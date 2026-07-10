from app.schemas.models import Criterion, CriterionKind, Offer
from app.services.equivalence import check_criterion, evaluate_offer
from app.services.interpreter import interpret
from app.services.pricing import compute_price_breakdown


def _offer(**kw) -> Offer:
    base = {"offer_id": "t1", "product_name": "Produto Teste", "delivery_available": True}
    base.update(kw)
    return Offer(**base)


def _approx(value):
    return Criterion(id="cap", label="Capacidade", field="capacidade_litros",
                     operator="approx", value=value, unit="L", kind=CriterionKind.OBRIGATORIO)


def test_tolerancia_10pct_dentro():
    offer = _offer(specs={"capacidade_litros": 431})
    ok, diff = check_criterion(_approx(450), offer, None, 0.10)
    assert ok
    assert "dentro da tolerância" in diff


def test_tolerancia_10pct_fora():
    offer = _offer(specs={"capacidade_litros": 390})
    ok, _ = check_criterion(_approx(450), offer, None, 0.10)
    assert not ok  # 390 < 405


def test_bivolt_atende_voltagem():
    crit = Criterion(id="v", label="Voltagem 220 V", field="voltagem", operator="eq",
                     value="220", kind=CriterionKind.OBRIGATORIO)
    offer = _offer(voltage="bivolt")
    ok, _ = check_criterion(crit, offer, None, 0.10)
    assert ok


def test_importado_bloqueado():
    q = interpret("geladeira frost free 450 litros", allow_imported=False)
    offer = _offer(origin="importado", specs={"capacidade_litros": 450, "frost_free": True})
    result = evaluate_offer(q, offer, compute_price_breakdown(offer))
    assert not result["passes"]
    assert any("importados" in u.lower() for u in result["mandatory_unmet"])


def test_preco_maximo_elimina():
    q = interpret("geladeira frost free 450 litros até R$ 4.000")
    offer = _offer(price=4500.0, price_pix=4500.0, specs={"capacidade_litros": 450, "frost_free": True})
    result = evaluate_offer(q, offer, compute_price_breakdown(offer))
    assert not result["passes"]
