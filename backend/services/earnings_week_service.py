"""Upcoming earnings dates from yfinance `Ticker.calendar` (no HTML scrape)."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Overlap with Market Pulse cap / movers universes
_DEFAULT_UNIVERSE = (
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "AMD",
    "NFLX",
    "COIN",
    "PLTR",
    "JPM",
    "SPY",
    "QQQ",
)


def _as_date(d: object) -> date | None:
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return None


def _earnings_dates_from_calendar(sym: str) -> list[date]:
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        t = yf.Ticker(sym)
        cal = getattr(t, "calendar", None)
        if not isinstance(cal, dict):
            return []
        raw = cal.get("Earnings Date")
        if raw is None:
            return []
        items = raw if isinstance(raw, list) else [raw]
        out: list[date] = []
        for x in items:
            ad = _as_date(x)
            if ad is not None:
                out.append(ad)
        return out
    except Exception as e:
        logger.debug("calendar %s: %s", sym, e)
        return []


def get_earnings_this_week(
    *,
    symbols: tuple[str, ...] | None = None,
    days: int = 7,
) -> dict[str, Any]:
    """
    Reported earnings dates falling in [today, today + days] (inclusive).
    Uses Yahoo Finance calendar data via yfinance.
    """
    days = int(min(max(days, 1), 21))
    today = date.today()
    end = today + timedelta(days=days)
    syms = symbols or _DEFAULT_UNIVERSE

    rows: list[dict[str, Any]] = []
    for sym in syms:
        sym_u = sym.strip().upper()
        if not sym_u:
            continue
        for ed in _earnings_dates_from_calendar(sym_u):
            if today <= ed <= end:
                rows.append(
                    {
                        "symbol": sym_u,
                        "earnings_date": ed.isoformat(),
                        "within_days": (ed - today).days,
                    }
                )

    rows.sort(key=lambda r: (r["earnings_date"], r["symbol"]))
    # de-dupe same symbol+date
    seen: set[tuple[str, str]] = set()
    uniq: list[dict[str, Any]] = []
    for r in rows:
        k = (r["symbol"], r["earnings_date"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)

    return {
        "window_days": days,
        "start": today.isoformat(),
        "end": end.isoformat(),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "count": len(uniq),
        "items": uniq,
    }
