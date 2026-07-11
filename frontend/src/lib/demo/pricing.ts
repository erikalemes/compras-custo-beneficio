// Preco total entregue (porta de backend/app/services/pricing.py).
// Cashback NUNCA e abatido do preco imediato.
import type { Offer, PriceBreakdown } from "../types";

type RawOffer = Offer & {
  taxes?: number;
  fees?: number;
  import_cost?: {
    international_shipping: number;
    taxes_included: number;
    taxes_estimated: number;
    fees: number;
    risk_of_extra_charges: boolean;
  } | null;
  coupon: (Offer["coupon"] & { min_order_value?: number }) | null;
};

export function computeBreakdown(offer: RawOffer): PriceBreakdown {
  const price = offer.price;
  const pricePix = offer.price_pix && offer.price_pix < price ? offer.price_pix : price;
  const pixDiscount = round2(price - pricePix);

  let couponDiscount = 0;
  if (offer.coupon?.validated) {
    const min = offer.coupon.min_order_value ?? 0;
    if (pricePix >= min) couponDiscount = Math.min(offer.coupon.discount_value, pricePix);
  }

  let shipping = offer.shipping_cost ?? 0;
  let taxes = offer.taxes ?? 0;
  let fees = offer.fees ?? 0;
  if (offer.import_cost) {
    shipping = shipping || offer.import_cost.international_shipping;
    taxes = taxes || offer.import_cost.taxes_included + offer.import_cost.taxes_estimated;
    fees = fees || offer.import_cost.fees;
  }

  return {
    price,
    price_pix: pricePix,
    pix_discount: pixDiscount,
    coupon_discount: couponDiscount,
    shipping,
    taxes,
    fees,
    total_delivered: round2(pricePix + shipping + taxes + fees - couponDiscount),
    cashback_later: round2(offer.cashback?.value ?? 0),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
