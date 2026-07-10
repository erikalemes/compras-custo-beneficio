from datetime import datetime, timedelta

from app.core.database import SessionLocal
from app.history.store import get_history_stats
from app.models.orm import PriceHistoryRow


def _seed(db, key: str, prices: list[float]):
    now = datetime.utcnow()
    for i, p in enumerate(prices):
        db.add(PriceHistoryRow(
            product_key=key, product_name="Teste", total_price=p,
            observed_at=now - timedelta(days=len(prices) - i), is_demo=True,
        ))
    db.commit()


def test_historico_insuficiente():
    with SessionLocal() as db:
        _seed(db, "hist:poucos", [100.0, 110.0])
        stats = get_history_stats(db, "hist:poucos", 105.0)
    assert not stats.available
    assert stats.classification == "insuficiente"


def test_classificacao_muito_baixo():
    with SessionLocal() as db:
        _seed(db, "hist:mb", [100, 102, 104, 106, 108, 110, 112, 114, 116, 118])
        stats = get_history_stats(db, "hist:mb", 90.0)
    assert stats.available
    assert stats.classification == "muito_baixo"


def test_classificacao_muito_alto_e_estatisticas():
    prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]
    with SessionLocal() as db:
        _seed(db, "hist:ma", [float(p) for p in prices])
        stats = get_history_stats(db, "hist:ma", 150.0)
    assert stats.classification == "muito_alto"
    assert stats.minimum == 100.0
    assert stats.maximum == 109.0
    assert stats.observations == 10
    assert len(stats.series) == 10


def test_tendencia_queda():
    prices = [120, 118, 116, 114, 112, 110, 108, 106, 104, 100]
    with SessionLocal() as db:
        _seed(db, "hist:queda", [float(p) for p in prices])
        stats = get_history_stats(db, "hist:queda", 100.0)
    assert stats.trend == "queda"
