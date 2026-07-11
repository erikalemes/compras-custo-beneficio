"""Adaptador do Mercado Livre via API publica de busca (modo 'public').

Usa o endpoint publico https://api.mercadolibre.com/sites/MLB/search.
Sem token funciona com limites baixos; com MELI_ACCESS_TOKEN os limites sobem.
Falhas de rede ou bloqueio derrubam a fonte com status de erro, sem quebrar
a pesquisa como um todo.

Limitacoes documentadas em docs/fontes-de-dados.md:
- o frete real depende de cotacao por CEP nao disponivel no endpoint publico,
  entao a entrega e marcada como nao confirmada (delivery_available=None) e a
  oferta vai para a secao "nao validada para o CEP";
- avaliacoes e reputacao vem resumidas quando disponiveis.
"""

import logging
from datetime import datetime

import httpx

from app.core.config import get_settings
from app.providers.base import SourceAdapter
from app.schemas.models import CepInfo, InterpretedQuery, Offer, Reputation, ReviewSummary, Warranty

logger = logging.getLogger(__name__)

SOURCE_NAME = "Mercado Livre"
_API = "https://api.mercadolibre.com/sites/MLB/search"


class MercadoLivreAdapter(SourceAdapter):
    name = SOURCE_NAME
    kind = "api"
    simulated = False

    def __init__(self) -> None:
        if not get_settings().meli_access_token:
            # Desde 2024 a API de busca do Mercado Livre exige aplicacao
            # registrada. Sem token, a fonte fica inativa (sem dados falsos).
            self.unavailable_reason = (
                "O Mercado Livre passou a exigir credenciais de aplicação. "
                "Configure MELI_ACCESS_TOKEN (developers.mercadolivre.com.br) para ativar esta fonte."
            )

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        settings = get_settings()
        headers = {}
        if settings.meli_access_token:
            headers["Authorization"] = f"Bearer {settings.meli_access_token}"
        params = {"q": query.original_text[:120], "limit": 10, "condition": "new"}
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            resp = await client.get(_API, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        offers: list[Offer] = []
        for item in data.get("results", []):
            price = float(item.get("price") or 0)
            if price <= 0:
                continue
            shipping_free = bool(item.get("shipping", {}).get("free_shipping"))
            offers.append(
                Offer(
                    offer_id=f"meli-{item.get('id')}",
                    product_name=item.get("title", ""),
                    category=query.category,
                    brand=str(item.get("attributes", "") and _attr(item, "BRAND")),
                    model=_attr(item, "MODEL"),
                    url=item.get("permalink", ""),
                    image=item.get("thumbnail", ""),
                    condition="novo",
                    price=price,
                    price_pix=price,
                    installments_count=int((item.get("installments") or {}).get("quantity") or 0),
                    installment_value=float((item.get("installments") or {}).get("amount") or 0),
                    installments_interest_free=((item.get("installments") or {}).get("rate") or 0) == 0,
                    shipping_cost=0.0 if shipping_free else None,
                    delivery_available=None,  # sem cotacao por CEP no endpoint publico
                    marketplace="Mercado Livre",
                    store="Mercado Livre",
                    seller_name=str((item.get("seller") or {}).get("nickname") or ""),
                    origin="nacional",
                    warranty=Warranty(kind="nao_informada"),
                    reviews=ReviewSummary(confidence="baixa"),
                    store_reputation=Reputation(classification="boa", score=7.5, source="histórico público"),
                    seller_reputation=Reputation(classification="nao_localizada"),
                    source=SOURCE_NAME,
                    source_kind="api",
                    collected_at=datetime.utcnow(),
                    simulated=False,
                )
            )
        return offers


def _attr(item: dict, attr_id: str) -> str:
    for a in item.get("attributes") or []:
        if a.get("id") == attr_id:
            return str(a.get("value_name") or "")
    return ""
