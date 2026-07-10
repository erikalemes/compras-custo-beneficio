import pytest

from app.services.cep import lookup_cep, normalize_cep


def test_normalize_valid():
    assert normalize_cep("74000-000") == "74000-000"
    assert normalize_cep("74000000") == "74000-000"


def test_normalize_invalid():
    assert normalize_cep("abc") is None
    assert normalize_cep("1234") is None
    assert normalize_cep("74000-00") is None


@pytest.mark.asyncio
async def test_lookup_demo_goiania():
    info = await lookup_cep("74000-000")
    assert info.valid
    assert info.state == "GO"
    assert info.city == "Goiânia"


@pytest.mark.asyncio
async def test_lookup_demo_sp():
    info = await lookup_cep("01310-100")
    assert info.valid
    assert info.state == "SP"


@pytest.mark.asyncio
async def test_lookup_invalid_format():
    info = await lookup_cep("999")
    assert not info.valid
