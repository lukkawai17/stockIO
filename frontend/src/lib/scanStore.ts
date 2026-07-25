import { promises as fs } from "fs";
import path from "path";
import type { ScanResponse, StockRow } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export async function readScan(mode: "short" | "long"): Promise<ScanResponse> {
  const file = path.join(DATA_DIR, mode === "short" ? "scan_short.json" : "scan_long.json");
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw) as ScanResponse & { all?: StockRow[] };
  return {
    mode,
    status: "ok",
    updated_at: data.updated_at,
    updated_at_iso: data.updated_at_iso,
    universe_size: data.universe_size,
    scanned: data.scanned,
    top: data.top || [],
    bottom: data.bottom || [],
    bullish: data.bullish || [],
    bearish: data.bearish || [],
    hold: data.hold || [],
    spy: data.spy,
    disclaimer: data.disclaimer,
  };
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
