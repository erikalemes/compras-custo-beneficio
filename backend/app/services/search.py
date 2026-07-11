"""Orquestracao da pesquisa (secao 32).

Fluxo: consulta fontes em paralelo -> normaliza -> valida 'novo' e entrega no
CEP -> calcula preco total -> completa reputacao -> consulta historico ->
aplica criterios obrigatorios -> pontua -> classifica -> grava historico.

As pesquisas rodam como tarefas asyncio; o estado fica em memoria e pode ser
consultado por /api/search/{id} (status + resultados).
"""

import asyncio
import logging
import uuid
from datetime import datetime

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.history.store import get_history_stats, product_key, record_observation
from app.models.orm import CollectionLogRow
from app.providers.amazon import SOURCE_NAME as AMAZON_NAME
from app.providers.registry import get_active_adapters
from app.ranking.scorer import assign_labels, build_alerts, build_pros_cons, score_offer
from app.reputation.adapter import enrich_reputation
from app.schemas.models import (
    CepInfo,
    CriterionKind,
    InterpretedQuery,
    Offer,
    RankedOffer,
    SearchResults,
    SourceStatus,
)
from app.services.equivalence import evaluate_offer
from app.services.pricing import compute_price_breakdown

logger = logging.getLogger(__name__)

# Armazenamento em memoria das pesquisas (sem dados pessoais persistidos).
_searches: dict[str, SearchResults] = {}
_MAX_SEARCHES = 200


def get_search(search_id: str) -> SearchResults | None:
    return _searches.get(search_id)


async def start_search(query: InterpretedQuery, cep: CepInfo) -> SearchResults:
    search_id = uuid.uuid4().hex[:12]
    adapters = get_active_adapters()
    result = SearchResults(
        search_id=search_id,
        status="executando",
        mode=get_settings().app_mode,
        query=query,
        cep=cep,
        sources=[
            SourceStatus(name=a.name, kind=a.kind, simulated=a.simulated, status="pendente")
            for a in adapters
        ],
    )
    if len(_searches) >= _MAX_SEARCHES:
        _searches.pop(next(iter(_searches)))
    _searches[search_id] = result
    asyncio.create_task(_run_search(result, query, cep))
    return result


async def _query_source(adapter, query: InterpretedQuery, cep: CepInfo, status: SourceStatus) -> list[Offer]:
    if adapter.unavailable_reason:
        # Fonte real sem credencial: nao consultamos nem inventamos dados.
        status.status = "erro"
        status.message = adapter.unavailable_reason
        return []
    status.status = "consultando"
    try:
        offers = await adapter.search(query, cep)
        status.offers_found = len(offers)
        status.status = "concluida" if offers else "sem_oferta"
        if not offers and adapter.name == AMAZON_NAME:
            status.message = (
                "A Amazon foi consultada, mas não foi localizada uma oferta compatível "
                "com os requisitos e com entrega para o CEP informado."
            )
        return offers
    except Exception as exc:  # noqa: BLE001 — uma fonte com erro nao derruba a pesquisa
        logger.warning("Fonte %s falhou: %s", adapter.name, exc)
        status.status = "erro"
        status.message = "Fonte temporariamente indisponível."
        return []


async def _run_search(result: SearchResults, query: InterpretedQuery, cep: CepInfo) -> None:
    settings = get_settings()
    adapters = get_active_adapters()
    status_by_name = {s.name: s for s in result.sources}

    try:
        offer_lists = await asyncio.gather(
            *[_query_source(a, query, cep, status_by_name[a.name]) for a in adapters]
        )
        all_offers = [o for lst in offer_lists for o in lst]

        amazon_status = status_by_name.get(AMAZON_NAME)
        result.amazon_consulted = amazon_status is not None and amazon_status.status != "pendente"
        if amazon_status and amazon_status.offers_found == 0:
            result.amazon_message = amazon_status.message or (
                "A Amazon foi consultada, mas não foi localizada uma oferta compatível "
                "com os requisitos e com entrega para o CEP informado."
            )

        total_desirable = sum(1 for c in query.criteria if c.kind == CriterionKind.DESEJAVEL)
        is_demo = settings.app_mode == "demo"

        validated: list[RankedOffer] = []
        unvalidated: list[RankedOffer] = []

        with SessionLocal() as db:
            for offer in all_offers:
                if offer.condition != "novo":
                    _discard(status_by_name, offer)
                    continue

                offer.store_reputation = await enrich_reputation(offer.store, offer.store_reputation)
                breakdown = compute_price_breakdown(offer)
                evaluation = evaluate_offer(query, offer, breakdown)
                history = get_history_stats(db, product_key(offer), breakdown.total_delivered)

                ranked = RankedOffer(
                    offer=offer,
                    price_breakdown=breakdown,
                    history=history,
                    mandatory_met=evaluation["mandatory_met"],
                    mandatory_unmet=evaluation["mandatory_unmet"],
                    desirable_met=evaluation["desirable_met"],
                    differences=evaluation["differences"],
                )

                if offer.delivery_available is not True:
                    # secao 4: sem confirmacao de entrega, fora do ranking principal
                    ranked.alerts.append("Oferta não validada para o CEP informado.")
                    unmet_delivery_only = [
                        u for u in evaluation["mandatory_unmet"] if "Entrega" not in u
                    ]
                    if not unmet_delivery_only:
                        unvalidated.append(ranked)
                    continue

                if not evaluation["passes"]:
                    _discard(status_by_name, offer)
                    continue

                record_observation(db, offer, breakdown, cep.cep, is_demo)
                validated.append(ranked)

            db.add(
                CollectionLogRow(
                    source=";".join(a.name for a in adapters),
                    source_kind=settings.app_mode,
                    status="concluida",
                    offers_found=len(validated),
                    message=f"{len(all_offers)} coletadas, {len(validated)} válidas",
                )
            )
            db.commit()

        best_total = min(
            (r.price_breakdown.total_delivered for r in validated), default=0.0
        )
        for ranked in validated:
            score_offer(ranked, best_total, total_desirable)
            build_alerts(ranked)
            build_pros_cons(ranked, best_total)
        for ranked in unvalidated:
            build_alerts(ranked)

        validated.sort(key=lambda r: r.score, reverse=True)
        highlights, bands = assign_labels(validated)

        result.offers = validated
        result.unvalidated_offers = unvalidated
        result.highlights = highlights
        result.price_bands = bands
        result.status = "concluida"
    except Exception:
        logger.exception("Falha na pesquisa %s", result.search_id)
        result.status = "erro"
        result.errors.append("Ocorreu um erro interno ao executar a pesquisa. Tente novamente.")


def _discard(status_by_name: dict[str, SourceStatus], offer: Offer) -> None:
    st = status_by_name.get(offer.source)
    if st:
        st.offers_discarded += 1


def utcnow() -> datetime:
    return datetime.utcnow()
