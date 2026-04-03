"""Clerk-backed auth helpers for the API."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.dependencies.clerk_auth import require_clerk_user
from backend.services.clerk_service import get_clerk_public_config, get_clerk_user_json
from backend.utils.env_keys import (
    alpaca_key_id,
    alpaca_secret_key,
    clerk_publishable_key,
    clerk_secret_key,
    elevenlabs_key,
    fred_key,
    gemini_key,
    gnews_key,
    openai_key,
    twilio_account_sid,
    twilio_auth_token,
    zapier_webhook_url,
)

router = APIRouter()


def _configured(value: str) -> bool:
    v = (value or "").strip()
    if not v:
        return False
    return v.upper() not in ("YOUR_KEY", "NONE", "PLACEHOLDER")


@router.get("/clerk-config")
def clerk_config() -> dict[str, Any]:
    """Publishable key for the frontend Clerk SDK (no secrets)."""
    return get_clerk_public_config()


@router.get("/integration-status")
def integration_status() -> dict[str, Any]:
    """Which backend integrations have keys set (booleans only — no secret values)."""
    return {
        "gnews": _configured(gnews_key()),
        "fred": _configured(fred_key()),
        "gemini": _configured(gemini_key()),
        "openai": _configured(openai_key()),
        "elevenlabs": _configured(elevenlabs_key()),
        "clerk_publishable": _configured(clerk_publishable_key()),
        "clerk_secret": _configured(clerk_secret_key()),
        "alpaca": _configured(alpaca_key_id()) and _configured(alpaca_secret_key()),
        "zapier_webhook": _configured(zapier_webhook_url()),
        "twilio_sms": _configured(twilio_account_sid()) and _configured(twilio_auth_token()),
    }


@router.get("/me")
def auth_me(user: Annotated[dict[str, Any], Depends(require_clerk_user)]) -> dict[str, Any]:
    """Validate Bearer session JWT and return claims + optional Clerk user payload."""
    uid = user.get("sub")
    profile = get_clerk_user_json(str(uid)) if uid else None
    return {
        "sub": uid,
        "session_claims": {
            k: user.get(k)
            for k in ("email", "name", "given_name", "family_name")
            if user.get(k) is not None
        },
        "clerk_user": profile,
    }
