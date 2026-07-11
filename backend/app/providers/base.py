"""Arquitetura de adaptadores de fontes (secao 9).

Para adicionar uma nova loja/marketplace/API, crie uma subclasse de
SourceAdapter e registre-a em registry.py. O nucleo do sistema nao muda.
"""

from abc import ABC, abstractmethod

from app.schemas.models import CepInfo, InterpretedQuery, Offer


class SourceAdapter(ABC):
    """Contrato de toda fonte de pesquisa."""

    name: str = "fonte"
    kind: str = "demo"  # demo | api | feed
    simulated: bool = True
    # Quando preenchido, a fonte NAO e consultada e o motivo e mostrado ao
    # usuario (ex.: credencial ausente). Nos modos reais isso substitui o
    # antigo fallback para dados simulados.
    unavailable_reason: str = ""

    @abstractmethod
    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        """Busca ofertas candidatas. Nao deve filtrar por criterios do usuario;
        a filtragem e responsabilidade do nucleo (services/search.py)."""
        raise NotImplementedError

    def describe(self) -> dict:
        return {
            "name": self.name,
            "kind": self.kind,
            "simulated": self.simulated,
            "unavailable_reason": self.unavailable_reason,
        }
