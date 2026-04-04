from __future__ import annotations

from backend.services.ai_extended_service import _run


def generate_insight(data: dict):
    prompt = f"""
    Analyze this financial data and explain risk:

    {data}
    """
    text = _run(prompt)
    return {"insight": text}


def _demo_explain(ctx: dict) -> dict[str, str]:
    """Template layer when GEMINI_API_KEY is missing."""
    kind = str(ctx.get("kind") or "generic")
    label = str(ctx.get("label") or "this metric")
    value = str(ctx.get("value") or "")
    sym = str(ctx.get("symbol") or "").upper()
    user_note = str(ctx.get("user_note") or "").strip()

    if kind == "macro":
        return {
            "what_it_is": (
                f"{label} is a macro indicator professional investors watch alongside earnings and positioning."
            ),
            "why_it_moves": (
                f"It moves when growth, inflation, or policy expectations shift. The reading {value or 'you see'} "
                "reflects the latest statistical print or market-implied path."
            ),
            "what_it_means_for_you": (
                "It helps frame whether assets are discounting a hard landing, soft landing, or reflation. "
                + (user_note or "Compare it to your time horizon: short-term traders react to surprises; long-term holders care about trends.")
            ),
        }

    if kind == "quote":
        return {
            "what_it_is": f"{sym or label} is a traded instrument; the price is where buyers and sellers last met.",
            "why_it_moves": (
                f"Day-to-day moves blend news, rates, sector flows, and options positioning. "
                f"The change shown ({value}) is one session’s snapshot — not the whole thesis."
            ),
            "what_it_means_for_you": (
                "Size positions against your risk budget. If this name is a large slice of your portfolio, "
                "a small % swing is a large dollar swing — that is concentration risk, not ‘being wrong’."
                + (f" {user_note}" if user_note else "")
            ),
        }

    if kind == "chart":
        return {
            "what_it_is": "Each candle summarizes one period: open, high, low, and close. Bodies show conviction; wicks show rejection levels.",
            "why_it_moves": (
                f"The chart does not move markets — it visualizes auction results. "
                f"Trends often continue until a major narrative (earnings, macro, liquidity) breaks the pattern."
            ),
            "what_it_means_for_you": (
                "Use the chart to mark levels you care about for risk management, not to predict every tick. "
                + (user_note or "")
            ),
        }

    if kind == "commodity":
        return {
            "what_it_is": f"{label} is a commodity or commodity-linked exposure; prices clear supply and demand at the margin.",
            "why_it_moves": (
                f"Inventory, weather, FX (USD), freight, and cross-markets like energy↔biofuel can all matter. "
                f"Reading: {value}."
            ),
            "what_it_means_for_you": (
                "Commodities can diversify a stock-heavy book but come with futures curve and volatility quirks. "
                + (user_note or "")
            ),
        }

    if kind == "fx":
        return {
            "what_it_is": f"{label} compares two currencies; you are expressing a view on relative policy and growth.",
            "why_it_moves": "Rate differentials, risk appetite, and intervention headlines dominate short-run FX.",
            "what_it_means_for_you": (
                f"A stronger domestic currency can soften inflation from imports but hurt exporters — sector impacts vary. "
                f"{user_note}"
            ),
        }

    if kind == "chain":
        return {
            "what_it_is": "A chain reaction links multiple markets (e.g. oil, ethanol, row crops) through real economic channels.",
            "why_it_moves": (
                "Markets rarely move one ‘because’ at a time; second-order effects often show up a few links down the chain."
            ),
            "what_it_means_for_you": (
                "Explaining the chain builds intuition for hedges and diversifiers — e.g. energy vs ag vs rate-sensitive tech."
                + (user_note or "")
            ),
        }

    return {
        "what_it_is": f"{label} is a data point in your dashboard.",
        "why_it_moves": "It updates as new trades, news, or model inputs arrive.",
        "what_it_means_for_you": "Ask how sensitive your portfolio is to this factor before acting." + (f" {user_note}" if user_note else ""),
    }


def explain_why_matters(body: dict | None) -> dict:
    """‘Why this matters’ — structured explainability."""
    ctx = (body or {}).get("context") if isinstance(body, dict) else None
    if not isinstance(ctx, dict):
        ctx = {}

    prompt = f"""You help retail investors understand markets. No buy/sell instructions.
Use exactly these headings in plain English (2–4 sentences each):

WHAT IT IS:
WHY IT MOVES (OR WHY READINGS CHANGE):
WHAT IT MEANS FOR YOU (risk lens, not advice):

Context JSON: {ctx}
"""
    text = _run(prompt).strip()
    if text:
        return {"mode": "live", "explanation": text}

    d = _demo_explain(ctx)
    return {"mode": "demo_fallback", **d}
