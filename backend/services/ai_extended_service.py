"""Hackathon AI helpers: portfolio analysis, news summary, strategy, crash context."""

from __future__ import annotations

import logging
import os
from typing import Any

from google.genai import Client

from backend.services.news_service import get_news_sentiment
from backend.services.sandbox_store import get_portfolio
from backend.utils.env_keys import gemini_key, openai_key

logger = logging.getLogger(__name__)

DEMO_REPLY = (
    "Demo mode: set GEMINI_API_KEY or OPENAI_API_KEY for live summaries. "
    "This is placeholder insight text for the hackathon UI."
)

# Omit *-latest aliases — they often 404 on v1beta. Override with GEMINI_MODEL_FALLBACKS=comma,separated
def _gemini_model_list() -> tuple[str, ...]:
    raw = os.getenv("GEMINI_MODEL_FALLBACKS", "").strip()
    if raw:
        return tuple(m.strip() for m in raw.split(",") if m.strip())
    # Avoid gemini-1.5-* — many API keys only expose 2.x models on v1beta.
    return (
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
    )


def _client():
    key = gemini_key() or "YOUR_KEY"
    return Client(api_key=key)


def _openai_complete(prompt: str) -> str | None:
    key = openai_key()
    if not key:
        return None
    try:
        import httpx

        r = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1024,
            },
            timeout=60.0,
        )
        r.raise_for_status()
        data = r.json()
        ch = data.get("choices") or []
        if ch and isinstance(ch[0], dict):
            c0 = ch[0].get("message") or {}
            t = (c0.get("content") or "").strip()
            if t:
                return t
    except Exception as e:
        logger.warning("OpenAI completion failed: %s", e)
    return None


def _run(prompt: str) -> str:
    if not gemini_key() and not openai_key():
        return DEMO_REPLY

    if gemini_key():
        try:
            c = _client()
            last_err: Exception | None = None
            for model in _gemini_model_list():
                try:
                    r = c.models.generate_content(model=model, contents=prompt)
                    text = (r.text or "").strip()
                    if text:
                        return text
                except Exception as e:
                    last_err = e
                    logger.warning("Gemini model %s failed: %s", model, e)
                    continue
            fb = _openai_complete(prompt)
            if fb:
                return fb
            if last_err:
                logger.exception("Gemini generate failed after model fallbacks")
                return (
                    "AI request failed for all Gemini models; OpenAI fallback also failed. "
                    "Confirm GEMINI_API_KEY / GOOGLE_API_KEY and optionally OPENAI_API_KEY. Raw error: "
                    f"{type(last_err).__name__}: {last_err!s}"[:400]
                )
            return "AI returned an empty response. Try again or check API quotas."
        except Exception as e:
            logger.exception("Gemini client error")
            fb = _openai_complete(prompt)
            if fb:
                return fb
            return (
                "AI temporarily unavailable. Check GEMINI_API_KEY / GOOGLE_API_KEY / OPENAI_API_KEY. "
                f"({type(e).__name__}: {e!s})"[:500]
            )

    o = _openai_complete(prompt)
    return o if o else DEMO_REPLY


def portfolio_analysis(user_id: str) -> dict[str, Any]:
    p = get_portfolio(user_id)
    prompt = f"""You are a portfolio analyst. Summarize risks, diversification, and 3 actionable bullets.
Portfolio JSON: {p}
Keep under 200 words."""
    return {"user_id": user_id, "analysis": _run(prompt)}


def news_summary() -> dict[str, Any]:
    n = get_news_sentiment("SPY", limit=20)
    prompt = f"""Summarize market tone and top themes for a trader. Reference sentiment score {n.get('avg_sentiment')}.
Headlines sample: {[a.get('title') for a in (n.get('articles') or [])[:8]]}
Under 180 words."""
    return {"summary": _run(prompt), "avg_sentiment": n.get("avg_sentiment")}


def strategy_suggestions(user_id: str) -> dict[str, Any]:
    p = get_portfolio(user_id)
    prompt = f"""Given this paper portfolio, suggest 3 risk-aware adjustments (sizes, hedges, or rebalancing).
{p}
Bullet format. Under 150 words."""
    return {"user_id": user_id, "suggestions": _run(prompt)}


def trade_feedback(user_id: str) -> dict[str, Any]:
    p = get_portfolio(user_id)
    prompt = f"""Review simulated trading activity: comment on frequency, concentration, and discipline.
{p}
Under 120 words."""
    return {"user_id": user_id, "feedback": _run(prompt)}


def crash_probability_narrative(score_0_1: float) -> str:
    prompt = f"""Explain in 2 sentences what a portfolio crash probability of {score_0_1:.2f} might imply for a retail investor."""
    return _run(prompt)
