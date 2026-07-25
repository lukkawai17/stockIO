from __future__ import annotations

"""
Strategy backtest (event study) for stockIO rules.

Measures what happens AFTER a 「買」 signal — not a per-ticker beauty contest.
Two entry styles:
  - chase: signal at bar close → enter next open (no same-bar lookahead)
  - limit: enter only if price pulls into suggested buy zone within 5 sessions after signal
"""

import logging
import math
from typing import Any, Literal

import numpy as np
import pandas as pd

from app.config import CACHE_BACKTEST
from app.services import cache
from app.services.indicators import compute_snapshot
from app.services.market_data import download_history
from app.services.scoring import score_long, score_short, suggest_levels
from app.universe import equity_tickers, etf_tickers

logger = logging.getLogger(__name__)

HORIZONS = (5, 10, 20)
MIN_BARS = 80
STEP = 5
LIMIT_WAIT = 5
MAX_TICKERS = 40


def _safe_ret(entry: float, exit_px: float) -> float | None:
    if entry is None or exit_px is None or entry <= 0 or math.isnan(entry) or math.isnan(exit_px):
        return None
    return (exit_px / entry - 1.0) * 100.0


def _summarize(returns: list[float]) -> dict[str, Any]:
    if not returns:
        return {
            "n": 0,
            "avg_return_pct": None,
            "median_return_pct": None,
            "win_rate_pct": None,
            "avg_win_pct": None,
            "avg_loss_pct": None,
            "worst_trade_pct": None,
            "best_trade_pct": None,
        }
    arr = np.asarray(returns, dtype=float)
    wins = arr[arr > 0]
    losses = arr[arr <= 0]
    return {
        "n": int(arr.size),
        "avg_return_pct": round(float(arr.mean()), 2),
        "median_return_pct": round(float(np.median(arr)), 2),
        "win_rate_pct": round(float((arr > 0).mean() * 100), 1),
        "avg_win_pct": round(float(wins.mean()), 2) if wins.size else None,
        "avg_loss_pct": round(float(losses.mean()), 2) if losses.size else None,
        "worst_trade_pct": round(float(arr.min()), 2),
        "best_trade_pct": round(float(arr.max()), 2),
    }


def _slice_df(df: pd.DataFrame, end_idx: int) -> pd.DataFrame:
    return df.iloc[: end_idx + 1]


def _backtest_mode(
    frames: dict[str, pd.DataFrame],
    spy_df: pd.DataFrame | None,
    mode: Literal["short", "long"],
) -> dict[str, Any]:
    chase_by_h: dict[int, list[float]] = {h: [] for h in HORIZONS}
    limit_by_h: dict[int, list[float]] = {h: [] for h in HORIZONS}
    spy_by_h: dict[int, list[float]] = {h: [] for h in HORIZONS}
    signal_count = 0
    limit_filled = 0
    tickers_used = 0

    spy_closes = None
    spy_ret20 = None
    spy_index = None
    if spy_df is not None and not spy_df.empty:
        spy_closes = spy_df["Close"].astype(float)
        spy_ret20 = spy_closes.pct_change(20) * 100
        spy_index = spy_df.index

    def spy_loc(dt) -> int | None:
        if spy_index is None:
            return None
        try:
            if dt in spy_index:
                si = spy_index.get_loc(dt)
                if isinstance(si, (int, np.integer)):
                    return int(si)
                if isinstance(si, slice):
                    return si.start
                if isinstance(si, np.ndarray) and si.size:
                    return int(si.flat[0])
        except Exception:
            return None
        return None

    for ticker, df in frames.items():
        if ticker == "SPY":
            continue
        if df is None or len(df) < MIN_BARS + max(HORIZONS) + 5:
            continue
        tickers_used += 1
        closes = df["Close"].astype(float).to_numpy()
        lows = df["Low"].astype(float).to_numpy()
        highs = df["High"].astype(float).to_numpy()
        opens = df["Open"].astype(float).to_numpy() if "Open" in df.columns else closes
        index = df.index

        start = max(MIN_BARS, 200 if mode == "long" else MIN_BARS)
        end = len(df) - max(HORIZONS) - 2

        for i in range(start, end, STEP):
            snap = compute_snapshot(_slice_df(df, i))
            if not snap:
                continue

            if mode == "short":
                scored = score_short(snap)
            else:
                rel = None
                dt = index[i]
                if spy_ret20 is not None:
                    try:
                        if dt in spy_ret20.index:
                            sv = spy_ret20.loc[dt]
                            if hasattr(sv, "iloc"):
                                sv = sv.iloc[0]
                            if sv is not None and not (isinstance(sv, float) and math.isnan(sv)):
                                rel = round(float(snap["ret_20d"]) - float(sv), 2)
                    except Exception:
                        rel = None
                scored = score_long(snap, vs_spy_ret_20d=rel)

            if scored.get("label") != "買":
                continue

            signal_count += 1
            entry_i = i + 1
            entry_chase = float(opens[entry_i])
            levels = scored.get("levels") or suggest_levels(snap, "買", mode)
            buy_high = levels.get("buy_high")
            stop_px = levels.get("stop")
            sell_px = levels.get("sell")

            si = spy_loc(index[entry_i])
            spy_arr = spy_closes.to_numpy() if spy_closes is not None else None
            for h in HORIZONS:
                exit_i = entry_i + h
                if exit_i >= len(df):
                    continue
                r = _safe_ret(entry_chase, float(closes[exit_i]))
                if r is not None:
                    chase_by_h[h].append(r)
                if spy_arr is not None and si is not None and si + h < len(spy_arr):
                    sr = _safe_ret(float(spy_arr[si]), float(spy_arr[si + h]))
                    if sr is not None:
                        spy_by_h[h].append(sr)

            if buy_high is None:
                continue
            filled_i = None
            fill_price = None
            for k in range(1, LIMIT_WAIT + 1):
                j = i + k
                if j >= len(df):
                    break
                o = float(opens[j])
                lo = float(lows[j])
                if o <= float(buy_high):
                    fill_price = o
                    filled_i = j
                    break
                if lo <= float(buy_high):
                    fill_price = float(buy_high)
                    filled_i = j
                    break
            if filled_i is None or fill_price is None:
                continue
            limit_filled += 1

            for h in HORIZONS:
                if filled_i + h >= len(df):
                    continue
                exit_px = None
                for j in range(filled_i, filled_i + h + 1):
                    if stop_px is not None and float(lows[j]) <= float(stop_px):
                        if j == filled_i and float(opens[j]) <= float(stop_px):
                            exit_px = float(opens[j])
                        else:
                            exit_px = float(stop_px)
                        break
                    if sell_px is not None and float(highs[j]) >= float(sell_px):
                        if j == filled_i and float(opens[j]) >= float(sell_px):
                            exit_px = float(opens[j])
                        else:
                            exit_px = float(sell_px)
                        break
                if exit_px is None:
                    exit_px = float(closes[filled_i + h])
                r = _safe_ret(fill_price, exit_px)
                if r is not None:
                    limit_by_h[h].append(r)

    horizons_out = []
    for h in HORIZONS:
        chase = _summarize(chase_by_h[h])
        limit = _summarize(limit_by_h[h])
        spy = _summarize(spy_by_h[h])
        vs_spy = None
        if chase["avg_return_pct"] is not None and spy["avg_return_pct"] is not None:
            vs_spy = round(chase["avg_return_pct"] - spy["avg_return_pct"], 2)
        horizons_out.append(
            {
                "hold_days": h,
                "chase": chase,
                "limit": limit,
                "spy": spy,
                "chase_minus_spy_pct": vs_spy,
            }
        )

    return {
        "mode": mode,
        "tickers_used": tickers_used,
        "signals": signal_count,
        "limit_fills": limit_filled,
        "limit_fill_rate_pct": round(limit_filled / signal_count * 100, 1) if signal_count else None,
        "step_days": STEP,
        "limit_wait_days": LIMIT_WAIT,
        "horizons": horizons_out,
    }


def run_backtest(force: bool = False) -> dict[str, Any]:
    existing = cache.read_json(CACHE_BACKTEST)
    if not force and existing and cache.is_fresh(existing, 6 * 24 * 3600):
        return existing  # type: ignore

    equities = equity_tickers()[:MAX_TICKERS]
    tickers = list(dict.fromkeys(["SPY", *equities, *etf_tickers()[:8]]))
    logger.info("Backtest downloading %d tickers", len(tickers))

    frames = download_history(tickers, period="2y")
    spy_df = frames.get("SPY")

    short = _backtest_mode(frames, spy_df, "short")
    long = _backtest_mode(frames, spy_df, "long")

    payload = cache.now_payload(
        {
            "status": "ok",
            "framework": "multi_pillar_v3",
            "method": "event_study_buy_signals",
            "period": "2y",
            "universe_cap": MAX_TICKERS,
            "notes": [
                "回測驗證策略規則，唔係逐隻股排行。",
                "chase＝訊號日收市確認後，下一交易日開市入場，持有至 N 日（避免用當日收市先知入場）。",
                "limit＝訊號後最多 5 日內跌入買入區間先入場；缺口低開直接用開市價成交。",
                "限價路徑：同一日先計止蝕再計目標（偏保守）。訊號可重疊；費用／滑價未計；過去唔代表未來。",
            ],
            "short": short,
            "long": long,
            "disclaimer": "今晚贏鋪大,老婆仔女攞去賣!",
        }
    )
    cache.write_json(CACHE_BACKTEST, payload)
    return payload
