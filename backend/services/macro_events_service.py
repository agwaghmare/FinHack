"""Upcoming US macro release-style calendar (approximate dates — education / planning)."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from typing import Any


def _first_friday_of_month(y: int, m: int) -> date:
    d = date(y, m, 1)
    while d.weekday() != 4:
        d += timedelta(days=1)
    return d


def _first_fridays_in_range(start: date, end: date) -> list[date]:
    out: list[date] = []
    y, m = start.year, start.month
    for _ in range(24):
        ff = _first_friday_of_month(y, m)
        if ff >= start and ff <= end:
            out.append(ff)
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1
        if date(y, m, 1) > end + timedelta(days=400):
            break
    return sorted(set(out))


def get_upcoming_macro_events(horizon_days: int = 90) -> dict[str, Any]:
    """
    Returns a mix of FOMC (statement day), jobs Friday (NFP proxy), CPI (approximate),
    and GDP advance (approximate). Dates are **planning aids**, not exchange guarantees.
    """
    horizon_days = int(min(max(horizon_days, 14), 400))
    today = date.today()
    end = today + timedelta(days=horizon_days)

    events: list[dict[str, Any]] = []

    fomc_dates = [
        date(2026, 1, 28),
        date(2026, 3, 18),
        date(2026, 5, 7),
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 17),
        date(2026, 11, 5),
        date(2026, 12, 16),
        date(2027, 1, 27),
        date(2027, 3, 17),
        date(2027, 5, 5),
        date(2027, 6, 16),
        date(2027, 7, 28),
        date(2027, 9, 16),
        date(2027, 11, 3),
        date(2027, 12, 15),
    ]
    for d in fomc_dates:
        if today <= d <= end:
            events.append(
                {
                    "id": f"fomc-{d.isoformat()}",
                    "name": "FOMC statement & press conference",
                    "date": d.isoformat(),
                    "time_hint": "~2:00 p.m. ET (statement day)",
                    "category": "policy",
                    "notes": "Fed funds path; markets often volatile around release.",
                }
            )

    for d in _first_fridays_in_range(today, end):
        events.append(
            {
                "id": f"nfp-{d.isoformat()}",
                "name": "Employment situation (jobs report)",
                "date": d.isoformat(),
                "time_hint": "~8:30 a.m. ET",
                "category": "labor",
                "notes": "Headline payrolls & unemployment — often moves rates and USD.",
            }
        )

    y0, m0 = today.year, today.month
    for i in range(15):
        yy = y0 + (m0 + i - 1) // 12
        mm = (m0 + i - 1) % 12 + 1
        last_d = calendar.monthrange(yy, mm)[1]
        day = min(13, last_d)
        cand = date(yy, mm, day)
        if today <= cand <= end:
            events.append(
                {
                    "id": f"cpi-{cand.isoformat()}",
                    "name": "CPI (headline, all urban consumers)",
                    "date": cand.isoformat(),
                    "time_hint": "~8:30 a.m. ET (approx.)",
                    "category": "inflation",
                    "notes": "Approximate mid-month window — verify on BLS calendar.",
                }
            )

    gdp_approx = [
        date(2026, 4, 29),
        date(2026, 7, 30),
        date(2026, 10, 29),
        date(2027, 1, 28),
    ]
    for d in gdp_approx:
        if today <= d <= end:
            events.append(
                {
                    "id": f"gdp-{d.isoformat()}",
                    "name": "GDP advance estimate (prior quarter)",
                    "date": d.isoformat(),
                    "time_hint": "~8:30 a.m. ET (approx.)",
                    "category": "growth",
                    "notes": "First GDP print for the quarter — subject to revision.",
                }
            )

    events.sort(key=lambda e: e["date"])

    return {
        "horizon_days": horizon_days,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "disclaimer": (
            "Dates are approximate planning aids. Verify exact release times on official "
            "sources (BLS, BEA, Federal Reserve) before trading or research."
        ),
        "events": events,
    }
