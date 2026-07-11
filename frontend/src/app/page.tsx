"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { interpretQuery } from "@/lib/api";
import { settings } from "@/lib/db";
import { isValidCep, maskCepInput } from "@/lib/format";

const EXAMPLES = [
  "Geladeira frost free, aproximadamente 450 litros, 220 V, nova, até R$ 5.000",
  "Notebook com 16 GB de RAM, SSD de 512 GB, tela de 15 polegadas, até R$ 4.500",
  "Ar-condicionado inverter 12.000 BTUs 220 V",
  "Smartphone com boa câmera, 256 GB e bateria de longa duração",
  "Impressora tanque de tinta com baixo custo por página",
];

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [cep, setCep] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [allowImported, setAllowImported] = useState(true);
  const [saveCep, setSaveCep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefill = sessionStorage.getItem("ccb:prefill");
    if (prefill) {
      sessionStorage.removeItem("ccb:prefill");
      try {
        const { text: t, cep: c } = JSON.parse(prefill) as { text: string; cep: string };
        if (t) setText(t);
        if (c) setCep(c);
      } catch {
        /* prefill invalido: ignora */
      }
    }
    settings
      .get("cep")
      .then((saved) => {
        if (typeof saved === "string" && saved) {
          setCep((current) => current || saved);
          setSaveCep(true);
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (text.trim().length < 3) {
      setError("Descreva o produto que você procura.");
      return;
    }
    if (!isValidCep(cep)) {
      setError("Informe um CEP válido no formato 00000-000. O CEP é obrigatório para validar a entrega.");
      return;
    }
    setLoading(true);
    try {
      const parsed = maxPrice ? Number(maxPrice.replace(/\./g, "").replace(",", ".")) : null;
      const result = await interpretQuery(text.trim(), cep, parsed, allowImported);
      if (saveCep) await settings.set("cep", cep);
      else await settings.remove("cep");
      sessionStorage.setItem("ccb:draft", JSON.stringify(result));
      router.push("/confirmar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          Qual produto você quer comprar hoje?
        </h1>
        <p className="text-slate-600">
          Descreva em linguagem natural. Nós comparamos ofertas de várias lojas, validamos a entrega para o
          seu CEP e mostramos o melhor custo-benefício, com justificativa.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card space-y-4" aria-describedby={error ? "form-error" : undefined}>
        <div>
          <label htmlFor="descricao" className="mb-1 block font-medium">
            O que você procura?
          </label>
          <textarea
            id="descricao"
            className="input min-h-[90px]"
            placeholder='Ex.: "Geladeira frost free, aproximadamente 450 litros, 220 V, nova, até R$ 5.000"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cep" className="mb-1 block font-medium">
              CEP de entrega <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="cep"
              className="input"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(maskCepInput(e.target.value))}
              required
              aria-describedby="cep-ajuda"
            />
            <p id="cep-ajuda" className="mt-1 text-xs text-slate-500">
              Usado para validar entrega, frete e prazo. Obrigatório.
            </p>
          </div>
          <div>
            <label htmlFor="preco" className="mb-1 block font-medium">
              Preço máximo (opcional)
            </label>
            <input
              id="preco"
              className="input"
              inputMode="decimal"
              placeholder="Ex.: 5000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowImported}
              onChange={(e) => setAllowImported(e.target.checked)}
              className="h-4 w-4"
            />
            Permitir produtos importados
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={saveCep}
              onChange={(e) => setSaveCep(e.target.checked)}
              className="h-4 w-4"
            />
            Salvar meu CEP neste navegador
          </label>
        </div>

        {error && (
          <p id="form-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Interpretando sua pesquisa..." : "Pesquisar"}
        </button>
      </form>

      <section className="mt-8" aria-labelledby="exemplos">
        <h2 id="exemplos" className="mb-3 font-semibold text-slate-700">
          Exemplos de pesquisa
        </h2>
        <ul className="space-y-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => setText(ex)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 transition hover:border-brand-600 hover:text-brand-700"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
