"""Generic broker OAuth flow helpers (demo in-memory state + token storage)."""

from __future__ import annotations

import secrets
import time
from typing import Any

_PENDING: dict[str, dict[str, Any]] = {}
_CONNECTED: dict[str, dict[str, Any]] = {}
_STATE_TTL_SECONDS = 10 * 60


def create_state(broker: str, redirect_uri: str) -> str:
    state = secrets.token_urlsafe(24)
    _PENDING[state] = {
        "broker": broker,
        "redirect_uri": redirect_uri,
        "created_at": time.time(),
    }
    _cleanup_old_states()
    return state


def consume_state(state: str, broker: str) -> dict[str, Any] | None:
    row = _PENDING.pop(state, None)
    if not row:
        return None
    if str(row.get("broker")) != broker:
        return None
    created = float(row.get("created_at") or 0.0)
    if (time.time() - created) > _STATE_TTL_SECONDS:
        return None
    return row


def _cleanup_old_states() -> None:
    now = time.time()
    old = [k for k, v in _PENDING.items() if (now - float(v.get("created_at") or 0.0)) > _STATE_TTL_SECONDS]
    for k in old:
        _PENDING.pop(k, None)


def set_connected(
    broker: str,
    *,
    token_type: str | None = None,
    has_access_token: bool = False,
    has_refresh_token: bool = False,
    scope: str | None = None,
) -> None:
    _CONNECTED[broker] = {
        "broker": broker,
        "connected": True,
        "token_type": token_type,
        "has_access_token": has_access_token,
        "has_refresh_token": has_refresh_token,
        "scope": scope,
        "connected_at": int(time.time()),
    }


def get_connections() -> list[dict[str, Any]]:
    return [v for _, v in sorted(_CONNECTED.items(), key=lambda x: x[0])]
