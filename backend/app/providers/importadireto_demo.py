"""Adaptador demo de plataforma de importacao direta (secao 15)."""

from app.providers.base import SourceAdapter
from app.providers.demo_loader import demo_offers_for_source
from app.schemas.models import CepInfo, InterpretedQuery, Offer

SOURCE_NAME = "ImportaDireto (demo)"


class ImportaDiretoAdapter(SourceAdapter):
    name = SOURCE_NAME
    kind = "demo"
    simulated = True

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        offers = demo_offers_for_source(SOURCE_NAME)
        return [o for o in offers if o.category == query.category or query.category == "geral"]
