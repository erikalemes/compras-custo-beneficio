"""Adaptador da Amazon (secao 9 — fonte obrigatoria em toda pesquisa).

Dois modos:

1. **Simulado (padrao)** — usa o catalogo de demonstracao. Ativo sempre que as
   credenciais da Product Advertising API (PA-API 5.0) nao estao configuradas.
2. **Real (PA-API 5.0)** — exige AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY
   e AMAZON_PAAPI_PARTNER_TAG (conta aprovada no programa de associados).
   A assinatura AWS SigV4 e as cotas da PA-API estao fora do alcance desta
   versao; quando as credenciais existem, o adaptador registra a limitacao e
   cai no modo simulado com aviso explicito, em vez de falhar a pesquisa.

O adaptador diferencia (via campo seller_type):
- vendido_entregue_amazon
- vendido_terceiro_entregue_amazon
- vendido_entregue_terceiro
e marca origem nacional/importada em cada oferta.
"""

import logging

from app.core.config import get_settings
from app.providers.base import SourceAdapter
from app.providers.demo_loader import demo_offers_for_source
from app.schemas.models import CepInfo, InterpretedQuery, Offer

logger = logging.getLogger(__name__)

SOURCE_NAME = "Amazon Brasil"


class AmazonAdapter(SourceAdapter):
    name = SOURCE_NAME
    kind = "api"

    def __init__(self) -> None:
        s = get_settings()
        self.has_credentials = bool(
            s.amazon_paapi_access_key and s.amazon_paapi_secret_key and s.amazon_paapi_partner_tag
        )
        self.simulated = not self.has_credentials or s.app_mode == "demo"
        if not self.simulated:
            # Credenciais presentes, mas a integracao PA-API real ainda nao foi
            # certificada nesta versao. Documentado em docs/fontes-de-dados.md.
            logger.warning(
                "PA-API: credenciais detectadas, mas a chamada assinada (SigV4) ainda nao esta "
                "implementada nesta versao. Usando catalogo simulado com aviso."
            )
            self.simulated = True

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        offers = demo_offers_for_source(SOURCE_NAME)
        category_offers = [o for o in offers if o.category == query.category or query.category == "geral"]
        for o in category_offers:
            o.simulated = True
            o.source_kind = "demo"
        return category_offers
