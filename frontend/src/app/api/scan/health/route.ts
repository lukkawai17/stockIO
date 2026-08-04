import { NextResponse } from "next/server";
import { isUniverseStale, readScan, readScanHealth } from "@/lib/scanStore";

export const runtime = "nodejs";

export async function GET() {
  const [short, long, health] = await Promise.all([
    readScan("short").catch(() => null),
    readScan("long").catch(() => null),
    readScanHealth(),
  ]);

  const shortIso = short?.universe_updated_at_iso || short?.updated_at_iso;
  const longIso = long?.universe_updated_at_iso || long?.updated_at_iso;
  const stale =
    isUniverseStale(shortIso, short?.universe_updated_at) ||
    isUniverseStale(longIso, long?.universe_updated_at);

  return NextResponse.json({
    ok: !stale,
    stale,
    short: {
      updated_at_iso: shortIso,
      scanned: short?.scanned,
      universe_stale: short?.universe_stale ?? true,
      status: short?.status,
    },
    long: {
      updated_at_iso: longIso,
      scanned: long?.scanned,
      universe_stale: long?.universe_stale ?? true,
      status: long?.status,
    },
    health,
    note: stale
      ? "全市場掃描超過約 36 小時未更新。請檢查 GitHub Actions「Market Scan」。"
      : "全市場掃描資料尚新。",
    stale_after_hours: 36,
  });
}
