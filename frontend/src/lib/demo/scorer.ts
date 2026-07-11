// Pontuacao 0-100, alertas e classificacoes (porta de backend/app/ranking/scorer.py).
import type { HistoryStats, Offer, PriceBreakdown, RankedOffer } from "../types";

const WEIGHTS: Record<string, number> = {
  preco_total: 0.3,
  avaliacoes: 0.2,
  reputacao: 0.15,
  especificacoes: 0.15,
  historico: 0.1,
  garantia: 0.05,
  condicoes: 0.05,
};

const REP_SCORE: Record<string, number> = {
  excelente: 100, boa: 80, regular: 55, ruim: 25, critica: 10, insuficiente: 40, nao_localizada: 40,
};
const HIST_SCORE: Record<string, number> = {
  muito_baixo: 100, baixo: 80, na_media: 60, alto: 30, muito_alto: 10, insuficiente: 50,
};
const REP_LABEL: Record<string, string> = {
  excelente: "excelente", boa: "boa", regular: "regular", ruim: "ruim", critica: "crítica",
  insuficiente: "insuficiente", nao_localizada: "não localizada",
};

type Component = [number, string];

function priceScore(total: number, best: number): Component {
  if (total <= 0 || best <= 0) return [0, "Preço total indisponível."];
  const score = Math.round(Math.min(100, (best / total) * 100) * 10) / 10;
  if (total === best) return [score, "Menor preço total entregue entre as ofertas válidas."];
  return [score, `Preço total ${((total / best - 1) * 100).toFixed(0)}% acima da oferta mais barata válida.`];
}

function reviewsScore(offer: Offer): Component {
  const r = offer.reviews;
  if (r.count === 0) return [30, "Sem avaliações localizadas; nota neutra baixa."];
  const confidence = Math.min(1, Math.log10(r.count + 1) / 3);
  const score = Math.round((r.average / 5) * 100 * (0.5 + 0.5 * confidence) * 10) / 10;
  const level = confidence > 0.8 ? "alta" : confidence > 0.5 ? "média" : "baixa";
  return [score, `Nota ${r.average.toFixed(1)}/5 em ${r.count} avaliações (confiança ${level}).`];
}

function reputationScore(offer: Offer): Component {
  const store = offer.store_reputation.classification;
  const seller = offer.seller_reputation.classification;
  const sStore = REP_SCORE[store] ?? 40;
  if (seller === "nao_localizada" || seller === "insuficiente")
    return [sStore, `Loja com reputação ${REP_LABEL[store] ?? store}.`];
  const score = Math.round((sStore * 0.6 + (REP_SCORE[seller] ?? 40) * 0.4) * 10) / 10;
  return [score, `Loja ${REP_LABEL[store] ?? store}, vendedor ${REP_LABEL[seller] ?? seller}.`];
}

function specsScore(desirableMet: string[], totalDesirable: number): Component {
  if (totalDesirable === 0) return [60, "Nenhum critério desejável informado; nota neutra."];
  const score = Math.round((40 + (desirableMet.length / totalDesirable) * 60) * 10) / 10;
  return [score, `Atende ${desirableMet.length} de ${totalDesirable} critérios desejáveis.`];
}

function historyScore(h: HistoryStats): Component {
  const score = HIST_SCORE[h.classification] ?? 50;
  if (h.classification === "insuficiente") return [score, "Histórico de preços insuficiente; nota neutra."];
  return [score, `Preço atual classificado como '${h.classification.replace(/_/g, " ")}' frente ao histórico.`];
}

function warrantyScore(offer: Offer): Component {
  const w = offer.warranty;
  if (w.kind === "nacional")
    return w.months >= 12
      ? [100, `Garantia nacional de ${w.months} meses.`]
      : [80, `Garantia nacional de ${w.months} meses.`];
  if (w.kind === "vendedor") return [60, `Garantia do vendedor (${w.months} meses).`];
  if (w.kind === "internacional") return [40, "Garantia apenas internacional (pode exigir envio ao exterior)."];
  if (w.kind === "sem_garantia") return [15, "Sem garantia informada pelo vendedor."];
  return [30, "Garantia não informada."];
}

function conditionsScore(offer: Offer, b: PriceBreakdown): Component {
  let score = 40;
  const parts: string[] = [];
  if (b.pix_discount > 0) { score += 15; parts.push("desconto no Pix"); }
  if (offer.installments_count >= 6 && offer.installments_interest_free) {
    score += 15;
    parts.push(`${offer.installments_count}x sem juros`);
  }
  if (b.coupon_discount > 0) { score += 10; parts.push("cupom validado"); }
  if (b.cashback_later > 0) { score += 10; parts.push("cashback posterior"); }
  const stock = (offer as Offer & { stock?: number | null }).stock;
  if (stock === undefined || stock === null || stock > 0) score += 10;
  else parts.push("sem estoque confirmado");
  return [Math.min(score, 100), parts.length ? `Condições: ${parts.join(", ")}.` : "Condições básicas."];
}

export function scoreOffer(ranked: RankedOffer, bestTotal: number, totalDesirable: number): void {
  const components: Record<string, Component> = {
    preco_total: priceScore(ranked.price_breakdown.total_delivered, bestTotal),
    avaliacoes: reviewsScore(ranked.offer),
    reputacao: reputationScore(ranked.offer),
    especificacoes: specsScore(ranked.desirable_met, totalDesirable),
    historico: historyScore(ranked.history),
    garantia: warrantyScore(ranked.offer),
    condicoes: conditionsScore(ranked.offer, ranked.price_breakdown),
  };
  ranked.score_breakdown = Object.fromEntries(Object.entries(components).map(([k, v]) => [k, v[0]]));
  ranked.score_explanations = Object.fromEntries(Object.entries(components).map(([k, v]) => [k, v[1]]));
  ranked.score =
    Math.round(
      Object.entries(components).reduce((sum, [k, v]) => sum + WEIGHTS[k] * v[0], 0) * 10,
    ) / 10;
}

export function buildAlerts(ranked: RankedOffer): void {
  const offer = ranked.offer;
  const alerts = ranked.alerts;
  const rep = offer.store_reputation.classification;
  if (rep === "ruim" || rep === "critica")
    alerts.push(
      `Esta empresa apresenta preço competitivo, mas possui reputação ${REP_LABEL[rep]} e histórico de reclamações. Compre com cautela.`,
    );
  const sellerRep = offer.seller_reputation.classification;
  if ((sellerRep === "ruim" || sellerRep === "critica") && rep !== "ruim" && rep !== "critica")
    alerts.push(
      `O vendedor ${offer.seller_name || "do marketplace"} possui reputação ${REP_LABEL[sellerRep]} e elevado índice de reclamações não solucionadas.`,
    );
  if (rep === "nao_localizada")
    alerts.push(
      "Não foi localizada reputação suficiente. A avaliação foi baseada em outras evidências disponíveis.",
    );
  if (offer.warranty.kind === "internacional")
    alerts.push(
      "Este produto possui garantia internacional. Poderá ser necessário enviá-lo ao exterior para reparo.",
    );
  if (offer.origin === "importado") {
    const importCost = (offer as Offer & { import_cost?: { risk_of_extra_charges?: boolean } | null }).import_cost;
    if (importCost?.risk_of_extra_charges)
      alerts.push("O valor final poderá sofrer cobranças adicionais durante o processo de importação.");
    else alerts.push("Produto importado: confira impostos e prazos antes de comprar.");
  }
  if (offer.shipping_days === null || offer.shipping_days === undefined)
    alerts.push("Prazo de entrega não informado pela loja.");
  else if (offer.shipping_days > 30) alerts.push(`Prazo de entrega longo: ${offer.shipping_days} dias.`);
  if (offer.coupon && !offer.coupon.validated && offer.coupon.code)
    alerts.push(
      `Cupom '${offer.coupon.code}' disponível, mas não foi possível validar as condições; não foi descontado do preço total.`,
    );
  if (!offer.installments_interest_free && offer.installments_count > 0)
    alerts.push("O parcelamento desta oferta tem juros e não entrou no cálculo principal.");
}

export function buildProsCons(ranked: RankedOffer, bestTotal: number): void {
  const offer = ranked.offer;
  const b = ranked.price_breakdown;
  if (b.total_delivered === bestTotal) ranked.advantages.push("Menor preço total entregue.");
  if (offer.reviews.average >= 4.5 && offer.reviews.count >= 100)
    ranked.advantages.push(`Muito bem avaliado (${offer.reviews.average.toFixed(1)}/5).`);
  if (offer.store_reputation.classification === "excelente")
    ranked.advantages.push("Loja com reputação excelente.");
  if (offer.warranty.kind === "nacional" && offer.warranty.months >= 12)
    ranked.advantages.push(`Garantia nacional de ${offer.warranty.months} meses.`);
  if (b.cashback_later > 0)
    ranked.advantages.push(`Cashback posterior estimado de R$ ${b.cashback_later.toFixed(2)}.`);
  if (offer.installments_count >= 10 && offer.installments_interest_free)
    ranked.advantages.push(`${offer.installments_count}x sem juros.`);

  if (offer.reviews.count < 20) ranked.disadvantages.push("Poucas avaliações para uma conclusão confiável.");
  const rep = offer.store_reputation.classification;
  if (rep === "regular" || rep === "ruim" || rep === "critica")
    ranked.disadvantages.push(`Reputação da loja: ${REP_LABEL[rep]}.`);
  if (b.shipping > 0) ranked.disadvantages.push(`Frete de R$ ${b.shipping.toFixed(2)} incluído no total.`);
  if (offer.reviews.recurring_issues.length > 0)
    ranked.disadvantages.push(
      `Problemas recorrentes: ${offer.reviews.recurring_issues.slice(0, 2).join("; ")}.`,
    );
}

export function assignLabels(
  offers: RankedOffer[],
): [Record<string, string>, Record<string, number[]>] {
  const highlights: Record<string, string> = {};
  const bands: Record<string, number[]> = {};
  if (offers.length === 0) return [highlights, bands];

  const tag = (label: string, r: RankedOffer | undefined | null) => {
    if (r) {
      highlights[label] = r.offer.offer_id;
      r.labels.push(label);
    }
  };

  const byScore = [...offers].sort((a, b) => b.score - a.score);
  const byPrice = [...offers].sort(
    (a, b) => a.price_breakdown.total_delivered - b.price_breakdown.total_delivered,
  );

  tag("melhor_custo_beneficio", byScore[0]);
  tag("menor_preco", byPrice[0]);

  const reliable = byPrice.filter(
    (r) =>
      ["excelente", "boa"].includes(r.offer.store_reputation.classification) &&
      !["ruim", "critica"].includes(r.offer.seller_reputation.classification) &&
      r.offer.reviews.count >= 20,
  );
  tag("menor_preco_confiavel", reliable[0]);

  const rated = offers.filter((r) => r.offer.reviews.count >= 20);
  tag(
    "melhor_avaliado",
    rated.length
      ? rated.reduce((best, r) =>
          r.offer.reviews.average > best.offer.reviews.average ||
          (r.offer.reviews.average === best.offer.reviews.average &&
            r.offer.reviews.count > best.offer.reviews.count)
            ? r
            : best,
        )
      : null,
  );

  const safety = (r: RankedOffer) =>
    (REP_SCORE[r.offer.store_reputation.classification] ?? 40) +
    (r.offer.warranty.kind === "nacional" ? 30 : 0) +
    Math.min(r.offer.reviews.count, 1000) / 100;
  tag("compra_mais_segura", offers.reduce((best, r) => (safety(r) > safety(best) ? r : best)));

  const imported = byScore.filter((r) => r.offer.origin === "importado");
  tag("melhor_importada", imported[0]);

  if (offers.length >= 3) {
    const prices = offers.map((r) => r.price_breakdown.total_delivered).sort((a, b) => a - b);
    const tercile = (frac: number) => {
      const k = (prices.length - 1) * frac;
      const lo = Math.floor(k);
      const hi = Math.min(lo + 1, prices.length - 1);
      return prices[lo] + (prices[hi] - prices[lo]) * (k - lo);
    };
    const t1 = tercile(1 / 3);
    const t2 = tercile(2 / 3);
    bands["economica"] = [prices[0], t1];
    bands["intermediaria"] = [t1, t2];
    bands["premium"] = [t2, prices[prices.length - 1]];
    for (const [band, [lo, hi]] of Object.entries(bands)) {
      const candidates = byScore.filter(
        (r) => r.price_breakdown.total_delivered >= lo && r.price_breakdown.total_delivered <= hi,
      );
      tag(`opcao_${band}`, candidates[0]);
    }
    for (const r of offers) {
      const p = r.price_breakdown.total_delivered;
      r.price_band = p <= t1 ? "economica" : p <= t2 ? "intermediaria" : "premium";
    }
  }

  return [highlights, bands];
}
