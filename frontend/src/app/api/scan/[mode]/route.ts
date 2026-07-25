import { NextResponse } from "next/server";
import { readScan } from "@/lib/scanStore";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ mode: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { mode } = await ctx.params;
  if (mode !== "short" && mode !== "long") {
    return NextResponse.json({ error: "mode must be short or long" }, { status: 400 });
  }
  try {
    const data = await readScan(mode);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { mode, status: "warming_up", top: [], bullish: [], bearish: [], hold: [], message: "掃描資料尚未準備" },
      { status: 200 }
    );
  }
}
