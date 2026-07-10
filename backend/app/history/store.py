"""Historico de precos dos ultimos 6 meses (secao 22).

Regra estatistica transparente:
- exige minimo de 5 observacoes; abaixo disso, classificacao 'insuficiente';
- compara o preco atual com percentis da serie (p10/p35/p65/p90);
- valores extremos sao amortecidos pelo uso de percentis (nao de media);
- tendencia = media do ultimo terco vs. primeiro terco da serie (+-3%).

Historico demo e gravado com is_demo=True e identificado na interface.
"""

import re
import statistics
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.orm import PriceHistoryRow
from app.schemas.models import HistoryStats, Offer, PriceBreakdown

MIN_OBSERVATIONS = 5
WINDOW_DAYS = 180


def product_key(offer: Offer) -> str:
    """Chave estavel de normalizacao (secao 30): EAN > MPN > marca+modelo."""
    if offer.ean:
        return f"ean:{offer.ean}"
    if offer.mpn:
        return f"mpn:{offer.mpn.lower()}"
    slug = re.sub(r"[^a-z0-9]+", "-", f"{offer.brand}-{offer.model}".lower()).strip("-")
    return f"bm:{slug}" if slug != "" else f"name:{re.sub(r'[^a-z0-9]+', '-', offer.product_name.lower())[:60]}"


def record_observation(
    db: Session, offer: Offer, breakdown: PriceBreakdown, cep: str, is_demo: bool
) -> None:
    db.add(
        PriceHistoryRow(
            product_key=product_key(offer),
            product_name=offer.product_name,
            brand=offer.brand,
            model=offer.model,
            store=offer.store,
            seller=offer.seller_name,
            observed_at=datetime.utcnow(),
            price=offer.price,
            price_pix=breakdown.price_pix,
            shipping=breakdown.shipping,
            taxes=breakdown.taxes,
            fees=breakdown.fees,
            total_price=breakdown.total_delivered,
            coupon_value=breakdown.coupon_discount,
            cashback_value=breakdown.cashback_later,
            available=offer.delivery_available is True,
            cep_prefix=cep.replace("-", "")[:5],
            source=offer.source,
            is_demo=is_demo,
        )
    )


def _percentile(sorted_values: list[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * pct
    lo, hi = int(k), min(int(k) + 1, len(sorted_values) - 1)
    frac = k - lo
    return sorted_values[lo] * (1 - frac) + sorted_values[hi] * frac


def get_history_stats(db: Session, key: str, current_total: float) -> HistoryStats:
    since = datetime.utcnow() - timedelta(days=WINDOW_DAYS)
    rows = db.execute(
        select(PriceHistoryRow)
        .where(PriceHistoryRow.product_key == key, PriceHistoryRow.observed_at >= since)
        .order_by(PriceHistoryRow.observed_at)
    ).scalars().all()

    if len(rows) < MIN_OBSERVATIONS:
        return HistoryStats(
            available=False,
            observations=len(rows),
            message=(
                f"Histórico insuficiente ({len(rows)} observações; mínimo {MIN_OBSERVATIONS}). "
                "O histórico real é construído a cada pesquisa."
            ),
        )

    totals = [r.total_price for r in rows]
    sorted_totals = sorted(totals)
    p10 = _percentile(sorted_totals, 0.10)
    p35 = _percentile(sorted_totals, 0.35)
    p65 = _percentile(sorted_totals, 0.65)
    p90 = _percentile(sorted_totals, 0.90)

    if current_total <= p10:
        classification = "muito_baixo"
    elif current_total <= p35:
        classification = "baixo"
    elif current_total <= p65:
        classification = "na_media"
    elif current_total <= p90:
        classification = "alto"
    else:
        classification = "muito_alto"

    third = max(1, len(totals) // 3)
    first_avg = statistics.mean(totals[:third])
    last_avg = statistics.mean(totals[-third:])
    if last_avg < first_avg * 0.97:
        trend = "queda"
    elif last_avg > first_avg * 1.03:
        trend = "alta"
    else:
        trend = "estavel"

    min_row = min(rows, key=lambda r: r.total_price)
    period_days = (rows[-1].observed_at - rows[0].observed_at).days
    previous = totals[-1] if totals else None
    variation = ((current_total - previous) / previous * 100) if previous else None

    return HistoryStats(
        available=True,
        is_demo=all(r.is_demo for r in rows),
        observations=len(rows),
        period_days=period_days,
        current=current_total,
        previous=previous,
        minimum=sorted_totals[0],
        maximum=sorted_totals[-1],
        average=round(statistics.mean(totals), 2),
        median=round(statistics.median(totals), 2),
        variation_pct=round(variation, 2) if variation is not None else None,
        min_date=min_row.observed_at.date().isoformat(),
        trend=trend,
        classification=classification,
        series=[
            {"date": r.observed_at.date().isoformat(), "total_price": r.total_price} for r in rows
        ],
        message="Histórico de demonstração (dados fictícios)." if all(r.is_demo for r in rows) else "",
    )
