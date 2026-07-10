"""Tabelas persistidas: historico de precos e registro de coletas."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PriceHistoryRow(Base):
    """Uma observacao de preco de uma oferta em uma data (secao 22)."""

    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_key: Mapped[str] = mapped_column(String(200), index=True)  # chave normalizada do produto
    product_name: Mapped[str] = mapped_column(String(300))
    brand: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    store: Mapped[str] = mapped_column(String(100), default="")
    seller: Mapped[str] = mapped_column(String(100), default="")
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    price_pix: Mapped[float] = mapped_column(Float, default=0.0)
    shipping: Mapped[float] = mapped_column(Float, default=0.0)
    taxes: Mapped[float] = mapped_column(Float, default=0.0)
    fees: Mapped[float] = mapped_column(Float, default=0.0)
    total_price: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    coupon_value: Mapped[float] = mapped_column(Float, default=0.0)
    cashback_value: Mapped[float] = mapped_column(Float, default=0.0)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    cep_prefix: Mapped[str] = mapped_column(String(5), default="")  # nunca o CEP completo
    source: Mapped[str] = mapped_column(String(100), default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class CollectionLogRow(Base):
    """Registro de cada consulta a uma fonte (secao 30, CollectionLog)."""

    __tablename__ = "collection_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(100))
    source_kind: Mapped[str] = mapped_column(String(30), default="demo")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(30), default="concluida")
    offers_found: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(500), default="")
