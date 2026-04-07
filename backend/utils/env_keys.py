"""Read API keys from env — supports common names and your `.env` variable names."""

import os


def _get(*names: str) -> str:
    for n in names:
        v = os.getenv(n)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def fred_key() -> str:
    return _get("FRED_API_KEY", "FRED", "fred_key")


def gnews_key() -> str:
    return _get("GNEWS_API_KEY", "GNEWS_TOKEN", "GNEWS")


def openai_key() -> str:
    return _get("OPENAI_API_KEY", "OPENAI")


def mistral_key() -> str:
    return _get(
        "MISTRAL_API_KEY",
        "MISTRAL",
        "mistral_api_key",
        "MISTRAL_KEY",
    )


def gemini_key() -> str:
    return _get(
        "GEMINI_API_KEY",
        "GEMINI",
        "GOOGLE_API_KEY",
        "GOOGLE_GENAI_API_KEY",
        "GENAI_API_KEY",
    )


def elevenlabs_key() -> str:
    return _get(
        "ELEVENLABS_API_KEY",
        "ELEVENLABS",
        "11",
        "elevenlabs_key",
    )


def alert_webhook_url() -> str:
    """Optional URL that receives JSON POST alert payloads (SMS/email are preferred for most users)."""
    return _get(
        "ALERT_WEBHOOK_URL",
        "WEBHOOK_URL",
        "ZAPIER_WEBHOOK_URL",
        "ZAPIER_WEBHOOK",
    )


def zapier_webhook_url() -> str:
    """Deprecated alias for :func:`alert_webhook_url` (same env vars)."""
    return alert_webhook_url()


def twilio_account_sid() -> str:
    return _get("TWILIO_ACCOUNT_SID")


def twilio_auth_token() -> str:
    # Prefer TWILIO_AUTH_TOKEN; legacy "Twillio" was a common typo in .env samples.
    return _get("TWILIO_AUTH_TOKEN", "TWILIO_AUTH", "Twillio", "TWILIO_TOKEN")


def twilio_from_number() -> str:
    return _get("TWILIO_FROM_NUMBER", "TWILIO_PHONE_NUMBER")


def alert_sms_to() -> str:
    """Destination E.164 for SMS alerts (optional)."""
    return _get("ALERT_SMS_TO", "TWILIO_ALERT_TO")


def smtp_host() -> str:
    return _get("SMTP_HOST", "EMAIL_SMTP_HOST")


def smtp_port() -> int:
    raw = _get("SMTP_PORT", "EMAIL_SMTP_PORT")
    try:
        return int(raw) if raw else 587
    except ValueError:
        return 587


def smtp_user() -> str:
    return _get("SMTP_USER", "EMAIL_SMTP_USER", "SMTP_USERNAME")


def smtp_password() -> str:
    return _get("SMTP_PASSWORD", "EMAIL_SMTP_PASSWORD", "SMTP_PASS")


def alert_email_from() -> str:
    return _get("ALERT_EMAIL_FROM", "SMTP_FROM", "EMAIL_FROM")


def alert_email_to() -> str:
    """
    Optional default inbox for alert emails when no signed-in user is available
    (comma-separated ok — first used for To). If ``CLERK_SECRET_KEY`` is set, alerts
    for authenticated users are sent to their Clerk primary email instead.
    """
    return _get("ALERT_EMAIL_TO", "SMTP_TO", "ALERT_TO_EMAIL")


def clerk_secret_key() -> str:
    return _get("CLERK_SECRET_KEY")


def clerk_publishable_key() -> str:
    return _get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_PUBLISHABLE_KEY")


def alpaca_key_id() -> str:
    return _get("ALPACA_API_KEY_ID", "APCA_API_KEY_ID", "ALPACA_KEY")


def alpaca_secret_key() -> str:
    return _get("ALPACA_API_SECRET_KEY", "APCA_API_SECRET_KEY", "ALPACA_SECRET")


def broker_oauth_client_id(broker: str) -> str:
    b = (broker or "").strip().upper().replace(" ", "_")
    return _get(f"{b}_OAUTH_CLIENT_ID")


def broker_oauth_authorize_url(broker: str) -> str:
    b = (broker or "").strip().upper().replace(" ", "_")
    return _get(f"{b}_OAUTH_AUTHORIZE_URL")


def broker_oauth_scope(broker: str) -> str:
    b = (broker or "").strip().upper().replace(" ", "_")
    return _get(f"{b}_OAUTH_SCOPE")


def broker_oauth_client_secret(broker: str) -> str:
    b = (broker or "").strip().upper().replace(" ", "_")
    return _get(f"{b}_OAUTH_CLIENT_SECRET")


def broker_oauth_token_url(broker: str) -> str:
    b = (broker or "").strip().upper().replace(" ", "_")
    return _get(f"{b}_OAUTH_TOKEN_URL")
