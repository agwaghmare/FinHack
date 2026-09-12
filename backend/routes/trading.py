"""Trading lab: daily VaR + strategy backtests (educational)."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.services.backtest_service import STRATEGIES_META, run_backtest
from backend.services.var_service import compute_portfolio_var

router = APIRouter()


@router.get("/strategies")
def list_strategies():
    return {"strategies": STRATEGIES_META}


@router.get("/var/{user_id}")
def portfolio_var(
    user_id: str,
    confidence: float = Query(0.95, ge=0.8, le=0.995),
    lookback: str = Query("1y"),
):
    lb = lookback if lookback in {"6mo", "1y", "2y"} else "1y"
    return compute_portfolio_var(user_id, confidence=confidence, lookback=lb)


class BacktestIn(BaseModel):
    symbol: str = Field("SPY", min_length=1, max_length=16)
    strategy: str = Field("sma_cross")
    period: str = Field("2y")
    initial_cash: float = Field(10_000, gt=100, le=10_000_000)
    params: dict = Field(default_factory=dict)


@router.post("/backtest")
def backtest(body: BacktestIn):
    allowed = {s["id"] for s in STRATEGIES_META}
    if body.strategy not in allowed:
        raise HTTPException(400, f"Unknown strategy. Choose one of: {sorted(allowed)}")
    period = body.period if body.period in {"6mo", "1y", "2y", "5y", "max"} else "2y"
    result = run_backtest(
        symbol=body.symbol,
        strategy=body.strategy,  # type: ignore[arg-type]
        period=period,
        initial_cash=body.initial_cash,
        params=body.params,
    )
    if not result.get("ok"):
        raise HTTPException(400, result.get("error") or "Backtest failed")
    return result
