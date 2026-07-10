"""Interpretacao da consulta em linguagem natural (secoes 6, 7 e 33).

Implementacao por regras, dicionarios e expressoes regulares — funciona sem
IA externa. Uma camada opcional de LLM pode substituir esta funcao mantendo
o mesmo esquema de saida (InterpretedQuery).
"""

import re
import unicodedata

from app.core.config import get_settings
from app.schemas.models import Criterion, CriterionKind, InterpretedQuery


def _fold(text: str) -> str:
    """minusculas sem acentos, para casar palavras-chave."""
    nfkd = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


CATEGORIES: dict[str, dict] = {
    "geladeira": {"label": "Geladeira / Refrigerador", "keywords": ["geladeira", "refrigerador", "frigobar"]},
    "notebook": {"label": "Notebook", "keywords": ["notebook", "laptop", "ultrabook", "macbook"]},
    "celular": {"label": "Celular / Smartphone", "keywords": ["celular", "smartphone", "iphone", "telefone"]},
    "ar_condicionado": {
        "label": "Ar-condicionado",
        "keywords": ["ar-condicionado", "ar condicionado", "split", "btus", "btu"],
    },
    "impressora": {"label": "Impressora", "keywords": ["impressora", "multifuncional", "tanque de tinta"]},
    "tv": {"label": "Televisor", "keywords": ["tv", "televisor", "televisao", "smart tv"]},
    "lavadora": {
        "label": "Máquina de lavar",
        "keywords": ["maquina de lavar", "lavadora", "lava e seca", "lava roupas"],
    },
}

_NUM = r"(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)"


def _to_float(raw: str) -> float:
    """Converte numero em formato brasileiro ('5.000,50') ou simples ('5000.5')."""
    s = raw.strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") == 1 and len(s.split(".")[1]) == 3:
        s = s.replace(".", "")  # '5.000' e milhar, nao decimal
    elif s.count(".") > 1:
        s = s.replace(".", "")
    return float(s)


def detect_category(text: str) -> tuple[str, str]:
    folded = _fold(text)
    for key, cfg in CATEGORIES.items():
        if any(kw in folded for kw in cfg["keywords"]):
            return key, cfg["label"]
    return "geral", "Produto geral"


def _crit(id_: str, label: str, field: str, op: str, value, unit: str, kind: CriterionKind) -> Criterion:
    return Criterion(id=id_, label=label, field=field, operator=op, value=value, unit=unit, kind=kind)


def interpret(text: str, max_price: float | None = None, allow_imported: bool = True) -> InterpretedQuery:
    settings = get_settings()
    folded = _fold(text)
    category, category_label = detect_category(text)
    criteria: list[Criterion] = []
    notes: list[str] = []

    # --- obrigatorios universais -------------------------------------------
    criteria.append(_crit("novo", "Produto novo", "condition", "eq", "novo", "", CriterionKind.OBRIGATORIO))
    criteria.append(
        _crit("entrega_cep", "Entrega disponível no CEP", "delivery_available", "eq", True, "",
              CriterionKind.OBRIGATORIO)
    )

    # --- preco maximo --------------------------------------------------------
    m = re.search(rf"(?:ate|maximo|no maximo|max\.?)\s*(?:de\s*)?(?:r\$\s*)?{_NUM}", folded)
    price_limit = max_price
    if m and price_limit is None:
        price_limit = _to_float(m.group(1))
    if price_limit is not None:
        criteria.append(
            _crit("preco_max", f"Preço máximo R$ {price_limit:,.2f}", "total_delivered", "lte",
                  price_limit, "R$", CriterionKind.OBRIGATORIO)
        )

    # --- voltagem ------------------------------------------------------------
    mv = re.search(r"\b(110|127|220)\s*v(?:olts)?\b", folded)
    if mv:
        criteria.append(
            _crit("voltagem", f"Voltagem {mv.group(1)} V", "voltagem", "eq", mv.group(1), "V",
                  CriterionKind.OBRIGATORIO)
        )
    elif "bivolt" in folded:
        criteria.append(_crit("voltagem", "Bivolt", "voltagem", "eq", "bivolt", "", CriterionKind.DESEJAVEL))

    # --- por categoria -------------------------------------------------------
    if category == "geladeira":
        if "frost free" in folded or "frost-free" in folded:
            criteria.append(
                _crit("frost_free", "Tecnologia frost free", "frost_free", "eq", True, "",
                      CriterionKind.OBRIGATORIO)
            )
        ml = re.search(rf"{_NUM}\s*(?:litros|l\b)", folded)
        if ml:
            litros = _to_float(ml.group(1))
            criteria.append(
                _crit("capacidade", f"Capacidade aproximada de {litros:.0f} litros", "capacidade_litros",
                      "approx", litros, "L", CriterionKind.OBRIGATORIO)
            )
        if "inverter" in folded:
            criteria.append(_crit("inverter", "Compressor inverter", "inverter", "eq", True, "",
                                  CriterionKind.DESEJAVEL))
        if "inox" in folded:
            criteria.append(_crit("cor", "Cor inox", "cor", "contains", "inox", "", CriterionKind.DESEJAVEL))

    elif category == "notebook":
        mr = re.search(rf"{_NUM}\s*gb\s*(?:de\s*)?(?:ram|memoria)", folded)
        if mr:
            criteria.append(_crit("ram", f"{_to_float(mr.group(1)):.0f} GB de RAM", "ram_gb", "gte",
                                  _to_float(mr.group(1)), "GB", CriterionKind.OBRIGATORIO))
        ms = re.search(rf"ssd\s*(?:de\s*)?{_NUM}\s*(gb|tb)|{_NUM}\s*(gb|tb)\s*(?:de\s*)?ssd", folded)
        if ms:
            raw = ms.group(1) or ms.group(3)
            unit = (ms.group(2) or ms.group(4) or "gb").lower()
            size = _to_float(raw) * (1024 if unit == "tb" else 1)
            criteria.append(_crit("ssd", f"SSD de {size:.0f} GB", "ssd_gb", "gte", size, "GB",
                                  CriterionKind.OBRIGATORIO))
        mt = re.search(rf"(?:tela\s*(?:de\s*)?)?{_NUM}\s*(?:polegadas|pol\b|\")", folded)
        if mt:
            criteria.append(_crit("tela", f"Tela de {_to_float(mt.group(1)):.1f} polegadas",
                                  "tela_polegadas", "approx", _to_float(mt.group(1)), "pol",
                                  CriterionKind.DESEJAVEL))

    elif category == "celular":
        ma = re.search(rf"{_NUM}\s*gb", folded)
        if ma:
            criteria.append(_crit("armazenamento", f"{_to_float(ma.group(1)):.0f} GB de armazenamento",
                                  "armazenamento_gb", "gte", _to_float(ma.group(1)), "GB",
                                  CriterionKind.OBRIGATORIO))
        if "camera" in folded:
            criteria.append(_crit("camera", "Boa câmera", "camera_destaque", "eq", True, "",
                                  CriterionKind.DESEJAVEL))
        if "bateria" in folded:
            criteria.append(_crit("bateria", "Bateria de longa duração", "bateria_mah", "gte", 4500,
                                  "mAh", CriterionKind.DESEJAVEL))

    elif category == "ar_condicionado":
        mb = re.search(rf"{_NUM}\s*btus?", folded)
        if mb:
            criteria.append(_crit("btus", f"{_to_float(mb.group(1)):.0f} BTUs", "btus", "approx",
                                  _to_float(mb.group(1)), "BTUs", CriterionKind.OBRIGATORIO))
        if "inverter" in folded:
            criteria.append(_crit("inverter", "Tecnologia inverter", "inverter", "eq", True, "",
                                  CriterionKind.DESEJAVEL))

    elif category == "impressora":
        if "tanque" in folded:
            criteria.append(_crit("tanque", "Tanque de tinta", "tanque_de_tinta", "eq", True, "",
                                  CriterionKind.OBRIGATORIO))
        if "custo por pagina" in folded or "baixo custo" in folded:
            criteria.append(_crit("custo_pagina", "Baixo custo por página", "custo_por_pagina_centavos",
                                  "lte", 15, "centavos", CriterionKind.DESEJAVEL))

    elif category == "tv":
        mt = re.search(rf"{_NUM}\s*(?:polegadas|pol\b|\")", folded)
        if mt:
            criteria.append(_crit("tela", f"{_to_float(mt.group(1)):.0f} polegadas", "tela_polegadas",
                                  "approx", _to_float(mt.group(1)), "pol", CriterionKind.OBRIGATORIO))
        if "4k" in folded:
            criteria.append(_crit("resolucao", "Resolução 4K", "resolucao", "contains", "4k", "",
                                  CriterionKind.OBRIGATORIO))

    elif category == "lavadora":
        mk = re.search(rf"{_NUM}\s*(?:kg|quilos)", folded)
        if mk:
            criteria.append(_crit("capacidade", f"Capacidade de {_to_float(mk.group(1)):.0f} kg",
                                  "capacidade_kg", "approx", _to_float(mk.group(1)), "kg",
                                  CriterionKind.OBRIGATORIO))

    if category == "geral":
        notes.append(
            "Categoria não identificada automaticamente; a busca usará o texto completo da descrição."
        )

    # criterios desejaveis universais
    if "garantia" in folded:
        criteria.append(_crit("garantia", "Melhor garantia", "warranty_months", "gte", 12, "meses",
                              CriterionKind.DESEJAVEL))
    if any(w in folded for w in ["baixo consumo", "economico", "economia de energia"]):
        criteria.append(_crit("consumo", "Baixo consumo de energia", "selo_a", "eq", True, "",
                              CriterionKind.DESEJAVEL))

    return InterpretedQuery(
        original_text=text,
        category=category,
        category_label=category_label,
        criteria=criteria,
        max_price=price_limit,
        allow_imported=allow_imported,
        tolerance=settings.tolerance,
        notes=notes,
    )
