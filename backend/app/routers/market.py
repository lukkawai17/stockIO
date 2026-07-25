from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.services import scanner

router = APIRouter(prefix="/api", tags=["market"])


@router.get("/health")
def health():
    return {"ok": True, "service": "stockIO"}


@router.get("/market/status")
def status():
    return scanner.market_status()


@router.get("/universe")
def universe():
    info = scanner.universe_info()
    # don't dump full list in default response size — include count + sample
    return {
        "total": info["total"],
        "equities": info["equities"],
        "etfs": info["etfs"],
        "sample": info["tickers"][:30],
    }


@router.get("/scan/{mode}")
def scan(mode: Literal["short", "long"], refresh: bool = Query(False)):
    if mode not in ("short", "long"):
        raise HTTPException(400, "mode must be short or long")

    data = scanner.get_scan(mode, force=refresh)
    if not data:
        return {"mode": mode, "status": "warming_up", "top": [], "bullish": [], "bearish": [], "hold": []}

    return {
        "mode": data.get("mode"),
        "updated_at": data.get("updated_at"),
        "updated_at_iso": data.get("updated_at_iso"),
        "universe_size": data.get("universe_size"),
        "scanned": data.get("scanned"),
        "top": data.get("top", []),
        "bottom": data.get("bottom", []),
        "bullish": data.get("bullish", []),
        "bearish": data.get("bearish", []),
        "hold": data.get("hold", []),
        "spy": data.get("spy"),
        "disclaimer": data.get("disclaimer"),
        "status": "ok",
    }


@router.post("/scan/{mode}/refresh")
def refresh_scan(mode: Literal["short", "long"], background_tasks: BackgroundTasks):
    background_tasks.add_task(scanner.run_scan, mode, True)
    return {"status": "started", "mode": mode}


@router.get("/quotes")
def quotes(symbols: str = Query(..., description="Comma-separated tickers"), refresh: bool = False):
    tickers = [s.strip().upper().replace(".", "-") for s in symbols.split(",") if s.strip()]
    if not tickers:
        raise HTTPException(400, "symbols required")
    if len(tickers) > 80:
        raise HTTPException(400, "max 80 symbols")
    return scanner.get_quotes(tickers, force=refresh)


@router.get("/stock/{ticker}")
def stock_detail(ticker: str):
    data = scanner.get_stock_detail(ticker)
    if data.get("error"):
        raise HTTPException(404, data["error"])
    return data
