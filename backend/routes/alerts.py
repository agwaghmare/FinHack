from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends

from backend.dependencies.clerk_auth import optional_clerk_user
from backend.services.alert_service import send_alert

router = APIRouter()


@router.post("/trigger")
def trigger(
    clerk_user: Annotated[dict[str, Any] | None, Depends(optional_clerk_user)],
    payload: dict = Body(default_factory=dict),
):
    """
    Sends alert payload to **Zapier** (webhook) and/or **Twilio** SMS when configured.
    If the client sends `Authorization: Bearer <Clerk session JWT>`, `user_id` is attached.
    """
    message = str(payload.get("message") or payload.get("text") or "").strip()
    if not message:
        message = "Alert triggered (no message body)"

    meta = {k: v for k, v in payload.items() if k not in ("message", "text")}
    uid = str(clerk_user["sub"]) if clerk_user and clerk_user.get("sub") else None

    return send_alert(message, metadata=meta, user_id=uid)


@router.post("/risk/{user_id}")
def alert_risk(
    user_id: str,
    body: dict = Body(default_factory=dict),
):
    msg = str(
        body.get("message")
        or f"Portfolio risk threshold event for user {user_id}"
    )
    return send_alert(
        msg,
        metadata={"alert_type": "risk", "user_id": user_id, **body},
        user_id=user_id,
    )


@router.post("/news")
def alert_news(body: dict = Body(default_factory=dict)):
    msg = str(body.get("message") or "Significant market news or sentiment change")
    return send_alert(
        msg,
        metadata={"alert_type": "news", **body},
    )


@router.post("/trade/{user_id}")
def alert_trade(user_id: str, body: dict = Body(default_factory=dict)):
    msg = str(
        body.get("message")
        or f"Trade risk flag for user {user_id}"
    )
    return send_alert(
        msg,
        metadata={"alert_type": "trade", "user_id": user_id, **body},
        user_id=user_id,
    )


@router.post("/send")
def alert_send(body: dict = Body(default_factory=dict)):
    """Explicit notification — same pipeline (webhook + optional SMS)."""
    msg = str(body.get("message") or "").strip()
    if not msg:
        msg = "Notification from FinSight"
    return send_alert(msg, metadata=body.get("metadata") or body)
