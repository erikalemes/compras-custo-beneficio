import { API_URL } from "./config";
import type { CepInfo, InterpretedQuery, SearchResults } from "./types";

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

export function validateCep(cep: string): Promise<CepInfo> {
  return request<CepInfo>(`/api/cep/${encodeURIComponent(cep)}`);
}

export function interpretQuery(
  text: string,
  cep: string,
  maxPrice: number | null,
  allowImported: boolean,
): Promise<{ query: InterpretedQuery; cep: CepInfo }> {
  return request(`/api/interpret`, {
    method: "POST",
    body: JSON.stringify({ text, cep, max_price: maxPrice, allow_imported: allowImported }),
  });
}

export function startSearch(query: InterpretedQuery, cep: string): Promise<{ search_id: string }> {
  return request(`/api/search`, { method: "POST", body: JSON.stringify({ query, cep }) });
}

export function getSearch(searchId: string): Promise<SearchResults> {
  return request<SearchResults>(`/api/search/${searchId}`);
}

export function exportUrl(searchId: string): string {
  return `${API_URL}/api/search/${searchId}/export`;
}

export function getAppConfig(): Promise<{ app_name: string; mode: string }> {
  return request(`/api/config`);
}
