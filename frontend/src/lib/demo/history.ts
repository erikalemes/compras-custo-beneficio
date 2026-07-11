// Historico de precos demo, gerado deterministicamente no navegador
// (equivalente a demo_seed.py + history/store.py do backend).
import type { HistoryStats } from "../types";
import { hashString, mulberry32 } from "./rng";

const WEEKS = 26;

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const k = (sorted.length - 1) * pct;
  const lo = Math.floor(k);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] * (1 - (k - lo)) + sorted[hi] * (k - lo);
}

export function genHistory(offerId: string, baseTotal: number): HistoryStats {
  const rng = mulberry32(hashString(offerId) ^ 42);
  const drift = -0.0015 + rng() * 0.0035;
  const now = Date.now();
  const series: { date: string; total_price: number }[] = [];
  for (let week = WEEKS; week >= 1; week--) {
    const noise = -0.05 + rng() * 0.1;
    const factor = 1 + drift * (WEEKS - week) + noise;
    const total = Math.round(baseTotal * Math.max(0.7, factor) * 100) / 100;
    const date = new Date(now - week * 7 * 24 * 3600 * 1000);
    series.push({ date: date.toISOString().slice(0, 10), total_price: total });
  }

  const totals = series.map((p) => p.total_price);
  const sorted = [...totals].sort((a, b) => a - b);
  const p10 = percentile(sorted, 0.1);
  const p35 = percentile(sorted, 0.35);
  const p65 = percentile(sorted, 0.65);
  const p90 = percentile(sorted, 0.9);

  const current = baseTotal;
  let classification: HistoryStats["classification"];
  if (current <= p10) classification = "muito_baixo";
  else if (current <= p35) classification = "baixo";
  else if (current <= p65) classification = "na_media";
  else if (current <= p90) classification = "alto";
  else classification = "muito_alto";

  const third = Math.max(1, Math.floor(totals.length / 3));
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const firstAvg = avg(totals.slice(0, third));
  const lastAvg = avg(totals.slice(-third));
  const trend = lastAvg < firstAvg * 0.97 ? "queda" : lastAvg > firstAvg * 1.03 ? "alta" : "estavel";

  const minIdx = totals.indexOf(sorted[0]);
  const previous = totals[totals.length - 1];

  return {
    available: true,
    is_demo: true,
    observations: series.length,
    period_days: WEEKS * 7,
    current,
    previous,
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
    average: Math.round(avg(totals) * 100) / 100,
    median: Math.round(percentile(sorted, 0.5) * 100) / 100,
    variation_pct: previous ? Math.round(((current - previous) / previous) * 10000) / 100 : null,
    min_date: series[minIdx]?.date ?? null,
    trend,
    classification,
    series,
    message: "Histórico de demonstração (dados fictícios).",
  };
}
