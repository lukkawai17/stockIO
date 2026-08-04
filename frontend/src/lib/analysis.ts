export type SupportResistance = {
  support: number | null;
  resistance: number | null;
  pivot: number;
  near_support: number | null;
  near_resistance: number | null;
  distance_to_support_pct: number | null;
  distance_to_resistance_pct: number | null;
  support_valid: boolean;
  resistance_valid: boolean;
  note: string;
};

export type Snapshot = {
  price: number;
  change_pct: number;
  ma20: number;
  ma50: number;
  ma200: number | null;
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  ret_5d: number;
  ret_20d: number;
  ret_63d: number;
  volume_ratio: number;
  atr_pct: number | null;
  dist_52w_high_pct: number | null;
  drawdown_20d_pct: number;
  ma_stack_bull: boolean;
  ma_stack_bear: boolean;
  golden_bias: boolean;
  death_bias: boolean;
  support_resistance: SupportResistance;
  above_ma20: boolean;
  above_ma50: boolean;
  above_ma200: boolean | null;
};

export type Pillars = Record<string, number | null | undefined>;

export type PriceLevels = {
  /** Preferred limit entry (mid of zone). Never chase by default. */
  buy: number | null;
  buy_low: number | null;
  buy_high: number | null;
  /** Take-profit / trim level (min ~2R when possible). */
  sell: number | null;
  /** Stop-loss reference. */
  stop: number | null;
  /** Reward / risk if entered at buy vs stop vs sell. */
  risk_reward?: number | null;
  /** Where price sits in support→resistance range (0=support, 1=resistance). */
  range_position?: number | null;
  /** limit_pullback | in_zone | wait_premium | trim | avoid */
  entry_mode?: string;
  note: string;
};

export type ScoreResult = {
  score: number;
  label: "買" | "持有" | "避開";
  reason: string;
  signals: string[];
  pillars: Pillars;
  framework: string;
  horizon: string;
  hold_period: string;
  knowledge: string;
  levels: PriceLevels;
};

export type Fundamentals = {
  roe?: number | null;
  pe?: number | null;
  profit_margin?: number | null;
  debt_to_equity?: number | null;
};

export type InstitutionalInput = {
  flow_score?: number | null;
  net_pct_change?: number | null;
  increasers?: number;
  decreasers?: number;
  institutions_percent?: number | null;
};

type Bar = { high: number; low: number; close: number; volume: number };

function sma(values: number[], window: number): number | null {
  if (values.length < Math.max(2, Math.floor(window / 2))) return null;
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function emaSeries(values: number[], span: number): number[] {
  if (!values.length) return [];
  const k = 2 / (span + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

function rsi(closes: number[], period = 14): number {
  // Wilder RSI — match backend indicators.rsi (EWM alpha=1/period)
  if (closes.length <= period) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * Re-assert S/R labels against a live quote (fixes stale scan payloads).
 * Support must be below price; resistance above. Drop near-price noise (<~0.6%).
 */
export function sanitizeSupportResistance(
  sr: SupportResistance,
  price: number
): SupportResistance {
  if (!Number.isFinite(price) || price <= 0) return sr;
  const minGap = Math.max(price * 0.006, 0.05);
  let support = sr.support;
  let resistance = sr.resistance;
  if (support != null && resistance != null && support > resistance) {
    const a = support;
    support = resistance;
    resistance = a;
  }
  if (support != null && support >= price - minGap) support = null;
  if (resistance != null && resistance <= price + minGap) resistance = null;

  let note = sr.note || "支撐／阻力為近期擺動結構位（已過濾貼價噪音）。";
  if (support == null && resistance == null) {
    note = "現價附近暫無清晰結構位（可能剛突破或橫行）。";
  } else if (support == null) {
    note = "下方暫無足夠距離嘅支撐結構；暫只顯示上方阻力。";
  } else if (resistance == null) {
    note = "上方暫無足夠距離嘅阻力結構；暫只顯示下方支撐。";
  }

  return {
    ...sr,
    support: support == null ? null : round(support),
    resistance: resistance == null ? null : round(resistance),
    near_support: support == null ? null : round(support),
    near_resistance: resistance == null ? null : round(resistance),
    distance_to_support_pct:
      support == null ? null : round(((price - support) / price) * 100),
    distance_to_resistance_pct:
      resistance == null ? null : round(((resistance - price) / price) * 100),
    support_valid: support != null,
    resistance_valid: resistance != null,
    note,
  };
}

/** Local swing low/high: extreme vs `radius` bars on each side. */
function swingPoints(values: number[], radius: number, mode: "low" | "high"): number[] {
  const out: number[] = [];
  for (let i = radius; i < values.length - radius; i++) {
    const v = values[i];
    let ok = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      if (mode === "low" && values[j] < v) {
        ok = false;
        break;
      }
      if (mode === "high" && values[j] > v) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(v);
  }
  return out;
}

function atrApprox(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0;
  const start = Math.max(1, bars.length - period);
  let sum = 0;
  let n = 0;
  for (let i = start; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    sum += tr;
    n++;
  }
  return n ? sum / n : 0;
}

/** Merge levels within `tol` into cluster means (reduces duplicate pivots). */
function clusterLevels(levels: number[], tol: number): number[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    if (sorted[i] - last[0] <= tol) last.push(sorted[i]);
    else clusters.push([sorted[i]]);
  }
  return clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

/**
 * Structural support/resistance (not sticker-price noise).
 * Swing lows/highs + floor pivots + 20d/60d range extremes.
 * Levels must sit ≥ max(0.8% price, 0.5×ATR) from the quote; pick nearest each side.
 */
export function computeSupportResistance(
  bars: Bar[],
  refPrice?: number | null
): SupportResistance {
  if (!bars.length) {
    return {
      support: null,
      resistance: null,
      pivot: 0,
      near_support: null,
      near_resistance: null,
      distance_to_support_pct: null,
      distance_to_resistance_pct: null,
      support_valid: false,
      resistance_valid: false,
      note: "數據不足，暫無支撐／阻力。",
    };
  }

  const look = bars.slice(-60);
  const highs = look.map((b) => b.high).filter((n) => Number.isFinite(n));
  const lows = look.map((b) => b.low).filter((n) => Number.isFinite(n));
  const prev = bars[bars.length - 2] || bars[bars.length - 1];
  const lastClose = bars[bars.length - 1].close;
  const c = refPrice != null && Number.isFinite(refPrice) && refPrice > 0 ? refPrice : lastClose;

  const atr = atrApprox(bars, 14);
  const minGap = Math.max(c * 0.008, atr * 0.5, 0.05);
  const clusterTol = Math.max(c * 0.004, atr * 0.25);

  const pivot = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * pivot - prev.low;
  const s1 = 2 * pivot - prev.high;
  const r2 = pivot + (prev.high - prev.low);
  const s2 = pivot - (prev.high - prev.low);

  const look20 = bars.slice(-20);
  const high20 = look20.length ? Math.max(...look20.map((b) => b.high)) : lastClose;
  const low20 = look20.length ? Math.min(...look20.map((b) => b.low)) : lastClose;
  const high60 = highs.length ? Math.max(...highs) : lastClose;
  const low60 = lows.length ? Math.min(...lows) : lastClose;

  const swingLows = swingPoints(lows, 2, "low");
  const swingHighs = swingPoints(highs, 2, "high");

  const rawBelow = clusterLevels(
    [...swingLows, s1, s2, pivot, low20, low60].filter((n) => Number.isFinite(n) && n < c - minGap),
    clusterTol
  ).sort((a, b) => b - a);

  const rawAbove = clusterLevels(
    [...swingHighs, r1, r2, pivot, high20, high60].filter((n) => Number.isFinite(n) && n > c + minGap),
    clusterTol
  ).sort((a, b) => a - b);

  const maxDist = c * 0.18;
  const support = rawBelow.find((n) => c - n <= maxDist) ?? null;
  const resistance = rawAbove.find((n) => n - c <= maxDist) ?? null;

  let note = "支撐／阻力＝近期擺動高低＋樞軸（已過濾貼價 <~0.8%／0.5ATR 噪音）。";
  if (support == null && resistance == null) {
    note = "現價附近暫無清晰結構位（可能剛突破、貼近區間端或橫行）。";
  } else if (support == null) {
    note = "下方暫無足夠距離嘅支撐結構；暫只顯示上方阻力。";
  } else if (resistance == null) {
    note = "上方暫無足夠距離嘅阻力結構（常見於接近區間高位）；暫只顯示下方支撐。";
  }

  return {
    support: support == null ? null : round(support),
    resistance: resistance == null ? null : round(resistance),
    pivot: round(pivot),
    near_support: support == null ? null : round(support),
    near_resistance: resistance == null ? null : round(resistance),
    distance_to_support_pct:
      support == null || !c ? null : round(((c - support) / c) * 100),
    distance_to_resistance_pct:
      resistance == null || !c ? null : round(((resistance - c) / c) * 100),
    support_valid: support != null,
    resistance_valid: resistance != null,
    note,
  };
}

/** @deprecated use computeSupportResistance — kept as private helper name during migration */
function supportResistance(bars: Bar[], refPrice?: number | null): SupportResistance {
  return computeSupportResistance(bars, refPrice);
}

function round(n: number, d = 2) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function clamp(n: number, lo = 0, hi = 100) {
  if (!Number.isFinite(n)) return (lo + hi) / 2;
  return Math.max(lo, Math.min(hi, n));
}

function labelFromScore(score: number, buyAt = 70, avoidBelow = 40): ScoreResult["label"] {
  if (score >= buyAt) return "買";
  if (score <= avoidBelow) return "避開";
  return "持有";
}

/** Profit discipline: 「買」需要跨類別確認，避免單一柱撐起假買訊。 */
function applyBuyGate(
  score: number,
  label: ScoreResult["label"],
  pillars: Record<string, number | null | undefined>,
  minStrong: number,
  coreKeys: string[]
): { score: number; label: ScoreResult["label"]; gated: boolean } {
  if (label !== "買") return { score, label, gated: false };
  const vals = Object.entries(pillars)
    .filter(([, v]) => v != null)
    .map(([, v]) => v as number);
  const strong = vals.filter((v) => v >= 58).length;
  const coreOk = coreKeys.every((k) => (pillars[k] ?? 0) >= 52);
  if (strong >= minStrong && coreOk) return { score, label, gated: false };
  // Downgrade: keep score but force 持有 so list doesn't over-promise
  return { score: Math.min(score, buyGateCap(score)), label: "持有", gated: true };
}

function buyGateCap(score: number) {
  return Math.min(score, 68.5);
}

/** Always recompute buy/sell levels for scan rows (keeps formula fresh). */
export function enrichRowLevels(
  row: {
    price: number;
    label: ScoreResult["label"];
    buy_price?: number | null;
    sell_price?: number | null;
    stop_price?: number | null;
    levels?: PriceLevels;
    support_resistance?: SupportResistance;
    ma20?: number;
    ma50?: number;
    ma200?: number | null;
    atr_pct?: number | null;
    rsi?: number;
  },
  horizon: "short" | "long"
) {
  const sr = row.support_resistance;
  if (!sr) return row;
  const sanitized = sanitizeSupportResistance(
    {
      support: sr.support ?? null,
      resistance: sr.resistance ?? null,
      pivot: sr.pivot ?? row.price,
      near_support: sr.near_support ?? null,
      near_resistance: sr.near_resistance ?? null,
      distance_to_support_pct: sr.distance_to_support_pct ?? null,
      distance_to_resistance_pct: sr.distance_to_resistance_pct ?? null,
      support_valid: sr.support_valid ?? sr.support != null,
      resistance_valid: sr.resistance_valid ?? sr.resistance != null,
      note: sr.note ?? "",
    },
    row.price
  );
  const snap: Snapshot = {
    price: row.price,
    change_pct: 0,
    ma20: row.ma20 ?? row.price,
    ma50: row.ma50 ?? row.price,
    ma200: row.ma200 ?? null,
    rsi: row.rsi ?? 50,
    macd: 0,
    macd_signal: 0,
    macd_hist: 0,
    ret_5d: 0,
    ret_20d: 0,
    ret_63d: 0,
    volume_ratio: 1,
    atr_pct: row.atr_pct ?? null,
    dist_52w_high_pct: null,
    drawdown_20d_pct: 0,
    ma_stack_bull: false,
    ma_stack_bear: false,
    golden_bias: false,
    death_bias: false,
    support_resistance: sanitized,
    above_ma20: row.price > (row.ma20 ?? row.price),
    above_ma50: row.price > (row.ma50 ?? row.price),
    above_ma200: row.ma200 == null ? null : row.price > row.ma200,
  };
  const levels = suggestLevels(snap, row.label, horizon);
  return {
    ...row,
    support_resistance: sanitized,
    levels,
    buy_price: levels.buy,
    sell_price: levels.sell,
    stop_price: levels.stop,
  };
}

/**
 * Safer buy/sell levels — blend of:
 * - Pullback / confluence entry (MA + support, not chase)
 * - Discount vs premium in S/R range (buy lower half)
 * - ATR volatility buffer for stops
 * - Minimum ~2:1 reward/risk before endorsing an entry
 *
 * Default is LIMIT on pullback. Market ≈ buy only if already in discount zone
 * AND R:R still ≥ ~2.
 */
export function suggestLevels(
  snap: Snapshot,
  label: ScoreResult["label"],
  horizon: "short" | "long"
): PriceLevels {
  const p = snap.price;
  const sr = snap.support_resistance;
  const atrPct = snap.atr_pct ?? (horizon === "short" ? 2 : 2.5);
  const atr = Math.max(p * (atrPct / 100), p * 0.008);
  let support =
    sr.support != null && sr.support < p - atr * 0.05 ? sr.support : p - atr * 1.5;
  let resistance =
    sr.resistance != null && sr.resistance > p + atr * 0.05 ? sr.resistance : p + atr * 2;
  // Ensure usable range
  if (resistance - support < atr * 1.2) {
    support = Math.min(support, p - atr * 1.5);
    resistance = Math.max(resistance, p + atr * 2);
  }
  const range = Math.max(resistance - support, atr);
  const rangePos = clamp((p - support) / range, 0, 1);
  const maPull = horizon === "short" ? snap.ma20 : snap.ma50;
  const deepMa = horizon === "short" ? snap.ma50 : snap.ma200 ?? snap.ma50;

  if (label === "避開") {
    return {
      buy: null,
      buy_low: null,
      buy_high: null,
      sell: round(p),
      stop: null,
      risk_reward: null,
      range_position: round(rangePos, 2),
      entry_mode: "avoid",
      note:
        horizon === "short"
          ? "暫不建議買入；若持倉可考慮減倉／離場。"
          : "長線暫避；若持倉可考慮逢高減倉。",
    };
  }

  // --- Stop: structure + ATR buffer (classic 0.5–1.0 ATR beyond support) ---
  let stop = support - atr * (horizon === "short" ? 0.5 : 0.75);
  if (horizon === "long" && snap.ma200 != null) {
    stop = Math.min(stop, snap.ma200 - atr * 0.5);
  }
  stop = Math.min(stop, p - atr * 1.2); // never tiny stop vs current chase

  // --- Ideal pullback / confluence buy zone (discount half of range) ---
  const fib382 = support + range * 0.382;
  const fib50 = support + range * 0.5;
  // Backtest limit fill ~12–22%：略放寬折讓上沿，提高限價成交機會
  const discountCap = support + range * 0.52;

  // Confluence anchors: max of support buffer and MAs that are still below price
  const anchors = [support + atr * 0.15, maPull, deepMa]
    .filter((x): x is number => x != null && Number.isFinite(x))
    .map((x) => Math.min(x, p - atr * 0.05));

  let buyLow = Math.max(support + atr * 0.1, Math.min(...anchors, fib382) - atr * 0.15);
  let buyHigh = Math.min(discountCap, fib50, Math.max(maPull, support + atr));

  // Prefer zone around MA pullback when MA is in discount
  if (maPull < p && maPull > support) {
    buyLow = Math.max(support + atr * 0.1, Math.min(maPull - atr * 0.35, buyLow));
    buyHigh = Math.min(discountCap, Math.max(maPull + atr * 0.25, buyHigh * 0.5 + maPull * 0.5));
  }

  if (buyHigh <= buyLow) {
    buyLow = support + atr * 0.1;
    buyHigh = buyLow + atr * 0.8;
  }
  // Cap buy zone strictly below current when in premium — force pullback
  const inPremium =
    rangePos >= 0.55 ||
    snap.rsi >= 68 ||
    (sr.distance_to_resistance_pct != null && sr.distance_to_resistance_pct <= 2.5);
  const inDiscount = rangePos <= 0.42 && snap.rsi <= 60;

  if (inPremium || label === "持有") {
    buyHigh = Math.min(buyHigh, p - atr * 0.35, discountCap);
    buyLow = Math.min(buyLow, buyHigh - atr * 0.4);
    if (buyLow < support) buyLow = support + atr * 0.05;
    if (buyHigh <= buyLow) {
      buyLow = support + atr * 0.1;
      buyHigh = Math.min(p - atr * 0.5, support + range * 0.4);
    }
  }

  let buy = (buyLow + buyHigh) / 2;
  let entryMode = "limit_pullback";
  let note: string;

  if (label === "持有") {
    entryMode = "limit_pullback";
    note = "暫持有。加倉只用限價等回調至買入區間；唔好現價追。";
  } else if (inPremium) {
    entryMode = "wait_premium";
    buy = (buyLow + buyHigh) / 2;
    note = "現價喺偏貴／貼近阻力區。等回調落入買入區間再用限價；追現價風險報酬差。";
  } else if (inDiscount && p <= buyHigh * 1.01) {
    // Already in discount — can use current as upper of zone, still prefer mid/limit
    buyHigh = Math.min(buyHigh, p);
    buy = Math.min(p, (buyLow + buyHigh) / 2);
    // Only tag "in_zone" if mid is within ~0.4 ATR of price (close enough)
    if (Math.abs(p - buy) <= atr * 0.45) {
      entryMode = "in_zone";
      buy = Math.min(p, buyHigh);
      note = "現價已喺折讓區內，可用限價靠近區間上沿試倉；仍建議唔好市價追穿。";
    } else {
      entryMode = "limit_pullback";
      note = "偏多但現價略高過理想中位，掛限價喺買入區間。";
    }
  } else {
    entryMode = "limit_pullback";
    buyHigh = Math.min(buyHigh, p - atr * 0.15);
    if (buyHigh <= buyLow) {
      buyLow = support + atr * 0.1;
      buyHigh = Math.min(p - atr * 0.2, support + range * 0.4);
    }
    buy = (buyLow + buyHigh) / 2;
    note = "偏多訊號：用限價等回調入場，唔用現價追。";
  }

  // --- Sell / TP: structure target with min ~2R from buy---stop ---
  const risk = Math.max(buy - stop, atr * 0.8);
  let sell = Math.max(resistance, buy + risk * 2);
  // First realistic structural target: don't invent fantasy if resistance is the goal
  const structuralTp = resistance > buy + atr * 0.5 ? resistance : buy + risk * 2;
  sell = Math.max(structuralTp, buy + risk * 2);
  // Cap extreme fantasy for short horizon
  if (horizon === "short" && sell > buy + atr * 5) {
    sell = Math.min(sell, Math.max(resistance, buy + risk * 2.2));
  }

  // Enforce ordering
  buyLow = Math.min(buyLow, buyHigh);
  buyHigh = Math.max(buyLow, buyHigh);
  buy = clamp(buy, buyLow, buyHigh);
  if (stop >= buyLow - atr * 0.05) stop = buyLow - atr * 0.5;
  if (sell <= buy + risk) sell = buy + risk * 2;

  // Final: never present buy >= current unless truly in_zone (small gap OK)
  if (entryMode !== "in_zone" && buy >= p * 0.998) {
    buyHigh = Math.min(buyHigh, p - atr * 0.25);
    buyLow = Math.min(buyLow, buyHigh - atr * 0.35);
    if (buyLow < support) buyLow = support + atr * 0.05;
    buy = (buyLow + buyHigh) / 2;
    entryMode = "limit_pullback";
    note = "為保安全邊際，買入價設喺現價之下（回調限價），唔追現價。";
  }

  const riskFinal = Math.max(buy - stop, 1e-9);
  const rr = (sell - buy) / riskFinal;

  // If R:R still weak, push sell or deepen buy
  if (rr < 1.8 && label === "買") {
    sell = buy + riskFinal * 2;
    note += " 已按最少約 2:1 風險報酬調整賣出目標。";
  }

  return {
    buy: round(buy),
    buy_low: round(buyLow),
    buy_high: round(buyHigh),
    sell: round(sell),
    stop: round(stop),
    risk_reward: round(Math.max((sell - buy) / Math.max(buy - stop, 1e-9), 0), 2),
    range_position: round(rangePos, 2),
    entry_mode: entryMode,
    note,
  };
}

export function computeSnapshot(
  bars: Bar[],
  opts?: { refPrice?: number | null; changePct?: number | null }
): Snapshot | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2] || last;
  const price =
    opts?.refPrice != null && Number.isFinite(opts.refPrice) && opts.refPrice > 0
      ? opts.refPrice
      : last;
  const changePct =
    opts?.changePct != null && Number.isFinite(opts.changePct)
      ? opts.changePct
      : prev
        ? ((last - prev) / prev) * 100
        : 0;
  const ma20 = sma(closes, 20) ?? last;
  const ma50 = sma(closes, 50) ?? last;
  const ma200 = sma(closes, 200);
  const rsiVal = round(rsi(closes, 14), 1);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalArr = emaSeries(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const macdSignal = signalArr[signalArr.length - 1];
  const macdHist = macd - macdSignal;
  const ret5 = closes.length > 5 ? ((last - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : 0;
  const ret20 = closes.length > 20 ? ((last - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : 0;
  const ret63 = closes.length > 63 ? ((last - closes[closes.length - 64]) / closes[closes.length - 64]) * 100 : 0;
  const volAvg = sma(volumes, 20) || 1;
  const volRatio = volumes[volumes.length - 1] / volAvg;

  // ATR%
  let atrSum = 0;
  let atrN = 0;
  for (let i = Math.max(1, closes.length - 14); i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atrSum += tr;
    atrN++;
  }
  const atrPct = atrN ? round((atrSum / atrN / price) * 100) : null;
  const high52 = Math.max(...highs.slice(-Math.min(252, highs.length)));
  const dist52 = high52 ? round(((high52 - price) / high52) * 100) : null;
  const peak20 = Math.max(...closes.slice(-21));
  const dd20 = peak20 ? round(((price - peak20) / peak20) * 100) : 0;

  return {
    price: round(price),
    change_pct: round(changePct),
    ma20: round(ma20),
    ma50: round(ma50),
    ma200: ma200 == null ? null : round(ma200),
    rsi: rsiVal,
    macd: round(macd, 3),
    macd_signal: round(macdSignal, 3),
    macd_hist: round(macdHist, 3),
    ret_5d: round(ret5),
    ret_20d: round(ret20),
    ret_63d: round(ret63),
    volume_ratio: round(volRatio),
    atr_pct: atrPct,
    dist_52w_high_pct: dist52,
    drawdown_20d_pct: dd20,
    ma_stack_bull: price > ma20 && ma20 > ma50,
    ma_stack_bear: price < ma20 && ma20 < ma50,
    golden_bias: ma200 != null && ma50 > ma200,
    death_bias: ma200 != null && ma50 < ma200,
    support_resistance: supportResistance(bars, price),
    above_ma20: price > ma20,
    above_ma50: price > ma50,
    above_ma200: ma200 == null ? null : price > ma200,
  };
}

export function scoreShort(snap: Snapshot): ScoreResult {
  const reasons: string[] = [];
  let trend = 50;
  if (snap.above_ma20) {
    trend += 14;
    reasons.push("企穩MA20（短線趨勢）");
  } else {
    trend -= 14;
    reasons.push("跌破MA20");
  }
  if (snap.above_ma50) {
    trend += 12;
    reasons.push("高於MA50");
  } else {
    trend -= 12;
    reasons.push("低於MA50");
  }
  if (snap.ma_stack_bull) {
    trend += 10;
    reasons.push("均線多頭排列");
  } else if (snap.ma_stack_bear) {
    trend -= 8;
    reasons.push("均線空頭排列");
  }
  if (snap.above_ma200 === true && snap.above_ma50) {
    trend += 6;
    reasons.push("順大趨勢（MA200上）");
  } else if (snap.above_ma200 === false) {
    trend -= 6;
    reasons.push("逆大趨勢（MA200下）");
  }
  trend = clamp(trend);

  let momentum = 50;
  const r = snap.rsi;
  if (r >= 45 && r <= 65) {
    momentum += 14;
    reasons.push(`RSI健康(${r})`);
  } else if (r >= 35 && r < 45) {
    momentum += 6;
    reasons.push(`RSI回調區(${r})`);
  } else if (r > 72) {
    momentum -= 16;
    reasons.push(`RSI超買(${r})`);
  } else if (r < 30) {
    momentum -= 8;
    reasons.push(`RSI超賣(${r})`);
  }
  if (snap.macd_hist > 0 && snap.macd > snap.macd_signal) {
    momentum += 12;
    reasons.push("MACD動能偏多");
  } else if (snap.macd_hist < 0) {
    momentum -= 12;
    reasons.push("MACD動能偏淡");
  }
  if (snap.ret_5d > 2) {
    momentum += 8;
    reasons.push(`近5日+${snap.ret_5d}%`);
  } else if (snap.ret_5d < -3) {
    momentum -= 10;
    reasons.push(`近5日${snap.ret_5d}%`);
  }
  if (snap.ret_20d > 5) {
    momentum += 6;
  } else if (snap.ret_20d < -8) {
    momentum -= 8;
  }
  if (snap.dist_52w_high_pct != null) {
    if (snap.dist_52w_high_pct <= 8) {
      momentum += 6;
      reasons.push("接近52週高（相對強勢）");
    } else if (snap.dist_52w_high_pct > 35) {
      momentum -= 6;
      reasons.push("遠離52週高（相對弱勢）");
    }
  }
  momentum = clamp(momentum);

  let volume = 50;
  if (snap.volume_ratio >= 1.4 && snap.ret_5d > 0) {
    volume += 18;
    reasons.push("放量上攻（參與度確認）");
  } else if (snap.volume_ratio >= 1.4 && snap.ret_5d < 0) {
    volume -= 16;
    reasons.push("放量下跌（拋壓確認）");
  } else if (snap.volume_ratio < 0.7) {
    volume -= 6;
    reasons.push("成交偏淡");
  } else {
    volume += 4;
    reasons.push("成交量正常");
  }
  volume = clamp(volume);

  let structure = 50;
  const ds = snap.support_resistance.distance_to_support_pct;
  const dr = snap.support_resistance.distance_to_resistance_pct;
  if (ds != null && ds <= 2) {
    structure += 14;
    reasons.push("接近支撐（結構較佳觀察位）");
  } else if (ds != null && ds >= 12) {
    structure -= 4;
  }
  if (dr != null && dr <= 1.5) {
    structure -= 14;
    reasons.push("貼近阻力（冲關風險）");
  } else if (dr != null && dr >= 8) {
    structure += 6;
    reasons.push("距離阻力有空間");
  }
  structure = clamp(structure);

  let risk = 55;
  if (snap.atr_pct != null) {
    if (snap.atr_pct >= 1 && snap.atr_pct <= 3.5) {
      risk += 12;
      reasons.push(`波幅適中(ATR ${snap.atr_pct}%)`);
    } else if (snap.atr_pct > 6) {
      risk -= 16;
      reasons.push(`波幅偏高(ATR ${snap.atr_pct}%)`);
    } else if (snap.atr_pct < 0.8) {
      risk += 4;
      reasons.push("波幅偏低");
    }
  }
  if (snap.drawdown_20d_pct <= -12) {
    risk -= 10;
    reasons.push("近月回撤偏深");
  }
  risk = clamp(risk);

  let score = clamp(trend * 0.3 + momentum * 0.25 + volume * 0.2 + structure * 0.15 + risk * 0.1);
  // Backtest: many weak「買」訊號；略提高門檻減少噪音
  let label = labelFromScore(score, 72, 40);
  const pillars = {
    trend: round(trend, 1),
    momentum: round(momentum, 1),
    volume: round(volume, 1),
    structure: round(structure, 1),
    risk: round(risk, 1),
  };
  const gated = applyBuyGate(score, label, pillars, 3, ["trend", "momentum"]);
  score = gated.score;
  label = gated.label;
  if (gated.gated) reasons.unshift("確認不足：未達跨柱齊備，暫不標「買」");

  // Backtest／結構：貼阻力時「買」容易冲關失敗 → 降級為持有
  if (label === "買" && dr != null && dr <= 2) {
    label = "持有";
    score = Math.min(score, 68.5);
    reasons.unshift("貼近阻力：暫不標買，等回調或突破確認");
  }

  const levels = suggestLevels(snap, label, "short");
  return {
    score: round(score, 1),
    label,
    reason: reasons.slice(0, 4).join("；"),
    signals: reasons,
    pillars,
    framework: "multi_pillar_v3",
    horizon: "短線",
    hold_period: label === "買" ? "3–10 個交易日" : label === "持有" ? "5–15 個交易日" : "暫觀望 / 等更好位置",
    knowledge:
      label === "買"
        ? "跨類別確認偏多。回測顯示限價回調較穩；進場前訂止蝕同倉位（單筆風險≤本金2%）。"
        : label === "避開"
          ? "多因子偏淡。宜等趨勢同動能重新对齐，唔好抄底博反彈。"
          : gated.gated || (dr != null && dr <= 2)
            ? "分數尚可但位置偏貴／確認不足。寧願錯過，唔好硬上。"
            : "多因子中性。可觀望等待更多確認。",
    levels,
  };
}

export function scoreLong(
  snap: Snapshot,
  vsSpyRet20d: number | null = null,
  fundamentals: Fundamentals | null = null,
  institutional: InstitutionalInput | null = null
): ScoreResult {
  const reasons: string[] = [];
  let sTrend = 50;
  if (snap.above_ma200 === true) {
    sTrend += 22;
    reasons.push("絕對動能：站上MA200");
  } else if (snap.above_ma200 === false) {
    sTrend -= 22;
    reasons.push("絕對動能弱：跌破MA200");
  }
  if (snap.above_ma50) {
    sTrend += 10;
    reasons.push("高於MA50");
  } else {
    sTrend -= 10;
    reasons.push("低於MA50");
  }
  if (snap.golden_bias) {
    sTrend += 8;
    reasons.push("MA50>MA200（偏金叉結構）");
  } else if (snap.death_bias) {
    sTrend -= 8;
    reasons.push("MA50<MA200（偏死叉結構）");
  }
  sTrend = clamp(sTrend);

  let sRel = 50;
  if (vsSpyRet20d != null) {
    if (vsSpyRet20d > 3) {
      sRel += 18;
      reasons.push(`相對動能強 vs SPY ${vsSpyRet20d > 0 ? "+" : ""}${vsSpyRet20d.toFixed(1)}%`);
    } else if (vsSpyRet20d > 0) {
      sRel += 8;
      reasons.push(`略強過大市 ${vsSpyRet20d.toFixed(1)}%`);
    } else if (vsSpyRet20d < -3) {
      sRel -= 18;
      reasons.push(`相對動能弱 vs SPY ${vsSpyRet20d.toFixed(1)}%`);
    } else {
      sRel -= 6;
      reasons.push("相對大市偏弱");
    }
  }
  sRel = clamp(sRel);

  let sMom = 50;
  if (snap.ret_20d > 3) {
    sMom += 10;
    reasons.push(`近月+${snap.ret_20d}%`);
  } else if (snap.ret_20d < -5) {
    sMom -= 12;
    reasons.push(`近月${snap.ret_20d}%`);
  }
  if (snap.ret_63d > 8) {
    sMom += 10;
    reasons.push(`近季+${snap.ret_63d}%`);
  } else if (snap.ret_63d < -12) {
    sMom -= 10;
    reasons.push(`近季${snap.ret_63d}%`);
  }
  if (snap.rsi > 75) {
    sMom -= 10;
    reasons.push("長線過熱風險");
  } else if (snap.rsi >= 40 && snap.rsi <= 65) sMom += 6;
  sMom = clamp(sMom);

  let sRisk = 55;
  if (snap.atr_pct != null) {
    if (snap.atr_pct >= 1 && snap.atr_pct <= 3.5) {
      sRisk += 12;
      reasons.push(`波幅適中(ATR ${snap.atr_pct}%)`);
    } else if (snap.atr_pct > 6) {
      sRisk -= 16;
      reasons.push(`波幅偏高(ATR ${snap.atr_pct}%)`);
    }
  }
  sRisk = clamp(sRisk);

  let sQuality = 50;
  if (fundamentals) {
    if (fundamentals.roe != null) {
      if (fundamentals.roe >= 0.15) {
        sQuality += 14;
        reasons.push(`質素：ROE ${(fundamentals.roe * 100).toFixed(0)}%`);
      } else if (fundamentals.roe < 0) {
        sQuality -= 12;
        reasons.push("質素弱：ROE 負數");
      }
    }
    if (fundamentals.profit_margin != null) {
      if (fundamentals.profit_margin >= 0.12) sQuality += 8;
      else if (fundamentals.profit_margin < 0) sQuality -= 8;
    }
    if (fundamentals.pe != null && fundamentals.pe > 0) {
      if (fundamentals.pe >= 8 && fundamentals.pe <= 28) {
        sQuality += 6;
        reasons.push(`估值合理 PE ${fundamentals.pe.toFixed(1)}`);
      } else if (fundamentals.pe > 45) {
        sQuality -= 8;
        reasons.push(`估值偏貴 PE ${fundamentals.pe.toFixed(1)}`);
      }
    }
    if (fundamentals.debt_to_equity != null) {
      if (fundamentals.debt_to_equity < 1) sQuality += 6;
      else if (fundamentals.debt_to_equity > 2.5) {
        sQuality -= 8;
        reasons.push("槓桿偏高");
      }
    }
  }
  sQuality = clamp(sQuality);

  let sInst = 50;
  const hasInst = institutional?.flow_score != null;
  if (hasInst) {
    sInst = clamp(institutional!.flow_score!);
    const net = institutional!.net_pct_change;
    if (net != null) {
      if (net > 2) reasons.push(`機構增持（加權約+${net}%）`);
      else if (net < -2) reasons.push(`機構減持（加權約${net}%）`);
    }
    const inc = institutional!.increasers ?? 0;
    const dec = institutional!.decreasers ?? 0;
    if (inc > dec + 1) reasons.push(`增持機構${inc} vs 減持${dec}`);
    else if (dec > inc + 1) reasons.push(`減持機構${dec} vs 增持${inc}`);
    if (institutional!.institutions_percent != null) {
      reasons.push(`機構持股${(institutional!.institutions_percent * 100).toFixed(0)}%`);
    }
  }
  sInst = clamp(sInst);

  let score: number;
  if (fundamentals && hasInst) {
    score = clamp(sTrend * 0.26 + sRel * 0.18 + sMom * 0.14 + sRisk * 0.1 + sQuality * 0.16 + sInst * 0.16);
  } else if (fundamentals) {
    score = clamp(sTrend * 0.3 + sRel * 0.22 + sMom * 0.18 + sRisk * 0.12 + sQuality * 0.18);
  } else if (hasInst) {
    score = clamp(sTrend * 0.3 + sRel * 0.22 + sMom * 0.18 + sRisk * 0.12 + sInst * 0.18);
  } else {
    score = clamp(sTrend * 0.35 + sRel * 0.25 + sMom * 0.25 + sRisk * 0.15);
  }

  let label = labelFromScore(score, 72, 42);
  const pillars = {
    trend: round(sTrend, 1),
    relative: round(sRel, 1),
    momentum: round(sMom, 1),
    risk: round(sRisk, 1),
    quality: fundamentals ? round(sQuality, 1) : null,
    institutional: hasInst ? round(sInst, 1) : null,
  };
  const gated = applyBuyGate(score, label, pillars, 3, ["trend", "relative"]);
  score = gated.score;
  label = gated.label;
  if (gated.gated) reasons.unshift("確認不足：雙動能未齊，暫不標「買」");
  // Heavy institutional distribution blocks buy
  if (label === "買" && hasInst && sInst < 40) {
    label = "持有";
    score = Math.min(score, 68.5);
    reasons.unshift("機構資金偏流出，暫降級為持有");
  }

  const relTxt = vsSpyRet20d == null ? "" : vsSpyRet20d > 0 ? "相對大市較強。" : "相對大市偏弱。";
  const levels = suggestLevels(snap, label, "long");
  return {
    score: round(score, 1),
    label,
    reason: reasons.slice(0, 4).join("；"),
    signals: reasons,
    pillars,
    framework: "multi_pillar_v3",
    horizon: "長線",
    hold_period: label === "買" ? "3–12 個月" : label === "持有" ? "1–6 個月觀察" : "長線暫避 / 等趨勢轉好",
    knowledge:
      label === "買"
        ? `雙動能+質素/機構確認偏多。${relTxt}分批建倉；跌破MA200 重新評估。`
        : label === "避開"
          ? `長線框架偏淡。${relTxt}可等重返MA200再說。`
          : gated.gated
            ? `分數尚可但確認不足。${relTxt}等絕對+相對齊備再考慮加倉。`
            : `長線中性。${relTxt}核心倉可留，避免一次加倉。`,
    levels,
  };
}
