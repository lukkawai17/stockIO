from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

from app.config import HISTORY_INTERVAL, HISTORY_PERIOD
from app.services.indicators import compute_snapshot

logger = logging.getLogger(__name__)


def download_history(tickers: list[str], period: str = HISTORY_PERIOD) -> dict[str, pd.DataFrame]:
    """Batch download OHLCV. Returns ticker -> dataframe."""
    if not tickers:
        return {}

    # yfinance handles space-joined batch well
    data = yf.download(
        tickers=tickers,
        period=period,
        interval=HISTORY_INTERVAL,
        group_by="ticker",
        auto_adjust=True,
        threads=True,
        progress=False,
    )

    frames: dict[str, pd.DataFrame] = {}
    if len(tickers) == 1:
        t = tickers[0]
        if isinstance(data, pd.DataFrame) and not data.empty:
            frames[t] = data.copy()
        return frames

    for t in tickers:
        try:
            if isinstance(data.columns, pd.MultiIndex):
                if t in data.columns.get_level_values(0):
                    df = data[t].dropna(how="all")
                    if not df.empty:
                        frames[t] = df
            else:
                # unexpected shape
                pass
        except Exception as e:
            logger.warning("history parse fail %s: %s", t, e)
    return frames


def fetch_quotes(tickers: list[str]) -> dict[str, dict[str, Any]]:
    """Fast last-price style quotes for a small set."""
    out: dict[str, dict[str, Any]] = {}
    if not tickers:
        return out

    unique = list(dict.fromkeys(tickers))

    def one(t: str) -> tuple[str, dict[str, Any] | None]:
        try:
            info = yf.Ticker(t).fast_info
            price = getattr(info, "last_price", None) or getattr(info, "lastPrice", None)
            prev = getattr(info, "previous_close", None) or getattr(info, "previousClose", None)
            if price is None:
                hist = yf.Ticker(t).history(period="5d")
                if hist.empty:
                    return t, None
                price = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
            price = float(price)
            prev = float(prev) if prev is not None else price
            chg = ((price - prev) / prev * 100) if prev else 0.0
            return t, {"ticker": t, "price": round(price, 2), "change_pct": round(chg, 2)}
        except Exception as e:
            logger.warning("quote fail %s: %s", t, e)
            return t, None

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(one, t) for t in unique]
        for fut in as_completed(futs):
            t, q = fut.result()
            if q:
                out[t] = q
    return out


def fetch_news(ticker: str, limit: int = 8) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    try:
        raw = yf.Ticker(ticker).news or []
        for n in raw[:limit]:
            # yfinance news shape varies by version
            content = n.get("content") if isinstance(n.get("content"), dict) else None
            if content:
                title = content.get("title") or ""
                summary = content.get("summary") or content.get("description") or ""
                pub = content.get("pubDate") or content.get("providerPublishTime")
                link = ""
                click = content.get("clickThroughUrl") or {}
                if isinstance(click, dict):
                    link = click.get("url") or ""
                provider = (content.get("provider") or {}).get("displayName") if isinstance(content.get("provider"), dict) else ""
            else:
                title = n.get("title") or ""
                summary = n.get("summary") or ""
                pub = n.get("providerPublishTime") or n.get("pubDate")
                link = n.get("link") or n.get("url") or ""
                provider = n.get("publisher") or ""

            pub_iso = None
            if isinstance(pub, (int, float)):
                pub_iso = datetime.fromtimestamp(pub, tz=timezone.utc).isoformat()
            elif isinstance(pub, str):
                pub_iso = pub

            if title:
                items.append(
                    {
                        "title": title,
                        "summary": summary,
                        "publisher": provider,
                        "link": link,
                        "published_at": pub_iso,
                    }
                )
    except Exception as e:
        logger.warning("news fail %s: %s", ticker, e)
    return items


def fetch_earnings(ticker: str) -> dict[str, Any]:
    result: dict[str, Any] = {"ticker": ticker, "next_earnings": None, "recent": []}
    try:
        t = yf.Ticker(ticker)
        # Preferred: earnings_dates
        try:
            ed = t.earnings_dates
            if ed is not None and not ed.empty:
                ed = ed.sort_index()
                now = pd.Timestamp.now(tz=ed.index.tz) if ed.index.tz else pd.Timestamp.now()
                upcoming = ed[ed.index >= now]
                past = ed[ed.index < now].tail(4)
                if not upcoming.empty:
                    idx = upcoming.index[0]
                    row = upcoming.iloc[0]
                    result["next_earnings"] = {
                        "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                        "eps_estimate": _safe_num(row.get("EPS Estimate") if hasattr(row, "get") else None),
                        "reported_eps": _safe_num(row.get("Reported EPS") if hasattr(row, "get") else None),
                    }
                for idx, row in past.iterrows():
                    result["recent"].append(
                        {
                            "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                            "eps_estimate": _safe_num(row.get("EPS Estimate") if hasattr(row, "get") else row.iloc[0] if len(row) else None),
                            "reported_eps": _safe_num(row.get("Reported EPS") if hasattr(row, "get") else None),
                        }
                    )
        except Exception:
            pass

        # Fallback calendar
        if result["next_earnings"] is None:
            try:
                cal = t.calendar
                if isinstance(cal, dict):
                    earn = cal.get("Earnings Date") or cal.get("earningsDate")
                    if earn:
                        if isinstance(earn, (list, tuple)) and earn:
                            d = earn[0]
                        else:
                            d = earn
                        result["next_earnings"] = {"date": str(d), "eps_estimate": None, "reported_eps": None}
                elif isinstance(cal, pd.DataFrame) and not cal.empty:
                    if "Earnings Date" in cal.index:
                        val = cal.loc["Earnings Date"]
                        d = val.iloc[0] if hasattr(val, "iloc") else val
                        result["next_earnings"] = {"date": str(d), "eps_estimate": None, "reported_eps": None}
            except Exception:
                pass
    except Exception as e:
        logger.warning("earnings fail %s: %s", ticker, e)
    return result


def _safe_num(v: Any) -> float | None:
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        return float(v)
    except Exception:
        return None


def snapshots_from_history(frames: dict[str, pd.DataFrame]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for t, df in frames.items():
        # Normalize columns
        cols = {c: str(c).title() for c in df.columns}
        df = df.rename(columns=cols)
        needed = {"Open", "High", "Low", "Close", "Volume"}
        if not needed.issubset(set(df.columns)):
            # try lower
            lower_map = {c: c.capitalize() for c in df.columns}
            df = df.rename(columns=lower_map)
        snap = compute_snapshot(df)
        if snap:
            out[t] = snap
    return out
