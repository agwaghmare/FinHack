from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException

from backend.dependencies.clerk_auth import optional_clerk_user, require_clerk_user
from backend.services.alert_service import send_alert
from backend.services.risk_signals_service import (
    build_digest_message,
    compute_risk_signals,
    get_delivery_channels,
)

router = APIRouter()


@router.post("/trigger")
def trigger(
    clerk_user: Annotated[dict[str, Any] | None, Depends(optional_clerk_user)],
    payload: dict = Body(default_factory=dict),
):
    """
    Sends alert payload to an optional **HTTP webhook**, **Twilio** SMS, and/or **SMTP** email when configured.
    If the client sends `Authorization: Bearer <Clerk session JWT>`, `user_id` is attached.
    """
    message = str(payload.get("message") or payload.get("text") or "").strip()
    if not message:
        message = "Alert triggered (no message body)"

    meta = {k: v for k, v in payload.items() if k not in ("message", "text")}
    uid = str(clerk_user["sub"]) if clerk_user and clerk_user.get("sub") else None
    jwt_email = (
        str(clerk_user.get("email") or "").strip() or None if clerk_user else None
    )

    return send_alert(message, metadata=meta, user_id=uid, recipient_email=jwt_email)


@router.post("/risk/{user_id}")
def alert_risk(
    user_id: str,
    clerk_user: Annotated[dict[str, Any], Depends(require_clerk_user)],
    body: dict = Body(default_factory=dict),
):
    uid = clerk_user.get("sub")
    if not uid or str(uid) != user_id:
        raise HTTPException(status_code=403, detail="user_id must match the signed-in user")
    jwt_email = str(clerk_user.get("email") or "").strip() or None
    msg = str(
        body.get("message")
        or f"Portfolio risk threshold event for user {user_id}"
    )
    return send_alert(
        msg,
        metadata={"alert_type": "risk", "user_id": user_id, **body},
        user_id=user_id,
        recipient_email=jwt_email,
    )


@router.post("/news")
def alert_news(body: dict = Body(default_factory=dict)):
    msg = str(body.get("message") or "Significant market news or sentiment change")
    return send_alert(
        msg,
        metadata={"alert_type": "news", **body},
    )


@router.post("/trade/{user_id}")
def alert_trade(
    user_id: str,
    clerk_user: Annotated[dict[str, Any], Depends(require_clerk_user)],
    body: dict = Body(default_factory=dict),
):
    uid = clerk_user.get("sub")
    if not uid or str(uid) != user_id:
        raise HTTPException(status_code=403, detail="user_id must match the signed-in user")
    jwt_email = str(clerk_user.get("email") or "").strip() or None
    msg = str(
        body.get("message")
        or f"Trade risk flag for user {user_id}"
    )
    return send_alert(
        msg,
        metadata={"alert_type": "trade", "user_id": user_id, **body},
        user_id=user_id,
        recipient_email=jwt_email,
    )


@router.post("/send")
def alert_send(
    clerk_user: Annotated[dict[str, Any] | None, Depends(optional_clerk_user)],
    body: dict = Body(default_factory=dict),
):
    """Explicit notification — same pipeline (webhook + optional SMS + email)."""
    msg = str(body.get("message") or "").strip()
    if not msg:
        msg = "Notification from FinSight"
    uid = str(clerk_user["sub"]) if clerk_user and clerk_user.get("sub") else None
    jwt_email = (
        str(clerk_user.get("email") or "").strip() or None if clerk_user else None
    )
    return send_alert(
        msg,
        metadata=body.get("metadata") or body,
        user_id=uid,
        recipient_email=jwt_email,
    )


@router.get("/delivery")
def alerts_delivery():
    """Which outbound channels have env configured (no secrets)."""
    return get_delivery_channels()


@router.get("/signals")
def alerts_signals(
    user: Annotated[dict[str, Any], Depends(require_clerk_user)],
    risk_alert_threshold: float = 7.0,
    concentration_threshold: float = 0.35,
):
    """Live portfolio + market signals for the signed-in user."""
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user id")
    return compute_risk_signals(
        str(uid),
        risk_alert_threshold=risk_alert_threshold,
        concentration_threshold=concentration_threshold,
    )


@router.post("/digest")
def alerts_digest(
    user: Annotated[dict[str, Any], Depends(require_clerk_user)],
    body: dict = Body(default_factory=dict),
):
    """
    Compute current risk signals and send via SMS / email / optional HTTP webhook (whatever is configured).
    """
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Missing user id")
    ra = float(body.get("risk_alert_threshold") or 7.0)
    cc = float(body.get("concentration_threshold") or 0.35)
    payload = compute_risk_signals(str(uid), risk_alert_threshold=ra, concentration_threshold=cc)
    subj, msg = build_digest_message(payload)
    meta = {
        "alert_type": "risk_digest",
        "subject": subj,
        **payload.get("thresholds", {}),
    }
    jwt_email = str(user.get("email") or "").strip() or None
    return send_alert(
        msg,
        metadata=meta,
        user_id=str(uid),
        recipient_email=jwt_email,
    )
