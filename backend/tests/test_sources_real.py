"""Modos reais: nenhuma fonte simulada, motivos claros para fontes inativas."""

import pytest

from app.core.config import get_settings
from app.providers.amazon import AmazonAdapter
from app.providers.registry import get_active_adapters
from app.providers.vtex import parse_specs, parse_warranty, product_to_offer
from app.schemas.models import CepInfo, SourceStatus
from app.services.interpreter import interpret
from app.services.search import _query_source


@pytest.fixture
def public_mode():
    settings = get_settings()
    original = settings.app_mode
    settings.app_mode = "public"
    yield
    settings.app_mode = original


def test_modo_real_sem_fontes_simuladas(public_mode):
    adapters = get_active_adapters()
    names = [a.name for a in adapters]
    assert "Amazon Brasil" in names  # Amazon sempre presente (secao 9)
    assert "Novo Mundo" in names
    assert not any("demo" in n.lower() for n in names)
    assert all(not a.simulated for a in adapters if not a.unavailable_reason)


def test_modo_demo_mantem_fontes_demo():
    names = [a.name for a in get_active_adapters()]
    assert "MegaLoja Brasil (demo)" in names


@pytest.mark.asyncio
async def test_amazon_real_sem_credencial_nao_retorna_dados(public_mode):
    adapter = AmazonAdapter()
    assert adapter.unavailable_reason  # motivo claro
    offers = await adapter.search(interpret("geladeira"), CepInfo(cep="74000-000", valid=True))
    assert offers == []  # nunca dados simulados em modo real


@pytest.mark.asyncio
async def test_fonte_indisponivel_nao_e_consultada(public_mode):
    adapter = AmazonAdapter()
    status = SourceStatus(name=adapter.name)
    offers = await _query_source(adapter, interpret("tv"), CepInfo(cep="74000-000", valid=True), status)
    assert offers == []
    assert status.status == "erro"
    assert "credenciais" in status.message


def test_mercadolivre_sem_token_fica_inativo(public_mode):
    from app.providers.mercadolivre import MercadoLivreAdapter

    adapter = MercadoLivreAdapter()
    assert "MELI_ACCESS_TOKEN" in adapter.unavailable_reason


# ------------------------------------------------------ mapeamento VTEX

_VTEX_PRODUCT = {
    "productName": "Geladeira Electrolux Frost Free 380L AutoSense Inverter 220V",
    "brand": "Electrolux",
    "link": "https://www.novomundo.com.br/geladeira-electrolux/p",
    "Garantia": ["12 Meses"],
    "Cor": ["Branco"],
    "items": [
        {
            "itemId": "3973770",
            "ean": "7896584066001",
            "referenceId": [{"Value": "IF43"}],
            "images": [{"imageUrl": "https://img.example/geladeira.jpg"}],
            "sellers": [
                {
                    "sellerId": "1",
                    "sellerName": "Novo Mundo",
                    "commertialOffer": {
                        "Price": 2999.0,
                        "ListPrice": 3299.0,
                        "IsAvailable": True,
                        "AvailableQuantity": 5,
                        "Installments": [
                            {"NumberOfInstallments": 10, "Value": 299.9, "InterestRate": 0.0},
                            {"NumberOfInstallments": 12, "Value": 275.0, "InterestRate": 1.5},
                        ],
                    },
                }
            ],
        }
    ],
}


def test_vtex_mapeia_produto_real():
    mapped = product_to_offer(_VTEX_PRODUCT, "Novo Mundo", "www.novomundo.com.br")
    assert mapped is not None
    offer, item_id, seller_id = mapped
    assert item_id == "3973770"
    assert seller_id == "1"
    assert offer.simulated is False
    assert offer.price == 3299.0  # ListPrice como preco normal
    assert offer.price_pix == 2999.0  # Price a vista
    assert offer.installments_count == 10  # so parcelamento SEM juros
    assert offer.specs["capacidade_litros"] == 380
    assert offer.specs["frost_free"] is True
    assert offer.specs["inverter"] is True
    assert offer.voltage == "220"
    assert offer.warranty.months == 12
    assert offer.ean == "7896584066001"
    assert offer.reviews.count == 0  # sem avaliacoes inventadas
    assert offer.store_reputation.classification == "nao_localizada"


def test_vtex_ignora_produto_indisponivel():
    product = {
        "productName": "TV 50",
        "items": [
            {"itemId": "1", "sellers": [{"sellerId": "1", "commertialOffer": {"Price": 0, "IsAvailable": False}}]}
        ],
    }
    assert product_to_offer(product, "Loja", "x.com.br") is None


def test_vtex_parse_specs_celular():
    specs, voltage = parse_specs(
        "Smartphone Motorola Moto G35 5G 256GB 4GB Ram Coral", {"Memória RAM": ["4 GB"]}
    )
    assert specs["armazenamento_gb"] == 256
    assert specs["ram_gb"] == 4
    assert voltage == ""


def test_vtex_parse_warranty_anos():
    w = parse_warranty({"Garantia": ["1 ano de garantia"]})
    assert w.months == 12
    assert w.kind == "nacional"
