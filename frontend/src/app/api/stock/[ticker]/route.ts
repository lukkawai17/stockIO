import { NextResponse } from "next/server";
import { computeSnapshot, scoreLong, scoreShort } from "@/lib/analysis";
import { buildChartPayload } from "@/lib/chartData";
import { findInScans } from "@/lib/scanStore";
import { yahooFinance } from "@/lib/yahoo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ticker: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { ticker: raw } = await ctx.params;
  const ticker = raw.toUpperCase().replace(/\./g, "-");

  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);

    const [chart, spyChart, summary, search, cached] = await Promise.all([
      yahooFinance.chart(ticker, { period1, interval: "1d" }),
      yahooFinance.chart("SPY", { period1, interval: "1d" }),
      yahooFinance.quoteSummary(ticker, { modules: ["calendarEvents"] }).catch(() => null),
      yahooFinance.search(ticker).catch(() => null),
      findInScans(ticker),
    ]);

    const bars =
      chart.quotes
        ?.filter((q) => q.close != null && q.high != null && q.low != null)
        .map((q) => ({
          date: q.date ?? null,
          high: Number(q.high),
          low: Number(q.low),
          close: Number(q.close),
          volume: Number(q.volume || 0),
        })) || [];

    const snap = computeSnapshot(bars);
    if (!snap) {
      return NextResponse.json({ error: "找不到數據" }, { status: 404 });
    }

    const spyBars =
      spyChart.quotes
        ?.filter((q) => q.close != null)
        .map((q) => ({
          high: Number(q.high || q.close),
          low: Number(q.low || q.close),
          close: Number(q.close),
          volume: Number(q.volume || 0),
        })) || [];
    const spySnap = computeSnapshot(spyBars);
    const rel =
      spySnap != null ? Math.round((snap.ret_20d - spySnap.ret_20d) * 100) / 100 : null;

    const short = scoreShort(snap);
    const long = scoreLong(snap, rel);

    if (cached.short) {
      short.score = cached.short.score;
      short.label = cached.short.label;
      short.reason = cached.short.reason;
      if (cached.short.hold_period) short.hold_period = cached.short.hold_period;
      if (cached.short.knowledge) short.knowledge = cached.short.knowledge;
      if (cached.short.signals) short.signals = cached.short.signals;
    }
    if (cached.long) {
      long.score = cached.long.score;
      long.label = cached.long.label;
      long.reason = cached.long.reason;
      if (cached.long.hold_period) long.hold_period = cached.long.hold_period;
      if (cached.long.knowledge) long.knowledge = cached.long.knowledge;
      if (cached.long.signals) long.signals = cached.long.signals;
    }

    const earningsDate = summary?.calendarEvents?.earnings?.earningsDate?.[0];
    const news =
      search?.news?.slice(0, 8).map((n) => {
        const pub = n.providerPublishTime as number | Date | undefined;
        let published_at: string | null = null;
        if (pub instanceof Date) published_at = pub.toISOString();
        else if (typeof pub === "number") published_at = new Date(pub * 1000).toISOString();
        return {
          title: n.title,
          summary: "",
          publisher: n.publisher || "",
          link: n.link || "",
          published_at,
        };
      }) || [];

    const chartPayload = buildChartPayload(
      bars,
      snap.support_resistance.support,
      snap.support_resistance.resistance
    );

    return NextResponse.json({
      ticker,
      price: snap.price,
      change_pct: snap.change_pct,
      snapshot: snap,
      short,
      long,
      support_resistance: snap.support_resistance,
      chart: chartPayload,
      earnings: {
        next_earnings: earningsDate
          ? {
              date: new Date(earningsDate).toISOString(),
              eps_estimate: summary?.calendarEvents?.earnings?.earningsAverage ?? null,
              reported_eps: null,
            }
          : null,
        recent: [],
      },
      news,
      hold_period_short: short.hold_period,
      hold_period_long: long.hold_period,
      disclaimer: "今晚贏鋪大,老婆仔女攞去賣!",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "stock detail failed" },
      { status: 502 }
    );
  }
}
