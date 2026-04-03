"""Clerk: JWT session verification (JWKS) and Backend API helper."""

from __future__ import annotations

import logging
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from backend.utils.env_keys import clerk_secret_key, clerk_publishable_key

logger = logging.getLogger(__name__)

CLERK_API_BASE = "https://api.clerk.com/v1"


def get_clerk_public_config() -> dict[str, str]:
    """Safe for frontend — publishable key only."""
    pk = clerk_publishable_key()
    return {"publishable_key": pk} if pk else {}


def verify_clerk_session_jwt(token: str) -> dict[str, Any]:
    """
    Verify a Clerk session JWT (Bearer token from the client).
    Uses issuer from the token + Clerk JWKS.
    """
    if not token or not token.strip():
        raise ValueError("empty token")

    unverified = jwt.decode(
        token,
        options={"verify_signature": False},
        algorithms=["RS256"],
    )
    iss = unverified.get("iss")
    if not iss or not isinstance(iss, str):
        raise ValueError("token missing iss")

    jwks_url = f"{iss.rstrip('/')}/.well-known/jwks.json"
    jwk_client = PyJWKClient(jwks_url, cache_keys=True)
    signing_key = jwk_client.get_signing_key_from_jwt(token)

    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=iss,
        options={
            "verify_aud": False,
            "require": ["exp", "iss", "sub"],
        },
    )
    return decoded


def clerk_backend_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
) -> httpx.Response:
    """Call Clerk Backend API with your secret key (server-side only)."""
    secret = clerk_secret_key()
    if not secret:
        raise RuntimeError("CLERK_SECRET_KEY is not set")

    url = f"{CLERK_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=30.0) as client:
        return client.request(method, url, headers=headers, params=params or {})


def get_clerk_user_json(user_id: str) -> dict[str, Any] | None:
    """Fetch a user from Clerk by user id (uses CLERK_SECRET_KEY)."""
    if not user_id:
        return None
    try:
        r = clerk_backend_request("GET", f"/users/{user_id}")
        if r.status_code != 200:
            logger.warning("Clerk user fetch %s: %s", r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        logger.exception("Clerk API error: %s", e)
        return None
