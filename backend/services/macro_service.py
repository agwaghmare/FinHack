import logging

import pandas as pd
from fredapi import Fred  # pyright: ignore[reportMissingImports]

from backend.utils.env_keys import fred_key

logger = logging.getLogger(__name__)

_FRED_SERIES = ("CPIAUCSL", "FEDFUNDS", "GDP", "UNRATE", "PCE")
_MACRO_FALLBACK = {
    "CPIAUCSL": 320.5,
    "FEDFUNDS": 4.33,
    "GDP": 29000.0,
    "UNRATE": 4.1,
    "PCE": 19850.0,
}


def _latest_from_fred_csv(series_id: str) -> float | None:
    """
    Fallback path that does not require fredapi auth.
    Uses the public FRED graph CSV endpoint for latest value.
    """
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        df = pd.read_csv(url)
        if "VALUE" not in df.columns:
            return None
        vals = pd.to_numeric(df["VALUE"], errors="coerce").dropna()
        if vals.empty:
            return None
        return float(vals.iloc[-1])
    except Exception as e:
        logger.warning("FRED CSV fallback failed for %s: %s", series_id, e)
        return None


def get_macro_data():
    vals: dict[str, float | None] = {
        "CPIAUCSL": None,
        "FEDFUNDS": None,
        "GDP": None,
        "UNRATE": None,
        "PCE": None,
    }

    key = (fred_key() or "").strip()
    if key:
        try:
            fred = Fred(api_key=key)
            for sid in _FRED_SERIES:
                s = fred.get_series(sid).dropna()
                vals[sid] = float(s.iloc[-1]) if not s.empty else None
        except Exception as e:
            logger.warning("fredapi failed, falling back to public CSV: %s", e)

    # Fill missing values through public CSV fallback (works without API key).
    for sid in _FRED_SERIES:
        if vals[sid] is None:
            vals[sid] = _latest_from_fred_csv(sid)

    # Final fail-safe so UI never blanks out if both fredapi and CSV fetch fail.
    for sid in _FRED_SERIES:
        if vals[sid] is None:
            vals[sid] = _MACRO_FALLBACK[sid]

    return {
        "cpi": vals["CPIAUCSL"],
        "rates": vals["FEDFUNDS"],
        "gdp": vals["GDP"],
        "unemployment": vals["UNRATE"],
        "pce": vals["PCE"],
    }
