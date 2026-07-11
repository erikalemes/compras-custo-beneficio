// Interpretacao da consulta em linguagem natural.
// Porta fiel de backend/app/services/interpreter.py (mesmas regras e rotulos).
import type { Criterion, CriterionKind, InterpretedQuery } from "../types";

const TOLERANCE = 0.1;

function fold(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  geladeira: { label: "Geladeira / Refrigerador", keywords: ["geladeira", "refrigerador", "frigobar"] },
  notebook: { label: "Notebook", keywords: ["notebook", "laptop", "ultrabook", "macbook"] },
  celular: { label: "Celular / Smartphone", keywords: ["celular", "smartphone", "iphone", "telefone"] },
  ar_condicionado: {
    label: "Ar-condicionado",
    keywords: ["ar-condicionado", "ar condicionado", "split", "btus", "btu"],
  },
  impressora: { label: "Impressora", keywords: ["impressora", "multifuncional", "tanque de tinta"] },
  tv: { label: "Televisor", keywords: ["tv", "televisor", "televisao", "smart tv"] },
  lavadora: {
    label: "Máquina de lavar",
    keywords: ["maquina de lavar", "lavadora", "lava e seca", "lava roupas"],
  },
};

const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;

function toFloat(raw: string): number {
  let s = raw.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length === 1 && s.split(".")[1].length === 3) s = s.replace(".", "");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  return parseFloat(s);
}

function brl(value: number): string {
  return (
    "R$ " +
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function crit(
  id: string, label: string, field: string, operator: Criterion["operator"],
  value: unknown, unit: string, kind: CriterionKind,
): Criterion {
  return { id, label, field, operator, value, unit, kind };
}

export function interpretStatic(
  text: string, maxPrice: number | null = null, allowImported = true,
): InterpretedQuery {
  const folded = fold(text);
  let category = "geral";
  let categoryLabel = "Produto geral";
  for (const [key, cfg] of Object.entries(CATEGORIES)) {
    if (cfg.keywords.some((kw) => folded.includes(kw))) {
      category = key;
      categoryLabel = cfg.label;
      break;
    }
  }

  const criteria: Criterion[] = [];
  const notes: string[] = [];

  criteria.push(crit("novo", "Produto novo", "condition", "eq", "novo", "", "obrigatorio"));
  criteria.push(crit("entrega_cep", "Entrega disponível no CEP", "delivery_available", "eq", true, "", "obrigatorio"));

  // preco maximo: exige palavra de limite e rejeita numeros com unidade fisica
  const priceRe = new RegExp(
    String.raw`(?:ate|no maximo|maximo de|max\.)\s*(?:de\s*)?(?:r\$\s*)?${NUM}` +
      String.raw`(?!\d)(?!\s*(?:gb|tb|mb|litros?|l\b|btus?|polegadas|pol\b|kg|quilos|v\b|volts|mah|mp\b))`,
  );
  const mPrice = folded.match(priceRe);
  let priceLimit = maxPrice;
  if (mPrice && priceLimit == null) priceLimit = toFloat(mPrice[1]);
  if (priceLimit != null) {
    criteria.push(
      crit("preco_max", `Preço máximo ${brl(priceLimit)}`, "total_delivered", "lte", priceLimit, "R$", "obrigatorio"),
    );
  }

  const mVolt = folded.match(/\b(110|127|220)\s*v(?:olts)?\b/);
  if (mVolt) {
    criteria.push(crit("voltagem", `Voltagem ${mVolt[1]} V`, "voltagem", "eq", mVolt[1], "V", "obrigatorio"));
  } else if (folded.includes("bivolt")) {
    criteria.push(crit("voltagem", "Bivolt", "voltagem", "eq", "bivolt", "", "desejavel"));
  }

  if (category === "geladeira") {
    if (folded.includes("frost free") || folded.includes("frost-free"))
      criteria.push(crit("frost_free", "Tecnologia frost free", "frost_free", "eq", true, "", "obrigatorio"));
    const mL = folded.match(new RegExp(`${NUM}\\s*(?:litros|l\\b)`));
    if (mL) {
      const litros = toFloat(mL[1]);
      criteria.push(
        crit("capacidade", `Capacidade aproximada de ${litros.toFixed(0)} litros`, "capacidade_litros",
          "approx", litros, "L", "obrigatorio"),
      );
    }
    if (folded.includes("inverter"))
      criteria.push(crit("inverter", "Compressor inverter", "inverter", "eq", true, "", "desejavel"));
    if (folded.includes("inox"))
      criteria.push(crit("cor", "Cor inox", "cor", "contains", "inox", "", "desejavel"));
  } else if (category === "notebook") {
    const mR = folded.match(new RegExp(`${NUM}\\s*gb\\s*(?:de\\s*)?(?:ram|memoria)`));
    if (mR)
      criteria.push(crit("ram", `${toFloat(mR[1]).toFixed(0)} GB de RAM`, "ram_gb", "gte", toFloat(mR[1]), "GB", "obrigatorio"));
    const mS = folded.match(new RegExp(`ssd\\s*(?:de\\s*)?${NUM}\\s*(gb|tb)|${NUM}\\s*(gb|tb)\\s*(?:de\\s*)?ssd`));
    if (mS) {
      const raw = mS[1] ?? mS[3];
      const unit = (mS[2] ?? mS[4] ?? "gb").toLowerCase();
      const size = toFloat(raw) * (unit === "tb" ? 1024 : 1);
      criteria.push(crit("ssd", `SSD de ${size.toFixed(0)} GB`, "ssd_gb", "gte", size, "GB", "obrigatorio"));
    }
    const mT = folded.match(new RegExp(`(?:tela\\s*(?:de\\s*)?)?${NUM}\\s*(?:polegadas|pol\\b|")`));
    if (mT)
      criteria.push(crit("tela", `Tela de ${toFloat(mT[1]).toFixed(1)} polegadas`, "tela_polegadas",
        "approx", toFloat(mT[1]), "pol", "desejavel"));
  } else if (category === "celular") {
    const mA = folded.match(new RegExp(`${NUM}\\s*gb`));
    if (mA)
      criteria.push(crit("armazenamento", `${toFloat(mA[1]).toFixed(0)} GB de armazenamento`,
        "armazenamento_gb", "gte", toFloat(mA[1]), "GB", "obrigatorio"));
    if (folded.includes("camera"))
      criteria.push(crit("camera", "Boa câmera", "camera_destaque", "eq", true, "", "desejavel"));
    if (folded.includes("bateria"))
      criteria.push(crit("bateria", "Bateria de longa duração", "bateria_mah", "gte", 4500, "mAh", "desejavel"));
  } else if (category === "ar_condicionado") {
    const mB = folded.match(new RegExp(`${NUM}\\s*btus?`));
    if (mB)
      criteria.push(crit("btus", `${toFloat(mB[1]).toFixed(0)} BTUs`, "btus", "approx", toFloat(mB[1]), "BTUs", "obrigatorio"));
    if (folded.includes("inverter"))
      criteria.push(crit("inverter", "Tecnologia inverter", "inverter", "eq", true, "", "desejavel"));
  } else if (category === "impressora") {
    if (folded.includes("tanque"))
      criteria.push(crit("tanque", "Tanque de tinta", "tanque_de_tinta", "eq", true, "", "obrigatorio"));
    if (folded.includes("custo por pagina") || folded.includes("baixo custo"))
      criteria.push(crit("custo_pagina", "Baixo custo por página", "custo_por_pagina_centavos", "lte", 15,
        "centavos", "desejavel"));
  } else if (category === "tv") {
    const mT = folded.match(new RegExp(`${NUM}\\s*(?:polegadas|pol\\b|")`));
    if (mT)
      criteria.push(crit("tela", `${toFloat(mT[1]).toFixed(0)} polegadas`, "tela_polegadas", "approx",
        toFloat(mT[1]), "pol", "obrigatorio"));
    if (folded.includes("4k"))
      criteria.push(crit("resolucao", "Resolução 4K", "resolucao", "contains", "4k", "", "obrigatorio"));
  } else if (category === "lavadora") {
    const mK = folded.match(new RegExp(`${NUM}\\s*(?:kg|quilos)`));
    if (mK)
      criteria.push(crit("capacidade", `Capacidade de ${toFloat(mK[1]).toFixed(0)} kg`, "capacidade_kg",
        "approx", toFloat(mK[1]), "kg", "obrigatorio"));
  }

  if (category === "geral")
    notes.push("Categoria não identificada automaticamente; a busca usará o texto completo da descrição.");

  if (folded.includes("garantia"))
    criteria.push(crit("garantia", "Melhor garantia", "warranty_months", "gte", 12, "meses", "desejavel"));
  if (["baixo consumo", "economico", "economia de energia"].some((w) => folded.includes(w)))
    criteria.push(crit("consumo", "Baixo consumo de energia", "selo_a", "eq", true, "", "desejavel"));

  return {
    original_text: text,
    category,
    category_label: categoryLabel,
    criteria,
    max_price: priceLimit ?? null,
    allow_imported: allowImported,
    tolerance: TOLERANCE,
    notes,
  };
}
