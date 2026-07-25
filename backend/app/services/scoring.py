from __future__ import annotations


def _clamp(n: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, n))


def label_from_score(score: float, buy_at: float = 70, avoid_below: float = 40) -> str:
    if score >= buy_at:
        return "買"
    if score <= avoid_below:
        return "避開"
    return "持有"


def score_short(snap: dict) -> dict:
    """Short-term technical score 0-100."""
    score = 50.0
    reasons: list[str] = []

    if snap["above_ma20"]:
        score += 10
        reasons.append("企穩20日線")
    else:
        score -= 10
        reasons.append("跌破20日線")

    if snap["above_ma50"]:
        score += 8
        reasons.append("高於50日線")
    else:
        score -= 8
        reasons.append("低於50日線")

    rsi = snap["rsi"]
    if 45 <= rsi <= 65:
        score += 12
        reasons.append(f"RSI健康({rsi})")
    elif 35 <= rsi < 45:
        score += 6
        reasons.append(f"RSI回調中({rsi})")
    elif rsi > 72:
        score -= 14
        reasons.append(f"RSI超買({rsi})")
    elif rsi < 30:
        score -= 8
        reasons.append(f"RSI超賣({rsi})")
    else:
        reasons.append(f"RSI {rsi}")

    if snap["macd_hist"] > 0 and snap["macd"] > snap["macd_signal"]:
        score += 10
        reasons.append("MACD偏多")
    elif snap["macd_hist"] < 0:
        score -= 10
        reasons.append("MACD偏淡")

    if snap["ret_5d"] > 2:
        score += 8
        reasons.append(f"近5日+{snap['ret_5d']}%")
    elif snap["ret_5d"] < -3:
        score -= 10
        reasons.append(f"近5日{snap['ret_5d']}%")

    if snap["volume_ratio"] >= 1.4 and snap["ret_5d"] > 0:
        score += 6
        reasons.append("放量上攻")
    elif snap["volume_ratio"] >= 1.4 and snap["ret_5d"] < 0:
        score -= 6
        reasons.append("放量下跌")

    sr = snap["support_resistance"]
    if sr["distance_to_support_pct"] <= 2:
        score += 4
        reasons.append("接近支撐")
    if sr["distance_to_resistance_pct"] <= 1.5:
        score -= 4
        reasons.append("接近阻力")

    score = _clamp(score)
    label = label_from_score(score)
    hold_days = "3–10 個交易日" if label == "買" else ("5–15 個交易日" if label == "持有" else "暫觀望 / 等更好位置")

    return {
        "score": round(score, 1),
        "label": label,
        "reason": "；".join(reasons[:3]),
        "signals": reasons,
        "horizon": "短線",
        "hold_period": hold_days,
        "knowledge": _short_knowledge(snap, label),
    }


def score_long(snap: dict, vs_spy_ret_20d: float | None = None) -> dict:
    """Long-term / ETF trend score 0-100."""
    score = 50.0
    reasons: list[str] = []

    above200 = snap.get("above_ma200")
    if above200 is True:
        score += 18
        reasons.append("站上200日線（長線趨勢向上）")
    elif above200 is False:
        score -= 18
        reasons.append("跌破200日線（長線趨勢轉弱）")
    else:
        reasons.append("200日線數據不足")

    if snap["above_ma50"]:
        score += 10
        reasons.append("高於50日線")
    else:
        score -= 10
        reasons.append("低於50日線")

    if snap["ret_20d"] > 3:
        score += 10
        reasons.append(f"近月+{snap['ret_20d']}%")
    elif snap["ret_20d"] < -5:
        score -= 12
        reasons.append(f"近月{snap['ret_20d']}%")

    if vs_spy_ret_20d is not None:
        if vs_spy_ret_20d > 2:
            score += 10
            reasons.append(f"相對大市強 {vs_spy_ret_20d:+.1f}%")
        elif vs_spy_ret_20d < -2:
            score -= 10
            reasons.append(f"相對大市弱 {vs_spy_ret_20d:+.1f}%")

    rsi = snap["rsi"]
    if rsi > 75:
        score -= 8
        reasons.append("偏熱，注意回調")
    elif 40 <= rsi <= 65:
        score += 6
        reasons.append("動能未過熱")

    score = _clamp(score)
    # Stricter for long-term buys
    label = label_from_score(score, buy_at=72, avoid_below=42)
    hold_days = "3–12 個月" if label == "買" else ("1–6 個月觀察" if label == "持有" else "長線暫避 / 等趨勢轉好")

    return {
        "score": round(score, 1),
        "label": label,
        "reason": "；".join(reasons[:3]),
        "signals": reasons,
        "horizon": "長線",
        "hold_period": hold_days,
        "knowledge": _long_knowledge(snap, label, vs_spy_ret_20d),
    }


def _short_knowledge(snap: dict, label: str) -> str:
    if label == "買":
        return "短線偏多：價格結構向上，適合用較細倉位試，並設止蝕喺近期支撐之下。"
    if label == "避開":
        return "短線偏淡：動能或均線轉弱，寧願等站回關鍵均線或企穩支撐再睇。"
    return "結構中性：可以持有觀望，等 MACD / 均線方向更清晰。"


def _long_knowledge(snap: dict, label: str, rel: float | None) -> str:
    trend = "升市趨勢" if snap.get("above_ma200") else "弱勢或整理"
    rel_txt = ""
    if rel is not None:
        rel_txt = "相對大市較強。" if rel > 0 else "相對大市偏弱。"
    if label == "買":
        return f"長線偏多（{trend}）。{rel_txt}適合分批布局，用月線思維，唔好用日線情緒追高。"
    if label == "避開":
        return f"長線偏淡（{trend}）。{rel_txt}可先觀望，等重返50/200日線再說。"
    return f"長線中性（{trend}）。{rel_txt}可持有核心倉，避免一次過加大倉位。"
