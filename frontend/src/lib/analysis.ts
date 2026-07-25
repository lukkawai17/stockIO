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
  /** Preferred entry (often mid of zone or market if OK). */
  buy: number | null;
  buy_low: number | null;
  buy_high: number | null;
  /** Take-profit / trim level. */
  sell: number | null;
  /** Stop-loss reference. */
  stop: number | null;
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
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
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
  return {
    support: round(Math.min(recentLow, s1, s2)),
    resistance: round(Math.max(recentHigh, r1, r2)),
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

/** Fill buy/sell levels onto a scan row when missing (older scan JSON). */
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
  if (row.levels || row.buy_price != null || row.sell_price != null) return row;
  const sr = row.support_resistance;
  if (!sr) return row;
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
    support_resistance: sr,
    above_ma20: row.price > (row.ma20 ?? row.price),
    above_ma50: row.price > (row.ma50 ?? row.price),
    above_ma200: row.ma200 == null ? null : row.price > row.ma200,
  };
  const levels = suggestLevels(snap, row.label, horizon);
  return {
    ...row,
    levels,
    buy_price: levels.buy,
    sell_price: levels.sell,
    stop_price: levels.stop,
  };
}

/** Recommend buy / sell / stop from S/R + ATR + MAs. Reference only. */
export function suggestLevels(
  snap: Snapshot,
  label: ScoreResult["label"],
  horizon: "short" | "long"
): PriceLevels {
  const p = snap.price;
  const sr = snap.support_resistance;
  const atrPct = snap.atr_pct ?? (horizon === "short" ? 2 : 2.5);
  const atr = Math.max(p * (atrPct / 100), p * 0.008);
  const support = sr.support;
  const resistance = sr.resistance;
  const ma20 = snap.ma20;
  const ma50 = snap.ma50;
  const ma200 = snap.ma200;

  if (label === "避開") {
    return {
      buy: null,
      buy_low: null,
      buy_high: null,
      sell: round(p),
      stop: null,
      note: horizon === "short" ? "暫不建議買入；若持倉可考慮減倉／離場。" : "長線暫避；若持倉可考慮逢高減倉。",
    };
  }

  let stop = support - atr * (horizon === "short" ? 0.35 : 0.5);
  if (horizon === "long" && ma200 != null) stop = Math.min(stop, ma200 * 0.985);
  stop = Math.min(stop, p - atr * 0.6);
  if (stop >= p * 0.995) stop = p - atr;

  let sell = resistance;
  if (sell <= p * 1.01) sell = p + atr * (horizon === "short" ? 1.8 : 3);
  if (horizon === "long") sell = Math.max(sell, p + atr * 3);

  let buyLow: number;
  let buyHigh: number;
  let buy: number;
  let note: string;

  if (label === "買") {
    if (horizon === "short") {
      const stretched = sr.distance_to_support_pct > 5 && snap.rsi > 65;
      if (stretched) {
        buyLow = Math.max(support * 1.005, p - atr * 2);
        buyHigh = Math.min(ma20, (support + p) / 2);
        if (buyHigh <= buyLow) buyHigh = buyLow + atr * 0.4;
        buy = round((buyLow + buyHigh) / 2);
        note = "現價偏高，建議等回調至買入區間；止蝕喺支撐下，目標睇賣出價。";
      } else {
        buyLow = Math.max(support * 1.002, p - atr * 0.8);
        buyHigh = Math.max(buyLow, Math.min(p * 1.005, p + atr * 0.12));
        buy = round(Math.min(p, (buyLow + buyHigh) / 2));
        if (p <= buyHigh * 1.01) buy = round(p);
        note = "可於買入區間進場（現價若喺區間內可考慮）；止蝕見下方，目標睇賣出價。";
      }
    } else {
      const anchor = ma50 || support;
      const stretched = ma50 != null && p > ma50 * 1.12;
      if (stretched) {
        buyLow = Math.max(support, anchor * 0.97);
        buyHigh = Math.min(p, anchor * 1.03);
        if (buyHigh <= buyLow) buyHigh = buyLow + atr;
        buy = round((buyLow + buyHigh) / 2);
        note = "偏離中期均線較遠，建議分批等回調買入；長線目標逢高減部分。";
      } else {
        buyLow = Math.max(support, anchor * 0.98);
        buyHigh = p;
        if (buyLow > p) buyLow = p * 0.97;
        buy = round(p);
        note = "可現價或分批於買入區間建倉；止蝕參考下方，賣出價作減倉目標。";
      }
    }
  } else {
    // 持有：更好嘅加倉位 + 減倉目標
    buyLow = support * 1.005;
    buyHigh =
      horizon === "short"
        ? Math.min(ma20, p * 0.995)
        : Math.min(ma50 || p * 0.98, p * 0.99);
    if (buyHigh <= buyLow) {
      buyLow = support;
      buyHigh = support + atr * 0.5;
    }
    buy = round((buyLow + buyHigh) / 2);
    note = "暫持有；想加倉等回調至買入區間；可於賣出價附近減倉。";
  }

  // Keep ordering: stop < buy_low <= buy <= buy_high < sell
  buyLow = Math.min(buyLow, buyHigh);
  buyHigh = Math.max(buyLow, buyHigh);
  if (buy < buyLow) buy = buyLow;
  if (buy > buyHigh) buy = buyHigh;
  if (sell <= buyHigh) sell = buyHigh + atr * (horizon === "short" ? 1.2 : 2);
  if (stop >= buyLow) stop = buyLow - atr * 0.35;

  return {
    buy: round(buy),
    buy_low: round(buyLow),
    buy_high: round(buyHigh),
    sell: round(sell),
    stop: round(stop),
    note,
  };
}

export function computeSnapshot(bars: Bar[]): Snapshot | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
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
  const atrPct = atrN ? round((atrSum / atrN / last) * 100) : null;
  const high52 = Math.max(...highs.slice(-Math.min(252, highs.length)));
  const dist52 = high52 ? round(((high52 - last) / high52) * 100) : null;
  const peak20 = Math.max(...closes.slice(-21));
  const dd20 = peak20 ? round(((last - peak20) / peak20) * 100) : 0;

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
    ret_63d: round(ret63),
    volume_ratio: round(volRatio),
    atr_pct: atrPct,
    dist_52w_high_pct: dist52,
    drawdown_20d_pct: dd20,
    ma_stack_bull: last > ma20 && ma20 > ma50,
    ma_stack_bear: last < ma20 && ma20 < ma50,
    golden_bias: ma200 != null && ma50 > ma200,
    death_bias: ma200 != null && ma50 < ma200,
    support_resistance: supportResistance(bars),
    above_ma20: last > ma20,
    above_ma50: last > ma50,
    above_ma200: ma200 == null ? null : last > ma200,
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
  if (ds <= 2) {
    structure += 14;
    reasons.push("接近支撐（結構較佳觀察位）");
  }
  if (dr <= 1.5) {
    structure -= 14;
    reasons.push("貼近阻力（冲關風險）");
  } else if (dr >= 8) {
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
    }
  }
  if (snap.drawdown_20d_pct <= -12) {
    risk -= 10;
    reasons.push("近月回撤偏深");
  }
  risk = clamp(risk);

  let score = clamp(trend * 0.3 + momentum * 0.25 + volume * 0.2 + structure * 0.15 + risk * 0.1);
  let label = labelFromScore(score);
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
        ? "跨類別確認偏多。進場前訂止蝕（支撐下）同倉位（單筆風險≤本金2%）。"
        : label === "避開"
          ? "多因子偏淡。宜等趨勢同動能重新对齐，唔好抄底博反彈。"
          : gated.gated
            ? "分數尚可但確認不足。寧願錯過，唔好硬上。"
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
