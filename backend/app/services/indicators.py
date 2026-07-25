from __future__ import annotations

import numpy as np
import pandas as pd


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window, min_periods=max(2, window // 2)).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    line = ema(close, 12) - ema(close, 26)
    signal = ema(line, 9)
    hist = line - signal
    return line, signal, hist


def support_resistance(high: pd.Series, low: pd.Series, close: pd.Series, lookback: int = 40) -> dict:
    """Recent swing levels + classic pivot."""
    h = high.tail(lookback)
    l = low.tail(lookback)
    c = float(close.iloc[-1])
    recent_high = float(h.max())
    recent_low = float(l.min())
    # Classic floor trader pivots from prior bar
    prev_h = float(high.iloc[-2]) if len(high) > 1 else recent_high
    prev_l = float(low.iloc[-2]) if len(low) > 1 else recent_low
    prev_c = float(close.iloc[-2]) if len(close) > 1 else c
    pivot = (prev_h + prev_l + prev_c) / 3
    r1 = 2 * pivot - prev_l
    s1 = 2 * pivot - prev_h
    r2 = pivot + (prev_h - prev_l)
    s2 = pivot - (prev_h - prev_l)
    return {
        "support": round(min(recent_low, s1, s2), 2),
        "resistance": round(max(recent_high, r1, r2), 2),
        "pivot": round(pivot, 2),
        "near_support": round(min(s1, recent_low), 2),
        "near_resistance": round(max(r1, recent_high), 2),
        "distance_to_support_pct": round((c - min(s1, recent_low)) / c * 100, 2) if c else 0,
        "distance_to_resistance_pct": round((max(r1, recent_high) - c) / c * 100, 2) if c else 0,
    }


def compute_snapshot(df: pd.DataFrame) -> dict | None:
    if df is None or len(df) < 30:
        return None

    close = df["Close"].astype(float)
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    volume = df["Volume"].astype(float)

    ma20 = sma(close, 20)
    ma50 = sma(close, 50)
    ma200 = sma(close, 200)
    rsi14 = rsi(close, 14)
    macd_line, macd_signal, macd_hist = macd(close)
    vol_ma20 = sma(volume, 20)

    last = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) > 1 else last
    change_pct = ((last - prev) / prev * 100) if prev else 0.0

    def last_val(s: pd.Series) -> float | None:
        v = s.iloc[-1]
        if pd.isna(v):
            return None
        return float(v)

    ret_5 = float(close.pct_change(5).iloc[-1] * 100) if len(close) > 5 else 0.0
    ret_20 = float(close.pct_change(20).iloc[-1] * 100) if len(close) > 20 else 0.0
    if pd.isna(ret_5):
        ret_5 = 0.0
    if pd.isna(ret_20):
        ret_20 = 0.0

    vol_last = last_val(volume) or 0.0
    vol_avg = last_val(vol_ma20) or 1.0
    vol_ratio = vol_last / vol_avg if vol_avg else 1.0

    sr = support_resistance(high, low, close)

    return {
        "price": round(last, 2),
        "change_pct": round(change_pct, 2),
        "ma20": round(last_val(ma20) or last, 2),
        "ma50": round(last_val(ma50) or last, 2),
        "ma200": round(last_val(ma200) or last, 2) if last_val(ma200) else None,
        "rsi": round(last_val(rsi14) or 50.0, 1),
        "macd": round(last_val(macd_line) or 0.0, 3),
        "macd_signal": round(last_val(macd_signal) or 0.0, 3),
        "macd_hist": round(last_val(macd_hist) or 0.0, 3),
        "ret_5d": round(ret_5, 2),
        "ret_20d": round(ret_20, 2),
        "volume_ratio": round(vol_ratio, 2),
        "support_resistance": sr,
        "above_ma20": last > (last_val(ma20) or last),
        "above_ma50": last > (last_val(ma50) or last),
        "above_ma200": (last > last_val(ma200)) if last_val(ma200) else None,
    }
