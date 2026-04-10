"""Per-user real-money holdings (in-memory). Used for portfolio return / CAGR views."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd

from backend.services.market_service import get_market_prices

_store: dict[str, list[dict[str, Any]]] = {}
_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "holdings_store.json"


def _load_store() -> None:
    global _store
    try:
        if _STORE_PATH.exists():
            raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                clean: dict[str, list[dict[str, Any]]] = {}
                for uid, rows in raw.items():
                    if not isinstance(uid, str) or not isinstance(rows, list):
                        continue
                    out_rows: list[dict[str, Any]] = []
                    for r in rows:
                        if not isinstance(r, dict):
                            continue
                        sym = str(r.get("symbol") or "").upper().strip()
                        try:
                            sh = float(r.get("shares") or 0)
                            ac = float(r.get("avg_cost") or 0)
                        except (TypeError, ValueError):
                            continue
                        od = str(r.get("opened_at") or _today_iso())[:10]
                        if sym and sh > 0 and ac > 0:
                            out_rows.append(
                                {
                                    "symbol": sym,
                                    "shares": sh,
                                    "avg_cost": ac,
                                    "opened_at": od,
                                }
                            )
                    if out_rows:
                        clean[uid] = out_rows
                _store = clean
    except Exception:
        # Keep app functional even if persisted file is corrupted.
        _store = {}


def _save_store() -> None:
    try:
        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _STORE_PATH.write_text(
            json.dumps(_store, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )
    except Exception:
        # Non-fatal: runtime memory store still works.
        pass


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
    _save_store()
    return list(rows)


def delete_position(user_id: str, symbol: str) -> list[dict[str, Any]]:
    sym = symbol.upper().strip()
    rows = _store.get(user_id, [])
    _store[user_id] = [r for r in rows if r["symbol"] != sym]
    _save_store()
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

    closes = cast(pd.Series, hist["Close"]).dropna()
    if len(closes) < 2:
        return {"1m": None, "ytd": None, "1y": None, "5y": None}

    last = float(closes.iloc[-1])
    idx = cast(pd.Index, closes.index)
    now_ts = cast(pd.Timestamp, idx[-1])

    def pct_from(ts_target: pd.Timestamp) -> float | None:
        """Last close on or before ts_target; handles empty slice when target is just before first bar."""
        try:
            sub = cast(pd.Series, closes[closes.index <= ts_target])
            if len(sub) > 0:
                past = float(sub.iloc[-1])
            else:
                if len(closes) == 0:
                    return None
                first_ts = cast(pd.Timestamp, idx[0])
                # If the series starts shortly after ts_target (weekends/holidays/period boundary),
                # use the first bar — otherwise we'd show "—" for 5Y despite having a full 5y download.
                if first_ts > ts_target:
                    gap = first_ts - ts_target
                    days = getattr(gap, "days", None)
                    if days is not None and days <= 31:
                        past = float(closes.iloc[0])
                    else:
                        return None
                else:
                    return None
            if past <= 0:
                return None
            return (last / past - 1.0) * 100.0
        except Exception:
            return None

    one_m_ago = now_ts - pd.DateOffset(months=1)
    one_y_ago = now_ts - pd.DateOffset(years=1)
    five_y_ago = now_ts - pd.DateOffset(years=5)

    ts_last = cast(pd.Timestamp, idx[-1])
    if getattr(ts_last, "tzinfo", None) is not None:
        ytd_start = pd.Timestamp(year=int(ts_last.year), month=1, day=1, tz=ts_last.tzinfo)
    else:
        ytd_start = pd.Timestamp(year=int(ts_last.year), month=1, day=1)
    ytd_sub = cast(pd.Series, closes[closes.index >= ytd_start])
    ytd_ret: float | None = None
    if len(ytd_sub) >= 1:
        first = float(ytd_sub.iloc[0])
        if first > 0:
            ytd_ret = (last / first - 1.0) * 100.0

    ret_5y = pct_from(five_y_ago)
    # If still missing (e.g. timezone quirks) but we have ~4+ years of bars, use first→last on this window.
    if ret_5y is None and len(closes) >= 2:
        first_ts = cast(pd.Timestamp, idx[0])
        last_ts = cast(pd.Timestamp, idx[-1])
        span_days = (last_ts - first_ts).days
        if span_days >= 365 * 4:
            first_px = float(closes.iloc[0])
            if first_px > 0:
                ret_5y = (last / first_px - 1.0) * 100.0

    return {
        "1m": pct_from(one_m_ago),
        "ytd": ytd_ret,
        "1y": pct_from(one_y_ago),
        "5y": ret_5y,
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
        # MV-weight among symbols that have history for this horizon (IPO / thin data → None otherwise).
        num = 0.0
        den = 0.0
        for sym, w in weights.items():
            r = cache.get(sym, {}).get(k)
            if r is None:
                continue
            num += w * float(r)
            den += w
        out[k] = round(num / den, 2) if den > 0 else None

    return {
        "has_positions": True,
        "periods": out,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


def holdings_top_performers(
    user_id: str,
    *,
    limit: int = 8,
    period: str = "ytd",
) -> dict[str, Any]:
    """
    Holdings with positive total return over the chosen window (adjusted closes), best first.
    """
    lim = int(min(max(limit, 1), 25))
    per = period if period in ("1m", "ytd", "1y", "5y") else "ytd"
    label_map = {"1m": "1 month", "ytd": "Year to date", "1y": "1 year", "5y": "5 years"}

    snap = snapshot(user_id)
    positions = [
        p
        for p in snap.get("positions") or []
        if p.get("market_value") is not None and float(p.get("market_value") or 0) > 0
    ]
    if not positions:
        return {
            "has_positions": False,
            "period": per,
            "period_label": label_map[per],
            "items": [],
            "message": "Add priced positions under My portfolio to see top performers.",
        }

    total_mv = sum(float(p["market_value"]) for p in positions)
    if total_mv <= 0:
        return {
            "has_positions": False,
            "period": per,
            "period_label": label_map[per],
            "items": [],
            "message": "No priced market value for holdings.",
        }

    rows: list[dict[str, Any]] = []
    for p in positions:
        sym = str(p["symbol"]).upper()
        mv = float(p["market_value"])
        rets = _symbol_period_returns_pct(sym)
        rp = rets.get(per)
        if rp is None:
            continue
        w_pct = (mv / total_mv) * 100.0
        rows.append(
            {
                "symbol": sym,
                "market_value": round(mv, 2),
                "weight_pct": round(w_pct, 2),
                "return_pct": round(float(rp), 2),
                "period_return_label": per,
            }
        )

    positive = [r for r in rows if r["return_pct"] > 0]
    positive.sort(key=lambda x: x["return_pct"], reverse=True)
    items = positive[:lim]

    hint: str | None = None
    if not items and rows:
        hint = "No holdings are positive for this window yet (all flat or down on adjusted closes)."

    return {
        "has_positions": True,
        "period": per,
        "period_label": label_map[per],
        "items": items,
        "count_evaluated": len(rows),
        "hint": hint,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


def portfolio_equity_curve(user_id: str, period: str = "1y") -> dict[str, Any]:
    """Portfolio market-value curve from holdings prices over time."""
    snap = snapshot(user_id)
    positions = [
        p
        for p in snap.get("positions") or []
        if p.get("symbol") and p.get("shares") is not None and float(p.get("shares") or 0) > 0
    ]
    if not positions:
        return {
            "has_positions": False,
            "points": [],
            "message": "Add positions under My portfolio to see capital growth.",
        }

    try:
        import yfinance as yf
    except Exception:
        return {
            "has_positions": False,
            "points": [],
            "message": "yfinance unavailable.",
        }

    allowed_periods = {"3mo", "6mo", "1y", "2y", "5y"}
    per = period if period in allowed_periods else "1y"

    by_symbol: dict[str, pd.Series] = {}
    shares_by_symbol: dict[str, float] = {}
    for p in positions:
        sym = str(p.get("symbol") or "").upper().strip()
        if not sym:
            continue
        shares = float(p.get("shares") or 0)
        if shares <= 0:
            continue
        try:
            hist = yf.Ticker(sym).history(period=per, interval="1d", auto_adjust=True)
        except Exception:
            continue
        if hist is None or hist.empty or "Close" not in hist.columns:
            continue
        close = cast(pd.Series, hist["Close"]).dropna()
        if len(close) < 2:
            continue
        by_symbol[sym] = close
        shares_by_symbol[sym] = shares

    if not by_symbol:
        return {
            "has_positions": False,
            "points": [],
            "message": "No historical price data for current holdings.",
        }

    df = pd.DataFrame(by_symbol).sort_index().ffill()
    value = pd.Series(0.0, index=cast(pd.Index, df.index), dtype="float64")
    for sym, sh in shares_by_symbol.items():
        if sym in df.columns:
            col = cast(pd.Series, df[sym])
            value = value + (col.astype(float) * float(sh))
    value = value.dropna()
    if value.empty:
        return {
            "has_positions": False,
            "points": [],
            "message": "Could not build equity curve from holdings.",
        }

    first = float(value.iloc[0]) if float(value.iloc[0]) > 0 else None
    points: list[dict[str, Any]] = []
    for idx, v in value.items():
        val = float(v)
        growth = ((val / first - 1.0) * 100.0) if first and first > 0 else None
        ts_idx = cast(pd.Timestamp, idx)
        date_str = ts_idx.date().isoformat()
        points.append(
            {
                "date": date_str,
                "value": round(val, 2),
                "growth_pct": round(growth, 3) if growth is not None else None,
            }
        )

    return {
        "has_positions": True,
        "period": per,
        "points": points,
        "start_value": round(float(value.iloc[0]), 2),
        "end_value": round(float(value.iloc[-1]), 2),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


_load_store()
