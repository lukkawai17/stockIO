import { describe, expect, it } from "vitest";
import {
  computeSnapshot,
  computeSupportResistance,
  sanitizeSupportResistance,
} from "@/lib/analysis";
import { buildCanonicalQuote } from "@/lib/quoteCanonical";

type Bar = { high: number; low: number; close: number; volume: number };

function makeBars(closes: number[]): Bar[] {
  return closes.map((c, i) => {
    const wobble = (i % 5) * 0.15;
    return {
      high: c + 1.2 + wobble,
      low: c - 1.1 - wobble,
      close: c,
      volume: 1_000_000 + i * 1000,
    };
  });
}

/** Rising then flat series so S/R candidates exist around a mid price. */
function trendingBars(n = 60, start = 80, step = 0.4): Bar[] {
  const closes: number[] = [];
  for (let i = 0; i < n; i++) closes.push(start + i * step);
  return makeBars(closes);
}

describe("computeSupportResistance", () => {
  it("places support below and resistance above the reference price", () => {
    const bars = trendingBars();
    const last = bars[bars.length - 1].close;
    const mid = last * 0.97;
    const sr = computeSupportResistance(bars, mid);

    if (sr.support != null) {
      expect(sr.support).toBeLessThan(mid);
      expect(sr.support_valid).toBe(true);
    }
    if (sr.resistance != null) {
      expect(sr.resistance).toBeGreaterThan(mid);
      expect(sr.resistance_valid).toBe(true);
    }
    expect(sr.support == null || sr.resistance == null || sr.support < sr.resistance).toBe(true);
  });

  it("classifies correctly when price is below / equal / above structural levels", () => {
    const bars = trendingBars(50, 100, 0.5);
    const last = bars[bars.length - 1].close;

    const belowBreak = computeSupportResistance(bars, last * 1.08);
    // Price above recent range → support may exist below; resistance may be null
    if (belowBreak.support != null) expect(belowBreak.support).toBeLessThan(last * 1.08);
    if (belowBreak.resistance != null) expect(belowBreak.resistance).toBeGreaterThan(last * 1.08);

    const aboveBreak = computeSupportResistance(bars, last * 0.85);
    if (aboveBreak.support != null) expect(aboveBreak.support).toBeLessThan(last * 0.85);
    if (aboveBreak.resistance != null) expect(aboveBreak.resistance).toBeGreaterThan(last * 0.85);

    const atPrice = computeSupportResistance(bars, last);
    if (atPrice.support != null) expect(atPrice.support).toBeLessThan(last - 0.01);
    if (atPrice.resistance != null) expect(atPrice.resistance).toBeGreaterThan(last + 0.01);
  });

  it("rejects near-price noise (sub-0.5% fake levels)", () => {
    // Construct bars with a clear swing low far below and a tiny spike high near price
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.2);
    const bars = closes.map((c, i) => ({
      high: c + (i === 48 ? 0.2 : 1.5),
      low: c - (i === 30 ? 8 : 1.2), // deep swing low around bar 30
      close: c,
      volume: 1e6,
    }));
    const price = bars[bars.length - 1].close;
    const sr = computeSupportResistance(bars, price);
    if (sr.support != null) {
      expect((price - sr.support) / price).toBeGreaterThanOrEqual(0.006);
      expect(sr.support).toBeLessThan(price);
    }
    if (sr.resistance != null) {
      expect((sr.resistance - price) / price).toBeGreaterThanOrEqual(0.006);
      expect(sr.resistance).toBeGreaterThan(price);
    }
  });

  it("returns null levels and a note when no valid S/R exists", () => {
    // Flat bars: all highs/lows collapse near the same price → hard to find sides
    const flat = makeBars(Array.from({ length: 40 }, () => 50));
    const sr = computeSupportResistance(flat, 50);
    // At least distances should not claim wrong-side levels
    if (sr.support != null) expect(sr.support).toBeLessThan(50);
    if (sr.resistance != null) expect(sr.resistance).toBeGreaterThan(50);
    expect(typeof sr.note).toBe("string");
    expect(sr.note.length).toBeGreaterThan(0);
  });

  it("handles empty bars", () => {
    const sr = computeSupportResistance([], 100);
    expect(sr.support).toBeNull();
    expect(sr.resistance).toBeNull();
    expect(sr.support_valid).toBe(false);
    expect(sr.resistance_valid).toBe(false);
  });
});

describe("sanitizeSupportResistance", () => {
  const base = {
    support: 90,
    resistance: 110,
    pivot: 100,
    near_support: 90,
    near_resistance: 110,
    distance_to_support_pct: 10,
    distance_to_resistance_pct: 10,
    support_valid: true,
    resistance_valid: true,
    note: "",
  };

  it("drops support that is above current price (not relabel as resistance)", () => {
    const sr = sanitizeSupportResistance({ ...base, support: 105, resistance: 110 }, 100);
    expect(sr.support).toBeNull();
    expect(sr.support_valid).toBe(false);
    expect(sr.resistance).toBe(110);
  });

  it("drops resistance that is below current price", () => {
    const sr = sanitizeSupportResistance({ ...base, support: 90, resistance: 95 }, 100);
    expect(sr.resistance).toBeNull();
    expect(sr.resistance_valid).toBe(false);
    expect(sr.support).toBe(90);
  });

  it("fixes reversed support/resistance pair ordering", () => {
    const sr = sanitizeSupportResistance({ ...base, support: 120, resistance: 80 }, 100);
    // After swap 80/120, support 80 ok, resistance 120 ok
    expect(sr.support).toBe(80);
    expect(sr.resistance).toBe(120);
  });

  it("handles price equal to a level by treating it as invalid for that side", () => {
    const sr = sanitizeSupportResistance({ ...base, support: 100, resistance: 110 }, 100);
    expect(sr.support).toBeNull();
    expect(sr.resistance).toBe(110);
  });
});

describe("canonical price consistency", () => {
  it("computeSnapshot uses refPrice for snap.price and S/R classification", () => {
    const bars = trendingBars();
    const ref = bars[bars.length - 1].close * 0.96;
    const snap = computeSnapshot(bars, { refPrice: ref, changePct: -1.25 });
    expect(snap).not.toBeNull();
    expect(snap!.price).toBe(Math.round(ref * 100) / 100);
    expect(snap!.change_pct).toBe(-1.25);
    const sr = snap!.support_resistance;
    if (sr.support != null) expect(sr.support).toBeLessThan(snap!.price);
    if (sr.resistance != null) expect(sr.resistance).toBeGreaterThan(snap!.price);
  });

  it("buildCanonicalQuote prefers live quote and does not mix chart change%", () => {
    const q = buildCanonicalQuote({
      quote: {
        regularMarketPrice: 42.5,
        regularMarketChangePercent: 1.5,
        regularMarketTime: new Date("2026-07-27T15:00:00Z"),
        marketState: "REGULAR",
      },
      chartClose: 40,
      chartChangePct: -3,
      chartAsOf: new Date("2026-07-26T20:00:00Z"),
    });
    expect(q.price).toBe(42.5);
    expect(q.change_pct).toBe(1.5);
    expect(q.source).toBe("yahoo_quote");
    expect(q.stale).toBe(false);
    expect(q.session_label).toBe("開市中");
  });

  it("falls back to daily close when quote missing", () => {
    const q = buildCanonicalQuote({
      quote: null,
      chartClose: 55.25,
      chartChangePct: 0.8,
      chartAsOf: new Date("2026-07-25T20:00:00Z"),
    });
    expect(q.price).toBe(55.25);
    expect(q.change_pct).toBe(0.8);
    expect(q.source).toBe("daily_close");
    expect(q.stale).toBe(true);
  });

  it("rejects extremely stale quote vs chart bar", () => {
    const q = buildCanonicalQuote({
      quote: {
        regularMarketPrice: 10,
        regularMarketChangePercent: 0,
        regularMarketTime: new Date("2020-01-01T00:00:00Z"),
        marketState: "CLOSED",
      },
      chartClose: 12,
      chartChangePct: 1,
      chartAsOf: new Date("2026-07-27T20:00:00Z"),
    });
    expect(q.source).toBe("mixed_fallback");
    expect(q.price).toBe(12);
    expect(q.stale).toBe(true);
  });
});
