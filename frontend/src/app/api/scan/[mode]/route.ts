import { NextResponse } from "next/server";
import { enrichRowLevels } from "@/lib/analysis";
import { liveRescoreScan } from "@/lib/liveRescore";
import { getUsMarketSession } from "@/lib/marketHours";
import { readScan } from "@/lib/scanStore";
import type { StockRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ mode: string }> };

function withLevels(rows: StockRow[] | undefined, mode: "short" | "long") {
  return (rows || []).map((r) => enrichRowLevels(r, mode) as StockRow);
}

function decorate(data: Awaited<ReturnType<typeof readScan>>, mode: "short" | "long") {
  return {
    ...data,
    top: withLevels(data.top, mode),
    bullish: withLevels(data.bullish, mode),
    bearish: withLevels(data.bearish, mode),
    hold: withLevels(data.hold, mode),
    bottom: withLevels(data.bottom, mode),
  };
}

export async function GET(req: Request, ctx: Ctx) {
  const { mode } = await ctx.params;
  if (mode !== "short" && mode !== "long") {
    return NextResponse.json({ error: "mode must be short or long" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const live = searchParams.get("live") === "1" || searchParams.get("live") === "true";
  const force = searchParams.get("refresh") === "true" || searchParams.get("force") === "1";

  try {
    if (!live) {
      const data = await readScan(mode);
      return NextResponse.json(decorate(data, mode));
    }

    const session = getUsMarketSession();
    const data = await liveRescoreScan(mode, {
      force,
      marketOpen: session.session === "regular" || session.session === "pre" || session.session === "post",
    });
    return NextResponse.json({
      ...decorate(data, mode),
      live: true,
      score_poll_interval_ms:
        session.session === "regular" ? 3 * 60_000 : session.session === "closed" ? 15 * 60_000 : 5 * 60_000,
      session: session.session,
      session_label: session.session_label,
    });
  } catch {
    try {
      const data = await readScan(mode);
      return NextResponse.json({
        ...decorate(data, mode),
        status: "fallback_static",
        message: "即時重計暫時失敗，顯示上次掃描分數",
      });
    } catch {
      return NextResponse.json(
        {
          mode,
          status: "warming_up",
          top: [],
          bullish: [],
          bearish: [],
          hold: [],
          message: "掃描資料尚未準備",
        },
        { status: 200 }
      );
    }
  }
}
