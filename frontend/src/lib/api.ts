import type { BacktestResponse, Quote, ScanResponse, StockDetail } from "./types";

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchScan(mode: "short" | "long", opts?: { refresh?: boolean; live?: boolean }) {
  const q = new URLSearchParams();
  if (opts?.refresh) q.set("refresh", "true");
  if (opts?.live) q.set("live", "1");
  const qs = q.toString();
  return getJSON<ScanResponse>(`/api/scan/${mode}${qs ? `?${qs}` : ""}`);
}

export function triggerRefresh(mode: "short" | "long") {
  return getJSON<{
    status: string;
    message?: string;
    updated_at_iso?: string;
    scanned?: number;
    top?: ScanResponse["top"];
    bullish?: ScanResponse["bullish"];
    bearish?: ScanResponse["bearish"];
    hold?: ScanResponse["hold"];
    bottom?: ScanResponse["bottom"];
    disclaimer?: string;
  }>(`/api/scan/${mode}/refresh`, { method: "POST" });
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

export function fetchScanHealth() {
  return getJSON<{
    ok: boolean;
    stale: boolean;
    note?: string;
    short?: { updated_at_iso?: string; universe_stale?: boolean };
    long?: { updated_at_iso?: string; universe_stale?: boolean };
  }>("/api/scan/health");
}

export function fetchMarketStatus() {
  return getJSON<{
    is_open: boolean;
    session: string;
    session_label?: string;
    poll_interval_ms?: number;
    note?: string;
    et_clock?: string;
  }>("/api/market/status");
}

export function fetchBacktest() {
  return getJSON<BacktestResponse>("/api/backtest");
}
