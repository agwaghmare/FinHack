import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

logger = logging.getLogger(__name__)

from backend.services.ai_service import generate_insight
from backend.services.macro_service import get_macro_data
from backend.services.cross_asset_service import get_cross_asset_snapshot, polish_cross_asset
from backend.services.market_service import (
    get_market_prices,
    get_ohlc_history,
    get_stock_fundamentals,
    get_yahoo_day_movers,
)
from backend.services.mplfinance_chart import render_ohlc_png
from backend.services.news_service import get_news_sentiment
from backend.services.sandbox_store import get_portfolio
from backend.services.voice_service import text_to_speech
from backend.services.market_podcast_service import (
    generate_market_podcast_audio,
    get_latest_podcast_audio,
    get_latest_podcast_script,
)

router = APIRouter()


@router.get("/price/{symbol}")
def price(symbol: str):
    from backend.services.market_service import get_stock_price

    return get_stock_price(symbol)


@router.get("/stock-info")
def market_stock_info(symbol: str = Query(..., min_length=1, max_length=32, description="Ticker e.g. AAPL")):
    """Company summary, sector, PE/EPS, market cap, logo URL (Clearbit from website)."""
    return get_stock_fundamentals(symbol)


@router.get("/movers")
def market_movers(
    count: int = Query(8, ge=1, le=25, description="Number of day gainers from Yahoo screener"),
):
    """Top percentage gainers (US) — same list Yahoo shows under Day Gainers."""
    return get_yahoo_day_movers(count)


@router.get("/prices")
def prices(
    symbols: str = Query(
        ...,
        description="Comma-separated: SPY,QQQ,BTC,WTI",
    ),
):
    syms = [s.strip() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=400, detail="symbols required")
    return get_market_prices(syms)


@router.get("/portfolio/{user_id}")
def market_portfolio(user_id: str):
    return {"user_id": user_id, "portfolio": get_portfolio(user_id)}


@router.get("/cross-asset")
def market_cross_asset():
    snap = get_cross_asset_snapshot()
    return polish_cross_asset(snap)


@router.get("/ohlc")
def market_ohlc(
    symbol: str = Query(..., min_length=1, max_length=32, description="Ticker e.g. AAPL, NVDA"),
    period: str = Query("1y", description="yfinance period: 1mo,3mo,6mo,1y,2y"),
    interval: str = Query("1d", description="1d,1wk,1h"),
):
    """OHLC history — query form (preferred for proxies); avoids path edge cases."""
    return get_ohlc_history(symbol, period=period, interval=interval)


@router.get("/ohlc/chart.png")
def market_ohlc_chart_png(
    symbol: str = Query(..., min_length=1, max_length=32),
    period: str = Query("1y", description="yfinance period"),
    interval: str = Query("1d", description="yfinance interval"),
):
    """PNG candlestick chart (mplfinance)."""
    data = get_ohlc_history(symbol, period=period, interval=interval)
    bars = data.get("bars") or []
    err = data.get("error")
    if not bars:
        raise HTTPException(status_code=404, detail=err or "no OHLC data for chart")
    try:
        title = f"{symbol.upper()}  ·  {period}  ·  {interval}"
        png = render_ohlc_png(bars, title=title)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"chart render failed: {e}") from e
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/history/{symbol}")
def market_history(
    symbol: str,
    period: str = Query("1y", description="yfinance period: 1mo,3mo,6mo,1y,2y"),
    interval: str = Query("1d", description="1d,1wk,1h"),
):
    """Path form: /market/history/AAPL — same data as /market/ohlc?symbol=AAPL"""
    return get_ohlc_history(symbol, period=period, interval=interval)


@router.get("/macro")
def market_macro():
    """FRED series; on failure returns nulls so clients can still load Yahoo price grids."""
    try:
        return get_macro_data()
    except Exception as e:
        logger.warning("FRED macro unavailable: %s", e)
        return {
            "cpi": None,
            "rates": None,
            "gdp": None,
            "unemployment": None,
            "pce": None,
            "error": "fred_unavailable",
            "detail": str(e)[:240],
        }


@router.get("/news")
def market_news(
    symbol: str = Query("SPY"),
    limit: int = Query(25, ge=5, le=50),
):
    return get_news_sentiment(symbol, limit)


@router.post("/audio-summary")
def market_audio_summary(body: dict):
    """AI text from dashboard context → ElevenLabs MP3."""
    ctx = body.get("context") or body
    try:
        insight = generate_insight({"dashboard": ctx})
        text = str(insight.get("insight") or "")[:5000]
        if not text.strip():
            text = "No insight text generated."
        audio = text_to_speech(text)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return Response(content=audio, media_type="audio/mpeg")


@router.get("/podcast/latest")
def market_podcast_latest(
    session: str = Query(
        "close",
        description="close = afternoon recap, open = morning briefing",
        pattern="^(close|open)$",
    ),
):
    audio, generated_at = get_latest_podcast_audio(session)
    if not audio:
        raise HTTPException(
            status_code=404,
            detail=f"No {session} market podcast has been generated yet. Click Generate on Market Pulse.",
        )
    headers: dict[str, str] = {"X-Podcast-Session": session}
    if generated_at:
        headers["X-Generated-At"] = generated_at.isoformat()
    return Response(content=audio, media_type="audio/mpeg", headers=headers)


@router.post("/podcast/generate")
def market_podcast_generate(
    session: str = Query(
        "close",
        description="close = afternoon recap, open = morning briefing",
        pattern="^(close|open)$",
    ),
):
    audio = generate_market_podcast_audio(session)
    script, generated_at = get_latest_podcast_script(session)
    if not audio:
        msg = (
            "Podcast audio generation failed (likely TTS provider key/plan issue). "
            "Script generated from live data is still available."
        )
        return {
            "status": "generated_script_only",
            "session": session,
            "generated_at": generated_at.isoformat() if generated_at else None,
            "message": msg,
            "script_preview": (script or "")[:220],
        }
    return {"status": "generated", "session": session, "generated_at": generated_at.isoformat() if generated_at else None}


@router.get("/podcast/latest-script")
def market_podcast_latest_script(
    session: str = Query(
        "close",
        description="close = afternoon recap, open = morning briefing",
        pattern="^(close|open)$",
    ),
):
    script, generated_at = get_latest_podcast_script(session)
    if not script:
        raise HTTPException(status_code=404, detail=f"No {session} podcast script yet.")
    return {
        "session": session,
        "generated_at": generated_at.isoformat() if generated_at else None,
        "script": script,
    }
