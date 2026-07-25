const KEY = "stockio.watchlist.v1";

export function loadWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.map((t) => t.toUpperCase()) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(tickers: string[]) {
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));
  localStorage.setItem(KEY, JSON.stringify(unique));
  return unique;
}

export function toggleWatch(ticker: string): string[] {
  const t = ticker.toUpperCase();
  const cur = loadWatchlist();
  const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  return saveWatchlist(next);
}

export function exportWatchlist(): string {
  return JSON.stringify({ watchlist: loadWatchlist(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importWatchlist(json: string): string[] {
  const data = JSON.parse(json) as { watchlist?: string[] } | string[];
  const list = Array.isArray(data) ? data : data.watchlist || [];
  return saveWatchlist(list);
}
