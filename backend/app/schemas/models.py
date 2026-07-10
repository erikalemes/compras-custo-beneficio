"""Esquemas Pydantic compartilhados entre API, servicos e adaptadores."""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- criterios


class CriterionKind(StrEnum):
    OBRIGATORIO = "obrigatorio"
    DESEJAVEL = "desejavel"
    INDIFERENTE = "indiferente"


class Criterion(BaseModel):
    id: str
    label: str
    field: str  # campo da spec que o criterio avalia (ex.: capacidade_litros)
    operator: Literal["eq", "gte", "lte", "approx", "contains"] = "eq"
    value: Any = None
    unit: str = ""
    kind: CriterionKind = CriterionKind.DESEJAVEL
    tolerance: float | None = None  # sobrescreve a tolerancia global se definida


class InterpretedQuery(BaseModel):
    original_text: str
    category: str = "geral"
    category_label: str = "Produto geral"
    criteria: list[Criterion] = []
    max_price: float | None = None
    allow_imported: bool = True
    tolerance: float = 0.10
    notes: list[str] = []


class CepInfo(BaseModel):
    cep: str
    valid: bool
    city: str = ""
    state: str = ""
    message: str = ""


# ---------------------------------------------------------------- oferta


class Coupon(BaseModel):
    code: str = ""
    discount_value: float = 0.0
    rules: str = ""
    min_order_value: float = 0.0
    validated: bool = False  # so entra no preco total se True (secao 12)


class Cashback(BaseModel):
    value: float = 0.0
    percent: float = 0.0
    platform: str = ""
    deadline_days: int = 0
    rules: str = ""
    payout_method: str = ""


class Warranty(BaseModel):
    months: int = 0
    kind: Literal["nacional", "internacional", "vendedor", "sem_garantia", "nao_informada"] = "nao_informada"
    description: str = ""


class ReviewSummary(BaseModel):
    average: float = 0.0
    count: int = 0
    distribution: dict[str, int] = {}  # "5": 120, "4": 30 ...
    verified_pct: float = 0.0
    recent_average: float = 0.0
    highlights: list[str] = []
    complaints: list[str] = []
    recurring_issues: list[str] = []
    confidence: Literal["alta", "media", "baixa"] = "baixa"


class Reputation(BaseModel):
    classification: Literal[
        "excelente", "boa", "regular", "ruim", "critica", "insuficiente", "nao_localizada"
    ] = "nao_localizada"
    score: float = 0.0  # 0-10
    complaints_total: int = 0
    response_rate: float = 0.0
    solution_rate: float = 0.0
    source: str = ""
    notes: str = ""


class ImportCost(BaseModel):
    product_price: float = 0.0
    international_shipping: float = 0.0
    taxes_included: float = 0.0
    taxes_estimated: float = 0.0
    fees: float = 0.0
    risk_of_extra_charges: bool = False


class Offer(BaseModel):
    # identificacao do produto
    offer_id: str
    product_name: str
    category: str = "geral"
    brand: str = ""
    model: str = ""
    mpn: str = ""  # codigo do fabricante
    ean: str = ""
    url: str = ""
    image: str = ""
    condition: Literal["novo", "usado", "recondicionado"] = "novo"
    specs: dict[str, Any] = {}
    voltage: str = ""
    color: str = ""
    dimensions: str = ""
    weight_kg: float = 0.0

    # precos e condicoes
    price: float = 0.0
    price_pix: float = 0.0
    installments_count: int = 0
    installment_value: float = 0.0
    installments_interest_free: bool = True
    coupon: Coupon | None = None
    cashback: Cashback | None = None
    shipping_cost: float | None = None
    shipping_days: int | None = None
    delivery_available: bool | None = None  # None = nao foi possivel confirmar
    stock: int | None = None
    taxes: float = 0.0
    fees: float = 0.0

    # loja e vendedor
    marketplace: str = ""
    store: str = ""
    seller_name: str = ""
    fulfilled_by: str = ""
    seller_type: str = ""  # ex.: vendido_entregue_amazon, vendido_terceiro_entregue_amazon...
    origin: Literal["nacional", "importado"] = "nacional"
    import_cost: ImportCost | None = None
    warranty: Warranty = Warranty()

    # confianca
    reviews: ReviewSummary = ReviewSummary()
    store_reputation: Reputation = Reputation()
    seller_reputation: Reputation = Reputation()

    # metadados
    source: str = ""
    source_kind: str = "demo"  # demo | api | feed
    collected_at: datetime = Field(default_factory=datetime.utcnow)
    simulated: bool = True  # dados simulados claramente identificados


# ---------------------------------------------------------------- avaliacao


class PriceBreakdown(BaseModel):
    price: float
    price_pix: float
    pix_discount: float
    coupon_discount: float
    shipping: float
    taxes: float
    fees: float
    total_delivered: float  # preco total imediato (secao 12)
    cashback_later: float  # beneficio posterior, NUNCA abatido


class HistoryStats(BaseModel):
    available: bool = False
    is_demo: bool = False
    observations: int = 0
    period_days: int = 0
    current: float = 0.0
    previous: float | None = None
    minimum: float = 0.0
    maximum: float = 0.0
    average: float = 0.0
    median: float = 0.0
    variation_pct: float | None = None
    min_date: str | None = None
    trend: Literal["queda", "estavel", "alta", "indefinida"] = "indefinida"
    classification: Literal[
        "muito_baixo", "baixo", "na_media", "alto", "muito_alto", "insuficiente"
    ] = "insuficiente"
    series: list[dict[str, Any]] = []  # [{date, total_price}]
    message: str = ""


class RankedOffer(BaseModel):
    offer: Offer
    score: float = 0.0
    score_breakdown: dict[str, float] = {}
    score_explanations: dict[str, str] = {}
    price_breakdown: PriceBreakdown
    history: HistoryStats = HistoryStats()
    mandatory_met: list[str] = []
    mandatory_unmet: list[str] = []
    desirable_met: list[str] = []
    differences: list[str] = []  # diferencas vs. o produto pedido (secao 8)
    advantages: list[str] = []
    disadvantages: list[str] = []
    alerts: list[str] = []
    labels: list[str] = []  # classificacoes (melhor custo-beneficio etc.)
    price_band: Literal["economica", "intermediaria", "premium", ""] = ""


class SourceStatus(BaseModel):
    name: str
    kind: str = "demo"
    status: Literal["pendente", "consultando", "concluida", "erro", "sem_oferta"] = "pendente"
    offers_found: int = 0
    offers_discarded: int = 0
    message: str = ""
    simulated: bool = True


class SearchResults(BaseModel):
    search_id: str
    status: Literal["executando", "concluida", "erro"] = "executando"
    mode: str = "demo"
    query: InterpretedQuery
    cep: CepInfo
    sources: list[SourceStatus] = []
    amazon_consulted: bool = False
    amazon_message: str = ""
    offers: list[RankedOffer] = []
    unvalidated_offers: list[RankedOffer] = []  # sem confirmacao de entrega p/ o CEP
    highlights: dict[str, str] = {}  # classificacao -> offer_id
    price_bands: dict[str, list[float]] = {}  # faixa -> [min, max]
    errors: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------- requests


class InterpretRequest(BaseModel):
    text: str = Field(min_length=3, max_length=500)
    cep: str = Field(min_length=8, max_length=9)
    max_price: float | None = Field(default=None, ge=0)
    allow_imported: bool = True


class SearchRequest(BaseModel):
    query: InterpretedQuery
    cep: str = Field(min_length=8, max_length=9)
