"""Hackathon AI helpers: portfolio analysis, news summary, strategy, crash context."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from backend.services.holdings_service import snapshot
from backend.services.news_service import get_news_sentiment
from backend.services.sandbox_store import get_portfolio
from backend.utils.env_keys import gemini_key, openai_key

logger = logging.getLogger(__name__)

DEMO_REPLY = (
    "Demo mode: set GEMINI_API_KEY or OPENAI_API_KEY for live summaries. "
    "This is placeholder insight text for the hackathon UI."
)
_GEMINI_COOLDOWN_UNTIL_TS = 0.0
_GEMINI_COOLDOWN_SECS = int(os.getenv("GEMINI_QUOTA_COOLDOWN_SECONDS", "120"))
_GEMINI_LAST_KEY = ""

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
    from google.genai import Client

    key = gemini_key() or "YOUR_KEY"
    return Client(api_key=key)


def _looks_like_gemini_quota_error(err: Exception) -> bool:
    s = f"{type(err).__name__}: {err!s}".upper()
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "QUOTA" in s


def _ai_failure_message(*, last_gemini_err: Exception | None, openai_key_configured: bool) -> str:
    """Clear copy for Insights / trade feedback when all providers fail."""
    lines: list[str] = []

    if last_gemini_err and _looks_like_gemini_quota_error(last_gemini_err):
        lines.append(
            "Gemini returned 429 (RESOURCE_EXHAUSTED): you have hit Google’s quota or rate limit for this API key. "
            "The key is usually fine — billing or daily free-tier limits are not. "
            "Open Google AI Studio / Cloud billing for the project that owns the key, or wait for the quota window to reset. "
            "Docs: https://ai.google.dev/gemini-api/docs/rate-limits"
        )
    elif last_gemini_err:
        lines.append(
            f"Gemini error after trying all configured models: {type(last_gemini_err).__name__}: {last_gemini_err!s}"[
                :450
            ]
        )

    if not openai_key_configured:
        lines.append(
            "OpenAI was not used: set OPENAI_API_KEY in the API .env (repo root, next to app.py) so the app can fall back when Gemini is unavailable."
        )
    else:
        lines.append(
            "OpenAI fallback was attempted but failed — verify OPENAI_API_KEY, account billing, and rate limits at https://platform.openai.com/account/billing"
        )

    return "\n\n".join(lines)


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
    global _GEMINI_COOLDOWN_UNTIL_TS, _GEMINI_LAST_KEY
    gkey = gemini_key()

    if not gkey and not openai_key():
        return (
            "AI is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY in the API .env file "
            "(repo root, next to app.py), then restart the server. "
            + DEMO_REPLY
        )

    # If the operator rotates/switches GEMINI key, clear cooldown immediately.
    if gkey and gkey != _GEMINI_LAST_KEY:
        _GEMINI_LAST_KEY = gkey
        _GEMINI_COOLDOWN_UNTIL_TS = 0.0

    now = time.time()
    use_gemini = bool(gkey) and now >= _GEMINI_COOLDOWN_UNTIL_TS
    if use_gemini:
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
                    if _looks_like_gemini_quota_error(e):
                        _GEMINI_COOLDOWN_UNTIL_TS = time.time() + max(30, _GEMINI_COOLDOWN_SECS)
                    continue
            fb = _openai_complete(prompt)
            if fb:
                return fb
            if last_err:
                logger.exception("Gemini generate failed after model fallbacks")
                if _looks_like_gemini_quota_error(last_err):
                    return (
                        "Gemini is temporarily rate-limited (quota). "
                        "OpenAI fallback is not configured, so showing a demo-style response instead. "
                        + DEMO_REPLY
                    )
                return "AI temporarily unavailable. Showing fallback guidance: " + DEMO_REPLY
            return "AI returned an empty response. Try again or check API quotas."
        except Exception as e:
            logger.exception("Gemini client error")
            if _looks_like_gemini_quota_error(e):
                _GEMINI_COOLDOWN_UNTIL_TS = time.time() + max(30, _GEMINI_COOLDOWN_SECS)
            fb = _openai_complete(prompt)
            if fb:
                return fb
            return "AI temporarily unavailable. Showing fallback guidance: " + DEMO_REPLY
    elif gkey:
        # Cooldown mode: skip Gemini calls temporarily after quota/rate-limit hit.
        fb = _openai_complete(prompt)
        if fb:
            return fb
        wait_s = max(1, int(_GEMINI_COOLDOWN_UNTIL_TS - now))
        return (
            f"Gemini quota cooldown active for ~{wait_s}s. "
            "Using fallback guidance while waiting. "
            + DEMO_REPLY
        )

    o = _openai_complete(prompt)
    return o if o else DEMO_REPLY


def portfolio_analysis(user_id: str) -> dict[str, Any]:
    p = get_portfolio(user_id)
    h = snapshot(user_id)
    prompt = f"""You are a portfolio analyst focused on financial education and research support (not personalized investment advice).
Summarize risks, diversification, and 3 practical learning bullets for a retail investor. Avoid buy/sell commands.
Paper / sandbox portfolio JSON: {p}
Real holdings snapshot JSON: {json.dumps(h, default=str)[:7000]}
If holdings exist, include concentration risk and a simple VaR-style intuition (e.g., what a -2% to -3% day could imply in dollars).
Keep under 200 words."""
    return {"user_id": user_id, "analysis": _run(prompt)}


def news_summary(user_id: str | None = None) -> dict[str, Any]:
    h = snapshot(user_id or "") if user_id else None
    held = [str(p.get("symbol") or "").upper() for p in (h or {}).get("positions") or [] if p.get("symbol")]
    symbol = ",".join(held[:5]) if held else "SPY"
    n = get_news_sentiment(symbol, limit=20)
    prompt = f"""Summarize market tone and top themes for a learner-investor building research habits. Reference sentiment score {n.get('avg_sentiment')}.
Headlines sample: {[a.get('title') for a in (n.get('articles') or [])[:8]]}
Held symbols focus: {held[:8] if held else ['SPY']}
If any held symbol appears in the headlines, call out that stock-specific risk in plain language.
No trade recommendations. Under 180 words."""
    return {"summary": _run(prompt), "avg_sentiment": n.get("avg_sentiment")}


def strategy_suggestions(user_id: str) -> dict[str, Any]:
    p = get_portfolio(user_id)
    h = snapshot(user_id)
    prompt = f"""Given this paper portfolio, suggest 3 risk-aware learning prompts (sizing concepts, hedging ideas, rebalancing discipline) — frame as education, not orders to execute.
{p}
Real holdings snapshot JSON: {json.dumps(h, default=str)[:7000]}
If one symbol is concentrated, include practical risk-mitigation examples (trim exposure, protective puts, collars, bear put spread) as educational options.
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


def learn_tutor_reply(
    module_title: str,
    module_summary: str,
    topics: list[str] | None,
    user_question: str,
) -> dict[str, Any]:
    topics_s = ", ".join(topics or [])[:500]
    system = """You are a financial literacy tutor: plain English, define jargon briefly, focus on concepts (not personalized buy/sell/hold, price targets, or tax/legal advice — say to consult a licensed professional when needed).

CRITICAL: Obey the learner's requested format and length first. Examples: "one sentence" → reply with exactly one sentence; "three bullets" → exactly three bullets; "one paragraph" → one short paragraph only.
If they do not specify length, keep the default answer short (at most 2–4 sentences or a few bullets). Only go longer if they explicitly ask for detail, depth, or examples."""
    user_block = f"""Module: {module_title}
Summary: {module_summary[:1800]}
Topics: {topics_s}

Learner question: {user_question}

If the question is unrelated to finance or this module, acknowledge briefly and steer back in one or two sentences."""
    full_prompt = f"{system}\n\n{user_block}"
    return {"reply": _run(full_prompt)}


def real_holdings_coach(user_id: str) -> dict[str, Any]:
    from backend.services.holdings_service import snapshot

    s = snapshot(user_id)
    blob = json.dumps(s, default=str)[:7000]
    prompt = f"""You help retail users with investment literacy and portfolio self-assessment — not regulated personalized advice.

Real holdings snapshot (JSON): {blob}

If positions is empty: three short bullets on goals, risk tolerance, and building a first research habit.
If positions exist: (1) plain-language concentration/diversification read, (2) two research questions to explore next, (3) one risk or cost reminder. No buy/sell orders. Under 230 words."""
    return {"user_id": user_id, "coaching": _run(prompt)}
