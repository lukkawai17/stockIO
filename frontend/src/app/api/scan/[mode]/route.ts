import { NextResponse } from "next/server";
import { enrichRowLevels } from "@/lib/analysis";
import { readScan } from "@/lib/scanStore";
import type { StockRow } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ mode: string }> };

function withLevels(rows: StockRow[] | undefined, mode: "short" | "long") {
  return (rows || []).map((r) => enrichRowLevels(r, mode) as StockRow);
}

export async function GET(_req: Request, ctx: Ctx) {
  const { mode } = await ctx.params;
  if (mode !== "short" && mode !== "long") {
    return NextResponse.json({ error: "mode must be short or long" }, { status: 400 });
  }
  try {
    const data = await readScan(mode);
    return NextResponse.json({
      ...data,
      top: withLevels(data.top, mode),
      bullish: withLevels(data.bullish, mode),
      bearish: withLevels(data.bearish, mode),
      hold: withLevels(data.hold, mode),
      bottom: withLevels(data.bottom, mode),
    });
  } catch {
    return NextResponse.json(
      { mode, status: "warming_up", top: [], bullish: [], bearish: [], hold: [], message: "掃描資料尚未準備" },
      { status: 200 }
    );
  }
}
