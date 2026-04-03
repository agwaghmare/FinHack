"""Per-user real-money holdings (in-memory). Used for portfolio return / CAGR views."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

import pandas as pd

from backend.services.market_service import get_market_prices

_store: dict[str, list[dict[str, Any]]] = {}


def _today_iso() -> str:
    return date.today().isoformat()


def list_positions(user_id: str) -> list[dict[str, Any]]:
    return list(_store.get(user_id, []))


def add_or_merge_position(
    user_id: str,
    *,
    symbol: str,
    shares: float,
    avg_cost: float,
    opened_at: str | None,
) -> list[dict[str, Any]]:
    sym = symbol.upper().strip()
    if not sym or shares <= 0 or avg_cost <= 0:
        raise ValueError("invalid_position")

    od = (opened_at or _today_iso()).strip()[:10]
    try:
        datetime.strptime(od, "%Y-%m-%d")
    except ValueError:
        raise ValueError("invalid_opened_at")

    rows = _store.setdefault(user_id, [])
    existing = next((r for r in rows if r["symbol"] == sym), None)
    if existing:
        old_q = float(existing["shares"])
        old_a = float(existing["avg_cost"])
        new_q = old_q + shares
        new_a = (old_a * old_q + avg_cost * shares) / new_q if new_q > 0 else avg_cost
        old_open = str(existing.get("opened_at") or od)
        existing["shares"] = new_q
        existing["avg_cost"] = round(new_a, 6)
        # keep earlier purchase date for CAGR anchor
        existing["opened_at"] = min(old_open, od)
    else:
        rows.append(
            {
                "symbol": sym,
                "shares": float(shares),
                "avg_cost": float(avg_cost),
                "opened_at": od,
            }
        )
    return list(rows)


def delete_position(user_id: str, symbol: str) -> list[dict[str, Any]]:
    sym = symbol.upper().strip()
    rows = _store.get(user_id, [])
    _store[user_id] = [r for r in rows if r["symbol"] != sym]
    return list(_store[user_id])


def _quote_price(quote: dict[str, Any]) -> float:
    try:
        return float(quote.get("price") or 0)
    except (TypeError, ValueError):
        return 0.0


def _price_lookup(quotes_payload: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for q in quotes_payload.get("quotes") or []:
        if not isinstance(q, dict):
            continue
        sym = str(q.get("symbol") or "").upper().strip()
        px = _quote_price(q)
        if sym and px > 0:
            out[sym] = px
        # crypto symbols like BTC/USD → also map BTC
        if "/" in sym:
            base = sym.split("/")[0].strip()
            if base and px > 0:
                out[base] = px
    return out


def snapshot(user_id: str) -> dict[str, Any]:
    rows = list_positions(user_id)
    if not rows:
        return {
            "user_id": user_id,
            "positions": [],
            "totals": {
                "cost_basis": 0.0,
                "market_value": 0.0,
                "unrealized_pl": 0.0,
                "total_return_pct": None,
                "cagr_pct": None,
            },
        }

    symbols = [str(r["symbol"]) for r in rows]
    quotes = get_market_prices(symbols)
    px_map = _price_lookup(quotes)

    enriched: list[dict[str, Any]] = []
    total_cb = 0.0
    total_mv = 0.0
    dates: list[str] = []
    pricing_complete = True

    for r in rows:
        sym = str(r["symbol"]).upper()
        sh = float(r["shares"])
        ac = float(r["avg_cost"])
        od = str(r.get("opened_at") or _today_iso())[:10]
        dates.append(od)

        price = px_map.get(sym, 0.0)
        if price <= 0:
            pricing_complete = False

        cb = sh * ac
        mv = sh * price if price > 0 else 0.0
        pl = (mv - cb) if price > 0 else None
        pl_pct = (pl / cb * 100.0) if pl is not None and cb > 0 else None

        total_cb += cb
        total_mv += mv

        enriched.append(
            {
                "symbol": sym,
                "shares": sh,
                "avg_cost": ac,
                "opened_at": od,
                "last_price": price if price > 0 else None,
                "cost_basis": round(cb, 2),
                "market_value": round(mv, 2) if price > 0 else None,
                "unrealized_pl": round(pl, 2) if pl is not None else None,
                "unrealized_pl_pct": round(pl_pct, 2) if pl_pct is not None else None,
            }
        )

    unrealized = total_mv - total_cb if total_cb > 0 else 0.0
    ret_pct: float | None
    if total_cb > 0 and pricing_complete:
        ret_pct = unrealized / total_cb * 100.0
    else:
        ret_pct = None

    cagr_pct = None
    if total_cb > 0 and pricing_complete and dates:
        try:
            earliest = min(datetime.strptime(d, "%Y-%m-%d").date() for d in dates)
            today = date.today()
            days = (today - earliest).days
            years = max(days / 365.25, 1.0 / 365.25)
            ratio = total_mv / total_cb
            if ratio > 0:
                cagr_pct = (ratio ** (1.0 / years) - 1.0) * 100.0
        except ValueError:
            cagr_pct = None

    return {
        "user_id": user_id,
        "positions": enriched,
        "pricing_complete": pricing_complete,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "cost_basis": round(total_cb, 2),
            "market_value": round(total_mv, 2),
            "unrealized_pl": round(unrealized, 2),
            "total_return_pct": round(ret_pct, 3) if ret_pct is not None else None,
            "cagr_pct": round(cagr_pct, 3) if cagr_pct is not None else None,
        },
    }


def _symbol_period_returns_pct(sym: str) -> dict[str, float | None]:
    """Approximate total returns from adjusted closes (yfinance)."""
    try:
        import yfinance as yf

        t = yf.Ticker(sym)
        hist = t.history(period="5y", interval="1d", auto_adjust=True)
    except Exception:
        return {"1m": None, "ytd": None, "1y": None, "5y": None}

    if hist is None or hist.empty or "Close" not in hist.columns:
        return {"1m": None, "ytd": None, "1y": None, "5y": None}

    closes = hist["Close"].dropna()
    if len(closes) < 2:
        return {"1m": None, "ytd": None, "1y": None, "5y": None}

    last = float(closes.iloc[-1])
    idx = closes.index
    now_ts = idx[-1]

    def pct_from(ts_target: pd.Timestamp) -> float | None:
        try:
            sub = closes[closes.index <= ts_target]
            if len(sub) == 0:
                return None
            past = float(sub.iloc[-1])
            if past <= 0:
                return None
            return (last / past - 1.0) * 100.0
        except Exception:
            return None

    one_m_ago = now_ts - pd.DateOffset(months=1)
    one_y_ago = now_ts - pd.DateOffset(years=1)
    five_y_ago = now_ts - pd.DateOffset(years=5)

    ts_last = closes.index[-1]
    if getattr(ts_last, "tz", None) is not None:
        ytd_start = pd.Timestamp(year=ts_last.year, month=1, day=1, tz=ts_last.tz)
    else:
        ytd_start = pd.Timestamp(year=ts_last.year, month=1, day=1)
    ytd_sub = closes[closes.index >= ytd_start]
    ytd_ret: float | None = None
    if len(ytd_sub) >= 1:
        first = float(ytd_sub.iloc[0])
        if first > 0:
            ytd_ret = (last / first - 1.0) * 100.0

    return {
        "1m": pct_from(one_m_ago),
        "ytd": ytd_ret,
        "1y": pct_from(one_y_ago),
        "5y": pct_from(five_y_ago),
    }


def portfolio_period_performance(user_id: str) -> dict[str, Any]:
    """Weighted portfolio total return % by period (MV weights, adjusted closes)."""
    snap = snapshot(user_id)
    positions = [
        p
        for p in snap.get("positions") or []
        if p.get("market_value") is not None and float(p.get("market_value") or 0) > 0
    ]
    if not positions:
        return {
            "has_positions": False,
            "periods": {"1m": None, "ytd": None, "1y": None, "5y": None},
            "message": "Add positions under My portfolio to see performance.",
        }

    total_mv = sum(float(p["market_value"]) for p in positions)
    if total_mv <= 0:
        return {
            "has_positions": False,
            "periods": {"1m": None, "ytd": None, "1y": None, "5y": None},
            "message": "No priced positions.",
        }

    weights = {str(p["symbol"]).upper(): float(p["market_value"]) / total_mv for p in positions}
    cache = {sym: _symbol_period_returns_pct(sym) for sym in weights}
    keys = ("1m", "ytd", "1y", "5y")
    out: dict[str, float | None] = {}
    for k in keys:
        acc = 0.0
        ok = True
        for sym, w in weights.items():
            r = cache.get(sym, {}).get(k)
            if r is None:
                ok = False
                break
            acc += w * r
        out[k] = round(acc, 2) if ok else None

    return {
        "has_positions": True,
        "periods": out,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
