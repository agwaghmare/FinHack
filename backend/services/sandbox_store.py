"""In-memory paper portfolio when Alpaca keys are absent (hackathon demo)."""

from __future__ import annotations

from typing import Any

DEFAULT_CASH = 100_000.0

_store: dict[str, dict[str, Any]] = {}
_leaderboard: list[dict[str, Any]] = []


def get_portfolio(user_id: str) -> dict[str, Any]:
    if user_id not in _store:
        _store[user_id] = {
            "cash": DEFAULT_CASH,
            "positions": [],
            "equity": DEFAULT_CASH,
            "points": 0,
            "trades": [],
        }
    return _store[user_id]


def record_trade(user_id: str, side: str, symbol: str, qty: float, price: float) -> dict[str, Any]:
    p = get_portfolio(user_id)
    cost = qty * price
    if side == "buy":
        if p["cash"] < cost:
            raise ValueError("insufficient_cash")
        p["cash"] -= cost
        # merge position
        pos = next((x for x in p["positions"] if x["symbol"] == symbol), None)
        if pos:
            new_qty = pos["qty"] + qty
            pos["avg"] = (pos["avg"] * pos["qty"] + price * qty) / new_qty
            pos["qty"] = new_qty
        else:
            p["positions"].append({"symbol": symbol, "qty": qty, "avg": price})
    else:
        pos = next((x for x in p["positions"] if x["symbol"] == symbol), None)
        if not pos or pos["qty"] < qty:
            raise ValueError("insufficient_shares")
        proceeds = qty * price
        pos["qty"] -= qty
        p["cash"] += proceeds
        if pos["qty"] <= 1e-9:
            p["positions"] = [x for x in p["positions"] if x["symbol"] != symbol]

    p["equity"] = p["cash"] + sum(x["qty"] * x["avg"] for x in p["positions"])
    p["points"] = int(p["points"]) + (10 if side == "buy" else 5)
    p["trades"].append(
        {"side": side, "symbol": symbol, "qty": qty, "price": price}
    )
    _bump_leaderboard(user_id, p["points"], p["equity"])
    return p


def _bump_leaderboard(user_id: str, points: int, equity: float) -> None:
    global _leaderboard
    rows = [r for r in _leaderboard if r["user_id"] != user_id]
    rows.append({"user_id": user_id, "points": points, "equity": round(equity, 2)})
    rows.sort(key=lambda r: (r["points"], r["equity"]), reverse=True)
    _leaderboard = rows[:50]


def get_leaderboard() -> list[dict[str, Any]]:
    return [
        {**r, "rank": i + 1} for i, r in enumerate(_leaderboard[:20])
    ]
