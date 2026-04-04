"""FastAPI dependencies for Clerk session tokens."""

from typing import Annotated, Any, Optional

from fastapi import Depends, Header, HTTPException

from backend.services.clerk_service import verify_clerk_session_jwt


async def bearer_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization.removeprefix("Bearer ").strip() or None


async def optional_clerk_user(
    token: Annotated[Optional[str], Depends(bearer_token)],
) -> Optional[dict[str, Any]]:
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
    token: Annotated[Optional[str], Depends(bearer_token)],
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
