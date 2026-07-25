import type { Quote, ScanResponse, StockDetail } from "./types";

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchScan(mode: "short" | "long", refresh = false) {
  const q = refresh ? "?refresh=true" : "";
  return getJSON<ScanResponse>(`/api/scan/${mode}${q}`);
}

export function triggerRefresh(mode: "short" | "long") {
  return getJSON<{ status: string }>(`/api/scan/${mode}/refresh`, { method: "POST" });
}

export function fetchQuotes(symbols: string[], refresh = false): Promise<{
  quotes: Record<string, Quote>;
  updated_at?: number;
  updated_at_iso?: string;
}> {
  if (!symbols.length) {
    return Promise.resolve({ quotes: {} });
  }
  const q = new URLSearchParams({
    symbols: symbols.join(","),
    ...(refresh ? { refresh: "true" } : {}),
  });
  return getJSON(`/api/quotes?${q}`);
}

export function fetchStock(ticker: string) {
  return getJSON<StockDetail>(`/api/stock/${encodeURIComponent(ticker)}`);
}

export function fetchMarketStatus() {
  return getJSON<{ is_open: boolean; session: string; note?: string }>("/api/market/status");
}
