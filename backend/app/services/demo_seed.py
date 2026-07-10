"""Semente do historico de precos no modo demonstracao (secao 22).

Gera ~26 semanas de observacoes ficticias (is_demo=True) para cada oferta do
catalogo demo, com variacao suave e deterministica (seed fixa), para que o
grafico e a classificacao de preco funcionem na primeira execucao.
"""

import logging
import random
from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.history.store import product_key
from app.models.orm import PriceHistoryRow
from app.providers.demo_loader import load_demo_offers
from app.services.pricing import compute_price_breakdown

logger = logging.getLogger(__name__)


def seed_demo_history() -> int:
    offers = load_demo_offers()
    if not offers:
        return 0
    first_key = product_key(offers[0])
    with SessionLocal() as db:
        existing = db.execute(
            select(func.count()).select_from(PriceHistoryRow).where(PriceHistoryRow.product_key == first_key)
        ).scalar_one()
        if existing:
            return 0

        rng = random.Random(42)
        count = 0
        now = datetime.utcnow()
        for offer in load_demo_offers():
            breakdown = compute_price_breakdown(offer)
            base = breakdown.total_delivered
            key = product_key(offer)
            drift = rng.uniform(-0.0015, 0.002)  # tendencia semanal suave
            for week in range(26, 0, -1):
                noise = rng.uniform(-0.05, 0.05)
                factor = 1 + drift * (26 - week) + noise
                total = round(base * max(0.7, factor), 2)
                db.add(
                    PriceHistoryRow(
                        product_key=key,
                        product_name=offer.product_name,
                        brand=offer.brand,
                        model=offer.model,
                        store=offer.store,
                        seller=offer.seller_name,
                        observed_at=now - timedelta(weeks=week, hours=rng.randint(0, 48)),
                        price=total,
                        price_pix=total,
                        shipping=breakdown.shipping,
                        taxes=breakdown.taxes,
                        fees=breakdown.fees,
                        total_price=total,
                        available=True,
                        cep_prefix="",
                        source=offer.source,
                        is_demo=True,
                    )
                )
                count += 1
        db.commit()
        logger.info("Histórico demo semeado: %d observações", count)
        return count
