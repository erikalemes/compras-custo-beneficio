// Tipos espelhando os esquemas Pydantic do backend.

export type CriterionKind = "obrigatorio" | "desejavel" | "indiferente";

export interface Criterion {
  id: string;
  label: string;
  field: string;
  operator: "eq" | "gte" | "lte" | "approx" | "contains";
  value: unknown;
  unit: string;
  kind: CriterionKind;
  tolerance?: number | null;
}

export interface InterpretedQuery {
  original_text: string;
  category: string;
  category_label: string;
  criteria: Criterion[];
  max_price: number | null;
  allow_imported: boolean;
  tolerance: number;
  notes: string[];
}

export interface CepInfo {
  cep: string;
  valid: boolean;
  city: string;
  state: string;
  message: string;
}

export interface PriceBreakdown {
  price: number;
  price_pix: number;
  pix_discount: number;
  coupon_discount: number;
  shipping: number;
  taxes: number;
  fees: number;
  total_delivered: number;
  cashback_later: number;
}

export interface HistoryStats {
  available: boolean;
  is_demo: boolean;
  observations: number;
  period_days: number;
  current: number;
  previous: number | null;
  minimum: number;
  maximum: number;
  average: number;
  median: number;
  variation_pct: number | null;
  min_date: string | null;
  trend: string;
  classification: string;
  series: { date: string; total_price: number }[];
  message: string;
}

export interface Offer {
  offer_id: string;
  product_name: string;
  category: string;
  brand: string;
  model: string;
  url: string;
  condition: string;
  specs: Record<string, unknown>;
  voltage: string;
  price: number;
  price_pix: number;
  installments_count: number;
  installment_value: number;
  installments_interest_free: boolean;
  coupon: { code: string; discount_value: number; rules: string; validated: boolean } | null;
  cashback: { value: number; percent: number; platform: string; deadline_days: number; rules: string } | null;
  shipping_cost: number | null;
  shipping_days: number | null;
  delivery_available: boolean | null;
  marketplace: string;
  store: string;
  seller_name: string;
  seller_type: string;
  origin: "nacional" | "importado";
  warranty: { months: number; kind: string; description: string };
  reviews: {
    average: number;
    count: number;
    highlights: string[];
    complaints: string[];
    recurring_issues: string[];
    confidence: string;
  };
  store_reputation: { classification: string; score: number; notes: string };
  seller_reputation: { classification: string; score: number; notes: string };
  source: string;
  simulated: boolean;
}

export interface RankedOffer {
  offer: Offer;
  score: number;
  score_breakdown: Record<string, number>;
  score_explanations: Record<string, string>;
  price_breakdown: PriceBreakdown;
  history: HistoryStats;
  mandatory_met: string[];
  mandatory_unmet: string[];
  desirable_met: string[];
  differences: string[];
  advantages: string[];
  disadvantages: string[];
  alerts: string[];
  labels: string[];
  price_band: string;
}

export interface SourceStatus {
  name: string;
  kind: string;
  status: string;
  offers_found: number;
  offers_discarded: number;
  message: string;
  simulated: boolean;
}

export interface SearchResults {
  search_id: string;
  status: "executando" | "concluida" | "erro";
  mode: string;
  query: InterpretedQuery;
  cep: CepInfo;
  sources: SourceStatus[];
  amazon_consulted: boolean;
  amazon_message: string;
  offers: RankedOffer[];
  unvalidated_offers: RankedOffer[];
  highlights: Record<string, string>;
  price_bands: Record<string, number[]>;
  errors: string[];
}

export const LABEL_NAMES: Record<string, string> = {
  melhor_custo_beneficio: "Melhor custo-benefício",
  menor_preco: "Menor preço",
  menor_preco_confiavel: "Menor preço confiável",
  melhor_avaliado: "Melhor avaliado",
  compra_mais_segura: "Compra mais segura",
  melhor_importada: "Melhor opção importada",
  opcao_economica: "Opção econômica",
  opcao_intermediaria: "Opção intermediária",
  opcao_premium: "Opção premium",
};
