import { NextResponse } from "next/server";
import { yahooFinance } from "@/lib/yahoo";

export const runtime = "nodejs";

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
    const quotes: Record<string, { ticker: string; price: number; change_pct: number; updated_at: number }> = {};
    const ts = Date.now() / 1000;
    for (const q of list) {
      if (!q?.symbol) continue;
      const price = Number(q.regularMarketPrice ?? q.postMarketPrice ?? 0);
      const change = Number(q.regularMarketChangePercent ?? 0);
      quotes[q.symbol] = {
        ticker: q.symbol,
        price: Math.round(price * 100) / 100,
        change_pct: Math.round(change * 100) / 100,
        updated_at: ts,
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
