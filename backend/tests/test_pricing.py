from app.schemas.models import Cashback, Coupon, ImportCost, Offer
from app.services.pricing import compute_price_breakdown


def _offer(**kw) -> Offer:
    base = {"offer_id": "t1", "product_name": "Produto Teste"}
    base.update(kw)
    return Offer(**base)


def test_pix_discount():
    b = compute_price_breakdown(_offer(price=1000.0, price_pix=950.0, shipping_cost=50.0))
    assert b.pix_discount == 50.0
    assert b.total_delivered == 1000.0  # 950 + 50 frete


def test_cupom_validado_descontado():
    o = _offer(
        price=1000.0, price_pix=1000.0, shipping_cost=0.0,
        coupon=Coupon(code="X", discount_value=100.0, min_order_value=500.0, validated=True),
    )
    assert compute_price_breakdown(o).total_delivered == 900.0


def test_cupom_nao_validado_ignorado():
    o = _offer(
        price=1000.0, price_pix=1000.0,
        coupon=Coupon(code="X", discount_value=100.0, validated=False),
    )
    assert compute_price_breakdown(o).total_delivered == 1000.0


def test_cupom_valor_minimo_nao_atingido():
    o = _offer(
        price=400.0, price_pix=400.0,
        coupon=Coupon(code="X", discount_value=100.0, min_order_value=500.0, validated=True),
    )
    assert compute_price_breakdown(o).total_delivered == 400.0


def test_cashback_nao_abatido():
    o = _offer(price=1000.0, price_pix=1000.0, cashback=Cashback(value=120.0, platform="Demo"))
    b = compute_price_breakdown(o)
    assert b.total_delivered == 1000.0
    assert b.cashback_later == 120.0


def test_importado_com_impostos():
    o = _offer(
        price=2000.0, price_pix=2000.0,
        import_cost=ImportCost(product_price=2000.0, international_shipping=100.0,
                               taxes_included=300.0, taxes_estimated=50.0, fees=25.0),
    )
    b = compute_price_breakdown(o)
    assert b.shipping == 100.0
    assert b.taxes == 350.0
    assert b.fees == 25.0
    assert b.total_delivered == 2475.0
