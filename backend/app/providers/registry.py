"""Registro central de fontes ativas por modo (secao 10).

- demo: apenas fontes simuladas locais (funciona 100% offline);
- public/production: SOMENTE fontes reais — nenhuma oferta simulada e
  apresentada nos modos reais. Fontes sem credencial ficam listadas como
  indisponiveis, com o motivo, em vez de servir dados ficticios.

A Amazon esta presente em TODOS os modos (regra da secao 9).
"""

from app.core.config import get_settings
from app.providers.amazon import AmazonAdapter
from app.providers.base import SourceAdapter
from app.providers.importadireto_demo import ImportaDiretoAdapter
from app.providers.megaloja_demo import MegaLojaAdapter
from app.providers.mercadolivre import MercadoLivreAdapter
from app.providers.vtex import VtexAdapter


def get_active_adapters() -> list[SourceAdapter]:
    settings = get_settings()
    if settings.app_mode == "demo":
        return [AmazonAdapter(), MegaLojaAdapter(), ImportaDiretoAdapter()]
    adapters: list[SourceAdapter] = [AmazonAdapter(), MercadoLivreAdapter()]
    for name, domain in settings.vtex_store_list:
        adapters.append(VtexAdapter(name, domain))
    return adapters
