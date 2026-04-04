"""Hackathon AI helpers: portfolio analysis, news summary, strategy, crash context."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from backend.services.holdings_service import snapshot
from backend.services.news_service import get_news_sentiment
from backend.services.sandbox_store import get_portfolio
from backend.utils.env_keys import mistral_key, openai_key

logger = logging.getLogger(__name__)

DEMO_REPLY = (
    "Demo mode: set GEMINI_API_KEY or OPENAI_API_KEY for live summaries. "
    "This is placeholder insight text for the hackathon UI."
)
_ENV_KEY_HINT = (
    "Set GEMINI_API_KEY and/or OPENAI_API_KEY in the API .env (repo root, next to app.py) and restart uvicorn."
)
_MISTRAL_KEY_HINT = (
    "Set MISTRAL_API_KEY in the API .env (repo root, next to app.py) and restart uvicorn. "
    "Optional: MISTRAL_MODEL=mistral-small-latest (or another Mistral chat model)."
)


def _mistral_error_detail(r: Any) -> str:
    """Best-effort parse of Mistral error JSON (avoid logging secrets)."""
    try:
        j = r.json()
        if isinstance(j, dict):
            d = j.get("detail") or j.get("message") or j.get("error")
            if isinstance(d, dict):
                d = d.get("message") or str(d)
            if d:
                return str(d)[:400]
    except Exception:
        pass
    try:
        return (r.text or "")[:400]
    except Exception:
        return "unknown error"


def _mistral_chat(prompt: str, *, system: str | None = None) -> tuple[str | None, str | None]:
    """
    Mistral Chat API for Learn tutor and holdings coach.

    Returns (assistant_text, error_message). On success error_message is None.
    If ``error_message`` is ``__NO_KEY__``, MISTRAL_API_KEY is missing.
    """
    key = mistral_key()
    if not key:
        return None, "__NO_KEY__"
    model = (os.getenv("MISTRAL_MODEL") or "mistral-small-latest").strip() or "mistral-small-latest"
    messages: list[dict[str, str]] = []
    sys_s = (system or "").strip()
    if sys_s:
        messages.append({"role": "system", "content": sys_s})
    messages.append({"role": "user", "content": (prompt or "").strip()})
    if not messages[-1]["content"]:
        return None, "empty user message"
    import httpx

    try:
        r = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.3,
            },
            timeout=90.0,
        )
        if r.status_code >= 400:
            detail = _mistral_error_detail(r)
            logger.warning("Mistral chat HTTP %s: %s", r.status_code, detail)
            return None, f"HTTP {r.status_code} — {detail}"
        data = r.json()
        ch = data.get("choices") or []
        if ch and isinstance(ch[0], dict):
            c0 = ch[0].get("message") or {}
            t = (c0.get("content") or "").strip()
            if t:
                return t, None
        return None, "empty or unexpected response from Mistral"
    except httpx.HTTPStatusError as e:
        detail = _mistral_error_detail(e.response)
        logger.warning("Mistral chat HTTPStatusError: %s", detail)
        return None, f"HTTP {e.response.status_code} — {detail}"
    except Exception as e:
        logger.warning("Mistral chat completion failed: %s", e)
        return None, f"{type(e).__name__}: {e!s}"[:400]


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
    text, err = _mistral_chat(prompt)
    if text:
        return text

    o = _openai_complete(prompt)
    if o:
        return o

    if err == "__NO_KEY__":
        return (
            "AI is not configured. Set MISTRAL_API_KEY (preferred) or OPENAI_API_KEY "
            "in the API .env (repo root, next to app.py), then restart the server."
        )
    if err:
        return f"Mistral unavailable ({err}). {DEMO_REPLY}"
    return DEMO_REPLY


def _run_mistral_holdings(prompt: str) -> str:
    """Holdings coach: Mistral AI only."""
    text, err = _mistral_chat(prompt)
    if text:
        return text
    if err == "__NO_KEY__":
        return f"Holdings coach uses Mistral AI. {_MISTRAL_KEY_HINT}"
    return (
        f"Holdings coach could not reach Mistral ({err}). "
        "401 Unauthorized usually means the key is wrong, revoked, or for a different workspace — create a new key in "
        "the Mistral console and paste it as MISTRAL_API_KEY in the repo root .env, then restart uvicorn. "
        f"If the model name is wrong, set MISTRAL_MODEL (e.g. mistral-small-latest). {_MISTRAL_KEY_HINT}"
    )


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
    # Paper/sandbox AI feedback should remain Gemini-driven.
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
    text, err = _mistral_chat(user_block, system=system)
    if text:
        return {"reply": text}
    if err == "__NO_KEY__":
        return {"reply": f"Learn tutor uses Mistral AI. {_MISTRAL_KEY_HINT}"}
    return {
        "reply": (
            f"Learn tutor Mistral error ({err}). "
            "401 = invalid or expired API key — generate a new key in the Mistral dashboard and update MISTRAL_API_KEY. "
            f"{_MISTRAL_KEY_HINT}"
        )
    }


def real_holdings_coach(user_id: str) -> dict[str, Any]:
    from backend.services.holdings_service import snapshot

    s = snapshot(user_id)
    blob = json.dumps(s, default=str)[:7000]
    prompt = f"""You help retail users with investment literacy and portfolio self-assessment — not regulated personalized advice.

Real holdings snapshot (JSON): {blob}

If positions is empty: three short bullets on goals, risk tolerance, and building a first research habit.
If positions exist: (1) plain-language concentration/diversification read, (2) two research questions to explore next, (3) one risk or cost reminder. No buy/sell orders. Under 230 words."""
    return {"user_id": user_id, "coaching": _run_mistral_holdings(prompt)}
