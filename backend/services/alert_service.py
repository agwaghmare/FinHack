"""Alerts: Zapier webhook + optional Twilio SMS."""

from __future__ import annotations

import logging
from typing import Any

import requests

from backend.utils.env_keys import (
    alert_sms_to,
    twilio_account_sid,
    twilio_auth_token,
    twilio_from_number,
    zapier_webhook_url,
)

logger = logging.getLogger(__name__)


def _send_zapier(payload: dict[str, Any]) -> tuple[bool, str]:
    url = zapier_webhook_url()
    if not url:
        return False, "no_webhook_url"
    try:
        r = requests.post(url, json=payload, timeout=25)
        r.raise_for_status()
        logger.info("Zapier webhook OK (%s)", r.status_code)
        return True, "zapier_sent"
    except Exception as e:
        logger.exception("Zapier webhook failed: %s", e)
        return False, f"zapier_error:{e}"


def _send_twilio_sms(body: str) -> tuple[bool, str]:
    sid = twilio_account_sid()
    token = twilio_auth_token()
    from_num = twilio_from_number()
    to = alert_sms_to()
    if not all([sid, token, from_num, to]):
        return False, "twilio_not_configured"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    try:
        r = requests.post(
            url,
            auth=(sid, token),
            data={"To": to, "From": from_num, "Body": body[:1600]},
            timeout=25,
        )
        r.raise_for_status()
        logger.info("Twilio SMS sent")
        return True, "twilio_sent"
    except Exception as e:
        logger.exception("Twilio SMS failed: %s", e)
        return False, f"twilio_error:{e}"


def send_alert(
    message: str,
    *,
    metadata: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Notify Zapier (JSON) and optionally SMS via Twilio.
    Set ZAPIER_WEBHOOK_URL and/or Twilio + ALERT_SMS_TO in env.
    """
    payload: dict[str, Any] = {
        "message": message,
        "source": "ai-financial-companion",
        "metadata": metadata or {},
    }
    if user_id:
        payload["user_id"] = user_id

    zapier_ok, zapier_detail = _send_zapier(payload)
    sms_ok, sms_detail = _send_twilio_sms(message) if message.strip() else (False, "empty_message")

    if not zapier_ok and not sms_ok:
        logger.info(
            "Alert received (no Zapier/Twilio): user_id=%s preview=%s",
            user_id,
            message[:240],
        )
        return {
            "status": "received",
            "note": "No Zapier webhook or Twilio SMS configured; message accepted and logged server-side.",
            "zapier": zapier_detail,
            "twilio": sms_detail,
            "user_id": user_id,
            "message_preview": message[:500],
        }

    return {
        "status": "sent",
        "zapier": zapier_detail if zapier_ok else zapier_detail,
        "twilio": sms_detail if sms_ok else sms_detail,
        "zapier_sent": zapier_ok,
        "twilio_sent": sms_ok,
    }
