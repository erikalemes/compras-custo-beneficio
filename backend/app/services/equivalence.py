"""Verificacao de criterios e equivalencia de produtos (secoes 7 e 8)."""

from typing import Any

from app.schemas.models import Criterion, CriterionKind, InterpretedQuery, Offer, PriceBreakdown


def _offer_value(offer: Offer, field: str, breakdown: PriceBreakdown | None) -> Any:
    if field == "condition":
        return offer.condition
    if field == "delivery_available":
        return offer.delivery_available
    if field == "total_delivered":
        return breakdown.total_delivered if breakdown else offer.price
    if field == "warranty_months":
        return offer.warranty.months
    if field == "voltagem":
        return offer.voltage or offer.specs.get("voltagem")
    if field == "cor":
        return offer.color or offer.specs.get("cor")
    return offer.specs.get(field)


def check_criterion(
    crit: Criterion, offer: Offer, breakdown: PriceBreakdown | None, tolerance: float
) -> tuple[bool, str]:
    """Retorna (atende, texto_da_diferenca)."""
    value = _offer_value(offer, crit.field, breakdown)
    if value is None:
        return False, f"{crit.label}: informação não disponível na oferta."

    tol = crit.tolerance if crit.tolerance is not None else tolerance

    if crit.operator == "eq":
        if crit.field == "voltagem" and str(value).lower() == "bivolt":
            return True, ""  # bivolt atende qualquer voltagem pedida
        ok = str(value).lower() == str(crit.value).lower()
        return ok, "" if ok else f"{crit.label}: oferta tem '{value}'."

    if crit.operator == "contains":
        ok = str(crit.value).lower() in str(value).lower()
        return ok, "" if ok else f"{crit.label}: oferta tem '{value}'."

    try:
        num = float(value)
        target = float(crit.value)
    except (TypeError, ValueError):
        return False, f"{crit.label}: valor '{value}' não é comparável."

    if crit.operator == "gte":
        ok = num >= target
        return ok, "" if ok else f"{crit.label}: oferta tem {num:g} {crit.unit} (mínimo {target:g})."
    if crit.operator == "lte":
        ok = num <= target
        return ok, "" if ok else f"{crit.label}: oferta tem {num:g} {crit.unit} (máximo {target:g})."
    if crit.operator == "approx":
        lo, hi = target * (1 - tol), target * (1 + tol)
        ok = lo <= num <= hi
        if ok and num != target:
            pct = (num - target) / target * 100
            side = "acima" if pct > 0 else "abaixo"
            return True, (
                f"{crit.label}: o modelo tem {num:g} {crit.unit}, {abs(pct):.0f}% {side} do pedido, "
                f"dentro da tolerância de {tol * 100:.0f}%."
            )
        return ok, "" if ok else (
            f"{crit.label}: {num:g} {crit.unit} fora da faixa tolerada ({lo:g} a {hi:g})."
        )
    return False, f"Operador desconhecido em {crit.label}."


def evaluate_offer(
    query: InterpretedQuery, offer: Offer, breakdown: PriceBreakdown
) -> dict:
    """Aplica todos os criterios e devolve met/unmet/diferencas."""
    mandatory_met: list[str] = []
    mandatory_unmet: list[str] = []
    desirable_met: list[str] = []
    differences: list[str] = []

    for crit in query.criteria:
        if crit.kind == CriterionKind.INDIFERENTE:
            continue
        ok, diff = check_criterion(crit, offer, breakdown, query.tolerance)
        if crit.kind == CriterionKind.OBRIGATORIO:
            (mandatory_met if ok else mandatory_unmet).append(crit.label)
            if diff:
                differences.append(diff)
        else:
            if ok:
                desirable_met.append(crit.label)
            elif diff and "não disponível" not in diff:
                differences.append(diff)

    if not query.allow_imported and offer.origin == "importado":
        mandatory_unmet.append("Produtos importados bloqueados pelo usuário")

    return {
        "mandatory_met": mandatory_met,
        "mandatory_unmet": mandatory_unmet,
        "desirable_met": desirable_met,
        "differences": differences,
        "passes": len(mandatory_unmet) == 0,
    }
