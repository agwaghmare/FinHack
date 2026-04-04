from datetime import date
import numpy as np
import yfinance as yf
from backend.services.holdings_service import snapshot


def _fetch_volatility_and_beta(symbol: str) -> dict:
    try:
        ticker_hist = yf.Ticker(symbol).history(period="30d")["Close"]
        spy_hist = yf.Ticker("SPY").history(period="30d")["Close"]

        returns = ticker_hist.pct_change().dropna()
        spy_returns = spy_hist.pct_change().dropna()

        # Align both series
        r, s = returns.align(spy_returns, join="inner")

        volatility = float(r.std() * np.sqrt(252))  # annualized
        beta = float(np.cov(r, s)[0][1] / np.var(s)) if len(r) > 1 else 1.0

        return {"volatility": round(volatility, 4), "beta": round(beta, 4)}
    except Exception:
        return {"volatility": 0.3, "beta": 1.0}  # sensible defaults on failure



def analyze_portfolio(user_id: str) -> dict:
    snap = snapshot(user_id)
    positions = [
        p for p in snap.get("positions", [])
        if p.get("market_value") and float(p["market_value"]) > 0
    ]

    if not positions:
        return {
            "risk_score": 0,
            "message": "No priced positions found.",
            "as_of": date.today().isoformat(),
            "positions": [],
        }

    total_mv = sum(float(p["market_value"]) for p in positions)

    enriched = []
    for p in positions:
        symbol = p["symbol"]
        weight = float(p["market_value"]) / total_mv
        metrics = _fetch_volatility_and_beta(symbol)

        vol = metrics["volatility"]
        beta = metrics["beta"]

        # Score components out of 10
        vol_score = min(vol * 15, 4)           # max 4pts
        beta_score = min(abs(beta) * 1.5, 3)   # max 3pts
        size_score = min(weight * 6, 3)         # max 3pts

        position_risk = round(vol_score + beta_score + size_score, 1)

        enriched.append({
            "symbol": symbol,
            "weight": round(weight, 4),
            "volatility": vol,
            "beta": beta,
            "risk_score": position_risk,
            "market_value": p["market_value"],
        })

    # Portfolio risk = weighted average of position risk scores
    portfolio_risk = round(
        sum(e["risk_score"] * e["weight"] for e in enriched), 1
    )

    # Risk label out of 10
    if portfolio_risk < 3:
        label = "Low"
    elif portfolio_risk < 5.5:
        label = "Moderate"
    elif portfolio_risk < 7.5:
        label = "High"
    else:
        label = "Very High"

    return {
        "risk_score": portfolio_risk,
        "risk_label": label,
        "message": f"Portfolio risk is {label} ({portfolio_risk}/10)",
        "positions": enriched,
        "as_of": date.today().isoformat(),
    }