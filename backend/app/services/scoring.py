from __future__ import annotations

"""
Multi-pillar scoring inspired by practitioner + academic blends:
- Trend / momentum / volume confirmation (classic TA stacking)
- Absolute + relative momentum (dual-momentum style)
- Structure (support/resistance)
- Risk / volatility awareness
"""


def _clamp(n: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, n))


def label_from_score(score: float, buy_at: float = 70, avoid_below: float = 40) -> str:
    if score >= buy_at:
        return "買"
    if score <= avoid_below:
        return "避開"
    return "持有"


def _apply_buy_gate(
    score: float,
    label: str,
    pillars: dict,
    min_strong: int,
    core_keys: list[str],
) -> tuple[float, str, bool]:
    """Downgrade 「買」 when cross-pillar confirmation is missing."""
    if label != "買":
        return score, label, False
    vals = [v for v in pillars.values() if v is not None]
    strong = sum(1 for v in vals if v >= 58)
    core_ok = all((pillars.get(k) or 0) >= 52 for k in core_keys)
    if strong >= min_strong and core_ok:
        return score, label, False
    return min(score, 68.5), "持有", True


def suggest_levels(snap: dict, label: str, horizon: str = "short") -> dict:
    """
    Safer buy/sell: pullback confluence + discount zone + ATR stop + ~2:1 R:R.
    Default is LIMIT below market — do not chase current price.
    """
    p = float(snap.get("price") or 0)
    sr = snap.get("support_resistance") or {}
    atr_pct = snap.get("atr_pct")
    if atr_pct is None:
        atr_pct = 2.0 if horizon == "short" else 2.5
    atr = max(p * (float(atr_pct) / 100.0), p * 0.008)
    raw_sup = sr.get("support")
    raw_res = sr.get("resistance")
    support = float(raw_sup) if raw_sup is not None and float(raw_sup) < p - atr * 0.05 else p - atr * 1.5
    resistance = float(raw_res) if raw_res is not None and float(raw_res) > p + atr * 0.05 else p + atr * 2
    if resistance - support < atr * 1.2:
        support = min(support, p - atr * 1.5)
        resistance = max(resistance, p + atr * 2)
    range_ = max(resistance - support, atr)
    range_pos = max(0.0, min(1.0, (p - support) / range_))
    rsi = float(snap.get("rsi") or 50)
    ma_pull = float(snap.get("ma20") if horizon == "short" else snap.get("ma50") or p)
    deep_ma = snap.get("ma50") if horizon == "short" else snap.get("ma200")
    deep_ma = float(deep_ma) if deep_ma is not None else ma_pull
    _dr = sr.get("distance_to_resistance_pct")
    dist_res = float(_dr) if _dr is not None else 99.0

    def r(n: float) -> float:
        return round(n, 2)

    if label == "避開":
        return {
            "buy": None,
            "buy_low": None,
            "buy_high": None,
            "sell": r(p),
            "stop": None,
            "risk_reward": None,
            "range_position": r(range_pos),
            "entry_mode": "avoid",
            "note": "暫不建議買入；若持倉可考慮減倉／離場。"
            if horizon == "short"
            else "長線暫避；若持倉可考慮逢高減倉。",
        }

    stop = support - atr * (0.5 if horizon == "short" else 0.75)
    ma200 = snap.get("ma200")
    if horizon == "long" and ma200 is not None:
        stop = min(stop, float(ma200) - atr * 0.5)
    stop = min(stop, p - atr * 1.2)

    fib382 = support + range_ * 0.382
    fib50 = support + range_ * 0.5
    discount_cap = support + range_ * 0.52
    anchors = [support + atr * 0.15, ma_pull, deep_ma]
    anchors = [min(x, p - atr * 0.05) for x in anchors]
    buy_low = max(support + atr * 0.1, min(anchors + [fib382]) - atr * 0.15)
    buy_high = min(discount_cap, fib50, max(ma_pull, support + atr))

    if support < ma_pull < p:
        buy_low = max(support + atr * 0.1, min(ma_pull - atr * 0.35, buy_low))
        buy_high = min(discount_cap, max(ma_pull + atr * 0.25, buy_high * 0.5 + ma_pull * 0.5))

    if buy_high <= buy_low:
        buy_low = support + atr * 0.1
        buy_high = buy_low + atr * 0.8

    in_premium = range_pos >= 0.55 or rsi >= 68 or dist_res <= 2.5
    in_discount = range_pos <= 0.42 and rsi <= 60

    if in_premium or label == "持有":
        buy_high = min(buy_high, p - atr * 0.35, discount_cap)
        buy_low = min(buy_low, buy_high - atr * 0.4)
        if buy_low < support:
            buy_low = support + atr * 0.05
        if buy_high <= buy_low:
            buy_low = support + atr * 0.1
            buy_high = min(p - atr * 0.5, support + range_ * 0.4)

    buy = (buy_low + buy_high) / 2
    entry_mode = "limit_pullback"
    note = ""

    if label == "持有":
        entry_mode = "limit_pullback"
        note = "暫持有。加倉只用限價等回調至買入區間；唔好現價追。"
    elif in_premium:
        entry_mode = "wait_premium"
        buy = (buy_low + buy_high) / 2
        note = "現價喺偏貴／貼近阻力區。等回調落入買入區間再用限價；追現價風險報酬差。"
    elif in_discount and p <= buy_high * 1.01:
        buy_high = min(buy_high, p)
        buy = min(p, (buy_low + buy_high) / 2)
        if abs(p - buy) <= atr * 0.45:
            entry_mode = "in_zone"
            buy = min(p, buy_high)
            note = "現價已喺折讓區內，可用限價靠近區間上沿試倉；仍建議唔好市價追穿。"
        else:
            entry_mode = "limit_pullback"
            note = "偏多但現價略高過理想中位，掛限價喺買入區間。"
    else:
        entry_mode = "limit_pullback"
        buy_high = min(buy_high, p - atr * 0.15)
        if buy_high <= buy_low:
            buy_low = support + atr * 0.1
            buy_high = min(p - atr * 0.2, support + range_ * 0.4)
        buy = (buy_low + buy_high) / 2
        note = "偏多訊號：用限價等回調入場，唔用現價追。"

    risk = max(buy - stop, atr * 0.8)
    structural_tp = resistance if resistance > buy + atr * 0.5 else buy + risk * 2
    sell = max(structural_tp, buy + risk * 2)
    if horizon == "short" and sell > buy + atr * 5:
        sell = min(sell, max(resistance, buy + risk * 2.2))

    buy_low, buy_high = min(buy_low, buy_high), max(buy_low, buy_high)
    buy = max(buy_low, min(buy, buy_high))
    if stop >= buy_low - atr * 0.05:
        stop = buy_low - atr * 0.5
    if sell <= buy + risk:
        sell = buy + risk * 2

    if entry_mode != "in_zone" and buy >= p * 0.998:
        buy_high = min(buy_high, p - atr * 0.25)
        buy_low = min(buy_low, buy_high - atr * 0.35)
        if buy_low < support:
            buy_low = support + atr * 0.05
        buy = (buy_low + buy_high) / 2
        entry_mode = "limit_pullback"
        note = "為保安全邊際，買入價設喺現價之下（回調限價），唔追現價。"

    risk_final = max(buy - stop, 1e-9)
    rr = (sell - buy) / risk_final
    if rr < 1.8 and label == "買":
        sell = buy + risk_final * 2
        note += " 已按最少約 2:1 風險報酬調整賣出目標。"

    return {
        "buy": r(buy),
        "buy_low": r(buy_low),
        "buy_high": r(buy_high),
        "sell": r(sell),
        "stop": r(stop),
        "risk_reward": r(max((sell - buy) / max(buy - stop, 1e-9), 0)),
        "range_position": r(range_pos),
        "entry_mode": entry_mode,
        "note": note,
    }


def _pillar_trend_short(snap: dict, reasons: list[str]) -> float:
    s = 50.0
    if snap.get("above_ma20"):
        s += 14
        reasons.append("企穩MA20（短線趨勢）")
    else:
        s -= 14
        reasons.append("跌破MA20")

    if snap.get("above_ma50"):
        s += 12
        reasons.append("高於MA50")
    else:
        s -= 12
        reasons.append("低於MA50")

    if snap.get("ma_stack_bull"):
        s += 10
        reasons.append("均線多頭排列")
    elif snap.get("ma_stack_bear"):
        s -= 8
        reasons.append("均線空頭排列")

    if snap.get("above_ma200") is True and snap.get("above_ma50"):
        s += 6
        reasons.append("順大趨勢（MA200上）")
    elif snap.get("above_ma200") is False:
        s -= 6
        reasons.append("逆大趨勢（MA200下）")

    return _clamp(s)


def _pillar_momentum(snap: dict, reasons: list[str]) -> float:
    s = 50.0
    rsi = snap.get("rsi", 50)
    if 45 <= rsi <= 65:
        s += 14
        reasons.append(f"RSI健康({rsi})")
    elif 35 <= rsi < 45:
        s += 6
        reasons.append(f"RSI回調區({rsi})")
    elif rsi > 72:
        s -= 16
        reasons.append(f"RSI超買({rsi})")
    elif rsi < 30:
        s -= 8
        reasons.append(f"RSI超賣({rsi})")

    if snap.get("macd_hist", 0) > 0 and snap.get("macd", 0) > snap.get("macd_signal", 0):
        s += 12
        reasons.append("MACD動能偏多")
    elif snap.get("macd_hist", 0) < 0:
        s -= 12
        reasons.append("MACD動能偏淡")

    ret5 = snap.get("ret_5d", 0)
    ret20 = snap.get("ret_20d", 0)
    if ret5 > 2:
        s += 8
        reasons.append(f"近5日+{ret5}%")
    elif ret5 < -3:
        s -= 10
        reasons.append(f"近5日{ret5}%")

    if ret20 > 5:
        s += 6
    elif ret20 < -8:
        s -= 8

    dist = snap.get("dist_52w_high_pct")
    if dist is not None:
        if 0 <= dist <= 8:
            s += 6
            reasons.append("接近52週高（相對強勢）")
        elif dist > 35:
            s -= 6
            reasons.append("遠離52週高（相對弱勢）")

    return _clamp(s)


def _pillar_volume(snap: dict, reasons: list[str]) -> float:
    s = 50.0
    vr = snap.get("volume_ratio", 1.0)
    ret5 = snap.get("ret_5d", 0)
    if vr >= 1.4 and ret5 > 0:
        s += 18
        reasons.append("放量上攻（參與度確認）")
    elif vr >= 1.4 and ret5 < 0:
        s -= 16
        reasons.append("放量下跌（拋壓確認）")
    elif vr < 0.7:
        s -= 6
        reasons.append("成交偏淡")
    else:
        s += 4
        reasons.append("成交量正常")
    return _clamp(s)


def _pillar_structure(snap: dict, reasons: list[str]) -> float:
    s = 50.0
    sr = snap.get("support_resistance") or {}
    ds = sr.get("distance_to_support_pct")
    dr = sr.get("distance_to_resistance_pct")
    if ds is not None and ds <= 2:
        s += 14
        reasons.append("接近支撐（結構較佳觀察位）")
    elif ds is not None and ds >= 12:
        s -= 4
    if dr is not None and dr <= 1.5:
        s -= 14
        reasons.append("貼近阻力（冲關風險）")
    elif dr is not None and dr >= 8:
        s += 6
        reasons.append("距離阻力有空間")
    return _clamp(s)


def _pillar_risk(snap: dict, reasons: list[str]) -> float:
    """Higher score = healthier risk profile (not too wild)."""
    s = 55.0
    atr = snap.get("atr_pct")
    if atr is not None:
        if 1.0 <= atr <= 3.5:
            s += 12
            reasons.append(f"波幅適中(ATR {atr}%)")
        elif atr > 6:
            s -= 16
            reasons.append(f"波幅偏高(ATR {atr}%)")
        elif atr < 0.8:
            s += 4
            reasons.append("波幅偏低")
    dd = snap.get("drawdown_20d_pct")
    if dd is not None and dd <= -12:
        s -= 10
        reasons.append("近月回撤偏深")
    return _clamp(s)


def score_short(snap: dict) -> dict:
    reasons: list[str] = []
    trend = _pillar_trend_short(snap, reasons)
    momentum = _pillar_momentum(snap, reasons)
    volume = _pillar_volume(snap, reasons)
    structure = _pillar_structure(snap, reasons)
    risk = _pillar_risk(snap, reasons)

    # Weighted blend (confirmation across categories)
    score = trend * 0.30 + momentum * 0.25 + volume * 0.20 + structure * 0.15 + risk * 0.10
    score = _clamp(score)
    label = label_from_score(score, buy_at=72, avoid_below=40)

    pillars = {
        "trend": round(trend, 1),
        "momentum": round(momentum, 1),
        "volume": round(volume, 1),
        "structure": round(structure, 1),
        "risk": round(risk, 1),
    }
    score, label, gated = _apply_buy_gate(score, label, pillars, 3, ["trend", "momentum"])
    if gated:
        reasons.insert(0, "確認不足：未達跨柱齊備，暫不標「買」")

    sr = snap.get("support_resistance") or {}
    dr = sr.get("distance_to_resistance_pct")
    if label == "買" and dr is not None and dr <= 2:
        label = "持有"
        score = min(score, 68.5)
        reasons.insert(0, "貼近阻力：暫不標買，等回調或突破確認")

    hold_days = "3–10 個交易日" if label == "買" else ("5–15 個交易日" if label == "持有" else "暫觀望 / 等更好位置")
    levels = suggest_levels(snap, label, "short")

    return {
        "score": round(score, 1),
        "label": label,
        "reason": "；".join(reasons[:4]),
        "signals": reasons,
        "pillars": pillars,
        "framework": "multi_pillar_v3",
        "horizon": "短線",
        "hold_period": hold_days,
        "knowledge": _short_knowledge(label, pillars, gated),
        "levels": levels,
        "buy_price": levels.get("buy"),
        "sell_price": levels.get("sell"),
        "stop_price": levels.get("stop"),
    }


def score_long(snap: dict, vs_spy_ret_20d: float | None = None, fundamentals: dict | None = None) -> dict:
    reasons: list[str] = []
    s_trend = 50.0
    above200 = snap.get("above_ma200")
    if above200 is True:
        s_trend += 22
        reasons.append("絕對動能：站上MA200")
    elif above200 is False:
        s_trend -= 22
        reasons.append("絕對動能弱：跌破MA200")
    else:
        reasons.append("MA200 數據不足")

    if snap.get("above_ma50"):
        s_trend += 10
        reasons.append("高於MA50")
    else:
        s_trend -= 10
        reasons.append("低於MA50")

    if snap.get("golden_bias"):
        s_trend += 8
        reasons.append("MA50>MA200（偏金叉結構）")
    elif snap.get("death_bias"):
        s_trend -= 8
        reasons.append("MA50<MA200（偏死叉結構）")
    s_trend = _clamp(s_trend)

    s_rel = 50.0
    if vs_spy_ret_20d is not None:
        if vs_spy_ret_20d > 3:
            s_rel += 18
            reasons.append(f"相對動能強 vs SPY {vs_spy_ret_20d:+.1f}%")
        elif vs_spy_ret_20d > 0:
            s_rel += 8
            reasons.append(f"略強過大市 {vs_spy_ret_20d:+.1f}%")
        elif vs_spy_ret_20d < -3:
            s_rel -= 18
            reasons.append(f"相對動能弱 vs SPY {vs_spy_ret_20d:+.1f}%")
        else:
            s_rel -= 6
            reasons.append("相對大市偏弱")
    s_rel = _clamp(s_rel)

    s_mom = 50.0
    ret20 = snap.get("ret_20d", 0)
    ret63 = snap.get("ret_63d", 0)
    if ret20 > 3:
        s_mom += 10
        reasons.append(f"近月+{ret20}%")
    elif ret20 < -5:
        s_mom -= 12
        reasons.append(f"近月{ret20}%")
    if ret63 > 8:
        s_mom += 10
        reasons.append(f"近季+{ret63}%")
    elif ret63 < -12:
        s_mom -= 10
        reasons.append(f"近季{ret63}%")
    rsi = snap.get("rsi", 50)
    if rsi > 75:
        s_mom -= 10
        reasons.append("長線過熱風險")
    elif 40 <= rsi <= 65:
        s_mom += 6
    s_mom = _clamp(s_mom)

    s_risk = _pillar_risk(snap, reasons)

    s_quality = 50.0
    if fundamentals:
        roe = fundamentals.get("roe")
        pe = fundamentals.get("pe")
        margin = fundamentals.get("profit_margin")
        de = fundamentals.get("debt_to_equity")
        if roe is not None:
            if roe >= 0.15:
                s_quality += 14
                reasons.append(f"質素：ROE {roe*100:.0f}%")
            elif roe < 0:
                s_quality -= 12
                reasons.append("質素弱：ROE 負數")
        if margin is not None:
            if margin >= 0.12:
                s_quality += 8
            elif margin < 0:
                s_quality -= 8
        if pe is not None and pe > 0:
            if 8 <= pe <= 28:
                s_quality += 6
                reasons.append(f"估值合理 PE {pe:.1f}")
            elif pe > 45:
                s_quality -= 8
                reasons.append(f"估值偏貴 PE {pe:.1f}")
        if de is not None:
            if de < 1.0:
                s_quality += 6
            elif de > 2.5:
                s_quality -= 8
                reasons.append("槓桿偏高")
    s_quality = _clamp(s_quality)

    # Dual-momentum style weighting + optional quality
    if fundamentals:
        score = s_trend * 0.30 + s_rel * 0.22 + s_mom * 0.18 + s_risk * 0.12 + s_quality * 0.18
    else:
        score = s_trend * 0.35 + s_rel * 0.25 + s_mom * 0.25 + s_risk * 0.15

    score = _clamp(score)
    label = label_from_score(score, buy_at=72, avoid_below=42)

    pillars = {
        "trend": round(s_trend, 1),
        "relative": round(s_rel, 1),
        "momentum": round(s_mom, 1),
        "risk": round(s_risk, 1),
        "quality": round(s_quality, 1) if fundamentals else None,
    }
    score, label, gated = _apply_buy_gate(score, label, pillars, 3, ["trend", "relative"])
    if gated:
        reasons.insert(0, "確認不足：雙動能未齊，暫不標「買」")

    hold_days = "3–12 個月" if label == "買" else ("1–6 個月觀察" if label == "持有" else "長線暫避 / 等趨勢轉好")
    levels = suggest_levels(snap, label, "long")

    return {
        "score": round(score, 1),
        "label": label,
        "reason": "；".join(reasons[:4]),
        "signals": reasons,
        "pillars": pillars,
        "framework": "multi_pillar_v3",
        "horizon": "長線",
        "hold_period": hold_days,
        "knowledge": _long_knowledge(label, vs_spy_ret_20d, pillars, gated),
        "levels": levels,
        "buy_price": levels.get("buy"),
        "sell_price": levels.get("sell"),
        "stop_price": levels.get("stop"),
    }


def _short_knowledge(label: str, pillars: dict, gated: bool = False) -> str:
    weak = [k for k, v in pillars.items() if v is not None and v < 45]
    strong = [k for k, v in pillars.items() if v is not None and v >= 65]
    tip = ""
    if strong:
        tip += f"強項：{'/'.join(strong)}。"
    if weak:
        tip += f"弱項：{'/'.join(weak)}。"
    if label == "買":
        return f"跨類別確認偏多。{tip}進場前訂止蝕（支撐下）同倉位（單筆風險≤本金2%）。"
    if label == "避開":
        return f"多因子偏淡。{tip}宜等趨勢同動能重新对齐，唔好抄底博反彈。"
    if gated:
        return f"分數尚可但確認不足。{tip}寧願錯過，唔好硬上。"
    return f"多因子中性。{tip}可觀望等待更多確認。"


def _long_knowledge(label: str, rel: float | None, pillars: dict, gated: bool = False) -> str:
    rel_txt = ""
    if rel is not None:
        rel_txt = "相對大市較強。" if rel > 0 else "相對大市偏弱。"
    if label == "買":
        return f"雙動能框架偏多（絕對趨勢+相對強勢）。{rel_txt}分批建倉；跌破MA200 重新評估。"
    if label == "避開":
        return f"長線框架偏淡。{rel_txt}可等重返MA200再說。"
    if gated:
        return f"分數尚可但確認不足。{rel_txt}等絕對+相對齊備再考慮加倉。"
    return f"長線中性。{rel_txt}核心倉可留，避免一次加倉。"
