import { computeSnapshot, scoreLong, scoreShort } from "@/lib/analysis";
import { buildCanonicalQuote } from "@/lib/quoteCanonical";
import { readScan } from "@/lib/scanStore";
import type { ScanResponse, StockRow } from "@/lib/types";
import { yahooFinance } from "@/lib/yahoo";

const TOP_N = 20;
const MAX_TICKERS = 36;
const CACHE_TTL_OPEN_MS = 2 * 60_000;
const CACHE_TTL_CLOSED_MS = 15 * 60_000;

type CacheEntry = { at: number; data: ScanResponse; ttl: number };
const memoryCache = new Map<string, CacheEntry>();

type Bar = {
  date: Date | null;
  high: number;
  low: number;
  close: number;
  volume: number;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function uniqueTickers(base: ScanResponse): string[] {
  const lists = [base.bullish, base.bearish, base.top, base.hold, base.bottom];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const r of list || []) {
      const t = (r.ticker || "").toUpperCase();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= MAX_TICKERS) return out;
    }
  }
  return out;
}

async function loadBars(ticker: string): Promise<Bar[]> {
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);
  const chart = await yahooFinance.chart(ticker, { period1, interval: "1d" });
  return (
    chart.quotes
      ?.filter((q) => q.close != null && q.high != null && q.low != null)
      .map((q) => ({
        date: q.date ?? null,
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume || 0),
      })) || []
  );
}

function rowFromScore(
  ticker: string,
  mode: "short" | "long",
  snap: NonNullable<ReturnType<typeof computeSnapshot>>,
  scored: ReturnType<typeof scoreShort>
): StockRow {
  return {
    ticker,
    name: ticker,
    price: snap.price,
    change_pct: snap.change_pct,
    score: scored.score,
    label: scored.label,
    reason: scored.reason,
    signals: scored.signals,
    horizon: mode,
    hold_period: scored.hold_period,
    knowledge: scored.knowledge,
    pillars: scored.pillars,
    framework: scored.framework,
    levels: scored.levels,
    buy_price: scored.levels?.buy ?? null,
    sell_price: scored.levels?.sell ?? null,
    stop_price: scored.levels?.stop ?? null,
    rsi: snap.rsi,
    macd_hist: snap.macd_hist,
    ret_5d: snap.ret_5d,
    ret_20d: snap.ret_20d,
    ret_63d: snap.ret_63d,
    volume_ratio: snap.volume_ratio,
    atr_pct: snap.atr_pct,
    ma20: snap.ma20,
    ma50: snap.ma50,
    ma200: snap.ma200,
    support_resistance: snap.support_resistance,
  };
}

/**
 * Re-score the tickers currently featured in the static scan lists
 * using live Yahoo charts/quotes. Cached briefly to protect rate limits.
 */
export async function liveRescoreScan(
  mode: "short" | "long",
  opts?: { force?: boolean; marketOpen?: boolean }
): Promise<ScanResponse> {
  const ttl = opts?.marketOpen ? CACHE_TTL_OPEN_MS : CACHE_TTL_CLOSED_MS;
  const cached = memoryCache.get(mode);
  if (!opts?.force && cached && Date.now() - cached.at < cached.ttl) {
    return { ...cached.data, status: "live_cached" };
  }

  const base = await readScan(mode);
  const tickers = uniqueTickers(base);
  if (!tickers.length) {
    return { ...base, status: "empty" };
  }

  // Batch quotes (cheap) + SPY chart for relative strength
  const quoteSymbols = [...tickers, "SPY"];
  let quoteMap: Record<string, unknown> = {};
  try {
    const raw = await yahooFinance.quote(quoteSymbols.length === 1 ? quoteSymbols[0] : quoteSymbols);
    const list = Array.isArray(raw) ? raw : [raw];
    for (const q of list) {
      if (q?.symbol) quoteMap[q.symbol] = q;
    }
  } catch {
    quoteMap = {};
  }

  let spyRet20: number | null = null;
  try {
    const spyBars = await loadBars("SPY");
    const spySnap = computeSnapshot(spyBars);
    spyRet20 = spySnap?.ret_20d ?? null;
  } catch {
    spyRet20 = null;
  }

  const settled = await mapPool(tickers, 6, async (ticker) => {
    try {
      const bars = await loadBars(ticker);
      if (bars.length < 30) return null;
      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2]?.close ?? last.close;
      const chartChange = prev ? ((last.close - prev) / prev) * 100 : 0;
      const quote = buildCanonicalQuote({
        quote: (quoteMap[ticker] || null) as Parameters<typeof buildCanonicalQuote>[0]["quote"],
        chartClose: last.close,
        chartChangePct: chartChange,
        chartAsOf: last.date,
      });
      const snap = computeSnapshot(bars, {
        refPrice: quote.price,
        changePct: quote.change_pct,
      });
      if (!snap) return null;

      if (mode === "short") {
        return rowFromScore(ticker, mode, snap, scoreShort(snap));
      }
      const rel =
        spyRet20 != null ? Math.round((snap.ret_20d - spyRet20) * 100) / 100 : null;
      return rowFromScore(ticker, mode, snap, scoreLong(snap, rel));
    } catch {
      return null;
    }
  });

  const rows = settled.filter((r): r is StockRow => r != null);
  if (!rows.length) {
    return { ...base, status: "live_failed", message: "即時重計失敗，沿用上次掃描" };
  }

  rows.sort((a, b) => b.score - a.score);
  const bullish = rows.filter((r) => r.label === "買").slice(0, TOP_N);
  const bearish = rows
    .filter((r) => r.label === "避開")
    .sort((a, b) => a.score - b.score)
    .slice(0, TOP_N);
  const hold = rows.filter((r) => r.label === "持有").slice(0, TOP_N);
  const top = rows.slice(0, TOP_N);
  const bottom = [...rows].reverse().slice(0, TOP_N);
  const now = Date.now() / 1000;

  const data: ScanResponse = {
    ...base,
    status: "live",
    updated_at: now,
    updated_at_iso: new Date(now * 1000).toISOString(),
    scanned: rows.length,
    top,
    bottom,
    bullish,
    bearish,
    hold,
    spy:
      spyRet20 != null
        ? {
            price: base.spy?.price ?? 0,
            change_pct: base.spy?.change_pct ?? 0,
            ret_20d: spyRet20,
          }
        : base.spy,
    disclaimer: base.disclaimer || "今晚贏鋪大,老婆仔女攞去賣!",
  };

  memoryCache.set(mode, { at: Date.now(), data, ttl });
  return data;
}

export function scorePollIntervalMs(session: string): number {
  if (session === "regular") return 3 * 60_000;
  if (session === "pre" || session === "post") return 5 * 60_000;
  return 15 * 60_000;
}
