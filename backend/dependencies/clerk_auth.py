"""FastAPI dependencies for Clerk session tokens."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException

from backend.services.clerk_service import verify_clerk_session_jwt


async def bearer_token(authorization: str | None = Header(None)) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip() or None


async def optional_clerk_user(
    token: Annotated[str | None, Depends(bearer_token)],
) -> dict[str, Any] | None:
    if not token:
        return None
    try:
        return verify_clerk_session_jwt(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Clerk session token",
        ) from None


async def require_clerk_user(
    token: Annotated[str | None, Depends(bearer_token)],
) -> dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")
    try:
        return verify_clerk_session_jwt(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Clerk session token",
        ) from None
