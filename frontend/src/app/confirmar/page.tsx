"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startSearch } from "@/lib/api";
import type { CepInfo, Criterion, CriterionKind, InterpretedQuery } from "@/lib/types";

const KIND_LABEL: Record<CriterionKind, string> = {
  obrigatorio: "Obrigatório",
  desejavel: "Desejável",
  indiferente: "Indiferente",
};

export default function ConfirmarPage() {
  const router = useRouter();
  const [query, setQuery] = useState<InterpretedQuery | null>(null);
  const [cep, setCep] = useState<CepInfo | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("ccb:draft");
    if (!raw) {
      router.replace("/");
      return;
    }
    const draft = JSON.parse(raw) as { query: InterpretedQuery; cep: CepInfo };
    setQuery(draft.query);
    setCep(draft.cep);
  }, [router]);

  if (!query || !cep) return <p className="text-slate-500">Carregando...</p>;

  function updateCriterion(id: string, patch: Partial<Criterion>) {
    setQuery((q) =>
      q ? { ...q, criteria: q.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : q,
    );
  }

  function removeCriterion(id: string) {
    setQuery((q) => (q ? { ...q, criteria: q.criteria.filter((c) => c.id !== id) } : q));
  }

  function addCriterion() {
    const label = newLabel.trim();
    if (!label || !query) return;
    const id = `custom-${Date.now()}`;
    setQuery({
      ...query,
      criteria: [
        ...query.criteria,
        {
          id,
          label,
          field: label
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "_"),
          operator: "contains",
          value: label,
          unit: "",
          kind: "desejavel",
        },
      ],
    });
    setNewLabel("");
  }

  async function handleSearch() {
    if (!query || !cep) return;
    setLoading(true);
    setError("");
    try {
      const { search_id } = await startSearch(query, cep.cep);
      sessionStorage.setItem("ccb:last-search", search_id);
      router.push(`/resultados?id=${search_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar a pesquisa.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Confira o que entendemos</h1>
        <p className="text-slate-600">
          Ajuste os critérios antes de pesquisar: mova entre obrigatório, desejável e indiferente, edite
          valores ou remova o que não interessa.
        </p>
      </header>

      <section className="card space-y-1 text-sm" aria-label="Resumo da pesquisa">
        <p>
          <span className="font-semibold">Pesquisa:</span> “{query.original_text}”
        </p>
        <p>
          <span className="font-semibold">Categoria:</span> {query.category_label}
        </p>
        <p>
          <span className="font-semibold">Entrega para:</span> {cep.cep} — {cep.city || "cidade não identificada"}
          {cep.state ? `/${cep.state}` : ""}
          {cep.message ? <span className="text-amber-700"> ({cep.message})</span> : null}
        </p>
        <p>
          <span className="font-semibold">Tolerância para equivalentes:</span>{" "}
          {(query.tolerance * 100).toFixed(0)}%
        </p>
        {query.notes.map((n) => (
          <p key={n} className="text-amber-700">
            {n}
          </p>
        ))}
      </section>

      <section aria-label="Critérios identificados" className="card space-y-3">
        <h2 className="font-semibold">Critérios</h2>
        <ul className="space-y-2">
          {query.criteria.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="min-w-0 flex-1 font-medium">{c.label}</span>
              <label className="sr-only" htmlFor={`kind-${c.id}`}>
                Tipo do critério {c.label}
              </label>
              <select
                id={`kind-${c.id}`}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={c.kind}
                onChange={(e) => updateCriterion(c.id, { kind: e.target.value as CriterionKind })}
                disabled={c.id === "entrega_cep" || c.id === "novo"}
              >
                {(Object.keys(KIND_LABEL) as CriterionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              {typeof c.value === "number" && (
                <>
                  <label className="sr-only" htmlFor={`val-${c.id}`}>
                    Valor de {c.label}
                  </label>
                  <input
                    id={`val-${c.id}`}
                    type="number"
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    value={c.value}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateCriterion(c.id, { value: v, label: c.label.replace(/[\d.,]+/, String(v)) });
                    }}
                  />
                </>
              )}
              {c.unit && <span className="text-xs text-slate-500">{c.unit}</span>}
              {c.id !== "entrega_cep" && c.id !== "novo" && (
                <button
                  type="button"
                  onClick={() => removeCriterion(c.id)}
                  className="text-sm text-red-600 hover:underline"
                  aria-label={`Remover critério ${c.label}`}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 pt-2">
          <label className="sr-only" htmlFor="novo-criterio">
            Adicionar critério
          </label>
          <input
            id="novo-criterio"
            className="input"
            placeholder="Adicionar critério (ex.: cor inox)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriterion())}
          />
          <button type="button" onClick={addCriterion} className="btn-secondary shrink-0">
            Adicionar
          </button>
        </div>
      </section>

      <section className="card flex flex-wrap items-center gap-4" aria-label="Preferências finais">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={query.allow_imported}
            onChange={(e) => setQuery({ ...query, allow_imported: e.target.checked })}
            className="h-4 w-4"
          />
          Permitir produtos importados
        </label>
        <label className="flex items-center gap-2 text-sm">
          Preço máximo (R$):
          <input
            type="number"
            className="w-32 rounded-lg border border-slate-300 px-2 py-1"
            value={query.max_price ?? ""}
            onChange={(e) =>
              setQuery({ ...query, max_price: e.target.value ? Number(e.target.value) : null })
            }
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push("/")} className="btn-secondary">
          Voltar
        </button>
        <button type="button" onClick={handleSearch} className="btn-primary flex-1" disabled={loading}>
          {loading ? "Iniciando pesquisa..." : "Confirmar e pesquisar"}
        </button>
      </div>
    </div>
  );
}
