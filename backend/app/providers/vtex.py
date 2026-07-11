"""Adaptador generico para lojas na plataforma VTEX (ex.: Novo Mundo).

Usa APIs publicas do proprio storefront VTEX, sem credencial:
- busca:  GET  /api/catalog_system/pub/products/search/{termo}
- frete:  POST /api/checkout/pub/orderForms/simulation  (por CEP)

Dados reais, nunca inventados: quando a loja nao expoe avaliacoes ou
reputacao, os campos ficam vazios/nao localizados e o ranking trata como
neutro com aviso. Lojas VTEX adicionais podem ser ativadas por variavel de
ambiente VTEX_STORES ("Nome:dominio;Nome2:dominio2").
"""

import logging
import re
import unicodedata
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import get_settings
from app.providers.base import SourceAdapter
from app.schemas.models import CepInfo, InterpretedQuery, Offer, Reputation, ReviewSummary, Warranty

logger = logging.getLogger(__name__)

_UA = {"User-Agent": "Mozilla/5.0 (compatible; ComprasCustoBeneficio/0.1; +https://github.com/erikalemes/compras-custo-beneficio)"}
_MAX_RESULTS = 9
_MAX_FREIGHT_CHECKS = 8
_MAX_OFFERS = 12

# Termo canonico por categoria, usado para buscar EQUIVALENTES de outras
# marcas (secao 8) alem do termo literal do usuario.
_CATEGORY_TERMS = {
    "geladeira": "geladeira frost free",
    "celular": "smartphone",
    "notebook": "notebook",
    "tv": "smart tv",
    "ar_condicionado": "ar condicionado split",
    "impressora": "impressora multifuncional",
    "lavadora": "maquina de lavar",
}

_UNIT_TOKEN = re.compile(r"^\d|^(?:gb|tb|litros?|l|btus?|polegadas|pol|kg|quilos|v|volts|mah|mp)$")
_FILLER = {"ate", "novo", "nova", "com", "de", "e", "para", "o", "a", "r$", "no", "maximo"}


def simplify_term(text: str) -> str:
    """Remove numeros, unidades e palavras de preenchimento do termo de busca."""
    tokens = [t for t in re.split(r"[^a-z0-9$]+", _fold(text)) if t]
    kept = [t for t in tokens if t not in _FILLER and not _UNIT_TOKEN.match(t)]
    return " ".join(kept[:4])


def _fold(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _num(raw: str) -> float:
    s = raw.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_specs(name: str, fields: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Extrai especificacoes comparaveis do nome e dos campos VTEX da loja.

    Retorna (specs, voltagem). So preenche o que consegue confirmar.
    """
    folded = _fold(name)
    specs: dict[str, Any] = {}

    def field(*keys: str) -> str:
        for k in keys:
            v = fields.get(k)
            if isinstance(v, list) and v:
                return str(v[0])
            if isinstance(v, str) and v:
                return v
        return ""

    m = re.search(r"(\d{2,4})\s*l(?:itros)?\b", folded)
    if m:
        specs["capacidade_litros"] = int(m.group(1))
    m = re.search(r"(\d{1,2}[.,]?\d{3})\s*btus?", folded)
    if m:
        specs["btus"] = int(_num(m.group(1)))
    m = re.search(r"(\d+)\s*gb\s*(?:de\s*)?ram", folded) or re.search(r"ram\s*(\d+)\s*gb", folded)
    ram_field = field("Memória RAM", "Memoria RAM")
    if m:
        specs["ram_gb"] = int(m.group(1))
    elif ram_field:
        mf = re.search(r"(\d+)", ram_field)
        if mf:
            specs["ram_gb"] = int(mf.group(1))
    storage_field = field("Memória Interna", "Memoria Interna", "Armazenamento")
    m = re.search(r"(\d{2,4})\s*gb(?!\s*(?:de\s*)?ram)", folded)
    if storage_field and re.search(r"(\d+)", storage_field):
        specs["armazenamento_gb"] = int(re.search(r"(\d+)", storage_field).group(1))  # type: ignore[union-attr]
    elif m:
        specs["armazenamento_gb"] = int(m.group(1))
    m = re.search(r"ssd\s*(?:de\s*)?(\d{3,4})\s*gb|(\d{3,4})\s*gb\s*ssd", folded)
    if m:
        specs["ssd_gb"] = int(m.group(1) or m.group(2))
    m = re.search(r"(\d{2}(?:[.,]\d)?)\s*(?:\"|polegadas|pol\b)", folded)
    if m:
        specs["tela_polegadas"] = _num(m.group(1))
    m = re.search(r"(\d{1,2})\s*kg\b", folded)
    if m and ("lava" in folded or "secadora" in folded):
        specs["capacidade_kg"] = int(m.group(1))
    if "frost free" in folded or "frost-free" in folded:
        specs["frost_free"] = True
    if "inverter" in folded or "invertec" in folded:
        specs["inverter"] = True
    if "tanque de tinta" in folded or "ecotank" in folded or "mega tank" in folded:
        specs["tanque_de_tinta"] = True
    if "4k" in folded:
        specs["resolucao"] = "4K"
    cor = field("Cor")
    if cor:
        specs["cor"] = cor

    voltage = ""
    vf = _fold(field("Voltagem", "Tensão", "Tensao"))
    source_text = vf or folded
    if "bivolt" in source_text:
        voltage = "bivolt"
    else:
        mv = re.search(r"\b(110|127|220)\s*v?\b", source_text)
        if mv:
            voltage = mv.group(1)
    return specs, voltage


def parse_warranty(fields: dict[str, Any]) -> Warranty:
    raw = fields.get("Garantia")
    text = str(raw[0] if isinstance(raw, list) and raw else raw or "")
    m = re.search(r"(\d+)\s*mes", _fold(text))
    if m:
        # Loja brasileira: garantia de fabrica vale em territorio nacional.
        return Warranty(months=int(m.group(1)), kind="nacional", description=text)
    m = re.search(r"(\d+)\s*ano", _fold(text))
    if m:
        return Warranty(months=int(m.group(1)) * 12, kind="nacional", description=text)
    return Warranty(kind="nao_informada", description=text)


def product_to_offer(
    product: dict[str, Any], store_name: str, domain: str
) -> tuple[Offer, str, str] | None:
    """Mapeia um produto VTEX para (Offer, item_id, seller_id)."""
    items = product.get("items") or []
    if not items:
        return None
    item = items[0]
    sellers = item.get("sellers") or []
    if not sellers:
        return None
    seller = sellers[0]
    co = seller.get("commertialOffer") or {}
    price = float(co.get("Price") or 0)
    if price <= 0 or not co.get("IsAvailable"):
        return None

    interest_free = [
        i for i in (co.get("Installments") or []) if float(i.get("InterestRate") or 0) == 0
    ]
    best_inst = max(interest_free, key=lambda i: int(i.get("NumberOfInstallments") or 0), default=None)

    specs, voltage = parse_specs(product.get("productName", ""), product)
    images = item.get("images") or []

    offer = Offer(
        offer_id=f"vtex-{domain}-{item.get('itemId')}",
        product_name=product.get("productName", ""),
        brand=product.get("brand", ""),
        model=str((item.get("referenceId") or [{}])[0].get("Value", "") if item.get("referenceId") else ""),
        ean=str(item.get("ean") or ""),
        url=product.get("link", ""),
        image=str(images[0].get("imageUrl", "")) if images else "",
        condition="novo",
        specs=specs,
        voltage=voltage,
        price=float(co.get("ListPrice") or price),
        price_pix=price,
        installments_count=int(best_inst.get("NumberOfInstallments") or 0) if best_inst else 0,
        installment_value=float(best_inst.get("Value") or 0) if best_inst else 0.0,
        installments_interest_free=True,
        stock=int(co.get("AvailableQuantity") or 0),
        marketplace=store_name,
        store=store_name,
        seller_name=str(seller.get("sellerName") or store_name),
        fulfilled_by=store_name,
        seller_type="loja_propria" if seller.get("sellerId") == "1" else "marketplace_terceiro",
        origin="nacional",
        warranty=parse_warranty(product),
        reviews=ReviewSummary(confidence="baixa"),  # loja nao expoe avaliacoes publicamente
        store_reputation=Reputation(
            classification="nao_localizada",
            notes="Reputação não coletada automaticamente para esta loja.",
        ),
        seller_reputation=Reputation(classification="nao_localizada"),
        source=store_name,
        source_kind="api",
        collected_at=datetime.utcnow(),
        simulated=False,
    )
    return offer, str(item.get("itemId")), str(seller.get("sellerId") or "1")


def _parse_estimate(estimate: str) -> int | None:
    m = re.match(r"(\d+)bd", estimate or "")
    if m:
        return int(m.group(1))
    m = re.match(r"(\d+)d", estimate or "")
    return int(m.group(1)) if m else None


class VtexAdapter(SourceAdapter):
    kind = "api"
    simulated = False

    def __init__(self, store_name: str, domain: str) -> None:
        self.name = store_name
        self.domain = domain

    async def _freight(self, client: httpx.AsyncClient, item_id: str, seller_id: str, cep: str) -> dict:
        resp = await client.post(
            f"https://{self.domain}/api/checkout/pub/orderForms/simulation",
            json={
                "items": [{"id": item_id, "quantity": 1, "seller": seller_id}],
                "postalCode": cep,
                "country": "BRA",
            },
        )
        resp.raise_for_status()
        return resp.json()

    async def _fetch(self, client: httpx.AsyncClient, term: str) -> list[dict]:
        resp = await client.get(
            f"https://{self.domain}/api/catalog_system/pub/products/search/{quote(term[:100])}",
            params={"_from": 0, "_to": _MAX_RESULTS},
        )
        if resp.status_code not in (200, 206):
            resp.raise_for_status()
        return resp.json()

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        settings = get_settings()
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds * 2, headers=_UA) as client:
            # 1) termo literal; 2) termo simplificado; 3) termo da categoria
            # (equivalentes de outras marcas — os criterios filtram no nucleo).
            products = await self._fetch(client, query.original_text)
            if not products:
                simplified = simplify_term(query.original_text)
                if simplified and simplified != _fold(query.original_text):
                    products = await self._fetch(client, simplified)
            category_term = _CATEGORY_TERMS.get(query.category)
            if category_term:
                extra = await self._fetch(client, category_term)
                seen = {p.get("productId") for p in products}
                products += [p for p in extra if p.get("productId") not in seen]

            offers: list[Offer] = []
            for product in products:
                if len(offers) >= _MAX_OFFERS:
                    break
                mapped = product_to_offer(product, self.name, self.domain)
                if mapped is None:
                    continue
                offer, item_id, seller_id = mapped
                offer.delivery_available = None  # ate simular o frete
                if len(offers) < _MAX_FREIGHT_CHECKS:
                    try:
                        sim = await self._freight(client, str(item_id), str(seller_id), cep.cep)
                        slas = ((sim.get("logisticsInfo") or [{}])[0].get("slas")) or []
                        availability = [i.get("availability") for i in sim.get("items", [])]
                        if slas:
                            cheapest = min(slas, key=lambda s: float(s.get("price") or 0))
                            offer.delivery_available = True
                            offer.shipping_cost = round(float(cheapest.get("price") or 0) / 100, 2)
                            offer.shipping_days = _parse_estimate(str(cheapest.get("shippingEstimate", "")))
                        elif "cannotBeDelivered" in availability:
                            offer.delivery_available = False
                    except (httpx.HTTPError, ValueError, KeyError):
                        logger.info("Simulação de frete indisponível p/ item %s em %s", item_id, self.name)
                offers.append(offer)
            return offers
