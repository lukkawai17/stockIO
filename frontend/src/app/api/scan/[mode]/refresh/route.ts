import { NextResponse } from "next/server";
import { enrichRowLevels } from "@/lib/analysis";
import { liveRescoreScan } from "@/lib/liveRescore";
import { getUsMarketSession } from "@/lib/marketHours";
import type { StockRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ mode: string }> };

function withLevels(rows: StockRow[] | undefined, mode: "short" | "long") {
  return (rows || []).map((r) => enrichRowLevels(r, mode) as StockRow);
}

export async function POST(_req: Request, ctx: Ctx) {
  const { mode } = await ctx.params;
  if (mode !== "short" && mode !== "long") {
    return NextResponse.json({ error: "mode must be short or long" }, { status: 400 });
  }

  try {
    const session = getUsMarketSession();
    const data = await liveRescoreScan(mode, {
      force: true,
      marketOpen: session.session !== "closed",
    });
    return NextResponse.json({
      status: "ok",
      mode,
      message: `已即時重計 ${data.scanned ?? 0} 隻（開市清單內標的）。全市場掃描仍由 GitHub Actions 定時跑。`,
      updated_at_iso: data.updated_at_iso,
      scanned: data.scanned,
      top: withLevels(data.top, mode),
      bullish: withLevels(data.bullish, mode),
      bearish: withLevels(data.bearish, mode),
      hold: withLevels(data.hold, mode),
      bottom: withLevels(data.bottom, mode),
      disclaimer: data.disclaimer,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        mode,
        message: e instanceof Error ? e.message : "即時重計失敗",
      },
      { status: 502 }
    );
  }
}
