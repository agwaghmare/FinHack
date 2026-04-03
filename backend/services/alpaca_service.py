"""Alpaca Paper Trading API — falls back to in-memory sandbox if keys missing."""

from __future__ import annotations

import logging
from typing import Any

import requests

from backend.utils.env_keys import alpaca_key_id, alpaca_secret_key

logger = logging.getLogger(__name__)

BASE = "https://paper-api.alpaca.markets"


def _headers() -> dict[str, str]:
    k = alpaca_key_id()
    s = alpaca_secret_key()
    if not k or not s:
        return {}
    return {
        "APCA-API-KEY-ID": k,
        "APCA-API-SECRET-KEY": s,
    }


def has_alpaca() -> bool:
    return bool(_headers())


def get_account() -> dict[str, Any] | None:
    h = _headers()
    if not h:
        return None
    try:
        r = requests.get(f"{BASE}/v2/account", headers=h, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.exception("Alpaca account: %s", e)
        return None


def get_positions() -> list[dict[str, Any]] | None:
    h = _headers()
    if not h:
        return None
    try:
        r = requests.get(f"{BASE}/v2/positions", headers=h, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.exception("Alpaca positions: %s", e)
        return None


def place_order(
    symbol: str,
    qty: float,
    side: str,
) -> dict[str, Any]:
    """side: buy | sell"""
    h = _headers()
    if not h:
        raise RuntimeError("no_alpaca_keys")

    body = {
        "symbol": symbol.upper(),
        "qty": str(qty),
        "side": side.lower(),
        "type": "market",
        "time_in_force": "day",
    }
    r = requests.post(f"{BASE}/v2/orders", headers=h, json=body, timeout=30)
    r.raise_for_status()
    return r.json()
