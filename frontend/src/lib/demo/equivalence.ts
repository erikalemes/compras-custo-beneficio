// Criterios e equivalencia (porta de backend/app/services/equivalence.py).
import type { Criterion, InterpretedQuery, Offer, PriceBreakdown } from "../types";

function offerValue(offer: Offer, field: string, breakdown: PriceBreakdown | null): unknown {
  if (field === "condition") return offer.condition;
  if (field === "delivery_available") return offer.delivery_available;
  if (field === "total_delivered") return breakdown ? breakdown.total_delivered : offer.price;
  if (field === "warranty_months") return offer.warranty.months;
  if (field === "voltagem") return offer.voltage || offer.specs["voltagem"];
  if (field === "cor") return (offer as Offer & { color?: string }).color || offer.specs["cor"];
  return offer.specs[field];
}

export function checkCriterion(
  crit: Criterion, offer: Offer, breakdown: PriceBreakdown | null, tolerance: number,
): [boolean, string] {
  const value = offerValue(offer, crit.field, breakdown);
  if (value === null || value === undefined)
    return [false, `${crit.label}: informação não disponível na oferta.`];

  const tol = crit.tolerance ?? tolerance;

  if (crit.operator === "eq") {
    if (crit.field === "voltagem" && String(value).toLowerCase() === "bivolt") return [true, ""];
    const ok = String(value).toLowerCase() === String(crit.value).toLowerCase();
    return [ok, ok ? "" : `${crit.label}: oferta tem '${value}'.`];
  }
  if (crit.operator === "contains") {
    const ok = String(value).toLowerCase().includes(String(crit.value).toLowerCase());
    return [ok, ok ? "" : `${crit.label}: oferta tem '${value}'.`];
  }

  const num = Number(value);
  const target = Number(crit.value);
  if (Number.isNaN(num) || Number.isNaN(target))
    return [false, `${crit.label}: valor '${value}' não é comparável.`];

  if (crit.operator === "gte") {
    const ok = num >= target;
    return [ok, ok ? "" : `${crit.label}: oferta tem ${fmt(num)} ${crit.unit} (mínimo ${fmt(target)}).`];
  }
  if (crit.operator === "lte") {
    const ok = num <= target;
    return [ok, ok ? "" : `${crit.label}: oferta tem ${fmt(num)} ${crit.unit} (máximo ${fmt(target)}).`];
  }
  // approx
  const lo = target * (1 - tol);
  const hi = target * (1 + tol);
  const ok = num >= lo && num <= hi;
  if (ok && num !== target) {
    const pct = ((num - target) / target) * 100;
    const side = pct > 0 ? "acima" : "abaixo";
    return [
      true,
      `${crit.label}: o modelo tem ${fmt(num)} ${crit.unit}, ${Math.abs(pct).toFixed(0)}% ${side} do pedido, ` +
        `dentro da tolerância de ${(tol * 100).toFixed(0)}%.`,
    ];
  }
  return [ok, ok ? "" : `${crit.label}: ${fmt(num)} ${crit.unit} fora da faixa tolerada (${fmt(lo)} a ${fmt(hi)}).`];
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface Evaluation {
  mandatory_met: string[];
  mandatory_unmet: string[];
  desirable_met: string[];
  differences: string[];
  passes: boolean;
}

export function evaluateOffer(query: InterpretedQuery, offer: Offer, breakdown: PriceBreakdown): Evaluation {
  const mandatoryMet: string[] = [];
  const mandatoryUnmet: string[] = [];
  const desirableMet: string[] = [];
  const differences: string[] = [];

  for (const c of query.criteria) {
    if (c.kind === "indiferente") continue;
    const [ok, diff] = checkCriterion(c, offer, breakdown, query.tolerance);
    if (c.kind === "obrigatorio") {
      (ok ? mandatoryMet : mandatoryUnmet).push(c.label);
      if (diff) differences.push(diff);
    } else {
      if (ok) desirableMet.push(c.label);
      else if (diff && !diff.includes("não disponível")) differences.push(diff);
    }
  }

  if (!query.allow_imported && offer.origin === "importado")
    mandatoryUnmet.push("Produtos importados bloqueados pelo usuário");

  return {
    mandatory_met: mandatoryMet,
    mandatory_unmet: mandatoryUnmet,
    desirable_met: desirableMet,
    differences,
    passes: mandatoryUnmet.length === 0,
  };
}
