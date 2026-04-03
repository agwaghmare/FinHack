"""Cross-asset / chain-reaction narratives — deterministic + optional Gemini polish."""

from __future__ import annotations

import logging
from typing import Any

from backend.services.market_service import get_market_prices
from backend.utils.env_keys import gemini_key

logger = logging.getLogger(__name__)

# Canonical storylines for hackathon demo (judges / education).
CHAIN_LIBRARY = [
    {
        "id": "oil-ethanol-ag",
        "title": "Oil ↔ ethanol ↔ row crops",
        "when": "Energy prices swing or biofuel policy dominates headlines.",
        "links": [
            {"from": "Crude oil", "direction": "↓", "to": "Ethanol economics", "note": "Cheaper oil can weaken ethanol blending margins."},
            {"from": "Ethanol economics", "direction": "→", "to": "Corn & soy demand", "note": "Ethanol uses corn; soy oil competes in biofuel complexes."},
            {"from": "Fertilizer / input costs", "direction": "→", "to": "Soy & corn yields", "note": "Nutrient constraints can tighten supply even when demand is steady."},
        ],
        "plain": (
            "When oil falls, ethanol plants can face tougher economics, which can feed back into corn demand. "
            "Meanwhile fertilizer and logistics still matter for soybean supply — so you can see oil ↓, ethanol ↑ "
            "logic, and soybean ↑ from a separate supply channel, all showing up at once."
        ),
    },
    {
        "id": "rates-usd-commodities",
        "title": "Rates ↔ USD ↔ commodities",
        "when": "Fed guidance or CPI surprises move the dollar.",
        "links": [
            {"from": "Real yields / Fed path", "direction": "→", "to": "U.S. dollar", "note": "Higher real rates often support USD."},
            {"from": "U.S. dollar", "direction": "→", "to": "USD-priced commodities", "note": "A stronger dollar can weigh on gold, oil, ags quoted in USD."},
            {"from": "Growth scare", "direction": "→", "to": "Industrial metals", "note": "Copper and energy often reprice growth expectations."},
        ],
        "plain": (
            "Fix income and FX are the fast transmission belt into commodity futures: dollar up often dampens "
            "commodities even when micro supply stories (weather, OPEC) are bullish."
        ),
    },
]


def _safe_pct(q: dict[str, Any]) -> float | None:
    try:
        return float(str(q.get("change_percent") or "").replace("%", "").strip() or "nan")
    except Exception:
        return None


def get_cross_asset_snapshot() -> dict[str, Any]:
    """Live mini snapshot: Movers on key cross-market symbols + chain templates."""
    symbols = ["WTI", "USO", "DBA", "GLD", "SPY", "EURUSD", "USDJPY"]
    quotes_resp = get_market_prices(symbols)
    quotes = quotes_resp.get("quotes") or []

    snap: list[dict[str, Any]] = []
    for q in quotes:
        sym = str(q.get("symbol") or "")
        px = q.get("price")
        pct = _safe_pct(q)
        snap.append(
            {
                "symbol": sym,
                "kind": q.get("kind"),
                "price": px,
                "change_percent": q.get("change_percent"),
                "change_pct_num": pct,
                "error": q.get("error"),
            }
        )

    wti = next((x for x in snap if x["symbol"] == "WTI"), None)
    dba = next((x for x in snap if x["symbol"] == "DBA"), None)
    headline = "Cross-asset snapshot: watch energy, ag baskets, and USD rates together."
    if wti and dba and wti.get("change_pct_num") is not None and dba.get("change_pct_num") is not None:
        wo = float(wti["change_pct_num"])
        ag = float(dba["change_pct_num"])
        if wo < -0.5 and ag > 0.3:
            headline = (
                f"Tape hint: WTI {wo:+.1f}% while ag basket {ag:+.1f}% — fits the chain where oil softness "
                "and ag fundamentals don’t move in lockstep."
            )
        elif wo > 0.5 and ag < -0.3:
            headline = (
                f"Tape hint: energy up {wo:+.1f}% but ag {ag:+.1f}% — often worth splitting ‘fuel’ vs ‘food’ channels."
            )

    return {
        "quotes": snap,
        "chains": CHAIN_LIBRARY,
        "headline": headline,
    }


def polish_cross_asset(snapshot: dict[str, Any]) -> dict[str, Any]:
    if not gemini_key() or gemini_key() == "YOUR_KEY":
        return snapshot
    try:
        from backend.services.ai_service import generate_insight

        r = generate_insight(
            {
                "task": "cross_asset_chain",
                "instruction": (
                    "In 3 short sentences, connect oil, ethanol/ag, USD, and rates for a retail investor. "
                    "No investment advice; educational only."
                ),
                "snapshot": snapshot,
            }
        )
        text = (r.get("insight") or "").strip()
        if text:
            out = dict(snapshot)
            out["ai_narrative"] = text[:1200]
            return out
    except Exception as e:
        logger.warning("cross-asset polish failed: %s", e)
    return snapshot
