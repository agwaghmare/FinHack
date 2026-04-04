from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.services.portfolio_service import analyze_portfolio

from backend.services.holdings_service import (
    add_or_merge_position,
    delete_position,
    portfolio_period_performance,
    snapshot,
)
from backend.services.portfolio_service import analyze_portfolio

router = APIRouter()

@router.get("/analyze/{user_id}")
def analyze(user_id: str):
    return analyze_portfolio(user_id)

# @router.post("/analyze")
# def analyze(portfolio: dict):
#     return analyze_portfolio(portfolio)


class HoldingIn(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    shares: float = Field(..., gt=0)
    avg_cost: float = Field(..., gt=0, description="Average cost per share in USD")
    opened_at: Optional[str] = Field(
        default=None,
        description="First buy date YYYY-MM-DD (for CAGR); defaults to today",
    )


@router.get("/holdings/{user_id}")
def holdings_snapshot(user_id: str):
    return snapshot(user_id)


@router.get("/holdings/{user_id}/performance")
def holdings_performance(user_id: str):
    """Weighted total return % (1M, YTD, 1Y, 5Y) from adjusted closes."""
    return portfolio_period_performance(user_id)


@router.post("/holdings/{user_id}")
def holdings_add(user_id: str, body: HoldingIn):
    try:
        rows = add_or_merge_position(
            user_id,
            symbol=body.symbol,
            shares=body.shares,
            avg_cost=body.avg_cost,
            opened_at=body.opened_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": True, "positions": rows, "snapshot": snapshot(user_id)}


@router.delete("/holdings/{user_id}/{symbol}")
def holdings_remove(user_id: str, symbol: str):
    rows = delete_position(user_id, symbol)
    return {"ok": True, "positions": rows, "snapshot": snapshot(user_id)}
