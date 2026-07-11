"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { exportUrl, getSearch } from "@/lib/api";
import { favorites, searches } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import type { RankedOffer, SearchResults } from "@/lib/types";
import { LABEL_NAMES } from "@/lib/types";
import { OfferCard } from "@/components/OfferCard";

const HIGHLIGHT_ORDER = [
  "melhor_custo_beneficio",
  "menor_preco_confiavel",
  "compra_mais_segura",
  "opcao_economica",
  "opcao_intermediaria",
  "opcao_premium",
  "melhor_importada",
];

export default function ResultadosPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Carregando...</p>}>
      <Resultados />
    </Suspense>
  );
}

function Resultados() {
  const params = useSearchParams();
  const searchId = params.get("id") ?? "";
  const [result, setResult] = useState<SearchResults | null>(null);
  const [error, setError] = useState("");
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [storeFilter, setStoreFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "price">("score");

  useEffect(() => {
    favorites
      .all()
      .then((all) => setFavIds(new Set(all.map((f) => f.id))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!searchId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const r = await getSearch(searchId);
        if (cancelled) return;
        setResult(r);
        if (r.status === "executando") {
          timer = setTimeout(poll, 700);
        } else if (r.status === "concluida") {
          searches
            .save({
              id: r.search_id,
              text: r.query.original_text,
              cep: r.cep.cep,
              city: r.cep.city,
              state: r.cep.state,
              createdAt: new Date().toISOString(),
              resultCount: r.offers.length,
            })
            .catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao consultar a pesquisa.");
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchId]);

  const toggleFavorite = useCallback(async (r: RankedOffer) => {
    const id = r.offer.offer_id;
    setFavIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        favorites.remove(id).catch(() => undefined);
      } else {
        next.add(id);
        favorites
          .save({
            id,
            kind: "oferta",
            title: r.offer.product_name,
            payload: r,
            createdAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
      return next;
    });
  }, []);

  const offerById = useMemo(() => {
    const map = new Map<string, RankedOffer>();
    result?.offers.forEach((o) => map.set(o.offer.offer_id, o));
    return map;
  }, [result]);

  const filtered = useMemo(() => {
    if (!result) return [];
    let list = [...result.offers];
    if (storeFilter) list = list.filter((o) => o.offer.store === storeFilter);
    if (bandFilter) list = list.filter((o) => o.price_band === bandFilter);
    if (originFilter) list = list.filter((o) => o.offer.origin === originFilter);
    list.sort((a, b) =>
      sortBy === "score" ? b.score - a.score : a.price_breakdown.total_delivered - b.price_breakdown.total_delivered,
    );
    return list;
  }, [result, storeFilter, bandFilter, originFilter, sortBy]);

  if (!searchId)
    return (
      <p className="text-slate-600">
        Nenhuma pesquisa selecionada. <Link className="text-brand-700 underline" href="/">Fazer uma pesquisa</Link>.
      </p>
    );
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-700">
        {error}
      </p>
    );
  if (!result) return <p className="text-slate-500">Carregando pesquisa...</p>;

  if (result.status === "executando") {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-live="polite">
        <h1 className="text-2xl font-bold">Pesquisando as melhores ofertas...</h1>
        <ul className="space-y-2">
          {result.sources.map((s) => (
            <li key={s.name} className="card flex items-center justify-between text-sm">
              <span>
                {s.name}
                {s.simulated && <span className="ml-2 badge bg-amber-100 text-amber-800">simulada</span>}
              </span>
              <span className="text-slate-500">
                {s.status === "pendente" && "aguardando"}
                {s.status === "consultando" && "consultando..."}
                {s.status === "concluida" && `${s.offers_found} ofertas`}
                {s.status === "sem_oferta" && "sem oferta compatível"}
                {s.status === "erro" && "indisponível"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (result.status === "erro") {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-700">
        {result.errors.join(" ") || "A pesquisa falhou. Tente novamente."}
      </p>
    );
  }

  const stores = Array.from(new Set(result.offers.map((o) => o.offer.store)));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Resultados</h1>
          <p className="text-slate-600">
            “{result.query.original_text}” · entrega para {result.cep.cep} ({result.cep.city}/
            {result.cep.state}) · {result.offers.length} ofertas válidas
          </p>
        </div>
        <div className="flex gap-2">
          <a href={exportUrl(result.search_id)} className="btn-primary text-sm" download>
            Exportar para Excel (.xlsx)
          </a>
          <Link href="/" className="btn-secondary text-sm">
            Nova pesquisa
          </Link>
        </div>
      </header>

      {result.mode === "demo" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Modo demonstração ativo: preços, avaliações e reputações são fictícios, criados para demonstrar a
          aplicação sem credenciais externas.
        </p>
      )}

      {result.amazon_message && (
        <p className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">{result.amazon_message}</p>
      )}

      {result.offers.length === 0 ? (
        <p className="card text-slate-600">
          Nenhuma oferta atendeu a todos os critérios obrigatórios com entrega confirmada para o CEP. Tente
          relaxar algum critério na etapa de confirmação.
        </p>
      ) : (
        <>
          <section aria-labelledby="destaques">
            <h2 id="destaques" className="mb-3 text-lg font-semibold">
              Destaques
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HIGHLIGHT_ORDER.filter((k) => result.highlights[k]).map((k) => {
                const r = offerById.get(result.highlights[k]);
                if (!r) return null;
                return (
                  <div key={k} className="card">
                    <p className="badge mb-2 bg-brand-700 text-white">{LABEL_NAMES[k]}</p>
                    <p className="font-medium leading-snug">{r.offer.product_name}</p>
                    <p className="text-sm text-slate-600">{r.offer.store}</p>
                    <p className="mt-1 text-lg font-bold">{formatBRL(r.price_breakdown.total_delivered)}</p>
                    <p className="text-sm text-brand-700">Nota {r.score.toFixed(1)}/100</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="todas">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 id="todas" className="text-lg font-semibold">
                Todas as ofertas válidas
              </h2>
              <div className="ml-auto flex flex-wrap gap-2 text-sm">
                <label>
                  <span className="sr-only">Filtrar por loja</span>
                  <select className="rounded-lg border border-slate-300 px-2 py-1.5" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                    <option value="">Todas as lojas</option>
                    {stores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filtrar por faixa de preço</span>
                  <select className="rounded-lg border border-slate-300 px-2 py-1.5" value={bandFilter} onChange={(e) => setBandFilter(e.target.value)}>
                    <option value="">Todas as faixas</option>
                    <option value="economica">Econômica</option>
                    <option value="intermediaria">Intermediária</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filtrar por origem</span>
                  <select className="rounded-lg border border-slate-300 px-2 py-1.5" value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
                    <option value="">Nacional e importado</option>
                    <option value="nacional">Somente nacional</option>
                    <option value="importado">Somente importado</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Ordenar</span>
                  <select className="rounded-lg border border-slate-300 px-2 py-1.5" value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "price")}>
                    <option value="score">Ordenar por nota</option>
                    <option value="price">Ordenar por preço total</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="space-y-4">
              {filtered.map((r) => (
                <OfferCard key={r.offer.offer_id} ranked={r} onFavorite={toggleFavorite} favorited={favIds.has(r.offer.offer_id)} />
              ))}
              {filtered.length === 0 && <p className="text-slate-500">Nenhuma oferta com os filtros atuais.</p>}
            </div>
          </section>
        </>
      )}

      {result.unvalidated_offers.length > 0 && (
        <section aria-labelledby="nao-validadas">
          <h2 id="nao-validadas" className="mb-1 text-lg font-semibold">
            Ofertas não validadas para o CEP informado
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Não foi possível confirmar a entrega destas ofertas para o seu CEP. Elas não participam do
            ranking de custo-benefício.
          </p>
          <div className="space-y-4">
            {result.unvalidated_offers.map((r) => (
              <OfferCard key={r.offer.offer_id} ranked={r} onFavorite={toggleFavorite} favorited={favIds.has(r.offer.offer_id)} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="fontes" className="card">
        <h2 id="fontes" className="mb-2 font-semibold">
          Fontes consultadas
        </h2>
        <ul className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          {result.sources.map((s) => (
            <li key={s.name}>
              {s.name}: {s.offers_found} ofertas{s.offers_discarded > 0 ? `, ${s.offers_discarded} descartadas` : ""}
              {s.simulated ? " (fonte simulada)" : ""}
              {s.message ? ` — ${s.message}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
