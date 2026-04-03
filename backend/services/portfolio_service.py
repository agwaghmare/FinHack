from datetime import date


def analyze_portfolio(portfolio: dict):
    weights = portfolio.get("weights", {})
    if not weights and portfolio.get("holdings"):
        weights = {
            h["symbol"]: h["weight"]
            for h in portfolio["holdings"]
            if "symbol" in h and "weight" in h
        }

    risk_score = sum(float(w) * 0.1 for w in weights.values()) if weights else 0.05

    return {
        "risk_score": risk_score,
        "message": "Basic portfolio analysis",
        "as_of": date.today().isoformat(),
    }
