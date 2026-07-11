// Armazenamento local no navegador via IndexedDB (secao 23).
// Sem cadastro: favoritos, historico de pesquisas e preferencias ficam aqui.

const DB_NAME = "compras-custo-beneficio";
const DB_VERSION = 1;

export interface FavoriteEntry {
  id: string;
  kind: "oferta" | "pesquisa";
  title: string;
  payload: unknown;
  createdAt: string;
}

export interface SearchHistoryEntry {
  id: string;
  text: string;
  cep: string;
  city: string;
  state: string;
  createdAt: string;
  resultCount: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("favorites")) db.createObjectStore("favorites", { keyPath: "id" });
      if (!db.objectStoreNames.contains("searches")) db.createObjectStore("searches", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export const favorites = {
  all: () => tx<FavoriteEntry[]>("favorites", "readonly", (s) => s.getAll()),
  save: (entry: FavoriteEntry) => tx("favorites", "readwrite", (s) => s.put(entry)),
  remove: (id: string) => tx("favorites", "readwrite", (s) => s.delete(id)),
  clear: () => tx("favorites", "readwrite", (s) => s.clear()),
};

export const searches = {
  all: () => tx<SearchHistoryEntry[]>("searches", "readonly", (s) => s.getAll()),
  save: (entry: SearchHistoryEntry) => tx("searches", "readwrite", (s) => s.put(entry)),
  remove: (id: string) => tx("searches", "readwrite", (s) => s.delete(id)),
  clear: () => tx("searches", "readwrite", (s) => s.clear()),
};

export const settings = {
  async get(key: string): Promise<unknown> {
    const row = await tx<{ key: string; value: unknown } | undefined>("settings", "readonly", (s) => s.get(key));
    return row?.value;
  },
  set: (key: string, value: unknown) => tx("settings", "readwrite", (s) => s.put({ key, value })),
  remove: (key: string) => tx("settings", "readwrite", (s) => s.delete(key)),
};

export async function clearAllLocalData(): Promise<void> {
  await favorites.clear();
  await searches.clear();
  await tx("settings", "readwrite", (s) => s.clear());
}
