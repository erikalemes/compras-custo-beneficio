"use client";

import { useState } from "react";
import type { RankedOffer } from "@/lib/types";
import { LABEL_NAMES } from "@/lib/types";
import { formatBRL, historyClassText, reputationText } from "@/lib/format";
import { HistoryChart } from "./HistoryChart";

const SCORE_NAMES: Record<string, string> = {
  preco_total: "Preço total entregue",
  avaliacoes: "Avaliações do produto",
  reputacao: "Reputação",
  especificacoes: "Especificações",
  historico: "Histórico de preços",
  garantia: "Garantia e pós-venda",
  condicoes: "Condições comerciais",
};

export function OfferCard({
  ranked,
  onFavorite,
  favorited,
}: {
  ranked: RankedOffer;
  onFavorite: (r: RankedOffer) => void;
  favorited: boolean;
}) {
  const [open, setOpen] = useState(false);
  const o = ranked.offer;
  const b = ranked.price_breakdown;

  return (
    <article className="card" aria-label={o.product_name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {ranked.labels.map((l) => (
              <span key={l} className="badge bg-brand-100 text-brand-800">
                {LABEL_NAMES[l] ?? l}
              </span>
            ))}
            {o.origin === "importado" && <span className="badge bg-purple-100 text-purple-800">Importado</span>}
            {o.simulated && <span className="badge bg-amber-100 text-amber-800">Dados simulados</span>}
          </div>
          <h3 className="font-semibold leading-snug">{o.product_name}</h3>
          <p className="text-sm text-slate-600">
            {o.store}
            {o.seller_name && o.seller_name !== o.store ? ` · vendido por ${o.seller_name}` : ""} ·{" "}
            {o.reviews.average.toFixed(1)}★ ({o.reviews.count.toLocaleString("pt-BR")} avaliações) · reputação{" "}
            {reputationText(o.store_reputation.classification).toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Preço total entregue</p>
          <p className="text-xl font-bold text-slate-900">{formatBRL(b.total_delivered)}</p>
          {b.cashback_later > 0 && (
            <p className="text-xs text-emerald-700">+ cashback posterior de {formatBRL(b.cashback_later)}</p>
          )}
          <p className="mt-1 text-sm font-semibold text-brand-700">Nota {ranked.score.toFixed(1)}/100</p>
        </div>
      </div>

      {ranked.alerts.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Alertas">
          {ranked.alerts.map((a) => (
            <li key={a} className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
              ⚠ {a}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Ocultar detalhes" : "Ver detalhes e justificativa"}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => onFavorite(ranked)}>
          {favorited ? "★ Favoritado" : "☆ Salvar favorito"}
        </button>
        {o.url && (
          <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
            Ver oferta na loja ↗
          </a>
        )}
      </div>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
          <section aria-label="Composição do preço">
            <h4 className="mb-2 font-semibold">Composição do preço</h4>
            <dl className="space-y-1 text-sm">
              <Row k="Preço normal" v={formatBRL(b.price)} />
              <Row k="Preço no Pix" v={formatBRL(b.price_pix)} />
              {b.coupon_discount > 0 && <Row k="Cupom validado" v={`− ${formatBRL(b.coupon_discount)}`} />}
              <Row k="Frete" v={b.shipping > 0 ? formatBRL(b.shipping) : "Grátis"} />
              {b.taxes > 0 && <Row k="Impostos" v={formatBRL(b.taxes)} />}
              {b.fees > 0 && <Row k="Taxas" v={formatBRL(b.fees)} />}
              <Row k="Total imediato" v={formatBRL(b.total_delivered)} strong />
              {o.installments_count > 0 && o.installments_interest_free && (
                <Row
                  k="Parcelado sem juros"
                  v={`${o.installments_count}x de ${formatBRL(o.installment_value)}`}
                />
              )}
              {b.cashback_later > 0 && o.cashback && (
                <Row
                  k={`Cashback (${o.cashback.platform})`}
                  v={`${formatBRL(b.cashback_later)} — benefício posterior, não abatido`}
                />
              )}
              {o.shipping_days != null && <Row k="Prazo de entrega" v={`${o.shipping_days} dias`} />}
              <Row k="Garantia" v={`${o.warranty.kind.replace(/_/g, " ")} · ${o.warranty.months} meses`} />
            </dl>
          </section>

          <section aria-label="Justificativa da nota">
            <h4 className="mb-2 font-semibold">Como a nota foi calculada</h4>
            <ul className="space-y-1 text-sm">
              {Object.entries(ranked.score_breakdown).map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">{SCORE_NAMES[k] ?? k}:</span>{" "}
                    <span className="text-slate-600">{ranked.score_explanations[k]}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{v.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </section>

          {(ranked.advantages.length > 0 || ranked.disadvantages.length > 0) && (
            <section aria-label="Vantagens e desvantagens">
              <h4 className="mb-2 font-semibold">Vantagens e desvantagens</h4>
              <ul className="space-y-1 text-sm">
                {ranked.advantages.map((a) => (
                  <li key={a} className="text-emerald-700">
                    ✓ {a}
                  </li>
                ))}
                {ranked.disadvantages.map((d) => (
                  <li key={d} className="text-red-700">
                    ✗ {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ranked.differences.length > 0 && (
            <section aria-label="Diferenças em relação ao pedido">
              <h4 className="mb-2 font-semibold">Diferenças em relação ao que você pediu</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                {ranked.differences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </section>
          )}

          {(o.reviews.highlights.length > 0 || o.reviews.complaints.length > 0) && (
            <section aria-label="Resumo das avaliações">
              <h4 className="mb-2 font-semibold">O que dizem as avaliações</h4>
              <ul className="space-y-1 text-sm">
                {o.reviews.highlights.map((hl) => (
                  <li key={hl} className="text-emerald-700">
                    + {hl}
                  </li>
                ))}
                {o.reviews.complaints.map((c) => (
                  <li key={c} className="text-red-700">
                    − {c}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-500">Nível de confiança da análise: {o.reviews.confidence}</p>
            </section>
          )}

          <section className="lg:col-span-2" aria-label="Histórico de preços">
            <h4 className="mb-2 font-semibold">
              Histórico de preços{" "}
              {ranked.history.available && (
                <span className="ml-1 text-sm font-normal text-slate-600">
                  — atual: {historyClassText(ranked.history.classification).toLowerCase()}
                  {ranked.history.trend !== "indefinida" ? `, tendência de ${ranked.history.trend}` : ""}
                </span>
              )}
            </h4>
            <HistoryChart history={ranked.history} />
          </section>
        </div>
      )}
    </article>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <dt>{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
