"""Render OHLC candlestick charts as PNG via mplfinance (matplotlib Agg backend)."""

from __future__ import annotations

import io
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _bars_to_ohlcv_df(bars: list[dict[str, Any]]):
    import pandas as pd

    rows: list[dict[str, Any]] = []
    for b in bars:
        d = b.get("date")
        if not d:
            continue
        try:
            o = float(b.get("open") or 0)
            h = float(b.get("high") or 0)
            lo = float(b.get("low") or 0)
            c = float(b.get("close") or 0)
        except (TypeError, ValueError):
            continue
        if min(o, h, lo, c) <= 0 or h < lo:
            continue
        vol = b.get("volume")
        try:
            v = int(vol) if vol is not None and str(vol) != "nan" else None
        except (TypeError, ValueError):
            v = None
        rows.append(
            {
                "Date": pd.Timestamp(str(d)),
                "Open": o,
                "High": h,
                "Low": lo,
                "Close": c,
                "Volume": v,
            }
        )

    if len(rows) < 2:
        return None

    df = pd.DataFrame(rows)
    df = df.set_index("Date").sort_index()
    # Drop duplicate index labels (keep last)
    df = df[~df.index.duplicated(keep="last")]
    return df


def render_ohlc_png(bars: list[dict[str, Any]], *, title: str) -> bytes:
    """Return PNG bytes for a candlestick chart."""
    import matplotlib

    matplotlib.use("Agg")
    import mplfinance as mpf

    df = _bars_to_ohlcv_df(bars)
    if df is None or len(df) < 2:
        raise ValueError("need at least 2 valid OHLC bars")

    buf = io.BytesIO()
    mc = mpf.make_marketcolors(up="#22c55e", down="#f43f5e", edge="inherit", wick="inherit")
    style = mpf.make_mpf_style(
        marketcolors=mc,
        base_mpf_style="nightclouds",
        gridstyle=":",
        y_on_right=True,
    )

    try:
        mpf.plot(
            df,
            type="candle",
            style=style,
            title=title,
            volume=False,
            figsize=(10.5, 5.25),
            tight_layout=True,
            savefig=dict(fname=buf, format="png", dpi=120, bbox_inches="tight", pad_inches=0.15),
        )
    except Exception as e:
        logger.exception("mplfinance plot failed: %s", e)
        raise

    buf.seek(0)
    out = buf.getvalue()
    if not out:
        raise RuntimeError("mplfinance produced empty PNG")
    return out
