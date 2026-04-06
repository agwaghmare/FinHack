from fastapi import APIRouter, Query

from backend.services.macro_service import get_macro_data, get_macro_history

router = APIRouter()


@router.get("/indicators")
def macro():
    return get_macro_data()


@router.get("/indicators/history")
def macro_indicators_history(
    years: float = Query(1.0, ge=0.25, le=5.0, description="Trailing window in years (FRED series)"),
):
    """Time series for each macro indicator — for trend charts (typically 1y)."""
    return get_macro_history(years)
