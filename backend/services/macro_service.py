import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, cast

import pandas as pd
from fredapi import Fred  # pyright: ignore[reportMissingImports]

from backend.utils.env_keys import fred_key

logger = logging.getLogger(__name__)

_FRED_SERIES = ("CPIAUCSL", "FEDFUNDS", "GDP", "UNRATE", "PCE")

# (response_key, fred_id, human label)
_MACRO_HISTORY_META: tuple[tuple[str, str, str], ...] = (
    ("cpi", "CPIAUCSL", "CPI (All Urban Consumers)"),
    ("rates", "FEDFUNDS", "Fed funds effective rate"),
    ("gdp", "GDP", "Gross domestic product (Bil. $, SAAR)"),
    ("unemployment", "UNRATE", "Unemployment rate"),
    ("pce", "PCE", "Personal consumption expenditures (Bil. $)"),
)
_MACRO_FALLBACK = {
    "CPIAUCSL": 320.5,
    "FEDFUNDS": 4.33,
    "GDP": 29000.0,
    "UNRATE": 4.1,
    "PCE": 19850.0,
}


def _fred_csv_dataframe(series_id: str) -> pd.DataFrame | None:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        raw = pd.read_csv(url)
        if raw.empty or len(raw.columns) < 2:
            return None
        return raw
    except Exception as e:
        logger.warning("FRED CSV read failed for %s: %s", series_id, e)
        return None


def _latest_from_fred_csv(series_id: str) -> float | None:
    """
    Fallback path that does not require fredapi auth.
    Uses the public FRED graph CSV endpoint for latest value.
    """
    df = _fred_csv_dataframe(series_id)
    if df is None:
        return None
    # FRED graph CSV: observation_date + series_id column (not always named VALUE).
    value_col = str(df.columns[1])
    series = cast(pd.Series, pd.to_numeric(df[value_col], errors="coerce")).dropna()
    if series.empty:
        return None
    last = series.iloc[-1]
    return float(last)


def get_macro_data() -> dict[str, float]:
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

    for sid in _FRED_SERIES:
        if vals[sid] is None:
            vals[sid] = _latest_from_fred_csv(sid)

    for sid in _FRED_SERIES:
        if vals[sid] is None:
            vals[sid] = _MACRO_FALLBACK[sid]

    return {
        "cpi": cast(float, vals["CPIAUCSL"]),
        "rates": cast(float, vals["FEDFUNDS"]),
        "gdp": cast(float, vals["GDP"]),
        "unemployment": cast(float, vals["UNRATE"]),
        "pce": cast(float, vals["PCE"]),
    }


def _history_from_fred_csv(series_id: str, start: date) -> list[dict[str, Any]]:
    """Public FRED graph CSV — works without API key."""
    df = _fred_csv_dataframe(series_id)
    if df is None:
        return []
    d_name = str(df.columns[0])
    v_name = str(df.columns[1])
    work = df[[d_name, v_name]].copy()
    work[d_name] = pd.to_datetime(work[d_name], errors="coerce")
    work[v_name] = pd.to_numeric(work[v_name], errors="coerce")
    work = work.dropna(how="any")
    start_ts = pd.Timestamp(start)
    mask = cast(pd.Series, work[d_name] >= start_ts)
    work = work.loc[mask]
    out: list[dict[str, Any]] = []
    dates = work[d_name].tolist()
    values = work[v_name].tolist()
    for dt_cell, val_cell in zip(dates, values):
        if val_cell is None or (isinstance(val_cell, float) and pd.isna(val_cell)):
            continue
        ts = pd.Timestamp(cast(Any, dt_cell))
        if bool(pd.isna(ts)):
            continue
        out.append(
            {
                "date": ts.strftime("%Y-%m-%d"),
                "value": round(float(cast(Any, val_cell)), 4),
            }
        )
    return out


def _history_from_fredapi(series_id: str, start: date) -> list[dict[str, Any]] | None:
    key = (fred_key() or "").strip()
    if not key:
        return None
    try:
        fred = Fred(api_key=key)
        s = fred.get_series(series_id, observation_start=start.isoformat()).dropna()
        if s.empty:
            return []
        out: list[dict[str, Any]] = []
        for idx, val in s.items():
            try:
                ts = pd.Timestamp(cast(Any, idx))
                if bool(pd.isna(ts)):
                    continue
                out.append({"date": ts.strftime("%Y-%m-%d"), "value": round(float(val), 4)})
            except (TypeError, ValueError):
                continue
        return out
    except Exception as e:
        logger.warning("fredapi history failed for %s: %s", series_id, e)
        return None


def get_macro_history(years: float = 1.0) -> dict[str, Any]:
    """
    Point-in-time series for charting (~last `years` calendar window).
    Prefers fredapi when FRED_API_KEY is set; otherwise uses public CSV.
    """
    years = float(min(max(years, 0.25), 5.0))
    end = date.today()
    start = end - timedelta(days=int(years * 365.25) + 45)

    series_out: list[dict[str, Any]] = []
    for key, fred_id, label in _MACRO_HISTORY_META:
        pts = _history_from_fredapi(fred_id, start)
        if pts is None:
            pts = _history_from_fred_csv(fred_id, start)
        series_out.append(
            {
                "key": key,
                "fred_id": fred_id,
                "label": label,
                "points": pts,
                "point_count": len(pts),
            }
        )

    return {
        "window_years": years,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "series": series_out,
    }
