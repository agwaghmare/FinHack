"""Portfolio + market risk signals for alerts UI and digest messages."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from backend.services.portfolio_service import analyze_portfolio
from backend.utils.env_keys import (
    alert_email_from,
    alert_email_to,
    alert_sms_to,
    alert_webhook_url,
    smtp_host,
    smtp_password,
    smtp_user,
    twilio_account_sid,
    twilio_auth_token,
    twilio_from_number,
)

logger = logging.getLogger(__name__)


def _configured(v: str) -> bool:
    t = (v or "").strip()
    return bool(t and t.upper() not in ("YOUR_KEY", "NONE", "PLACEHOLDER"))


def get_delivery_channels() -> dict[str, Any]:
    """Booleans only — safe for public API."""
    tw_sid = _configured(twilio_account_sid())
    tw_tok = _configured(twilio_auth_token())
    tw_from = _configured(twilio_from_number())
    tw_to = _configured(alert_sms_to())
    sms_ready = tw_sid and tw_tok and tw_from and tw_to
    u_ok = _configured(smtp_user())
    p_ok = _configured(smtp_password())
    auth_ok = (not u_ok and not p_ok) or (u_ok and p_ok)
    email_ready = (
        _configured(smtp_host())
        and _configured(alert_email_to())
        and _configured(alert_email_from())
        and auth_ok
    )
    return {
        "webhook": _configured(alert_webhook_url()),
        "sms": sms_ready,
        "email": email_ready,
        "any_channel": _configured(alert_webhook_url()) or sms_ready or email_ready,
    }


def _spy_1m_return_pct() -> float | None:
    try:
        import yfinance as yf

        h = yf.Ticker("SPY").history(period="1mo")
        if h is None or len(h) < 2:
            return None
        c = h["Close"]
        c0 = float(c.iloc[0])
        c1 = float(c.iloc[-1])
        if c0 <= 0:
            return None
        return round((c1 / c0 - 1) * 100, 2)
    except Exception as e:
        logger.debug("spy 1m: %s", e)
        return None


def compute_risk_signals(
    user_id: str,
    *,
    risk_alert_threshold: float = 7.0,
    concentration_threshold: float = 0.35,
) -> dict[str, Any]:
    """
    Structured signals for UI + digest copy.
    Thresholds are hints only (education / research framing).
    """
    analysis = analyze_portfolio(user_id)
    positions = analysis.get("positions") or []
    risk_score = analysis.get("risk_score")
    risk_label = analysis.get("risk_label")
    as_of = analysis.get("as_of") or date.today().isoformat()

    signals: list[dict[str, Any]] = []

    if not positions:
        signals.append(
            {
                "id": "no_holdings",
                "severity": "info",
                "title": "No priced holdings",
                "detail": "Add positions under My portfolio to unlock portfolio risk scoring and concentration checks.",
            }
        )
    else:
        if isinstance(risk_score, (int, float)) and float(risk_score) >= risk_alert_threshold:
            signals.append(
                {
                    "id": "portfolio_risk_high",
                    "severity": "warning",
                    "title": f"Portfolio risk {float(risk_score):.1f}/10 ({risk_label})",
                    "detail": f"At or above your watch level ({risk_alert_threshold:.1f}/10). Review sizing and diversification.",
                }
            )
        elif isinstance(risk_score, (int, float)) and float(risk_score) < 3:
            signals.append(
                {
                    "id": "portfolio_risk_low",
                    "severity": "info",
                    "title": f"Portfolio risk {float(risk_score):.1f}/10 ({risk_label})",
                    "detail": "Model reads relatively calm vs typical equity sleeves — still subject to gap and macro risk.",
                }
            )

        top = max(positions, key=lambda p: float(p.get("weight") or 0))
        tw = float(top.get("weight") or 0)
        sym = str(top.get("symbol") or "?")
        if tw >= concentration_threshold:
            signals.append(
                {
                    "id": "concentration",
                    "severity": "risk" if tw >= 0.5 else "warning",
                    "title": f"Concentration: {sym} {tw * 100:.1f}%",
                    "detail": f"Largest line is above {concentration_threshold * 100:.0f}% of portfolio value — single-name risk.",
                }
            )

        # Single-name risk scores (top two worst, avoid noise)
        hot = sorted(
            positions,
            key=lambda x: float(x.get("risk_score") or 0),
            reverse=True,
        )[:2]
        for p in hot:
            rs = float(p.get("risk_score") or 0)
            if rs >= 7.5:
                signals.append(
                    {
                        "id": f"position_hot_{p.get('symbol')}",
                        "severity": "warning",
                        "title": f"{p.get('symbol')} position risk {rs:.1f}/10",
                        "detail": "High volatility, beta, or weight in the sleeve model — review against your plan.",
                    }
                )

    spy_1m = _spy_1m_return_pct()
    if spy_1m is not None:
        if spy_1m <= -5:
            signals.append(
                {
                    "id": "spy_drawdown_1m",
                    "severity": "warning",
                    "title": f"US equity (SPY) ~{spy_1m:.1f}% over 30d",
                    "detail": "Broad market soft over the last month — check risk budget and correlations.",
                }
            )
        elif spy_1m >= 5:
            signals.append(
                {
                    "id": "spy_rally_1m",
                    "severity": "info",
                    "title": f"US equity (SPY) ~{spy_1m:+.1f}% over 30d",
                    "detail": "Strong month for the index proxy — avoid overconfidence in sizing.",
                }
            )

    if not signals:
        signals.append(
            {
                "id": "all_clear",
                "severity": "info",
                "title": "No major flags in this pass",
                "detail": "Routine check: keep monitoring holdings and macro as conditions change.",
            }
        )

    return {
        "user_id": user_id,
        "as_of": as_of,
        "portfolio_risk_score": risk_score,
        "portfolio_risk_label": risk_label,
        "positions_count": len(positions),
        "spy_1m_return_pct": spy_1m,
        "signals": signals,
        "thresholds": {
            "risk_alert": risk_alert_threshold,
            "concentration": concentration_threshold,
        },
    }


def build_digest_message(
    payload: dict[str, Any],
    *,
    intro: str | None = None,
) -> tuple[str, str]:
    """Returns (subject, plain_body)."""
    uid = str(payload.get("user_id") or "")
    lines = [
        intro or "FinSight risk & signals digest",
        f"Date: {payload.get('as_of') or date.today().isoformat()}",
        "",
    ]
    pr = payload.get("portfolio_risk_score")
    pl = payload.get("portfolio_risk_label")
    if pr is not None:
        lines.append(f"Portfolio risk: {pr}/10 ({pl})")
    lines.append(f"Holdings counted: {payload.get('positions_count', 0)}")
    spy = payload.get("spy_1m_return_pct")
    if spy is not None:
        lines.append(f"SPY ~30d return: {spy:+.2f}%")
    lines.append("")
    lines.append("Signals:")
    for s in payload.get("signals") or []:
        lines.append(f"• [{s.get('severity')}] {s.get('title')}")
        if s.get("detail"):
            lines.append(f"  {s.get('detail')}")
    lines.append("")
    lines.append("Educational / research framing only — not investment advice.")
    body = "\n".join(lines)
    subj = f"FinSight digest — risk {pr if pr is not None else '—'} ({date.today().isoformat()})"
    return subj, body
