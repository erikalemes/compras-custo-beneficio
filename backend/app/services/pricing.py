"""Calculo do preco total entregue (secao 12).

Preco total imediato = preco + frete + impostos + taxas
                       - desconto no Pix - cupom valido.
Cashback NUNCA e abatido: aparece como beneficio posterior.
"""

from app.schemas.models import Offer, PriceBreakdown


def compute_price_breakdown(offer: Offer) -> PriceBreakdown:
    price = offer.price
    price_pix = offer.price_pix if offer.price_pix and offer.price_pix < price else price
    pix_discount = round(price - price_pix, 2)

    coupon_discount = 0.0
    if offer.coupon and offer.coupon.validated:
        base_for_coupon = price_pix
        if base_for_coupon >= offer.coupon.min_order_value:
            coupon_discount = min(offer.coupon.discount_value, base_for_coupon)

    shipping = offer.shipping_cost or 0.0
    taxes = offer.taxes or 0.0
    fees = offer.fees or 0.0
    if offer.import_cost:
        shipping = shipping or offer.import_cost.international_shipping
        taxes = taxes or (offer.import_cost.taxes_included + offer.import_cost.taxes_estimated)
        fees = fees or offer.import_cost.fees

    total = round(price_pix + shipping + taxes + fees - coupon_discount, 2)
    cashback_later = round(offer.cashback.value, 2) if offer.cashback else 0.0

    return PriceBreakdown(
        price=price,
        price_pix=price_pix,
        pix_discount=pix_discount,
        coupon_discount=coupon_discount,
        shipping=shipping,
        taxes=taxes,
        fees=fees,
        total_delivered=total,
        cashback_later=cashback_later,
    )
