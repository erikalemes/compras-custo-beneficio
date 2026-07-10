"""Carrega o catalogo de demonstracao (data/demo/products.json)."""

import json
import logging
from functools import lru_cache

from app.core.config import get_settings
from app.schemas.models import Offer

logger = logging.getLogger(__name__)


@lru_cache
def load_demo_offers() -> tuple[Offer, ...]:
    path = get_settings().demo_data_dir / "products.json"
    if not path.exists():
        logger.error("Arquivo de demonstração não encontrado: %s", path)
        return ()
    raw = json.loads(path.read_text(encoding="utf-8"))
    offers = tuple(Offer(**item) for item in raw["offers"])
    logger.info("Catálogo demo carregado: %d ofertas", len(offers))
    return offers


def demo_offers_for_source(source_name: str) -> list[Offer]:
    return [o.model_copy(deep=True) for o in load_demo_offers() if o.source == source_name]
