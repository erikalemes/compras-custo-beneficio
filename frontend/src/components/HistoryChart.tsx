import type { HistoryStats } from "@/lib/types";
import { formatBRL } from "@/lib/format";

// Grafico de linha simples em SVG, sem dependencias externas.
export function HistoryChart({ history }: { history: HistoryStats }) {
  if (!history.available || history.series.length < 2) {
    return <p className="text-sm text-slate-500">{history.message || "Sem histórico suficiente para exibir gráfico."}</p>;
  }
  const w = 560;
  const h = 140;
  const pad = 8;
  const values = history.series.map((p) => p.total_price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = history.series
    .map((p, i) => {
      const x = pad + (i / (history.series.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((p.total_price - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = history.series[0];
  const last = history.series[history.series.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Evolução do preço total de ${first.date} a ${last.date}, mínimo ${formatBRL(min)}, máximo ${formatBRL(max)}`}
        className="w-full"
      >
        <polyline points={points} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
        <span>
          {first.date} → {last.date} ({history.observations} observações)
        </span>
        <span>
          mín {formatBRL(min)} · máx {formatBRL(max)} · mediana {formatBRL(history.median)}
        </span>
      </figcaption>
      {history.is_demo && (
        <p className="mt-1 text-xs font-medium text-amber-700">Histórico de demonstração (dados fictícios).</p>
      )}
    </figure>
  );
}
