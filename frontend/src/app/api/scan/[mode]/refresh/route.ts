import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ mode: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { mode } = await ctx.params;
  return NextResponse.json({
    status: "scheduled_externally",
    mode,
    message: "全市場重新計分由 GitHub Actions 自動跑（約每日數次）。報價會繼續每 3 分鐘更新。",
  });
}
