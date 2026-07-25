from __future__ import annotations

import logging
from typing import Any, Literal

from app.config import CACHE_LONG, CACHE_QUOTES, CACHE_SHORT, QUOTE_CACHE_TTL, SCORE_CACHE_TTL, TOP_N
from app.services import cache
from app.services.market_data import download_history, fetch_earnings, fetch_news, fetch_quotes, snapshots_from_history
from app.services.scoring import score_long, score_short
from app.universe import all_tickers, equity_tickers, etf_tickers

logger = logging.getLogger(__name__)


def run_scan(mode: Literal["short", "long"], force: bool = False) -> dict[str, Any]:
    path = CACHE_SHORT if mode == "short" else CACHE_LONG
    existing = cache.read_json(path)
    if not force and cache.is_fresh(existing, SCORE_CACHE_TTL):
        return existing  # type: ignore

    if mode == "short":
        tickers = equity_tickers()
    else:
        # Long: ETFs + large liquid equities for trend context
        tickers = list(dict.fromkeys(etf_tickers() + equity_tickers()[:80]))

    # Always include SPY for relative strength
    if "SPY" not in tickers:
        tickers = ["SPY", *tickers]

    logger.info("Scanning %s mode, %d tickers", mode, len(tickers))
    frames = download_history(tickers)
    snaps = snapshots_from_history(frames)
    spy_ret = snaps.get("SPY", {}).get("ret_20d")

    rows: list[dict[str, Any]] = []
    for t, snap in snaps.items():
        if mode == "short" and t in set(etf_tickers()) and t != "SPY":
            # short page focuses equities; keep ETFs out except we already skip most
            continue
        if mode == "short" and t == "SPY":
            continue

        if mode == "short":
            scored = score_short(snap)
        else:
            rel = None
            if spy_ret is not None and t != "SPY":
                rel = round(snap["ret_20d"] - spy_ret, 2)
            scored = score_long(snap, vs_spy_ret_20d=rel)

        rows.append(
            {
                "ticker": t,
                "name": t,
                "price": snap["price"],
                "change_pct": snap["change_pct"],
                "score": scored["score"],
                "label": scored["label"],
                "reason": scored["reason"],
                "signals": scored["signals"],
                "horizon": scored["horizon"],
                "hold_period": scored["hold_period"],
                "knowledge": scored["knowledge"],
                "rsi": snap["rsi"],
                "macd_hist": snap["macd_hist"],
                "ret_5d": snap["ret_5d"],
                "ret_20d": snap["ret_20d"],
                "volume_ratio": snap["volume_ratio"],
                "ma20": snap["ma20"],
                "ma50": snap["ma50"],
                "ma200": snap.get("ma200"),
                "support_resistance": snap["support_resistance"],
                "is_etf": t in set(etf_tickers()),
            }
        )

    rows.sort(key=lambda r: r["score"], reverse=True)
    bullish = [r for r in rows if r["label"] == "買"][:TOP_N]
    bearish = sorted([r for r in rows if r["label"] == "避開"], key=lambda r: r["score"])[:TOP_N]
    neutrals = [r for r in rows if r["label"] == "持有"][:TOP_N]
    top = rows[:TOP_N]
    bottom = list(reversed(rows[-TOP_N:])) if len(rows) >= TOP_N else list(reversed(rows))

    payload = cache.now_payload(
        {
            "mode": mode,
            "universe_size": len(tickers),
            "scanned": len(rows),
            "top": top,
            "bottom": bottom,
            "bullish": bullish,
            "bearish": bearish,
            "hold": neutrals,
            "all": rows,
            "spy": snaps.get("SPY"),
            "disclaimer": "今晚贏鋪大,老婆仔女攞去賣!",
        }
    )
    cache.write_json(path, payload)
    return payload


def get_scan(mode: Literal["short", "long"], force: bool = False) -> dict[str, Any]:
    path = CACHE_SHORT if mode == "short" else CACHE_LONG
    existing = cache.read_json(path)
    if existing and not force and cache.is_fresh(existing, SCORE_CACHE_TTL):
        return existing
    if existing and not force:
        # stale but usable while client can request refresh
        return existing
    return run_scan(mode, force=force)


def get_quotes(tickers: list[str], force: bool = False) -> dict[str, Any]:
    existing = cache.read_json(CACHE_QUOTES) or {"quotes": {}}
    quotes: dict[str, Any] = dict(existing.get("quotes") or {})
    need = []
    for t in tickers:
        q = quotes.get(t)
        if force or not q or not cache.is_fresh({"updated_at": q.get("updated_at")}, QUOTE_CACHE_TTL):
            need.append(t)

    if need:
        fresh = fetch_quotes(need)
        ts = cache.now_payload({})["updated_at"]
        for t, q in fresh.items():
            q["updated_at"] = ts
            quotes[t] = q
        payload = cache.now_payload({"quotes": quotes})
        cache.write_json(CACHE_QUOTES, payload)
        return {"quotes": {t: quotes[t] for t in tickers if t in quotes}, "updated_at": payload["updated_at"], "updated_at_iso": payload["updated_at_iso"]}

    return {
        "quotes": {t: quotes[t] for t in tickers if t in quotes},
        "updated_at": existing.get("updated_at"),
        "updated_at_iso": existing.get("updated_at_iso"),
    }


def get_stock_detail(ticker: str) -> dict[str, Any]:
    t = ticker.upper().replace(".", "-")
    frames = download_history([t, "SPY"])
    snaps = snapshots_from_history(frames)
    snap = snaps.get(t)
    if not snap:
        return {"ticker": t, "error": "找不到數據"}

    spy_ret = snaps.get("SPY", {}).get("ret_20d")
    short = score_short(snap)
    rel = round(snap["ret_20d"] - spy_ret, 2) if spy_ret is not None else None
    long = score_long(snap, vs_spy_ret_20d=rel)

    news = fetch_news(t)
    earnings = fetch_earnings(t)

    return {
        "ticker": t,
        "price": snap["price"],
        "change_pct": snap["change_pct"],
        "snapshot": snap,
        "short": short,
        "long": long,
        "support_resistance": snap["support_resistance"],
        "earnings": earnings,
        "news": news,
        "hold_period_short": short["hold_period"],
        "hold_period_long": long["hold_period"],
        "disclaimer": "今晚贏鋪大,老婆仔女攞去賣!",
    }


def market_status() -> dict[str, Any]:
    # Simple US session heuristic in UTC (ET ≈ UTC-4/-5). Good enough for UI badge.
    import datetime as dt

    now = dt.datetime.now(dt.timezone.utc)
    # Convert rough ET = UTC-4 (EDT). Acceptable for badge.
    et = now - dt.timedelta(hours=4)
    weekday = et.weekday()  # 0=Mon
    minutes = et.hour * 60 + et.minute
    open_m, close_m = 9 * 60 + 30, 16 * 60
    is_weekday = weekday < 5
    is_open = is_weekday and open_m <= minutes < close_m
    return {
        "is_open": is_open,
        "session": "open" if is_open else "closed",
        "server_time_utc": now.isoformat(),
        "note": "美東交易時段約 09:30–16:00（夏令約 UTC-4）",
    }


def universe_info() -> dict[str, Any]:
    return {
        "total": len(all_tickers()),
        "equities": len(equity_tickers()),
        "etfs": len(etf_tickers()),
        "tickers": all_tickers(),
    }
