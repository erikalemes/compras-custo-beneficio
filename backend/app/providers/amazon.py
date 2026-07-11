"""Adaptador da Amazon (secao 9 — fonte obrigatoria em toda pesquisa).

- **Modo demo**: usa o catalogo de demonstracao local, sempre marcado como
  simulado.
- **Modos reais (public/production)**: NUNCA serve dados simulados. A chamada
  real exige a Product Advertising API 5.0 (conta de associado aprovada +
  assinatura AWS SigV4, ainda nao certificada nesta versao). Sem isso a fonte
  fica listada como indisponivel, com o motivo exibido ao usuario.

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
        self.demo_mode = s.app_mode == "demo"
        self.has_credentials = bool(
            s.amazon_paapi_access_key and s.amazon_paapi_secret_key and s.amazon_paapi_partner_tag
        )
        self.simulated = self.demo_mode
        if not self.demo_mode:
            if not self.has_credentials:
                self.unavailable_reason = (
                    "A Amazon exige credenciais oficiais da Product Advertising API "
                    "(programa de associados). Fonte inativa até as credenciais serem configuradas."
                )
            else:
                # Credenciais presentes, mas a chamada assinada (SigV4) ainda nao
                # foi certificada nesta versao. Documentado em docs/fontes-de-dados.md.
                self.unavailable_reason = (
                    "Credenciais da PA-API detectadas, mas a integração assinada ainda não foi "
                    "certificada nesta versão. Nenhum dado simulado é exibido em modo real."
                )

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        if not self.demo_mode:
            return []  # modos reais nunca servem dados simulados
        offers = demo_offers_for_source(SOURCE_NAME)
        category_offers = [o for o in offers if o.category == query.category or query.category == "geral"]
        for o in category_offers:
            o.simulated = True
            o.source_kind = "demo"
        return category_offers
