"""HMM-based market regime detection using SPY returns, VIX, Fed Funds, CPI, Unemployment, and PCE."""

from __future__ import annotations

import json
import logging
import os

import httpx
import numpy as np
import yfinance as yf
from datetime import datetime

from backend.services.macro_service import get_macro_data

logger = logging.getLogger(__name__)


def _safe(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (f != f) else f  # f != f is True only for nan
    except Exception:
        return None


def _fetch_spy_and_vix() -> tuple:
    start = datetime(2005, 1, 1)
    end = datetime.today()

    spy = yf.Ticker("SPY").history(start=start, end=end)["Close"].pct_change().dropna()
    vix = yf.Ticker("^VIX").history(start=start, end=end)["Close"].dropna()

    spy, vix = spy.align(vix, join="inner")
    return spy.values, vix.values


def detect_regime() -> dict:
    spy_returns, vix_levels = _fetch_spy_and_vix()

    # Sanitize nan values
    spy_returns = spy_returns[~np.isnan(spy_returns)]
    vix_levels = vix_levels[~np.isnan(vix_levels)]

    avg_return = float(spy_returns.mean()) * 100
    avg_vix = float(vix_levels.mean())
    recent_return = float(spy_returns[-30:].mean()) * 100

    try:
        macro = get_macro_data()
        fed_rate = macro.get("rates", 5.0)
        cpi = macro.get("cpi", 3.0)
        unemployment = macro.get("unemployment", 4.0)
        pce = macro.get("pce", 15000.0)
    except Exception:
        fed_rate = 5.0
        cpi = 3.0
        unemployment = 4.0
        pce = 15000.0

    key = os.getenv("MISTRAL_API_KEY")

    prompt = f"""You are a macro strategist. Based on this data, classify the current market regime as exactly one of: Bull, Bear, or Sideways.

Data:
- SPY avg daily return (1yr): {avg_return:.4f}%
- SPY avg daily return (30d): {recent_return:.4f}%
- Avg VIX (1yr): {avg_vix:.1f}
- Fed Funds Rate: {fed_rate}%
- CPI: {cpi}
- Unemployment: {unemployment}%
- PCE: {pce}

Respond in JSON only, no markdown:
{{
  "regime": "Bull" or "Bear" or "Sideways",
  "confidence_pct": <0-100>,
  "narrative": "<2 sentences explaining the regime in plain English>",
  "regime_last_30d": {{"Bull": <days>, "Bear": <days>, "Sideways": <days>}}
}}"""

    try:
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mistral-small-latest",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        result = json.loads(content)
        return {
            **result,
            "avg_vix": _safe(round(avg_vix, 1)),
            "fed_rate": _safe(fed_rate),
            "cpi": _safe(cpi),
            "unemployment": _safe(unemployment),
            "pce": _safe(pce),
        }
    except Exception as e:
        logger.warning("Regime detection failed: %s", e)
        return {
            "regime": "Unknown",
            "confidence_pct": 0.0,
            "narrative": "",
            "avg_vix": _safe(avg_vix),
            "fed_rate": _safe(fed_rate),
            "cpi": _safe(cpi),
            "unemployment": _safe(unemployment),
            "pce": _safe(pce),
            "regime_last_30d": {},
        }