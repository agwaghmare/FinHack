"""Hackathon AI helpers: portfolio analysis, news summary, strategy, crash context."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from backend.services.holdings_service import snapshot
from backend.services.market_service import get_stock_fundamentals
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
    
    # Import and run our ML risk score
    from backend.services.portfolio_service import analyze_portfolio
    risk_data = analyze_portfolio(user_id)

    prompt = f"""You are a portfolio analyst focused on financial education and research support (not personalized investment advice).
Summarize risks, diversification, and 3 practical learning bullets for a retail investor. Avoid buy/sell commands.
Paper / sandbox portfolio JSON: {p}
Real holdings snapshot JSON: {json.dumps(h, default=str)[:5000]}
ML Risk Analysis: {json.dumps(risk_data, default=str)}
The portfolio has an overall risk score of {risk_data['risk_score']}/100 ({risk_data['risk_label']} risk).
Reference specific position risk scores and beta/volatility in your analysis.
If holdings exist, include concentration risk and a simple VaR-style intuition (e.g., what a -2% to -3% day could imply in dollars).
Keep under 200 words."""

    return {
        "user_id": user_id,
        "analysis": _run(prompt),
        "risk_score": risk_data["risk_score"],
        "risk_label": risk_data["risk_label"],
        "positions": risk_data["positions"],
    }


# def news_summary(user_id: str | None = None) -> dict[str, Any]:
#     h = snapshot(user_id or "") if user_id else None
#     held = [str(p.get("symbol") or "").upper() for p in (h or {}).get("positions") or [] if p.get("symbol")]
#     symbol = ",".join(held[:5]) if held else "SPY"
#     n = get_news_sentiment(symbol, limit=20)
#     prompt = f"""Summarize market tone and top themes for a learner-investor building research habits. Reference sentiment score {n.get('avg_sentiment')}.
# Headlines sample: {[a.get('title') for a in (n.get('articles') or [])[:8]]}
# Held symbols focus: {held[:8] if held else ['SPY']}
# If any held symbol appears in the headlines, call out that stock-specific risk in plain language.
# No trade recommendations. Under 180 words."""
#     return {"summary": _run(prompt), "avg_sentiment": n.get("avg_sentiment")}



def strategy_suggestions(user_id: str) -> dict[str, Any]:
    from backend.services.regime_service import detect_regime
    from backend.services.portfolio_service import analyze_portfolio

    h = snapshot(user_id)
    held = [str(p.get("symbol") or "").upper() for p in (h or {}).get("positions") or [] if p.get("symbol")]
    
    # Get regime and risk data
    regime_data = detect_regime()
    risk_data = analyze_portfolio(user_id)

    regime = regime_data.get("regime", "Unknown")
    confidence_pct = regime_data.get("confidence_pct", 0)
    narrative = regime_data.get("narrative", "")
    fed_rate = regime_data.get("fed_rate")
    cpi = regime_data.get("cpi")
    unemployment = regime_data.get("unemployment")
    pce = regime_data.get("pce")
    regime_last_30d = regime_data.get("regime_last_30d", {})
    risk_score = risk_data.get("risk_score", 0)
    risk_label = risk_data.get("risk_label", "Unknown")
    positions = risk_data.get("positions", [])

    key = os.getenv("MISTRAL_API_KEY")
    suggestions = None

    if key:
        try:
            import httpx
            prompt = f"""You are a risk-aware portfolio strategist advising a retail investor. Be direct and specific.

Market Regime: {regime} (confidence: {confidence_pct}%)
Regime context: {narrative}
Regime last 30 days: {regime_last_30d}

Macro environment:
- Fed Funds Rate: {fed_rate}%
- CPI: {cpi}
- Unemployment: {unemployment}%
- PCE: {pce}

Portfolio:
- Holdings: {held}
- Overall risk score: {risk_score}/10 ({risk_label})
- Position breakdown: {json.dumps(positions, default=str)[:1500]}

Given this {regime} regime with {risk_label} portfolio risk, provide exactly 3 specific strategy suggestions.
Each suggestion should reference the regime, the macro data, and specific holdings where relevant.
Format as 3 numbered points. Be direct. Under 200 words. No disclaimers."""

            response = httpx.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 400,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            suggestions = response.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Mistral strategy suggestions failed: %s", e)

    # Fall back to existing pipeline
    if not suggestions:
        suggestions = _run(f"""Given these holdings {held} in a {regime} market regime with {risk_label} risk score ({risk_score}/10), suggest 3 risk-aware strategy adjustments. Reference the regime and macro context: Fed {fed_rate}%, CPI {cpi}, Unemployment {unemployment}%. Bullet format. Under 150 words.""")

    return {
        "user_id": user_id,
        "suggestions": suggestions,
        "regime": regime,
        "confidence_pct": confidence_pct,
        "narrative": narrative,
        "regime_last_30d": regime_last_30d,
        "fed_rate": fed_rate,
        "cpi": cpi,
        "unemployment": unemployment,
        "pce": pce,
        "risk_score": risk_score,
        "risk_label": risk_label,
    }

def news_summary(user_id: str | None = None) -> dict[str, Any]:
    h = snapshot(user_id or "") if user_id else None
    held = [str(p.get("symbol") or "").upper() for p in (h or {}).get("positions") or [] if p.get("symbol")]
    symbol = ",".join(held[:5]) if held else "SPY"
    n = get_news_sentiment(symbol, limit=20)
    headlines = [a.get("title") for a in (n.get("articles") or [])[:12] if a.get("title")]
    avg_sentiment = n.get("avg_sentiment", 0)

    sector_map = {
        "AAPL": "technology", "MSFT": "technology", "NVDA": "semiconductors",
        "GOOGL": "technology", "META": "technology", "AMZN": "consumer/cloud",
        "TSLA": "EV/energy", "JPM": "financials", "BAC": "financials",
        "GS": "financials", "XOM": "energy", "CVX": "energy",
        "JNJ": "healthcare", "UNH": "healthcare", "GH": "healthcare",
    }
    held_with_sectors = [f"{s} ({sector_map.get(s, 'equity')})" for s in held[:6]]

    sentiment_label = (
        "moderately bullish" if avg_sentiment > 0.2 else
        "moderately bearish" if avg_sentiment < -0.2 else
        "neutral"
    )

    prompt = f"""You are a sharp market analyst writing for a retail investor. Be direct and confident.

Current portfolio holdings: {held_with_sectors if held_with_sectors else ["SPY (broad market)"]}
Overall news sentiment: {sentiment_label} (score: {avg_sentiment})

Latest headlines:
{chr(10).join(f"- {hl}" for hl in headlines)}

Write a news sentiment summary with exactly these four sections:

1. TOP THEMES: Identify 3-4 dominant market themes from these headlines (e.g. rates, earnings, AI, energy). Be specific.

2. SENTIMENT BALANCE: Describe the bullish vs bearish balance with confident analyst language. Reference the sentiment score.

3. MACRO IMPACT: Plain-English impact on growth, rates, and volatility expectations based on these headlines.

4. SO WHAT: For each holding in the portfolio, write one sentence tying the headlines to that specific sector/stock. Be direct.

Keep total response under 220 words. No disclaimers."""

    # Try Mistral first
    mistral_key = os.getenv("MISTRAL_API_KEY")
    summary = None

    if mistral_key:
        try:
            import httpx
            response = httpx.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {mistral_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1024,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            summary = data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Mistral news summary failed: %s", e)

    # Fall back to existing Gemini/OpenAI pipeline
    if not summary:
        summary = _run(prompt)

    return {
        "summary": summary,
        "avg_sentiment": avg_sentiment,
        "sentiment_label": sentiment_label,
        "holdings_analyzed": held[:6],
    }

def _paper_lab_fundamentals_blob(symbols: list[str], *, max_symbols: int = 5) -> str:
    """Compact yfinance slices for Mistral context (best-effort)."""
    chunks: list[str] = []
    for sym in symbols[:max_symbols]:
        sym = sym.upper().strip()
        if not sym:
            continue
        try:
            f = get_stock_fundamentals(sym)
            if f.get("error"):
                chunks.append(json.dumps({"symbol": sym, "note": "fundamentals_unavailable", "error": f.get("error")}))
                continue
            chunks.append(
                json.dumps(
                    {
                        "symbol": f.get("symbol"),
                        "name": f.get("long_name"),
                        "sector": f.get("sector"),
                        "industry": f.get("industry"),
                        "summary": f.get("summary"),
                        "trailing_pe": f.get("trailing_pe"),
                        "forward_pe": f.get("forward_pe"),
                        "trailing_eps": f.get("trailing_eps"),
                        "profit_margins": f.get("profit_margins"),
                        "market_cap": f.get("market_cap"),
                    },
                    default=str,
                )
            )
        except Exception as e:
            logger.debug("paper lab fundamentals %s: %s", sym, e)
            chunks.append(json.dumps({"symbol": sym, "note": "fetch_failed"}))
    return "\n".join(chunks) if chunks else "(no symbols to look up)"


def trade_feedback(user_id: str) -> dict[str, Any]:
    """Paper Lab coaching via Mistral + public fundamentals (simulation only; not real-money advice)."""
    p = get_portfolio(user_id)
    positions = p.get("positions") or []
    trades = p.get("trades") or []
    syms = list(
        dict.fromkeys(
            str(x.get("symbol") or "").upper().strip()
            for x in positions
            if x.get("symbol")
        )
    )
    fund_blob = _paper_lab_fundamentals_blob(syms)

    system = """You are **Mistral Paper Lab** — analyst for a **simulated** trading sandbox only.

Voice: sound like a research desk briefing: clear, direct, a bit upbeat when metrics support it. You may say a company **appears** in reasonable financial shape or **looks** stretched **based only on the numbers provided** — e.g. margins, P/E context, scale — and suggest **paper-portfolio** follow-ups (deeper read, compare a peer, set a rule in the sim).

Hard rules:
- Do **not** tell the user to buy, sell, or hold real securities; no price targets or guarantees.
- Do **not** invent filings or numbers: only use the portfolio JSON and fundamentals lines; if data is missing, say so.
- End with one short line that this is educational simulation output, not personalized investment advice."""

    user_block = f"""## Sandbox portfolio (JSON)
{json.dumps(p, default=str)[:4500]}

## Recent trade count
{len(trades)} round-trip events in history (buy/sell rows above).

## Public fundamentals snapshot (yfinance; incomplete OK)
{fund_blob[:6500]}

## Write the feedback with these sections (markdown headings OK)

1. **Simulation activity** — How active they've been, which tickers, concentration vs cash (cite figures).

2. **Names & financial picture** — For each held symbol, a short paragraph: is the business **profile** (from summary/sector) sensible for a learner holding? Do trailing P/E, margins, or scale **suggest** generally healthy vs speculative positioning — **only** from the data given. If thin data, say what you'd check next in real research.

3. **Suggested paper-lab moves** — 2–4 bullets framed as **simulation** ideas (e.g. add a defensive sleeve in the sandbox, cap single-name size, write a one-line thesis before the next paper trade). Wording can include phrases like ""interesting candidate to track in the paper book"" — not an order to invest real capital.

4. **Quick analytics** — Bullets: approximate % of equity in top holding, number of positions, trades per symbol if obvious, cash runway tone.

Keep total under ~320 words unless data is very rich."""

    text, err = _mistral_chat(user_block, system=system)
    if text:
        return {"user_id": user_id, "feedback": text, "provider": "mistral"}
    if err == "__NO_KEY__":
        return {
            "user_id": user_id,
            "feedback": (
                "Mistral Paper Lab needs Mistral AI. "
                f"{_MISTRAL_KEY_HINT}"
            ),
            "provider": "mistral",
        }
    return {
        "user_id": user_id,
        "feedback": (
            f"Mistral Paper Lab could not reach the API ({err}). "
            "Check MISTRAL_API_KEY and MISTRAL_MODEL, then restart the server."
        ),
        "provider": "mistral",
    }


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
