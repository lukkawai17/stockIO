import { NextResponse } from "next/server";
import { computeSnapshot, scoreLong, scoreShort } from "@/lib/analysis";
import { buildChartPayload } from "@/lib/chartData";
import { parseInstitutional } from "@/lib/institutional";
import { buildCanonicalQuote } from "@/lib/quoteCanonical";
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

    const [chartRes, spyRes, summaryRes, searchRes, quoteRes, cached] = await Promise.all([
      yahooFinance.chart(ticker, { period1, interval: "1d" }),
      yahooFinance.chart("SPY", { period1, interval: "1d" }),
      yahooFinance
        .quoteSummary(ticker, {
          modules: [
            "calendarEvents",
            "defaultKeyStatistics",
            "financialData",
            "summaryDetail",
            "institutionOwnership",
            "majorHoldersBreakdown",
          ],
        })
        .catch(() => null),
      yahooFinance.search(ticker).catch(() => null),
      yahooFinance.quote(ticker).catch(() => null),
      findInScans(ticker),
    ]);

    const chart = chartRes;
    const spyChart = spyRes;
    const summary = summaryRes;
    const search = searchRes;
    const liveQuote = quoteRes;

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

    if (bars.length < 30) {
      return NextResponse.json({ error: "找不到數據" }, { status: 404 });
    }

    const lastBar = bars[bars.length - 1];
    const prevClose = bars[bars.length - 2]?.close ?? lastBar.close;
    const chartChangePct = prevClose ? ((lastBar.close - prevClose) / prevClose) * 100 : 0;

    const quote = buildCanonicalQuote({
      quote: liveQuote as Parameters<typeof buildCanonicalQuote>[0]["quote"],
      chartClose: lastBar.close,
      chartChangePct,
      chartAsOf: lastBar.date,
    });

    // Single canonical price drives snapshot, S/R, scores, and top-level fields
    const snap = computeSnapshot(bars, {
      refPrice: quote.price,
      changePct: quote.change_pct,
    });
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
    const num = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const fundamentals = {
      roe: num(summary?.defaultKeyStatistics?.returnOnEquity ?? summary?.financialData?.returnOnEquity),
      pe: num(summary?.summaryDetail?.trailingPE ?? summary?.defaultKeyStatistics?.trailingPE),
      profit_margin: num(
        summary?.defaultKeyStatistics?.profitMargins ?? summary?.financialData?.profitMargins
      ),
      debt_to_equity: (() => {
        const d = num(summary?.financialData?.debtToEquity);
        return d == null ? null : d > 5 ? d / 100 : d;
      })(),
    };
    const institutional = parseInstitutional(summary);
    const long = scoreLong(snap, rel, fundamentals, institutional);

    void cached;

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
      // Canonical price aliases — all equal to quote.price
      price: quote.price,
      change_pct: quote.change_pct,
      quote,
      as_of: quote.as_of,
      as_of_iso: quote.as_of_iso,
      data_source: quote.source_label,
      market: {
        state: quote.market_state,
        session_label: quote.session_label,
        is_open: quote.market_state === "REGULAR",
      },
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
      institutional,
      hold_period_short: short.hold_period,
      hold_period_long: long.hold_period,
      signal_disclaimer:
        "以下「買／持有／避開」同分數均為程式演算法訊號，並非分析師評級或投資建議。",
      disclaimer: "今晚贏鋪大,老婆仔女攞去賣!",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "stock detail failed" },
      { status: 502 }
    );
  }
}
