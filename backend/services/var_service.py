"""Daily portfolio Value-at-Risk (educational / research, not advice)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from backend.services.holdings_service import snapshot

# One-sided normal z for common confidences (left-tail)
_Z = {0.90: -1.2816, 0.95: -1.6449, 0.99: -2.3263}


def _fetch_close(symbol: str, period: str) -> pd.Series | None:
    try:
        hist = yf.Ticker(symbol).history(period=period, auto_adjust=True)
        if hist is None or hist.empty or "Close" not in hist.columns:
            return None
        s = hist["Close"].dropna()
        return s if len(s) >= 40 else None
    except Exception:
        return None


def compute_portfolio_var(user_id: str, confidence: float = 0.95, lookback: str = "1y") -> dict:
    """
    Historical + parametric VaR / CVaR from weighted daily portfolio returns.
    Uses current position market-value weights (constant-weight educational assumption).
    """
    snap = snapshot(user_id)
    positions = [
        p
        for p in snap.get("positions", [])
        if p.get("market_value") and float(p["market_value"]) > 0
    ]
    as_of = date.today().isoformat()
    generated_at = datetime.now(timezone.utc).isoformat()

    if not positions:
        return {
            "as_of": as_of,
            "generated_at": generated_at,
            "message": "Add priced holdings to compute daily VaR.",
            "portfolio_value": 0,
            "var": None,
        }

    total_mv = sum(float(p["market_value"]) for p in positions)
    weights = {str(p["symbol"]).upper(): float(p["market_value"]) / total_mv for p in positions}

    series: dict[str, pd.Series] = {}
    for sym in weights:
        s = _fetch_close(sym, lookback)
        if s is not None:
            series[sym] = s

    if len(series) < 1:
        return {
            "as_of": as_of,
            "generated_at": generated_at,
            "message": "Could not load enough price history for VaR.",
            "portfolio_value": round(total_mv, 2),
            "var": None,
            "weights": weights,
        }

    closes = pd.DataFrame(series).sort_index().ffill().dropna(how="any")
    ok = list(closes.columns)
    if closes.shape[0] < 30:
        return {
            "as_of": as_of,
            "generated_at": generated_at,
            "message": "Need at least ~30 trading days of history.",
            "portfolio_value": round(total_mv, 2),
            "var": None,
        }

    w_sum = sum(weights[s] for s in ok)
    w = np.array([weights[s] / w_sum for s in ok], dtype=float)
    rets = closes.pct_change().dropna()
    port_rets = (rets.values * w).sum(axis=1)
    port_rets = np.asarray(port_rets, dtype=float)

    confidences = sorted({0.95, 0.99, float(confidence)})
    hist: dict[str, Any] = {}
    param: dict[str, Any] = {}
    cvar: dict[str, Any] = {}

    mu = float(np.mean(port_rets))
    sigma = float(np.std(port_rets, ddof=1))

    for c in confidences:
        q = float(np.percentile(port_rets, (1 - c) * 100))
        hist_loss_pct = max(0.0, -q)
        z = _Z.get(round(c, 2), -1.6449)
        param_q = mu + z * sigma
        param_loss_pct = max(0.0, -param_q)

        key = f"{int(round(c * 100))}"
        hist[key] = {
            "confidence": c,
            "daily_var_pct": round(hist_loss_pct * 100, 3),
            "daily_var_usd": round(hist_loss_pct * total_mv, 2),
        }
        param[key] = {
            "confidence": c,
            "daily_var_pct": round(param_loss_pct * 100, 3),
            "daily_var_usd": round(param_loss_pct * total_mv, 2),
        }
        tail = port_rets[port_rets <= q]
        es = float(-np.mean(tail)) if len(tail) else hist_loss_pct
        cvar[key] = {
            "confidence": c,
            "daily_cvar_pct": round(max(0.0, es) * 100, 3),
            "daily_cvar_usd": round(max(0.0, es) * total_mv, 2),
        }

    contrib = []
    for i, sym in enumerate(ok):
        r = rets[sym].dropna().values.astype(float)
        if len(r) < 30:
            continue
        q95 = float(np.percentile(r, 5))
        loss = max(0.0, -q95)
        contrib.append(
            {
                "symbol": sym,
                "weight": round(float(w[i]), 4),
                "standalone_var_95_pct": round(loss * 100, 3),
                "weighted_var_proxy_usd": round(loss * float(w[i]) * total_mv, 2),
            }
        )
    contrib.sort(key=lambda x: x["weighted_var_proxy_usd"], reverse=True)

    primary = hist.get("95") or next(iter(hist.values()))

    return {
        "as_of": as_of,
        "generated_at": generated_at,
        "lookback": lookback,
        "trading_days": int(len(port_rets)),
        "portfolio_value": round(total_mv, 2),
        "weights": {s: round(weights[s], 4) for s in ok},
        "mean_daily_return_pct": round(mu * 100, 4),
        "daily_vol_pct": round(sigma * 100, 4),
        "annualized_vol_pct": round(sigma * np.sqrt(252) * 100, 2),
        "var": {
            "primary_confidence": 0.95,
            "historical": hist,
            "parametric": param,
            "cvar": cvar,
            "headline": primary,
        },
        "contributors": contrib[:12],
        "disclaimer": (
            "Educational VaR assuming constant current weights and historical returns. "
            "Not a guarantee of future losses and not investment advice."
        ),
    }
