"""Pontuacao de custo-beneficio 0-100, transparente e explicavel (secao 19).

Cada componente gera nota 0-100 + explicacao; a nota final e a soma ponderada
pelos pesos de configuracao (config.DEFAULT_WEIGHTS, ajustaveis por ambiente).
O prazo de entrega tem peso zero, mas gera alerta quando extremo/indefinido.
"""

import math

from app.core.config import get_settings
from app.schemas.models import HistoryStats, Offer, PriceBreakdown, RankedOffer, Reputation

_REPUTATION_SCORE = {
    "excelente": 100.0, "boa": 80.0, "regular": 55.0, "ruim": 25.0,
    "critica": 10.0, "insuficiente": 40.0, "nao_localizada": 40.0,
}
_HISTORY_SCORE = {
    "muito_baixo": 100.0, "baixo": 80.0, "na_media": 60.0,
    "alto": 30.0, "muito_alto": 10.0, "insuficiente": 50.0,
}
_REPUTATION_LABEL = {
    "excelente": "excelente", "boa": "boa", "regular": "regular", "ruim": "ruim",
    "critica": "crítica", "insuficiente": "insuficiente", "nao_localizada": "não localizada",
}


def _price_score(total: float, best_total: float) -> tuple[float, str]:
    if total <= 0 or best_total <= 0:
        return 0.0, "Preço total indisponível."
    ratio = best_total / total
    score = round(min(100.0, ratio * 100), 1)
    if total == best_total:
        return score, "Menor preço total entregue entre as ofertas válidas."
    pct = (total / best_total - 1) * 100
    return score, f"Preço total {pct:.0f}% acima da oferta mais barata válida."


def _reviews_score(offer: Offer) -> tuple[float, str]:
    r = offer.reviews
    if r.count == 0:
        return 30.0, "Sem avaliações localizadas; nota neutra baixa."
    confidence = min(1.0, math.log10(r.count + 1) / 3)  # ~1.0 com 1000+ avaliações
    base = r.average / 5 * 100
    score = round(base * (0.5 + 0.5 * confidence), 1)
    return score, (
        f"Nota {r.average:.1f}/5 em {r.count} avaliações "
        f"(confiança {'alta' if confidence > 0.8 else 'média' if confidence > 0.5 else 'baixa'})."
    )


def _reputation_score(store: Reputation, seller: Reputation) -> tuple[float, str]:
    s_store = _REPUTATION_SCORE[store.classification]
    if seller.classification in ("nao_localizada", "insuficiente"):
        score, txt = s_store, f"Loja com reputação {_REPUTATION_LABEL[store.classification]}."
    else:
        score = round(s_store * 0.6 + _REPUTATION_SCORE[seller.classification] * 0.4, 1)
        txt = (
            f"Loja {_REPUTATION_LABEL[store.classification]}, "
            f"vendedor {_REPUTATION_LABEL[seller.classification]}."
        )
    return score, txt


def _specs_score(desirable_met: list[str], total_desirable: int) -> tuple[float, str]:
    if total_desirable == 0:
        return 60.0, "Nenhum critério desejável informado; nota neutra."
    frac = len(desirable_met) / total_desirable
    score = round(40 + frac * 60, 1)  # atender tudo = 100; nada = 40
    return score, f"Atende {len(desirable_met)} de {total_desirable} critérios desejáveis."


def _history_score(history: HistoryStats) -> tuple[float, str]:
    score = _HISTORY_SCORE[history.classification]
    if history.classification == "insuficiente":
        return score, "Histórico de preços insuficiente; nota neutra."
    label = history.classification.replace("_", " ")
    return score, f"Preço atual classificado como '{label}' frente ao histórico."


def _warranty_score(offer: Offer) -> tuple[float, str]:
    w = offer.warranty
    if w.kind == "nacional":
        return (100.0, f"Garantia nacional de {w.months} meses.") if w.months >= 12 else (
            80.0, f"Garantia nacional de {w.months} meses.")
    if w.kind == "vendedor":
        return 60.0, f"Garantia do vendedor ({w.months} meses)."
    if w.kind == "internacional":
        return 40.0, "Garantia apenas internacional (pode exigir envio ao exterior)."
    if w.kind == "sem_garantia":
        return 15.0, "Sem garantia informada pelo vendedor."
    return 30.0, "Garantia não informada."


def _conditions_score(offer: Offer, breakdown: PriceBreakdown) -> tuple[float, str]:
    score = 40.0
    parts: list[str] = []
    if breakdown.pix_discount > 0:
        score += 15
        parts.append("desconto no Pix")
    if offer.installments_count >= 6 and offer.installments_interest_free:
        score += 15
        parts.append(f"{offer.installments_count}x sem juros")
    if breakdown.coupon_discount > 0:
        score += 10
        parts.append("cupom validado")
    if breakdown.cashback_later > 0:
        score += 10
        parts.append("cashback posterior")
    if offer.stock is None or offer.stock > 0:
        score += 10
    else:
        parts.append("sem estoque confirmado")
    return min(score, 100.0), ("Condições: " + ", ".join(parts) + ".") if parts else "Condições básicas."


def score_offer(
    ranked: RankedOffer, best_total: float, total_desirable: int
) -> RankedOffer:
    weights = get_settings().ranking_weights
    offer = ranked.offer

    components = {
        "preco_total": _price_score(ranked.price_breakdown.total_delivered, best_total),
        "avaliacoes": _reviews_score(offer),
        "reputacao": _reputation_score(offer.store_reputation, offer.seller_reputation),
        "especificacoes": _specs_score(ranked.desirable_met, total_desirable),
        "historico": _history_score(ranked.history),
        "garantia": _warranty_score(offer),
        "condicoes": _conditions_score(offer, ranked.price_breakdown),
    }
    ranked.score_breakdown = {k: v[0] for k, v in components.items()}
    ranked.score_explanations = {k: v[1] for k, v in components.items()}
    ranked.score = round(sum(weights[k] * v[0] for k, v in components.items()), 1)
    return ranked


def build_alerts(ranked: RankedOffer) -> None:
    """Alertas obrigatorios das secoes 13-18."""
    offer = ranked.offer
    alerts = ranked.alerts

    rep = offer.store_reputation.classification
    if rep in ("ruim", "critica"):
        alerts.append(
            "Esta empresa apresenta preço competitivo, mas possui reputação "
            f"{_REPUTATION_LABEL[rep]} e histórico de reclamações. Compre com cautela."
        )
    if rep == "nao_localizada":
        alerts.append(
            "Não foi localizada reputação suficiente. A avaliação foi baseada em outras evidências disponíveis."
        )
    if offer.warranty.kind == "internacional":
        alerts.append(
            "Este produto possui garantia internacional. Poderá ser necessário enviá-lo ao exterior para reparo."
        )
    if offer.origin == "importado":
        if offer.import_cost and offer.import_cost.risk_of_extra_charges:
            alerts.append("O valor final poderá sofrer cobranças adicionais durante o processo de importação.")
        else:
            alerts.append("Produto importado: confira impostos e prazos antes de comprar.")
    if offer.shipping_days is None:
        alerts.append("Prazo de entrega não informado pela loja.")
    elif offer.shipping_days > 30:
        alerts.append(f"Prazo de entrega longo: {offer.shipping_days} dias.")
    if offer.coupon and not offer.coupon.validated and offer.coupon.code:
        alerts.append(
            f"Cupom '{offer.coupon.code}' disponível, mas não foi possível validar as condições; "
            "não foi descontado do preço total."
        )
    if not offer.installments_interest_free and offer.installments_count > 0:
        alerts.append("O parcelamento desta oferta tem juros e não entrou no cálculo principal.")


def build_pros_cons(ranked: RankedOffer, best_total: float) -> None:
    offer = ranked.offer
    b = ranked.price_breakdown
    if b.total_delivered == best_total:
        ranked.advantages.append("Menor preço total entregue.")
    if offer.reviews.average >= 4.5 and offer.reviews.count >= 100:
        ranked.advantages.append(f"Muito bem avaliado ({offer.reviews.average:.1f}/5).")
    if offer.store_reputation.classification == "excelente":
        ranked.advantages.append("Loja com reputação excelente.")
    if offer.warranty.kind == "nacional" and offer.warranty.months >= 12:
        ranked.advantages.append(f"Garantia nacional de {offer.warranty.months} meses.")
    if b.cashback_later > 0:
        ranked.advantages.append(f"Cashback posterior estimado de R$ {b.cashback_later:.2f}.")
    if offer.installments_count >= 10 and offer.installments_interest_free:
        ranked.advantages.append(f"{offer.installments_count}x sem juros.")

    if offer.reviews.count < 20:
        ranked.disadvantages.append("Poucas avaliações para uma conclusão confiável.")
    if offer.store_reputation.classification in ("regular", "ruim", "critica"):
        ranked.disadvantages.append(
            f"Reputação da loja: {_REPUTATION_LABEL[offer.store_reputation.classification]}."
        )
    if b.shipping > 0:
        ranked.disadvantages.append(f"Frete de R$ {b.shipping:.2f} incluído no total.")
    if offer.reviews.recurring_issues:
        ranked.disadvantages.append("Problemas recorrentes: " + "; ".join(offer.reviews.recurring_issues[:2]) + ".")


def assign_labels(offers: list[RankedOffer]) -> tuple[dict[str, str], dict[str, list[float]]]:
    """Atribui as classificacoes da secao 20 e as faixas de preco da secao 21."""
    highlights: dict[str, str] = {}
    bands: dict[str, list[float]] = {}
    if not offers:
        return highlights, bands

    def tag(label: str, ranked: RankedOffer | None) -> None:
        if ranked is not None:
            highlights[label] = ranked.offer.offer_id
            ranked.labels.append(label)

    by_score = sorted(offers, key=lambda r: r.score, reverse=True)
    by_price = sorted(offers, key=lambda r: r.price_breakdown.total_delivered)

    tag("melhor_custo_beneficio", by_score[0])
    tag("menor_preco", by_price[0])

    reliable = [
        r for r in by_price
        if r.offer.store_reputation.classification in ("excelente", "boa")
        and r.offer.seller_reputation.classification not in ("ruim", "critica")
        and r.offer.reviews.count >= 20
    ]
    tag("menor_preco_confiavel", reliable[0] if reliable else None)

    rated = [r for r in offers if r.offer.reviews.count >= 20]
    tag("melhor_avaliado",
        max(rated, key=lambda r: (r.offer.reviews.average, r.offer.reviews.count)) if rated else None)

    def safety(r: RankedOffer) -> float:
        return (
            _REPUTATION_SCORE[r.offer.store_reputation.classification]
            + (30 if r.offer.warranty.kind == "nacional" else 0)
            + min(r.offer.reviews.count, 1000) / 100
        )
    tag("compra_mais_segura", max(offers, key=safety))

    imported = [r for r in by_score if r.offer.origin == "importado"]
    tag("melhor_importada", imported[0] if imported else None)

    # faixas de preco por distribuicao (tercis), somente com 3+ ofertas
    if len(offers) >= 3:
        prices = sorted(r.price_breakdown.total_delivered for r in offers)

        def tercile(frac: float) -> float:
            k = (len(prices) - 1) * frac
            lo, hi = int(k), min(int(k) + 1, len(prices) - 1)
            return prices[lo] + (prices[hi] - prices[lo]) * (k - lo)

        t1 = tercile(1 / 3)
        t2 = tercile(2 / 3)
        bands = {
            "economica": [prices[0], t1],
            "intermediaria": [t1, t2],
            "premium": [t2, prices[-1]],
        }
        for band, (lo, hi) in bands.items():
            candidates = [r for r in by_score if lo <= r.price_breakdown.total_delivered <= hi]
            tag(f"opcao_{band}", candidates[0] if candidates else None)
        for r in offers:
            p = r.price_breakdown.total_delivered
            r.price_band = "economica" if p <= t1 else "intermediaria" if p <= t2 else "premium"

    return highlights, bands
