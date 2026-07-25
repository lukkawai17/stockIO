import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Optional override for Vercel-only deploy (GitHub Actions writes into frontend/public/data)
_OUT = Path(os.getenv("SCAN_OUT_DIR", str(DATA_DIR))).expanduser().resolve()
_OUT.mkdir(parents=True, exist_ok=True)

CACHE_SHORT = _OUT / "scan_short.json"
CACHE_LONG = _OUT / "scan_long.json"
CACHE_BACKTEST = _OUT / "backtest.json"
CACHE_QUOTES = DATA_DIR / "quotes.json"
SEED_SHORT = DATA_DIR / "seed_scan_short.json"
SEED_LONG = DATA_DIR / "seed_scan_long.json"

# Recompute full scores at most this often (seconds)
SCORE_CACHE_TTL = int(os.getenv("SCORE_CACHE_TTL", str(3 * 60 * 60)))  # default 3h
QUOTE_CACHE_TTL = int(os.getenv("QUOTE_CACHE_TTL", str(3 * 60)))  # default 3m

TOP_N = 20
HISTORY_PERIOD = "1y"
HISTORY_INTERVAL = "1d"

# Comma-separated frontend origins, e.g. https://stockio.vercel.app
_extra = [o.strip() for o in os.getenv("FRONTEND_ORIGIN", "").split(",") if o.strip()]
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    *_extra,
]
