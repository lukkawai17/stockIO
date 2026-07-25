export type SupportResistance = {
  support: number;
  resistance: number;
  pivot: number;
  near_support: number;
  near_resistance: number;
  distance_to_support_pct: number;
  distance_to_resistance_pct: number;
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
  volume_ratio: number;
  support_resistance: SupportResistance;
  above_ma20: boolean;
  above_ma50: boolean;
  above_ma200: boolean | null;
};

export type ScoreResult = {
  score: number;
  label: "買" | "持有" | "避開";
  reason: string;
  signals: string[];
  horizon: string;
  hold_period: string;
  knowledge: string;
};

type Bar = { high: number; low: number; close: number; volume: number };

function sma(values: number[], window: number): number | null {
  if (values.length < Math.max(2, Math.floor(window / 2))) return null;
  const slice = values.slice(-window);
  if (slice.length < 2) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function emaSeries(values: number[], span: number): number[] {
  if (!values.length) return [];
  const k = 2 / (span + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  // Wilder smoothing for remaining not applied fully; good enough for detail view
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function supportResistance(bars: Bar[]): SupportResistance {
  const look = bars.slice(-40);
  const highs = look.map((b) => b.high);
  const lows = look.map((b) => b.low);
  const recentHigh = Math.max(...highs);
  const recentLow = Math.min(...lows);
  const prev = bars[bars.length - 2] || bars[bars.length - 1];
  const c = bars[bars.length - 1].close;
  const pivot = (prev.high + prev.low + prev.close) / 3;
  const r1 = 2 * pivot - prev.low;
  const s1 = 2 * pivot - prev.high;
  const r2 = pivot + (prev.high - prev.low);
  const s2 = pivot - (prev.high - prev.low);
  const support = Math.min(recentLow, s1, s2);
  const resistance = Math.max(recentHigh, r1, r2);
  return {
    support: round(support),
    resistance: round(resistance),
    pivot: round(pivot),
    near_support: round(Math.min(s1, recentLow)),
    near_resistance: round(Math.max(r1, recentHigh)),
    distance_to_support_pct: round(((c - Math.min(s1, recentLow)) / c) * 100),
    distance_to_resistance_pct: round(((Math.max(r1, recentHigh) - c) / c) * 100),
  };
}

function round(n: number, d = 2) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function labelFromScore(score: number, buyAt = 70, avoidBelow = 40): ScoreResult["label"] {
  if (score >= buyAt) return "買";
  if (score <= avoidBelow) return "避開";
  return "持有";
}

export function computeSnapshot(bars: Bar[]): Snapshot | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2] || last;
  const changePct = prev ? ((last - prev) / prev) * 100 : 0;
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
  const volAvg = sma(volumes, 20) || 1;
  const volRatio = volumes[volumes.length - 1] / volAvg;
  const sr = supportResistance(bars);

  return {
    price: round(last),
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
    volume_ratio: round(volRatio),
    support_resistance: sr,
    above_ma20: last > ma20,
    above_ma50: last > ma50,
    above_ma200: ma200 == null ? null : last > ma200,
  };
}

export function scoreShort(snap: Snapshot): ScoreResult {
  let score = 50;
  const reasons: string[] = [];
  if (snap.above_ma20) {
    score += 10;
    reasons.push("企穩20日線");
  } else {
    score -= 10;
    reasons.push("跌破20日線");
  }
  if (snap.above_ma50) {
    score += 8;
    reasons.push("高於50日線");
  } else {
    score -= 8;
    reasons.push("低於50日線");
  }
  const { rsi: r } = snap;
  if (r >= 45 && r <= 65) {
    score += 12;
    reasons.push(`RSI健康(${r})`);
  } else if (r >= 35 && r < 45) {
    score += 6;
    reasons.push(`RSI回調中(${r})`);
  } else if (r > 72) {
    score -= 14;
    reasons.push(`RSI超買(${r})`);
  } else if (r < 30) {
    score -= 8;
    reasons.push(`RSI超賣(${r})`);
  } else reasons.push(`RSI ${r}`);

  if (snap.macd_hist > 0 && snap.macd > snap.macd_signal) {
    score += 10;
    reasons.push("MACD偏多");
  } else if (snap.macd_hist < 0) {
    score -= 10;
    reasons.push("MACD偏淡");
  }
  if (snap.ret_5d > 2) {
    score += 8;
    reasons.push(`近5日+${snap.ret_5d}%`);
  } else if (snap.ret_5d < -3) {
    score -= 10;
    reasons.push(`近5日${snap.ret_5d}%`);
  }
  if (snap.volume_ratio >= 1.4 && snap.ret_5d > 0) {
    score += 6;
    reasons.push("放量上攻");
  } else if (snap.volume_ratio >= 1.4 && snap.ret_5d < 0) {
    score -= 6;
    reasons.push("放量下跌");
  }
  if (snap.support_resistance.distance_to_support_pct <= 2) {
    score += 4;
    reasons.push("接近支撐");
  }
  if (snap.support_resistance.distance_to_resistance_pct <= 1.5) {
    score -= 4;
    reasons.push("接近阻力");
  }
  score = clamp(score);
  const label = labelFromScore(score);
  return {
    score: round(score, 1),
    label,
    reason: reasons.slice(0, 3).join("；"),
    signals: reasons,
    horizon: "短線",
    hold_period: label === "買" ? "3–10 個交易日" : label === "持有" ? "5–15 個交易日" : "暫觀望 / 等更好位置",
    knowledge:
      label === "買"
        ? "短線偏多：價格結構向上，適合用較細倉位試，並設止蝕喺近期支撐之下。"
        : label === "避開"
          ? "短線偏淡：動能或均線轉弱，寧願等站回關鍵均線或企穩支撐再睇。"
          : "結構中性：可以持有觀望，等 MACD / 均線方向更清晰。",
  };
}

export function scoreLong(snap: Snapshot, vsSpyRet20d: number | null = null): ScoreResult {
  let score = 50;
  const reasons: string[] = [];
  if (snap.above_ma200 === true) {
    score += 18;
    reasons.push("站上200日線（長線趨勢向上）");
  } else if (snap.above_ma200 === false) {
    score -= 18;
    reasons.push("跌破200日線（長線趨勢轉弱）");
  } else reasons.push("200日線數據不足");

  if (snap.above_ma50) {
    score += 10;
    reasons.push("高於50日線");
  } else {
    score -= 10;
    reasons.push("低於50日線");
  }
  if (snap.ret_20d > 3) {
    score += 10;
    reasons.push(`近月+${snap.ret_20d}%`);
  } else if (snap.ret_20d < -5) {
    score -= 12;
    reasons.push(`近月${snap.ret_20d}%`);
  }
  if (vsSpyRet20d != null) {
    if (vsSpyRet20d > 2) {
      score += 10;
      reasons.push(`相對大市強 ${vsSpyRet20d > 0 ? "+" : ""}${vsSpyRet20d.toFixed(1)}%`);
    } else if (vsSpyRet20d < -2) {
      score -= 10;
      reasons.push(`相對大市弱 ${vsSpyRet20d.toFixed(1)}%`);
    }
  }
  if (snap.rsi > 75) {
    score -= 8;
    reasons.push("偏熱，注意回調");
  } else if (snap.rsi >= 40 && snap.rsi <= 65) {
    score += 6;
    reasons.push("動能未過熱");
  }
  score = clamp(score);
  const label = labelFromScore(score, 72, 42);
  const trend = snap.above_ma200 ? "升市趨勢" : "弱勢或整理";
  const relTxt =
    vsSpyRet20d == null ? "" : vsSpyRet20d > 0 ? "相對大市較強。" : "相對大市偏弱。";
  return {
    score: round(score, 1),
    label,
    reason: reasons.slice(0, 3).join("；"),
    signals: reasons,
    horizon: "長線",
    hold_period: label === "買" ? "3–12 個月" : label === "持有" ? "1–6 個月觀察" : "長線暫避 / 等趨勢轉好",
    knowledge:
      label === "買"
        ? `長線偏多（${trend}）。${relTxt}適合分批布局，用月線思維，唔好用日線情緒追高。`
        : label === "避開"
          ? `長線偏淡（${trend}）。${relTxt}可先觀望，等重返50/200日線再說。`
          : `長線中性（${trend}）。${relTxt}可持有核心倉，避免一次過加大倉位。`,
  };
}
