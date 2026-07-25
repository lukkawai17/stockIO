import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const file = path.join(process.cwd(), "public", "data", "backtest.json");
    const raw = await fs.readFile(file, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        status: "warming_up",
        message: "回測資料尚未準備（會由 GitHub Actions 每週更新）",
        short: null,
        long: null,
      },
      { status: 200 }
    );
  }
}
