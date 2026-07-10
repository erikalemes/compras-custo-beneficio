"""Validacao e localizacao de CEP (secao 4).

Em modo demo usa uma tabela local de prefixos (offline, sem rede).
Nos demais modos consulta o ViaCEP e cai na tabela local se a rede falhar.
"""

import logging
import re

import httpx

from app.core.config import get_settings
from app.schemas.models import CepInfo

logger = logging.getLogger(__name__)

_CEP_RE = re.compile(r"^(\d{5})-?(\d{3})$")

# Faixas de CEP por estado (prefixo de 2 digitos) — fonte: Correios, faixas oficiais.
_STATE_BY_PREFIX: list[tuple[int, int, str]] = [
    (1, 19, "SP"), (20, 28, "RJ"), (29, 29, "ES"), (30, 39, "MG"),
    (40, 48, "BA"), (49, 49, "SE"), (50, 56, "PE"), (57, 57, "AL"),
    (58, 58, "PB"), (59, 59, "RN"), (60, 63, "CE"), (64, 64, "PI"),
    (65, 65, "MA"), (66, 68, "PA"), (69, 69, "AM"), (70, 73, "DF"),
    (74, 76, "GO"), (77, 77, "TO"), (78, 78, "MT"), (79, 79, "MS"),
    (80, 87, "PR"), (88, 89, "SC"), (90, 99, "RS"),
]

# Capitais e cidades conhecidas por prefixo (usado no modo offline/demo).
_CITY_BY_PREFIX: dict[str, str] = {
    "01": "São Paulo", "02": "São Paulo", "03": "São Paulo", "04": "São Paulo", "05": "São Paulo",
    "08": "São Paulo", "13": "Campinas", "20": "Rio de Janeiro", "21": "Rio de Janeiro",
    "22": "Rio de Janeiro", "23": "Rio de Janeiro", "29": "Vitória", "30": "Belo Horizonte",
    "31": "Belo Horizonte", "40": "Salvador", "41": "Salvador", "50": "Recife", "51": "Recife",
    "52": "Recife", "57": "Maceió", "58": "João Pessoa", "59": "Natal", "60": "Fortaleza",
    "64": "Teresina", "65": "São Luís", "66": "Belém", "69": "Manaus", "70": "Brasília",
    "71": "Brasília", "72": "Brasília", "74": "Goiânia", "77": "Palmas", "78": "Cuiabá",
    "79": "Campo Grande", "80": "Curitiba", "81": "Curitiba", "82": "Curitiba",
    "88": "Florianópolis", "90": "Porto Alegre", "91": "Porto Alegre",
}


def normalize_cep(cep: str) -> str | None:
    m = _CEP_RE.match(cep.strip())
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}"


def _offline_lookup(cep: str) -> CepInfo:
    prefix2 = int(cep[:2])
    state = next((uf for lo, hi, uf in _STATE_BY_PREFIX if lo <= prefix2 <= hi), "")
    if not state:
        return CepInfo(cep=cep, valid=False, message="CEP fora das faixas brasileiras conhecidas.")
    city = _CITY_BY_PREFIX.get(cep[:2], "")
    msg = "" if city else "Cidade não identificada na base offline; confira o estado."
    return CepInfo(cep=cep, valid=True, city=city, state=state, message=msg)


async def lookup_cep(raw_cep: str) -> CepInfo:
    cep = normalize_cep(raw_cep)
    if cep is None:
        return CepInfo(cep=raw_cep, valid=False, message="Formato inválido. Use 00000-000.")

    settings = get_settings()
    if settings.app_mode == "demo":
        return _offline_lookup(cep)

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            resp = await client.get(f"https://viacep.com.br/ws/{cep.replace('-', '')}/json/")
            resp.raise_for_status()
            data = resp.json()
        if data.get("erro"):
            return CepInfo(cep=cep, valid=False, message="CEP não encontrado na base dos Correios.")
        return CepInfo(cep=cep, valid=True, city=data.get("localidade", ""), state=data.get("uf", ""))
    except httpx.HTTPError:
        logger.warning("ViaCEP indisponível; usando base offline")
        info = _offline_lookup(cep)
        if info.valid and not info.message:
            info.message = "Serviço de CEP indisponível; localização estimada pela faixa do CEP."
        return info
