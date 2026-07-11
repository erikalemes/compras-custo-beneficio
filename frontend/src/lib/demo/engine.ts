// Motor de demonstracao 100% no navegador (GitHub Pages, sem backend).
// Reproduz o fluxo de backend/app/services/search.py sobre o catalogo demo.
import catalog from "../../../../data/demo/products.json";
import type { CepInfo, InterpretedQuery, Offer, RankedOffer, SearchResults, SourceStatus } from "../types";
import { lookupCepStatic } from "./cep";
import { evaluateOffer } from "./equivalence";
import { genHistory } from "./history";
import { interpretStatic } from "./interpreter";
import { computeBreakdown } from "./pricing";
import { assignLabels, buildAlerts, buildProsCons, scoreOffer } from "./scorer";

const AMAZON = "Amazon Brasil";
const SOURCE_NAMES = [AMAZON, "MegaLoja Brasil (demo)", "ImportaDireto (demo)"];
const SIMULATED_DELAY_MS = 1100; // tempo de "consulta" exibido na tela de progresso

// Preenche os padroes que o Pydantic aplicaria no backend (campos opcionais
// ausentes no JSON cru viram valores neutros).
// eslint-disable-next-line
function normalizeOffer(raw: any): Offer {
  return {
    ...raw,
    brand: raw.brand ?? "",
    model: raw.model ?? "",
    url: raw.url ?? "",
    condition: raw.condition ?? "novo",
    specs: raw.specs ?? {},
    voltage: raw.voltage ?? "",
    price: raw.price ?? 0,
    price_pix: raw.price_pix ?? 0,
    installments_count: raw.installments_count ?? 0,
    installment_value: raw.installment_value ?? 0,
    installments_interest_free: raw.installments_interest_free ?? true,
    coupon: raw.coupon ?? null,
    cashback: raw.cashback ?? null,
    shipping_cost: raw.shipping_cost ?? null,
    shipping_days: raw.shipping_days ?? null,
    delivery_available: raw.delivery_available ?? null,
    marketplace: raw.marketplace ?? "",
    store: raw.store ?? "",
    seller_name: raw.seller_name ?? "",
    seller_type: raw.seller_type ?? "",
    origin: raw.origin ?? "nacional",
    warranty: { months: 0, kind: "nao_informada", description: "", ...(raw.warranty ?? {}) },
    reviews: {
      average: 0, count: 0, highlights: [], complaints: [], recurring_issues: [], confidence: "baixa",
      ...(raw.reviews ?? {}),
    },
    store_reputation: { classification: "nao_localizada", score: 0, notes: "", ...(raw.store_reputation ?? {}) },
    seller_reputation: { classification: "nao_localizada", score: 0, notes: "", ...(raw.seller_reputation ?? {}) },
    source: raw.source ?? "",
    simulated: raw.simulated ?? true,
  } as Offer;
}

function catalogOffers(): Offer[] {
  return (catalog as { offers: unknown[] }).offers.map(normalizeOffer);
}

export function validateCepStatic(cep: string): CepInfo {
  return lookupCepStatic(cep);
}

export function interpretRequestStatic(
  text: string, cep: string, maxPrice: number | null, allowImported: boolean,
): { query: InterpretedQuery; cep: CepInfo } {
  const cepInfo = lookupCepStatic(cep);
  if (!cepInfo.valid) throw new Error(`CEP inválido: ${cepInfo.message}`);
  return { query: interpretStatic(text, maxPrice, allowImported), cep: cepInfo };
}

export function runSearchStatic(query: InterpretedQuery, cepInfo: CepInfo): SearchResults {
  const all = catalogOffers().filter(
    (o) => o.category === query.category || query.category === "geral",
  );
  const sources: SourceStatus[] = SOURCE_NAMES.map((name) => ({
    name,
    kind: "demo",
    status: "concluida",
    offers_found: 0,
    offers_discarded: 0,
    message: "",
    simulated: true,
  }));
  const sourceByName = new Map(sources.map((s) => [s.name, s]));
  const totalDesirable = query.criteria.filter((c) => c.kind === "desejavel").length;

  const validated: RankedOffer[] = [];
  const unvalidated: RankedOffer[] = [];

  for (const offer of all) {
    const st = sourceByName.get(offer.source);
    if (st) st.offers_found += 1;
    if (offer.condition !== "novo") {
      if (st) st.offers_discarded += 1;
      continue;
    }
    const breakdown = computeBreakdown(offer as Parameters<typeof computeBreakdown>[0]);
    const evaluation = evaluateOffer(query, offer, breakdown);
    const ranked: RankedOffer = {
      offer,
      score: 0,
      score_breakdown: {},
      score_explanations: {},
      price_breakdown: breakdown,
      history: genHistory(offer.offer_id, breakdown.total_delivered),
      mandatory_met: evaluation.mandatory_met,
      mandatory_unmet: evaluation.mandatory_unmet,
      desirable_met: evaluation.desirable_met,
      differences: evaluation.differences,
      advantages: [],
      disadvantages: [],
      alerts: [],
      labels: [],
      price_band: "",
    };

    if (offer.delivery_available !== true) {
      ranked.alerts.push("Oferta não validada para o CEP informado.");
      const unmetBesidesDelivery = evaluation.mandatory_unmet.filter((u) => !u.includes("Entrega"));
      if (unmetBesidesDelivery.length === 0) {
        ranked.history = { ...ranked.history, available: false, series: [], message: "" };
        buildAlerts(ranked);
        unvalidated.push(ranked);
      } else if (st) st.offers_discarded += 1;
      continue;
    }
    if (!evaluation.passes) {
      if (st) st.offers_discarded += 1;
      continue;
    }
    validated.push(ranked);
  }

  for (const s of sources) {
    const kept = validated.filter((r) => r.offer.source === s.name).length +
      unvalidated.filter((r) => r.offer.source === s.name).length;
    if (kept === 0) s.status = "sem_oferta";
    if (s.name === AMAZON && kept === 0)
      s.message =
        "A Amazon foi consultada, mas não foi localizada uma oferta compatível com os requisitos e com entrega para o CEP informado.";
  }

  const bestTotal = validated.length
    ? Math.min(...validated.map((r) => r.price_breakdown.total_delivered))
    : 0;
  for (const r of validated) {
    scoreOffer(r, bestTotal, totalDesirable);
    buildAlerts(r);
    buildProsCons(r, bestTotal);
  }
  validated.sort((a, b) => b.score - a.score);
  const [highlights, bands] = assignLabels(validated);

  const amazonSource = sourceByName.get(AMAZON);
  return {
    search_id: "",
    status: "concluida",
    mode: "demo",
    query,
    cep: cepInfo,
    sources,
    amazon_consulted: true,
    amazon_message: amazonSource?.message ?? "",
    offers: validated,
    unvalidated_offers: unvalidated,
    highlights,
    price_bands: bands,
    errors: [],
  };
}

export function startSearchStatic(query: InterpretedQuery, cep: string): { search_id: string } {
  const cepInfo = lookupCepStatic(cep);
  if (!cepInfo.valid) throw new Error(`CEP inválido: ${cepInfo.message}`);
  const result = runSearchStatic(query, cepInfo);
  const searchId = Math.random().toString(36).slice(2, 14);
  result.search_id = searchId;
  sessionStorage.setItem(
    `ccb:static:${searchId}`,
    JSON.stringify({ startedAt: Date.now(), result }),
  );
  return { search_id: searchId };
}

export function getSearchStatic(searchId: string): SearchResults {
  const raw = sessionStorage.getItem(`ccb:static:${searchId}`);
  if (!raw) throw new Error("Pesquisa não encontrada ou expirada.");
  const { startedAt, result } = JSON.parse(raw) as { startedAt: number; result: SearchResults };
  if (Date.now() - startedAt < SIMULATED_DELAY_MS) {
    return {
      ...result,
      status: "executando",
      offers: [],
      unvalidated_offers: [],
      highlights: {},
      sources: result.sources.map((s) => ({ ...s, status: "consultando" as const })),
    };
  }
  return result;
}
