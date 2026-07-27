import { NextResponse } from "next/server";
import { yahooFinance } from "@/lib/yahoo";

export const runtime = "nodejs";

type YQuote = {
  symbol?: string;
  marketState?: string;
  regularMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
  postMarketChangePercent?: number | null;
  preMarketChangePercent?: number | null;
};

function pickLive(q: YQuote) {
  const state = String(q.marketState || "").toUpperCase();
  let price = Number(q.regularMarketPrice ?? 0);
  let change = Number(q.regularMarketChangePercent ?? 0);

  if ((state === "POST" || state === "POSTPOST") && q.postMarketPrice != null && Number(q.postMarketPrice) > 0) {
    price = Number(q.postMarketPrice);
    if (q.postMarketChangePercent != null) change = Number(q.postMarketChangePercent);
  } else if (
    (state === "PRE" || state === "PREPRE") &&
    q.preMarketPrice != null &&
    Number(q.preMarketPrice) > 0
  ) {
    price = Number(q.preMarketPrice);
    if (q.preMarketChangePercent != null) change = Number(q.preMarketChangePercent);
  }

  return {
    price: Math.round(price * 100) / 100,
    change_pct: Math.round(change * 100) / 100,
    market_state: state || "UNKNOWN",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase().replace(/\./g, "-"))
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }
  if (symbols.length > 80) {
    return NextResponse.json({ error: "max 80 symbols" }, { status: 400 });
  }

  try {
    const raw = await yahooFinance.quote(symbols.length === 1 ? symbols[0] : symbols);
    const list = Array.isArray(raw) ? raw : [raw];
    const quotes: Record<
      string,
      { ticker: string; price: number; change_pct: number; updated_at: number; market_state?: string }
    > = {};
    const ts = Date.now() / 1000;
    for (const q of list as YQuote[]) {
      if (!q?.symbol) continue;
      const live = pickLive(q);
      if (!(live.price > 0)) continue;
      quotes[q.symbol] = {
        ticker: q.symbol,
        price: live.price,
        change_pct: live.change_pct,
        updated_at: ts,
        market_state: live.market_state,
      };
    }
    return NextResponse.json({
      quotes,
      updated_at: ts,
      updated_at_iso: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "quote failed", quotes: {} },
      { status: 502 }
    );
  }
}
