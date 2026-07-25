from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, CACHE_LONG, CACHE_SHORT, SEED_LONG, SEED_SHORT
from app.routers import market
from app.services import scanner

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("stockIO")


def _ensure_seed_cache() -> None:
    """On fresh deploy, copy committed seed JSON so first page load is instant."""
    import shutil

    for seed, dest in ((SEED_SHORT, CACHE_SHORT), (SEED_LONG, CACHE_LONG)):
        if seed.exists() and not dest.exists():
            shutil.copy(seed, dest)
            logger.info("Seeded cache from %s", seed.name)


@asynccontextmanager
async def lifespan(_: FastAPI):
    import threading

    _ensure_seed_cache()

    def warm():
        try:
            logger.info("Warming short scan cache...")
            scanner.run_scan("short", force=False)
            logger.info("Warming long scan cache...")
            scanner.run_scan("long", force=False)
            logger.info("Cache warm done")
        except Exception as e:
            logger.exception("Warm failed: %s", e)

    threading.Thread(target=warm, daemon=True).start()
    yield


app = FastAPI(title="stockIO API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(market.router)


@app.get("/")
def root():
    return {
        "name": "stockIO",
        "docs": "/docs",
        "endpoints": ["/api/health", "/api/scan/short", "/api/scan/long", "/api/quotes", "/api/stock/{ticker}"],
    }
