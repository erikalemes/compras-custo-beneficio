import { API_URL, APP_NAME } from "./config";
import type { CepInfo, InterpretedQuery, SearchResults } from "./types";

// Quando NEXT_PUBLIC_STATIC_DEMO=true (build do GitHub Pages), toda a "API"
// roda no proprio navegador via src/lib/demo/engine.ts, sem backend.
const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    let detail = "Erro ao falar com o servidor.";
    try {
      const body = await resp.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* mantem mensagem generica */
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<T>;
}

export async function validateCep(cep: string): Promise<CepInfo> {
  if (STATIC_DEMO) return (await import("./demo/engine")).validateCepStatic(cep);
  return request<CepInfo>(`/api/cep/${encodeURIComponent(cep)}`);
}

export async function interpretQuery(
  text: string,
  cep: string,
  maxPrice: number | null,
  allowImported: boolean,
): Promise<{ query: InterpretedQuery; cep: CepInfo }> {
  if (STATIC_DEMO)
    return (await import("./demo/engine")).interpretRequestStatic(text, cep, maxPrice, allowImported);
  return request(`/api/interpret`, {
    method: "POST",
    body: JSON.stringify({ text, cep, max_price: maxPrice, allow_imported: allowImported }),
  });
}

export async function startSearch(query: InterpretedQuery, cep: string): Promise<{ search_id: string }> {
  if (STATIC_DEMO) return (await import("./demo/engine")).startSearchStatic(query, cep);
  return request(`/api/search`, { method: "POST", body: JSON.stringify({ query, cep }) });
}

export async function getSearch(searchId: string): Promise<SearchResults> {
  if (STATIC_DEMO) return (await import("./demo/engine")).getSearchStatic(searchId);
  return request<SearchResults>(`/api/search/${searchId}`);
}

export async function downloadExport(results: SearchResults): Promise<void> {
  if (STATIC_DEMO) {
    await (await import("./demo/excel")).exportXlsxStatic(results);
    return;
  }
  window.location.href = `${API_URL}/api/search/${results.search_id}/export`;
}

export async function getAppConfig(): Promise<{ app_name: string; mode: string }> {
  if (STATIC_DEMO) return { app_name: APP_NAME, mode: "demo" };
  return request(`/api/config`);
}
