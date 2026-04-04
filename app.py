"""FastAPI entry — uses `backend` package (your layout)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Always load keys from the repo root (folder containing this file), not only from CWD.
# utf-8-sig strips a UTF-8 BOM so the first key is not "\ufeffGEMINI_API_KEY".
_ROOT = Path(__file__).resolve().parent
# override=True: repo-root .env wins over empty/partial exports (e.g. MISTRAL_API_KEY= in the shell).
load_dotenv(_ROOT / ".env", encoding="utf-8-sig", override=True)
load_dotenv(encoding="utf-8-sig")  # optional extra keys from cwd .env (does not unset root keys)

_logger = logging.getLogger("uvicorn.error")

from backend.routes.router import api_router
from backend.services.market_service import MARKET_QUOTES_PROVIDER
from backend.services.news_service import NEWS_PIPELINE_ID

_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
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

_cors_regex = os.getenv("CORS_ORIGIN_REGEX", "").strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=_cors_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Chrome may send Access-Control-Request-Private-Network for loopback APIs; without this, preflight fails → "Failed to fetch".
    allow_private_network=True,
)

app.include_router(api_router)
# Alias for clients/proxies that expect an `/api` prefix (same handlers).
app.include_router(api_router, prefix="/api")


def _route_paths() -> set[str]:
    return {getattr(r, "path", "") or "" for r in app.routes}


@app.on_event("startup")
def _startup_checks() -> None:
    from backend.utils.env_keys import gemini_key, mistral_key, openai_key

    if not gemini_key() and not openai_key():
        _logger.warning(
            "AI keys not loaded: set GEMINI_API_KEY or GOOGLE_API_KEY (or OPENAI_API_KEY) in "
            "the repo root .env next to app.py, save the file, then restart uvicorn. "
            "frontend/.env is not read by the Python API."
        )
    if not mistral_key():
        _logger.warning(
            "MISTRAL_API_KEY not loaded — Learn tutor and AI holdings coach require it (repo root .env)."
        )
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
    from backend.utils.env_keys import gemini_key, mistral_key, openai_key

    paths = _route_paths()
    return {
        "status": "ok",
        "market_quotes_provider": MARKET_QUOTES_PROVIDER,
        "news_pipeline": NEWS_PIPELINE_ID,
        "market_ohlc": "/market/ohlc" in paths,
        "market_ohlc_api_prefix": "/api/market/ohlc" in paths,
        "market_cross_asset": "/market/cross-asset" in paths,
        "ai_explain": "/ai/explain" in paths,
        "gemini_key_loaded": bool(gemini_key()),
        "openai_key_loaded": bool(openai_key()),
        "mistral_key_loaded": bool(mistral_key()),
    }
