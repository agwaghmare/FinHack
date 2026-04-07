"""Alerts: optional HTTP webhook + Twilio SMS + SMTP email."""

from __future__ import annotations

import logging
from typing import Any

import requests

from backend.services.clerk_service import (
    get_clerk_metadata_alert_email,
    get_clerk_user_primary_email,
)
from backend.utils.env_keys import (
    alert_email_from,
    alert_email_to,
    alert_sms_to,
    alert_webhook_url,
    smtp_host,
    smtp_password,
    smtp_port,
    smtp_user,
    twilio_account_sid,
    twilio_auth_token,
    twilio_from_number,
)

logger = logging.getLogger(__name__)


def _delivery_hints(webhook_d: str, sms_d: str, email_d: str) -> list[str]:
    """Actionable strings for API clients when delivery fails or is partial."""
    hints: list[str] = []
    w, s, e = str(webhook_d), str(sms_d), str(email_d)

    if "no_webhook_url" in w:
        hints.append("Optional: set ALERT_WEBHOOK_URL if you want JSON POSTs to your server.")

    if "twilio_not_configured" in s:
        hints.append(
            "SMS: set all of TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, ALERT_SMS_TO, then restart the API.",
        )
    elif "401" in s or "Unauthorized" in s or "20003" in s:
        hints.append(
            "Twilio 401 / unauthorized: TWILIO_ACCOUNT_SID must match the project shown in Twilio Console, and "
            "TWILIO_AUTH_TOKEN must be the Account Auth Token (Console → Account → API keys & tokens), not an API Key secret. "
            "Regenerate the token if it was rotated.",
        )
    elif "twilio_error" in s:
        hints.append("Twilio rejected the request — see the `twilio` string for the HTTP error. Check FROM/TO numbers (E.164) and trial restrictions.")

    if "smtp_not_configured" in e:
        hints.append(
            "Email: set SMTP_HOST, SMTP_PORT, ALERT_EMAIL_FROM, and usually SMTP_USER + SMTP_PASSWORD "
            "(Gmail needs an app password). For per-user delivery, set CLERK_SECRET_KEY so the API can read each "
            "user's primary email or per-user ``private_metadata.alert_email``; optionally set ALERT_EMAIL_TO as a "
            "fallback for unauthenticated sends. "
            "Restart the API after editing .env.",
        )
    elif "smtp_error" in e:
        hints.append("SMTP failed after connect — check host, port (587 STARTTLS vs 465 SSL), username/password, and sender allowlisting.")

    if not hints:
        hints.append("Configure at least one of: ALERT_WEBHOOK_URL, Twilio SMS, or SMTP (see docs on Alerts page).")
    return hints


def _resolve_smtp_recipient(
    recipient_email: str | None,
    user_id: str | None,
) -> str | None:
    """
    1. Clerk ``private_metadata.alert_email`` (or ``public_metadata``) — per-user dynamic TO.
    2. JWT/session ``email`` claim when present.
    3. Clerk primary email.
    4. Env ``ALERT_EMAIL_TO`` (fallback for unauthenticated or no Clerk profile).
    """
    if user_id:
        meta_to = get_clerk_metadata_alert_email(user_id)
        if meta_to:
            return meta_to
    e = (recipient_email or "").strip()
    if e and "@" in e:
        return e
    if user_id:
        ce = get_clerk_user_primary_email(user_id)
        if ce:
            return ce
    raw = alert_email_to()
    if raw:
        return raw.split(",")[0].strip()
    return None


def _send_http_webhook(payload: dict[str, Any]) -> tuple[bool, str]:
    url = alert_webhook_url()
    if not url:
        return False, "no_webhook_url"
    try:
        r = requests.post(url, json=payload, timeout=25)
        r.raise_for_status()
        logger.info("Alert HTTP webhook OK (%s)", r.status_code)
        return True, "webhook_sent"
    except Exception as e:
        logger.exception("Alert HTTP webhook failed: %s", e)
        return False, f"webhook_error:{e}"


def _send_smtp_email(subject: str, body: str, *, to_addr: str | None) -> tuple[bool, str]:
    """Optional SMTP (Gmail app password, SendGrid SMTP, etc.)."""
    host = smtp_host()
    from_addr = alert_email_from()
    user = smtp_user()
    password = smtp_password()
    to = (to_addr or "").strip() if to_addr else ""
    if not host or not from_addr:
        missing = []
        if not host:
            missing.append("SMTP_HOST")
        if not from_addr:
            missing.append("ALERT_EMAIL_FROM")
        return False, f"smtp_not_configured:missing={','.join(missing)}"
    if not to or "@" not in to:
        return False, "smtp_not_configured:missing=recipient(no user email and no ALERT_EMAIL_TO)"
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject[:200]
        msg["From"] = from_addr
        msg["To"] = to
        msg.attach(MIMEText(body[:12000], "plain", "utf-8"))

        port = smtp_port()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                if user and password:
                    server.login(user, password)
                server.sendmail(from_addr, [to], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except Exception:
                    pass
                if user and password:
                    server.login(user, password)
                server.sendmail(from_addr, [to], msg.as_string())
        logger.info("SMTP alert email sent to %s", to[:8] + "…")
        return True, "smtp_sent"
    except Exception as e:
        logger.exception("SMTP email failed: %s", e)
        return False, f"smtp_error:{e}"


def _send_twilio_sms(body: str) -> tuple[bool, str]:
    sid = twilio_account_sid().strip()
    token = twilio_auth_token().strip()
    from_num = twilio_from_number().strip()
    to = alert_sms_to().strip()
    if not all([sid, token, from_num, to]):
        missing = []
        if not sid:
            missing.append("TWILIO_ACCOUNT_SID")
        if not token:
            missing.append("TWILIO_AUTH_TOKEN")
        if not from_num:
            missing.append("TWILIO_FROM_NUMBER")
        if not to:
            missing.append("ALERT_SMS_TO")
        return False, f"twilio_not_configured:missing={','.join(missing)}"
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
    recipient_email: str | None = None,
) -> dict[str, Any]:
    """
    Notify optional HTTP webhook (JSON POST), Twilio SMS, and SMTP email.
    Set ``ALERT_WEBHOOK_URL``, Twilio + ``ALERT_SMS_TO``, and/or SMTP vars in env.

    Email ``To``: ``recipient_email`` (e.g. from JWT) if valid, else Clerk primary email for
    ``user_id`` (requires ``CLERK_SECRET_KEY``), else ``ALERT_EMAIL_TO`` in env.
    """
    payload: dict[str, Any] = {
        "message": message,
        "source": "ai-financial-companion",
        "metadata": metadata or {},
    }
    if user_id:
        payload["user_id"] = user_id

    webhook_ok, webhook_detail = _send_http_webhook(payload)
    sms_ok, sms_detail = _send_twilio_sms(message) if message.strip() else (False, "empty_message")
    subj = str((metadata or {}).get("subject") or "FinSight alert")[:200]
    smtp_to = _resolve_smtp_recipient(recipient_email, user_id)
    email_ok, email_detail = (
        _send_smtp_email(subj, message, to_addr=smtp_to)
        if message.strip()
        else (False, "empty_message")
    )

    hints = _delivery_hints(webhook_detail, sms_detail, email_detail)

    if not webhook_ok and not sms_ok and not email_ok:
        logger.info(
            "Alert received (no successful delivery): user_id=%s preview=%s",
            user_id,
            message[:240],
        )
        return {
            "status": "received",
            "note": "No delivery channel succeeded; the alert was logged server-side. Fix Twilio, SMTP, or webhook settings and retry.",
            "delivery_hints": hints,
            "webhook": webhook_detail,
            "twilio": sms_detail,
            "email": email_detail,
            "user_id": user_id,
            "message_preview": message[:500],
            "zapier": webhook_detail,
            "zapier_sent": webhook_ok,
        }

    out: dict[str, Any] = {
        "status": "sent",
        "webhook": webhook_detail,
        "twilio": sms_detail if sms_ok else sms_detail,
        "email": email_detail if email_ok else email_detail,
        "webhook_sent": webhook_ok,
        "twilio_sent": sms_ok,
        "email_sent": email_ok,
        "zapier": webhook_detail,
        "zapier_sent": webhook_ok,
    }
    any_ok = webhook_ok or sms_ok or email_ok
    if any_ok and not (webhook_ok and sms_ok and email_ok):
        partial: list[str] = []
        if not sms_ok:
            partial.extend([h for h in hints if "Twilio" in h or "SMS:" in h])
        if not email_ok:
            partial.extend([h for h in hints if "Email:" in h or "SMTP" in h])
        if not webhook_ok and "webhook_error" in webhook_detail:
            partial.append("HTTP webhook POST failed — see the `webhook` field for details.")
        if partial:
            out["delivery_warnings"] = partial
    return out
