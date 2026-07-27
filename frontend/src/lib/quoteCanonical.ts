/** Canonical live quote shared by stock detail header, S/R, and levels. */

export type MarketState =
  | "PRE"
  | "REGULAR"
  | "POST"
  | "CLOSED"
  | "UNKNOWN";

export type CanonicalQuote = {
  /** Display / scoring price — single source of truth for the page. */
  price: number;
  change_pct: number;
  /** Unix seconds when the quote was observed (provider or server). */
  as_of: number;
  as_of_iso: string;
  /** yahoo_quote | daily_close | mixed_fallback */
  source: "yahoo_quote" | "daily_close" | "mixed_fallback";
  source_label: string;
  market_state: MarketState;
  session_label: string;
  /** True when we fell back because live quote was missing/stale. */
  stale: boolean;
  currency?: string;
};

export function sessionLabel(state: MarketState): string {
  switch (state) {
    case "PRE":
      return "盤前";
    case "REGULAR":
      return "開市中";
    case "POST":
      return "盤後";
    case "CLOSED":
      return "已收市";
    default:
      return "時段未知";
  }
}

export function normalizeMarketState(raw: unknown): MarketState {
  const s = String(raw || "").toUpperCase();
  if (s === "PRE" || s === "PREPRE") return "PRE";
  if (s === "REGULAR") return "REGULAR";
  if (s === "POST" || s === "POSTPOST") return "POST";
  if (s === "CLOSED" || s === "HOLIDAY") return "CLOSED";
  return "UNKNOWN";
}

export function sourceLabel(source: CanonicalQuote["source"]): string {
  switch (source) {
    case "yahoo_quote":
      return "Yahoo Finance 報價";
    case "daily_close":
      return "日線收市價";
    default:
      return "備用報價";
  }
}

type QuoteLike = {
  regularMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
  postMarketChangePercent?: number | null;
  preMarketChangePercent?: number | null;
  regularMarketTime?: Date | number | null;
  postMarketTime?: Date | number | null;
  preMarketTime?: Date | number | null;
  marketState?: string | null;
  currency?: string | null;
};

function toUnix(v: Date | number | null | undefined, fallback: number): number {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime() / 1000;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1e12 ? v / 1000 : v;
  }
  return fallback;
}

/**
 * Prefer a live Yahoo quote. Never mix chart close with quote change%.
 * If quote is missing/invalid, fall back to daily close from the chart.
 */
export function buildCanonicalQuote(opts: {
  quote?: QuoteLike | null;
  chartClose: number;
  chartChangePct: number;
  chartAsOf?: Date | number | null;
  nowSec?: number;
}): CanonicalQuote {
  const now = opts.nowSec ?? Date.now() / 1000;
  const chartAsOf = toUnix(opts.chartAsOf ?? null, now);
  const q = opts.quote;

  if (q) {
    const state = normalizeMarketState(q.marketState);
    let price =
      Number(q.regularMarketPrice) ||
      Number(q.postMarketPrice) ||
      Number(q.preMarketPrice) ||
      0;
    let changePct = Number(q.regularMarketChangePercent);
    let asOf = toUnix(q.regularMarketTime, now);

    if (state === "POST" && q.postMarketPrice != null && Number(q.postMarketPrice) > 0) {
      price = Number(q.postMarketPrice);
      if (q.postMarketChangePercent != null) changePct = Number(q.postMarketChangePercent);
      asOf = toUnix(q.postMarketTime, asOf);
    } else if (state === "PRE" && q.preMarketPrice != null && Number(q.preMarketPrice) > 0) {
      price = Number(q.preMarketPrice);
      if (q.preMarketChangePercent != null) changePct = Number(q.preMarketChangePercent);
      asOf = toUnix(q.preMarketTime, asOf);
    }

    if (Number.isFinite(price) && price > 0 && Number.isFinite(changePct)) {
      // Reject extremely stale quotes (>2 days behind chart bar) — fall back
      const staleVsChart = chartAsOf > 0 && asOf + 2 * 86400 < chartAsOf;
      if (!staleVsChart) {
        return {
          price: Math.round(price * 100) / 100,
          change_pct: Math.round(changePct * 100) / 100,
          as_of: asOf,
          as_of_iso: new Date(asOf * 1000).toISOString(),
          source: "yahoo_quote",
          source_label: sourceLabel("yahoo_quote"),
          market_state: state,
          session_label: sessionLabel(state),
          stale: false,
          currency: q.currency || "USD",
        };
      }
    }
  }

  return {
    price: Math.round(opts.chartClose * 100) / 100,
    change_pct: Math.round(opts.chartChangePct * 100) / 100,
    as_of: chartAsOf,
    as_of_iso: new Date(chartAsOf * 1000).toISOString(),
    source: q ? "mixed_fallback" : "daily_close",
    source_label: sourceLabel(q ? "mixed_fallback" : "daily_close"),
    market_state: normalizeMarketState(q?.marketState),
    session_label: sessionLabel(normalizeMarketState(q?.marketState)),
    stale: true,
    currency: q?.currency || "USD",
  };
}
