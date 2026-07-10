"""Registro central de fontes ativas por modo (secao 10).

- demo: apenas fontes simuladas locais (funciona 100% offline);
- public: fontes demo + APIs publicas sem credencial (Mercado Livre);
- production: tudo, usando credenciais configuradas quando existirem.

A Amazon esta presente em TODOS os modos (regra da secao 9).
"""

from app.core.config import get_settings
from app.providers.amazon import AmazonAdapter
from app.providers.base import SourceAdapter
from app.providers.importadireto_demo import ImportaDiretoAdapter
from app.providers.megaloja_demo import MegaLojaAdapter
from app.providers.mercadolivre import MercadoLivreAdapter


def get_active_adapters() -> list[SourceAdapter]:
    mode = get_settings().app_mode
    adapters: list[SourceAdapter] = [AmazonAdapter(), MegaLojaAdapter(), ImportaDiretoAdapter()]
    if mode in ("public", "production"):
        adapters.append(MercadoLivreAdapter())
    return adapters
