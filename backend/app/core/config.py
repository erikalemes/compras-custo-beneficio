"""Configuracao central da aplicacao.

Tudo que e ajustavel (nome do produto, modo, pesos do ranking, tolerancias)
vive aqui e pode ser sobrescrito por variaveis de ambiente ou .env.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BASE_DIR.parent

# Pesos do ranking de custo-beneficio (soma = 1.0). Secao 19 do escopo.
DEFAULT_WEIGHTS = {
    "preco_total": 0.30,
    "avaliacoes": 0.20,
    "reputacao": 0.15,
    "especificacoes": 0.15,
    "historico": 0.10,
    "garantia": 0.05,
    "condicoes": 0.05,
}

# Tolerancia padrao para caracteristicas quantitativas (secao 8).
DEFAULT_TOLERANCE = 0.10


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Compras Custo-Benefício"
    app_mode: str = "demo"  # demo | public | production
    database_url: str = "sqlite:///./app.db"
    cors_origins: str = "http://localhost:3000"
    mask_cep_in_logs: bool = True

    # Credenciais opcionais de fontes reais
    amazon_paapi_access_key: str = ""
    amazon_paapi_secret_key: str = ""
    amazon_paapi_partner_tag: str = ""
    meli_access_token: str = ""
    anthropic_api_key: str = ""

    # Limites de seguranca
    max_query_length: int = 500
    http_timeout_seconds: float = 8.0
    rate_limit: str = "30/minute"

    ranking_weights: dict[str, float] = DEFAULT_WEIGHTS
    tolerance: float = DEFAULT_TOLERANCE
    demo_data_dir: Path = REPO_DIR / "data" / "demo"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
