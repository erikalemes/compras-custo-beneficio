"""Interface de adaptadores de reputacao (secao 18).

O Reclame Aqui nao oferece API publica aberta; a integracao real depende de
parceria/termos de uso. Por isso a arquitetura preve adaptadores plugaveis e
esta versao entrega um adaptador demo. As ofertas do catalogo de demonstracao
ja trazem reputacao embutida; este adaptador cobre fontes que nao trazem
(ex.: Mercado Livre) usando uma tabela local de lojas conhecidas.
"""

from abc import ABC, abstractmethod

from app.schemas.models import Reputation


class ReputationAdapter(ABC):
    name: str = "reputacao"

    @abstractmethod
    async def lookup(self, store: str, seller: str = "") -> Reputation:
        raise NotImplementedError


class DemoReputationAdapter(ReputationAdapter):
    name = "Base local de reputação (demo)"

    _KNOWN: dict[str, tuple[str, float]] = {
        "amazon brasil": ("excelente", 8.9),
        "mercado livre": ("boa", 7.8),
        "megaloja brasil (demo)": ("boa", 7.4),
        "importadireto (demo)": ("regular", 5.9),
    }

    async def lookup(self, store: str, seller: str = "") -> Reputation:
        key = store.strip().lower()
        if key in self._KNOWN:
            classification, score = self._KNOWN[key]
            return Reputation(
                classification=classification, score=score, source=self.name,
                notes="Reputação de demonstração, não coletada em tempo real.",
            )
        return Reputation(
            classification="nao_localizada",
            source=self.name,
            notes="Não foi localizada reputação suficiente. A avaliação foi baseada em outras evidências.",
        )


async def enrich_reputation(offer_store: str, current: Reputation) -> Reputation:
    """Completa a reputacao da loja quando a fonte nao trouxe nada."""
    if current.classification != "nao_localizada":
        return current
    return await DemoReputationAdapter().lookup(offer_store)
