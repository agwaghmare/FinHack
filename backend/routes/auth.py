"""Clerk-backed auth helpers for the API."""

from urllib.parse import urlencode
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
import httpx

from backend.dependencies.clerk_auth import require_clerk_user
from backend.services.clerk_service import (
    get_clerk_metadata_alert_email,
    get_clerk_public_config,
    get_clerk_user_json,
    set_clerk_user_alert_email,
)
from backend.services.broker_oauth_service import create_state, consume_state, get_connections, set_connected
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
    broker_oauth_authorize_url,
    broker_oauth_client_id,
    broker_oauth_client_secret,
    broker_oauth_scope,
    broker_oauth_token_url,
)

router = APIRouter()
_BROKERS = ("alpaca", "robinhood", "interactive_brokers", "charles_schwab", "td_ameritrade")


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
        and _configured(alert_email_from())
        and smtp_auth_ok
        and (_configured(alert_email_to()) or _configured(clerk_secret_key()))
    )
    oauth_ready = {
        f"{b}_oauth": (
            _configured(broker_oauth_client_id(b))
            and _configured(broker_oauth_authorize_url(b))
        )
        for b in _BROKERS
    }
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
        **oauth_ready,
    }


@router.get("/broker-oauth/start")
def broker_oauth_start(
    broker: str = Query(..., description="Broker id"),
    redirect_uri: str = Query(..., description="Frontend callback URL"),
) -> RedirectResponse:
    b = broker.strip().lower().replace(" ", "_")
    if b not in _BROKERS:
        raise HTTPException(status_code=400, detail="Unsupported broker")
    authorize_url = broker_oauth_authorize_url(b)
    client_id = broker_oauth_client_id(b)
    if not _configured(authorize_url) or not _configured(client_id):
        raise HTTPException(status_code=503, detail=f"{b} OAuth is not configured")
    state = create_state(b, redirect_uri)
    q: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state,
    }
    scope = broker_oauth_scope(b)
    if _configured(scope):
        q["scope"] = scope
    sep = "&" if "?" in authorize_url else "?"
    return RedirectResponse(url=f"{authorize_url}{sep}{urlencode(q)}", status_code=307)


@router.get("/broker-oauth/callback")
def broker_oauth_callback(
    broker: str = Query(..., description="Broker id"),
    code: str | None = Query(None, description="OAuth auth code"),
    state: str | None = Query(None, description="OAuth state"),
    error: str | None = Query(None, description="Provider error"),
) -> RedirectResponse:
    b = broker.strip().lower().replace(" ", "_")
    if b not in _BROKERS:
        raise HTTPException(status_code=400, detail="Unsupported broker")
    if not state:
        raise HTTPException(status_code=400, detail="Missing OAuth state")
    st = consume_state(state, b)
    if not st:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    redirect_uri = str(st.get("redirect_uri") or "")
    if not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing redirect URI")

    status = "error"
    msg = ""
    if error:
        status = "error"
        msg = error
    elif not code:
        status = "error"
        msg = "missing_code"
    else:
        token_url = broker_oauth_token_url(b)
        client_id = broker_oauth_client_id(b)
        client_secret = broker_oauth_client_secret(b)
        if _configured(token_url) and _configured(client_id) and _configured(client_secret):
            try:
                form = {
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                }
                with httpx.Client(timeout=25.0, follow_redirects=True) as c:
                    r = c.post(token_url, data=form)
                    r.raise_for_status()
                    tok = r.json() if r.headers.get("content-type", "").lower().find("json") >= 0 else {}
                set_connected(
                    b,
                    token_type=str((tok or {}).get("token_type") or "") or None,
                    has_access_token=bool((tok or {}).get("access_token")),
                    has_refresh_token=bool((tok or {}).get("refresh_token")),
                    scope=str((tok or {}).get("scope") or "") or None,
                )
                status = "connected"
                msg = "OAuth connected and token exchange succeeded."
            except Exception as e:
                status = "error"
                msg = f"token_exchange_failed:{type(e).__name__}"
        else:
            status = "auth_only"
            msg = "OAuth code received. Configure token endpoint + client secret to finish connection."

    sep = "&" if "?" in redirect_uri else "?"
    qs = urlencode({"broker": b, "oauth_status": status, "oauth_message": msg})
    return RedirectResponse(url=f"{redirect_uri}{sep}{qs}", status_code=307)


@router.get("/broker-oauth/connections")
def broker_oauth_connections() -> dict[str, Any]:
    return {"connections": get_connections()}


@router.get("/alert-email")
def auth_get_alert_email(
    user: Annotated[dict[str, Any], Depends(require_clerk_user)],
) -> dict[str, Any]:
    """Per-user SMTP destination override (Clerk private_metadata), not the resolved fallback chain."""
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user id")
    addr = get_clerk_metadata_alert_email(str(uid))
    return {"alert_email": addr}


@router.patch("/alert-email")
def auth_patch_alert_email(
    user: Annotated[dict[str, Any], Depends(require_clerk_user)],
    body: dict = Body(default_factory=dict),
) -> dict[str, Any]:
    """
    Set or clear dynamic alert inbox (stored in Clerk ``private_metadata.alert_email``).
    Send ``{"email": null}`` or ``{"email": ""}`` to clear and use primary account email / env.
    """
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user id")
    raw = body.get("email")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        ok, detail = set_clerk_user_alert_email(str(uid), None)
    else:
        email = str(raw).strip()
        if "@" not in email or len(email) > 320:
            raise HTTPException(status_code=400, detail="Invalid email")
        ok, detail = set_clerk_user_alert_email(str(uid), email)
    if not ok:
        raise HTTPException(status_code=502, detail=detail)
    return {"ok": True, "alert_email": get_clerk_metadata_alert_email(str(uid))}


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
