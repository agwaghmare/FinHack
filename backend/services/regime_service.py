"""Market regime detection using HMM + rules-based classifier cross-check."""

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
        return None if (f != f) else f
    except Exception:
        return None


def _fetch_spy_and_vix() -> tuple:
    start = datetime(2005, 1, 1)
    end = datetime.today()
    spy = yf.Ticker("SPY").history(start=start, end=end)["Close"].pct_change().dropna()
    vix = yf.Ticker("^VIX").history(start=start, end=end)["Close"].dropna()
    spy, vix = spy.align(vix, join="inner")
    return spy.values, vix.values


def _rules_classifier(
    avg_return: float,
    recent_return: float,
    avg_vix: float,
    fed_rate: float,
    unemployment: float,
) -> tuple[str, float]:
    """Rule-based regime classification using market data."""
    bull_score = 0
    bear_score = 0

    # SPY returns
    if avg_return > 0.03:
        bull_score += 2
    elif avg_return < -0.03:
        bear_score += 2

    if recent_return > 0.05:
        bull_score += 2
    elif recent_return < -0.05:
        bear_score += 2

    # VIX — high VIX = fear = bearish
    if avg_vix < 18:
        bull_score += 1
    elif avg_vix > 25:
        bear_score += 2
    elif avg_vix > 20:
        bear_score += 1

    # Fed rate — high rates = tighter = bearish
    if fed_rate > 4.5:
        bear_score += 1
    elif fed_rate < 2.0:
        bull_score += 1

    # Unemployment — high unemployment = bearish
    if unemployment > 5.5:
        bear_score += 1
    elif unemployment < 4.0:
        bull_score += 1

    total = bull_score + bear_score
    if bull_score > bear_score + 1:
        regime = "Bull"
        confidence = min(0.5 + (bull_score / max(total, 1)) * 0.5, 0.95)
    elif bear_score > bull_score + 1:
        regime = "Bear"
        confidence = min(0.5 + (bear_score / max(total, 1)) * 0.5, 0.95)
    else:
        regime = "Sideways"
        confidence = 0.6

    return regime, round(confidence * 100, 1)


def _hmm_classifier(spy_returns: np.ndarray, vix_levels: np.ndarray) -> tuple[str, float]:
    """HMM-based regime classification."""
    try:
        from hmmlearn.hmm import GaussianHMM

        vix_norm = (vix_levels - vix_levels.mean()) / (vix_levels.std() + 1e-8)
        X = np.column_stack([spy_returns, vix_norm])

        model = GaussianHMM(
            n_components=3,
            covariance_type="full",
            n_iter=200,
            random_state=42,
        )
        model.fit(X)

        hidden_states = model.predict(X)
        current_state = int(hidden_states[-1])

        # Label states by mean SPY return
        state_means = {}
        for s in range(3):
            mask = hidden_states == s
            state_means[s] = float(spy_returns[mask].mean()) if mask.sum() > 0 else 0.0

        sorted_states = sorted(state_means.keys(), key=lambda s: state_means[s])
        labels = {
            sorted_states[0]: "Bear",
            sorted_states[1]: "Sideways",
            sorted_states[2]: "Bull",
        }

        regime = labels[current_state]
        proba = model.predict_proba(X)
        confidence = float(proba[-1][current_state]) * 100

        return regime, round(confidence, 1)
    except Exception as e:
        logger.warning("HMM classification failed: %s", e)
        return "Unknown", 0.0


def _combine_regimes(
    hmm_regime: str,
    hmm_confidence: float,
    rules_regime: str,
    rules_confidence: float,
) -> tuple[str, float]:
    """Cross-check HMM and rules-based regimes.
    If they agree, boost confidence. If they disagree, use HMM but lower confidence."""
    if hmm_regime == rules_regime:
        # Both agree — boost confidence
        combined_confidence = min((hmm_confidence + rules_confidence) / 2 * 1.15, 95.0)
        return hmm_regime, round(combined_confidence, 1)
    elif hmm_regime != "Unknown":
        # Disagreement — trust HMM but reduce confidence
        combined_confidence = hmm_confidence * 0.75
        return hmm_regime, round(combined_confidence, 1)
    else:
        # HMM failed — fall back to rules
        return rules_regime, rules_confidence


def detect_regime() -> dict:
    spy_returns, vix_levels = _fetch_spy_and_vix()

    # Sanitize
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

    # Run both classifiers
    hmm_regime, hmm_confidence = _hmm_classifier(spy_returns, vix_levels)
    rules_regime, rules_confidence = _rules_classifier(
        avg_return=avg_return,
        recent_return=recent_return,
        avg_vix=avg_vix,
        fed_rate=fed_rate,
        unemployment=unemployment,
    )

    # Cross-check and combine
    regime, confidence_pct = _combine_regimes(
        hmm_regime, hmm_confidence,
        rules_regime, rules_confidence,
    )

    # Get Mistral narrative
    key = os.getenv("MISTRAL_API_KEY")
    narrative = ""
    regime_last_30d: dict = {}

    prompt = f"""You are a macro strategist. The market regime has been classified as {regime} with {confidence_pct}% confidence using a Hidden Markov Model cross-checked with a rules-based classifier.

Data:
- SPY avg daily return (1yr): {avg_return:.4f}%
- SPY avg daily return (30d): {recent_return:.4f}%
- Avg VIX (1yr): {avg_vix:.1f}
- Fed Funds Rate: {fed_rate}%
- CPI: {cpi}
- Unemployment: {unemployment}%
- PCE: {pce}
- HMM regime: {hmm_regime} ({hmm_confidence}%)
- Rules regime: {rules_regime} ({rules_confidence}%)

Respond in JSON only, no markdown:
{{
  "narrative": "<2 sentences explaining what this {regime} regime means for a retail investor right now>",
  "regime_last_30d": {{"Bull": <estimated days>, "Bear": <estimated days>, "Sideways": <estimated days>}}
}}"""

    if key:
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
                    "max_tokens": 200,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            result = json.loads(content)
            narrative = result.get("narrative", "")
            regime_last_30d = result.get("regime_last_30d", {})
        except Exception as e:
            logger.warning("Mistral regime narrative failed: %s", e)

    return {
        "regime": regime,
        "confidence_pct": confidence_pct,
        "narrative": narrative,
        "hmm_regime": hmm_regime,
        "hmm_confidence": hmm_confidence,
        "rules_regime": rules_regime,
        "rules_confidence": rules_confidence,
        "avg_vix": _safe(round(avg_vix, 1)),
        "fed_rate": _safe(fed_rate),
        "cpi": _safe(cpi),
        "unemployment": _safe(unemployment),
        "pce": _safe(pce),
        "regime_last_30d": regime_last_30d,
    }