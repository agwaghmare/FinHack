"""FastAPI entry — uses `backend` package (your layout)."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Always load keys from the repo root (folder containing this file), not only from CWD.
_ROOT = Path(__file__).resolve().parent
load_dotenv(_ROOT / ".env")
load_dotenv()  # optional overrides if the shell cwd has another .env

from backend.routes.router import api_router
from backend.services.market_service import MARKET_QUOTES_PROVIDER
from backend.services.news_service import NEWS_PIPELINE_ID

_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
]
_extra = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS = _DEFAULT_ORIGINS + (
    [o.strip() for o in _extra.split(",") if o.strip()] if _extra else []
)

app = FastAPI(
    title="AI Financial Companion",
    description="Aggregates market data, macro, sentiment, AI insights, and alerts",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
# Alias for clients/proxies that expect an `/api` prefix (same handlers).
app.include_router(api_router, prefix="/api")


def _route_paths() -> set[str]:
    return {getattr(r, "path", "") or "" for r in app.routes}


@app.on_event("startup")
def _start_market_podcast_scheduler() -> None:
    # Starts a background job to generate the market-close podcast.
    try:
        from backend.services.market_podcast_service import start_market_podcast_scheduler

        start_market_podcast_scheduler()
    except Exception as e:
        # Avoid crashing the server if scheduling is unavailable.
        print(f"Market podcast scheduler start failed: {e}")


@app.get("/")
def root():
    """If `market_ohlc` is false, you are not running this codebase’s current routes (stale process or wrong folder)."""
    paths = _route_paths()
    return {
        "message": "AI Financial Companion API is running",
        "routes": {
            "market_ohlc": "/market/ohlc" in paths,
            "market_ohlc_api_prefix": "/api/market/ohlc" in paths,
            "market_cross_asset": "/market/cross-asset" in paths,
            "ai_explain": "/ai/explain" in paths,
        },
    }


@app.get("/health")
def health():
    paths = _route_paths()
    return {
        "status": "ok",
        "market_quotes_provider": MARKET_QUOTES_PROVIDER,
        "news_pipeline": NEWS_PIPELINE_ID,
        "market_ohlc": "/market/ohlc" in paths,
        "market_ohlc_api_prefix": "/api/market/ohlc" in paths,
        "market_cross_asset": "/market/cross-asset" in paths,
        "ai_explain": "/ai/explain" in paths,
    }
