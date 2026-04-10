"""Polymarket Gamma API — hot markets by 24h volume (read-only, educational)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

GAMMA_MARKETS = "https://gamma-api.polymarket.com/markets"


def _event_slug_for_polymarket_link(m: dict[str, Any]) -> str:
    """
    Gamma market `slug` is often a per-outcome id (e.g. ...-april-30-899) that does not match
    polymarket.com/event/{slug}. The public site uses the parent event's slug from `events[0]`.
    """
    events = m.get("events")
    if isinstance(events, list) and events:
        ev0 = events[0]
        if isinstance(ev0, dict):
            s = str(ev0.get("slug") or "").strip()
            if s:
                return s
    return str(m.get("slug") or "").strip()


def get_hot_polymarket_markets(limit: int = 8) -> dict[str, Any]:
    """
    Returns active markets sorted by 24h notional volume (hottest trading).
    """
    n = int(min(max(limit, 3), 20))
    params = {
        "limit": str(n * 3),
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
    }
    try:
        r = requests.get(GAMMA_MARKETS, params=params, timeout=15)
        r.raise_for_status()
        raw = r.json()
    except Exception as e:
        logger.warning("Polymarket Gamma fetch failed: %s", e)
        return {
            "source": "polymarket_gamma",
            "as_of": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "markets": [],
        }

    if not isinstance(raw, list):
        return {
            "source": "polymarket_gamma",
            "as_of": datetime.now(timezone.utc).isoformat(),
            "error": "unexpected_payload",
            "markets": [],
        }

    out: list[dict[str, Any]] = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        q = str(m.get("question") or "").strip()
        if not q:
            continue
        slug = _event_slug_for_polymarket_link(m)
        url = f"https://polymarket.com/event/{slug}" if slug else "https://polymarket.com/"
        vol24 = m.get("volume24hr") or m.get("volume24hrClob") or 0
        try:
            vol24f = float(vol24)
        except (TypeError, ValueError):
            vol24f = 0.0
        prices_raw = m.get("outcomePrices")
        yes_price: float | None = None
        if isinstance(prices_raw, str):
            try:
                arr = json.loads(prices_raw)
                if isinstance(arr, list) and arr:
                    yes_price = float(arr[0])
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        elif isinstance(prices_raw, list) and prices_raw:
            try:
                yes_price = float(prices_raw[0])
            except (TypeError, ValueError):
                pass

        out.append(
            {
                "question": q[:280],
                "slug": slug,
                "url": url,
                "volume_24h": round(vol24f, 2),
                "liquidity": m.get("liquidityNum") or m.get("liquidity"),
                "yes_implied": round(yes_price, 4) if yes_price is not None else None,
                "end_date": m.get("endDateIso") or m.get("endDate"),
            }
        )

    out.sort(key=lambda x: float(x.get("volume_24h") or 0), reverse=True)
    return {
        "source": "polymarket_gamma",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "disclaimer": (
            "Prediction markets involve risk and regulatory constraints; shown for research "
            "and information literacy, not solicitation."
        ),
        "markets": out[:n],
    }
