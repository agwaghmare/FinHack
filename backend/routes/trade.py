"""Paper trading sandbox — Alpaca paper API or in-memory fallback."""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.services import sandbox_store
from backend.services.ai_extended_service import trade_feedback as trade_feedback_ai
from backend.services.alpaca_service import get_account, get_positions, has_alpaca, place_order
from backend.services.market_service import last_trade_price

router = APIRouter()


class TradeBody(BaseModel):
    user_id: str = Field(default="demo", min_length=1)
    symbol: str = Field(..., min_length=1, max_length=12)
    qty: float = Field(..., gt=0, le=1_000_000)


@router.get("/portfolio/{user_id}")
def trade_portfolio(user_id: str) -> dict[str, Any]:
    if has_alpaca():
        acc = get_account()
        pos = get_positions()
        return {"source": "alpaca", "account": acc, "positions": pos}
    p = sandbox_store.get_portfolio(user_id)
    return {"source": "sandbox", "portfolio": p}


@router.post("/buy")
def trade_buy(body: TradeBody) -> dict[str, Any]:
    if has_alpaca():
        try:
            order = place_order(body.symbol, body.qty, "buy")
            return {"source": "alpaca", "order": order}
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
    try:
        px = last_trade_price(body.symbol)
        if px <= 0:
            px = 100.0
        p = sandbox_store.record_trade(body.user_id, "buy", body.symbol.upper(), body.qty, px)
        return {"source": "sandbox", "price": px, "portfolio": p}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/sell")
def trade_sell(body: TradeBody) -> dict[str, Any]:
    if has_alpaca():
        try:
            order = place_order(body.symbol, body.qty, "sell")
            return {"source": "alpaca", "order": order}
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
    try:
        px = last_trade_price(body.symbol)
        if px <= 0:
            px = 100.0
        p = sandbox_store.record_trade(body.user_id, "sell", body.symbol.upper(), body.qty, px)
        return {"source": "sandbox", "price": px, "portfolio": p}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/leaderboard")
def leaderboard() -> dict[str, Any]:
    return {"rows": sandbox_store.get_leaderboard()}


@router.get("/ai-feedback/{user_id}")
def ai_feedback(user_id: str) -> dict[str, Any]:
    return trade_feedback_ai(user_id)


@router.post("/audio-feedback/{user_id}")
def trade_audio_feedback(user_id: str) -> Response:
    from backend.services.voice_service import text_to_speech

    fb = trade_feedback_ai(user_id)
    text = str(fb.get("feedback") or "")[:5000]
    try:
        audio = text_to_speech(text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return Response(content=audio, media_type="audio/mpeg")
