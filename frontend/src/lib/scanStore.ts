import { promises as fs } from "fs";
import path from "path";
import type { ScanResponse, StockRow } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

/** Universe scan older than this is treated as stale in the UI. */
export const UNIVERSE_STALE_MS = 36 * 60 * 60 * 1000;

export function universeAgeMs(updatedAtIso?: string | null, updatedAtSec?: number | null): number | null {
  if (updatedAtIso) {
    const t = new Date(updatedAtIso).getTime();
    if (Number.isFinite(t)) return Math.max(0, Date.now() - t);
  }
  if (updatedAtSec != null && Number.isFinite(updatedAtSec)) {
    const ms = updatedAtSec > 1e12 ? updatedAtSec : updatedAtSec * 1000;
    return Math.max(0, Date.now() - ms);
  }
  return null;
}

export function isUniverseStale(updatedAtIso?: string | null, updatedAtSec?: number | null): boolean {
  const age = universeAgeMs(updatedAtIso, updatedAtSec);
  return age == null ? true : age > UNIVERSE_STALE_MS;
}

export async function readScan(mode: "short" | "long"): Promise<ScanResponse> {
  const file = path.join(DATA_DIR, mode === "short" ? "scan_short.json" : "scan_long.json");
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw) as ScanResponse & { all?: StockRow[] };
  const universeIso = data.updated_at_iso ?? null;
  const stale = isUniverseStale(universeIso, data.updated_at);

  return {
    mode,
    status: stale ? "universe_stale" : "ok",
    updated_at: data.updated_at,
    updated_at_iso: data.updated_at_iso,
    universe_updated_at: data.updated_at,
    universe_updated_at_iso: universeIso || undefined,
    universe_stale: stale,
    universe_size: data.universe_size,
    scanned: data.scanned,
    top: data.top || [],
    bottom: data.bottom || [],
    bullish: data.bullish || [],
    bearish: data.bearish || [],
    hold: data.hold || [],
    spy: data.spy,
    disclaimer: data.disclaimer,
    message: stale
      ? "全市場掃描偏舊；名單來源可能滯後。分數會嘗試即時重計榜內標的。"
      : undefined,
  };
}

export async function readScanHealth(): Promise<{
  updated_at_iso?: string;
  short_updated_at_iso?: string;
  long_updated_at_iso?: string;
  ok?: boolean;
  message?: string;
} | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "scan_health.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function findInScans(ticker: string): Promise<{ short?: StockRow; long?: StockRow }> {
  const t = ticker.toUpperCase();
  const out: { short?: StockRow; long?: StockRow } = {};
  for (const mode of ["short", "long"] as const) {
    try {
      const file = path.join(DATA_DIR, mode === "short" ? "scan_short.json" : "scan_long.json");
      const raw = await fs.readFile(file, "utf8");
      const data = JSON.parse(raw) as { all?: StockRow[]; top?: StockRow[]; bullish?: StockRow[] };
      const pool = [...(data.all || []), ...(data.top || []), ...(data.bullish || [])];
      const hit = pool.find((r) => r.ticker === t);
      if (hit) out[mode] = hit;
    } catch {
      /* ignore */
    }
  }
  return out;
}
