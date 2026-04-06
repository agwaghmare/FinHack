"""Clerk-backed auth helpers for the API."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.dependencies.clerk_auth import require_clerk_user
from backend.services.clerk_service import get_clerk_public_config, get_clerk_user_json
from backend.utils.env_keys import (
    alert_email_from,
    alert_email_to,
    alert_sms_to,
    alpaca_key_id,
    alpaca_secret_key,
    clerk_publishable_key,
    clerk_secret_key,
    elevenlabs_key,
    fred_key,
    gemini_key,
    gnews_key,
    mistral_key,
    openai_key,
    twilio_account_sid,
    twilio_auth_token,
    twilio_from_number,
    alert_webhook_url,
    smtp_host,
    smtp_password,
    smtp_user,
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
    tw_sid = _configured(twilio_account_sid())
    tw_tok = _configured(twilio_auth_token())
    tw_from = _configured(twilio_from_number())
    tw_to = _configured(alert_sms_to())
    # SMS can only send when all four are set (matches alert_service._send_twilio_sms).
    u_ok = _configured(smtp_user())
    p_ok = _configured(smtp_password())
    smtp_auth_ok = (not u_ok and not p_ok) or (u_ok and p_ok)
    smtp_email = (
        _configured(smtp_host())
        and _configured(alert_email_to())
        and _configured(alert_email_from())
        and smtp_auth_ok
    )
    return {
        "gnews": _configured(gnews_key()),
        "fred": _configured(fred_key()),
        "gemini": _configured(gemini_key()),
        "openai": _configured(openai_key()),
        "mistral": _configured(mistral_key()),
        "elevenlabs": _configured(elevenlabs_key()),
        "clerk_publishable": _configured(clerk_publishable_key()),
        "clerk_secret": _configured(clerk_secret_key()),
        "alpaca": _configured(alpaca_key_id()) and _configured(alpaca_secret_key()),
        "alert_webhook": _configured(alert_webhook_url()),
        "zapier_webhook": _configured(alert_webhook_url()),
        "twilio_sms": tw_sid and tw_tok and tw_from and tw_to,
        "twilio_account_sid": tw_sid,
        "twilio_auth_token": tw_tok,
        "twilio_from_number": tw_from,
        "twilio_alert_to": tw_to,
        "smtp_email": smtp_email,
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
