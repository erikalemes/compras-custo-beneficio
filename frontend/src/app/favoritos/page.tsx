"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearAllLocalData,
  favorites,
  searches,
  settings,
  type FavoriteEntry,
  type SearchHistoryEntry,
} from "@/lib/db";
import { formatBRL } from "@/lib/format";
import type { RankedOffer } from "@/lib/types";

export default function FavoritosPage() {
  const router = useRouter();
  const [favs, setFavs] = useState<FavoriteEntry[]>([]);
  const [hist, setHist] = useState<SearchHistoryEntry[]>([]);
  const [savedCep, setSavedCep] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function reload() {
    setFavs(await favorites.all().catch(() => []));
    const h = await searches.all().catch(() => []);
    setHist(h.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    const cep = await settings.get("cep").catch(() => null);
    setSavedCep(typeof cep === "string" ? cep : null);
  }

  useEffect(() => {
    reload();
  }, []);

  async function searchAgain(entry: SearchHistoryEntry) {
    sessionStorage.setItem("ccb:prefill", JSON.stringify({ text: entry.text, cep: entry.cep }));
    router.push(`/?texto=${encodeURIComponent(entry.text)}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Favoritos e histórico</h1>
        <p className="text-slate-600">
          Tudo aqui fica salvo apenas no seu navegador (IndexedDB). Nada é enviado a servidores.
        </p>
      </header>

      <section aria-labelledby="favs" className="space-y-3">
        <h2 id="favs" className="text-lg font-semibold">
          Ofertas favoritas ({favs.length})
        </h2>
        {favs.length === 0 && <p className="text-slate-500">Nenhum favorito salvo ainda.</p>}
        {favs.map((f) => {
          const ranked = f.payload as RankedOffer;
          return (
            <div key={f.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-slate-600">
                  {ranked?.offer?.store} · salvo em {new Date(f.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                  {formatBRL(ranked?.price_breakdown?.total_delivered)} na época
                </p>
              </div>
              <div className="flex gap-2">
                {ranked?.offer?.url && (
                  <a href={ranked.offer.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                    Ver oferta ↗
                  </a>
                )}
                <button
                  type="button"
                  className="btn-secondary text-sm text-red-600"
                  onClick={async () => {
                    await favorites.remove(f.id);
                    reload();
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="hist" className="space-y-3">
        <h2 id="hist" className="text-lg font-semibold">
          Pesquisas anteriores ({hist.length})
        </h2>
        {hist.length === 0 && <p className="text-slate-500">Nenhuma pesquisa registrada neste navegador.</p>}
        {hist.map((h) => (
          <div key={h.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">“{h.text}”</p>
              <p className="text-sm text-slate-600">
                {new Date(h.createdAt).toLocaleString("pt-BR")} · CEP {h.cep} ({h.city}/{h.state}) ·{" "}
                {h.resultCount} ofertas
              </p>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={() => searchAgain(h)}>
              Pesquisar novamente
            </button>
          </div>
        ))}
      </section>

      <section aria-labelledby="dados" className="card space-y-3">
        <h2 id="dados" className="font-semibold">
          Seus dados locais
        </h2>
        <p className="text-sm text-slate-600">
          CEP salvo neste navegador: <strong>{savedCep ?? "nenhum"}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={async () => {
              await searches.clear();
              setMessage("Histórico de pesquisas apagado.");
              reload();
            }}
          >
            Apagar histórico
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={async () => {
              await favorites.clear();
              setMessage("Favoritos apagados.");
              reload();
            }}
          >
            Apagar favoritos
          </button>
          <button
            type="button"
            className="btn-secondary text-sm text-red-600"
            onClick={async () => {
              await clearAllLocalData();
              setMessage("Todos os dados locais foram apagados.");
              reload();
            }}
          >
            Limpar todos os dados locais
          </button>
        </div>
        {message && (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        )}
      </section>

      <p className="text-sm">
        <Link href="/" className="text-brand-700 underline">
          ← Voltar para a pesquisa
        </Link>
      </p>
    </div>
  );
}
