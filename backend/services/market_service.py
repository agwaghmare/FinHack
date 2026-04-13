"""Market data via yfinance only (equities, ETFs, crypto, FX, oil). No third-party quote APIs."""

from __future__ import annotations

import logging
from typing import Any, cast

import pandas as pd

logger = logging.getLogger(__name__)

# Returned on quote payloads and `/health` so you can confirm the running server is this codebase.
MARKET_QUOTES_PROVIDER = "yfinance"

MOCK_EQUITY_PRICES: dict[str, float] = {
    "AAPL": 214.7,
    "MSFT": 421.3,
    "NVDA": 131.9,
    "AMZN": 182.4,
    "GOOGL": 175.5,
    "META": 503.1,
    "TSLA": 189.2,
    "BRK.B": 421.7,
    "SPY": 523.8,
    "QQQ": 448.3,
    "DIA": 392.1,
    "IWM": 206.4,
    "AMD": 171.0,
    "NFLX": 662.8,
    "COIN": 243.7,
    "PLTR": 24.6,
    "USO": 68.5,
}
MOCK_CRYPTO_PRICES: dict[str, float] = {"BTC": 67500.0, "ETH": 3520.0}
MOCK_WTI: float = 72.0


def _yf():
    import yfinance as yf

    return yf


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _yahoo_equity_ticker(symbol: str) -> str:
    return symbol.upper().strip().replace(".", "-")


def _history_last_prev_volume(
    yahoo_id: str,
    *,
    periods: tuple[str, ...] = ("7d", "1mo", "3mo", "6mo"),
    interval: str = "1d",
) -> tuple[float, float | None, int | None] | None:
    """(last_close, previous_close_or_none, volume_or_none)."""
    try:
        t = _yf().Ticker(yahoo_id)
    except Exception as e:
        logger.warning("yfinance ticker %s: %s", yahoo_id, e)
        return None

    for period in periods:
        try:
            hist = t.history(period=period, interval=interval, auto_adjust=False)
        except Exception as e:
            logger.debug("history %s %s: %s", yahoo_id, period, e)
            continue
        if hist is None or hist.empty:
            continue
        try:
            last = _safe_float(hist["Close"].iloc[-1])
            vol_raw = hist["Volume"].iloc[-1] if "Volume" in hist.columns else None
            vol: int | None
            try:
                vol = int(vol_raw) if vol_raw is not None and str(vol_raw) != "nan" else None
            except Exception:
                vol = None
            if last <= 0:
                continue
            if len(hist) >= 2:
                prev = _safe_float(hist["Close"].iloc[-2])
                prev = prev if prev > 0 else None
            else:
                prev = None
            return (last, prev, vol)
        except Exception as e:
            logger.debug("parse hist %s: %s", yahoo_id, e)
            continue

    try:
        fi = t.fast_info
        if isinstance(fi, dict):
            last = _safe_float(
                fi.get("last_price") or fi.get("regularMarketPrice") or fi.get("navPrice") or 0
            )
            prev = _safe_float(fi.get("previous_close") or fi.get("regularMarketPreviousClose") or 0)
        else:
            last = _safe_float(
                getattr(fi, "last_price", None)
                or getattr(fi, "regular_market_price", None)
                or 0
            )
            prev = _safe_float(getattr(fi, "previous_close", None) or 0)
        if last > 0:
            return (last, prev if prev > 0 else None, None)
    except Exception as e:
        logger.debug("fast_info %s: %s", yahoo_id, e)

    return None


def _pair_change_pct(last: float, prev: float | None) -> tuple[float, str]:
    if prev is None or prev <= 0:
        return 0.0, "0.00"
    pct = ((last - prev) / prev) * 100.0
    return last - prev, f"{pct:.2f}"


def _equity_like_quote(display_sym: str, yahoo_id: str) -> dict[str, Any]:
    row = _history_last_prev_volume(yahoo_id)
    sym = display_sym.upper().strip()
    if not row:
        px = float(MOCK_EQUITY_PRICES.get(sym, 100.0))
        return {
            "kind": "equity",
            "symbol": sym,
            "price": px,
            "change": 0.0,
            "change_percent": "0.00",
            "volume": None,
            "last_session": None,
            "error": "mock_no_yfinance",
        }
    last, prev, vol = row
    chg, pct = _pair_change_pct(last, prev)
    return {
        "kind": "equity",
        "symbol": sym,
        "price": last,
        "change": chg,
        "change_percent": pct,
        "volume": vol,
        "last_session": None,
    }


def _crypto_quote_from_yahoo(yahoo_id: str, display_base: str) -> dict[str, Any]:
    row = _history_last_prev_volume(yahoo_id, periods=("7d", "1mo", "3mo"))
    base = display_base.upper().strip()
    if not row:
        px = float(MOCK_CRYPTO_PRICES.get(base, 1000.0))
        return {
            "kind": "crypto",
            "symbol": f"{base}/USD",
            "price": px,
            "change": 0.0,
            "change_percent": "0.00",
            "error": "mock_no_yfinance",
        }
    last, prev, _vol = row
    chg, pct = _pair_change_pct(last, prev)
    return {
        "kind": "crypto",
        "symbol": f"{base}/USD",
        "price": last,
        "change": chg,
        "change_percent": pct,
    }


def _fx_quote(pair: str) -> dict[str, Any]:
    sym = pair.upper().strip()
    if len(sym) != 6 or not sym.isalpha():
        return {
            "kind": "fx",
            "symbol": sym,
            "price": 1.0,
            "change": 0.0,
            "change_percent": "0.00",
            "error": "invalid_fx_pair",
        }
    yid = f"{sym[:3]}{sym[3:6]}=X"
    row = _history_last_prev_volume(yid, periods=("10d", "1mo", "3mo"))
    if not row:
        return {
            "kind": "fx",
            "symbol": sym,
            "price": 1.0,
            "change": 0.0,
            "change_percent": "0.00",
            "error": "no_data",
        }
    last, prev, _v = row
    chg, pct = _pair_change_pct(last, prev)
    return {
        "kind": "fx",
        "symbol": sym,
        "price": last,
        "change": chg,
        "change_percent": pct,
    }


def _wti_quote() -> dict[str, Any]:
    row = _history_last_prev_volume("CL=F", periods=("10d", "1mo", "3mo"))
    if not row:
        return {
            "kind": "commodity",
            "symbol": "WTI",
            "price": MOCK_WTI,
            "change": 0.0,
            "change_percent": "0.00",
            "unit": "USD/barrel",
            "error": "mock_no_yfinance",
        }
    last, prev, _ = row
    chg, pct = _pair_change_pct(last, prev)
    return {
        "kind": "commodity",
        "symbol": "WTI",
        "price": last,
        "change": chg,
        "change_percent": pct,
        "unit": "USD/barrel",
    }


def _legacy_global_quote_shim(q: dict[str, Any]) -> dict[str, str]:
    """Shim for older clients expecting Alpha Vantage-style `Global Quote` keys."""
    sym = str(q.get("symbol") or "")
    price = q.get("price")
    chg = q.get("change")
    if chg is None:
        chg = 0.0
    pct = q.get("change_percent")
    pct_str = f"{float(pct):.2f}" if isinstance(pct, (int, float)) else str(pct or "0.00")
    pct_str = pct_str.replace("%", "")
    vol = q.get("volume")
    return {
        "01. symbol": sym,
        "05. price": str(price if price is not None else 0),
        "09. change": str(chg),
        "10. change percent": f"{pct_str}%",
        "07. latest trading day": str(q.get("last_session") or ""),
        "06. volume": str(vol) if vol is not None else "",
    }


def _normalized_quote_for_symbol(raw: str) -> dict[str, Any]:
    s = raw.strip().upper()
    if not s:
        return _equity_like_quote("SPY", "SPY")

    if s in ("WTI", "OIL"):
        return _wti_quote()

    if s == "USO":
        return _equity_like_quote("USO", "USO")

    fx_pairs = {"EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCAD", "NZDUSD"}
    if s in fx_pairs:
        return _fx_quote(s)

    if "BTC" in s:
        return _crypto_quote_from_yahoo("BTC-USD", "BTC")
    if s.startswith("ETH") or "ETH" == s:
        return _crypto_quote_from_yahoo("ETH-USD", "ETH")
    if s.endswith("-USD") and s.replace("-USD", "").isalnum():
        base = s.replace("-USD", "")
        return _crypto_quote_from_yahoo(s, base)

    yid = _yahoo_equity_ticker(s)
    return _equity_like_quote(s, yid)


def get_stock_price(symbol: str) -> dict[str, Any]:
    """Single-symbol quote. Includes `Global Quote` dict for legacy dashboards.

    If you see `Information` / Alpha Vantage text here, you are **not** running this module —
    stop old Uvicorn processes and start from the project root (folder containing app.py).
    """
    q = _normalized_quote_for_symbol(symbol)
    return {
        **q,
        "Global Quote": _legacy_global_quote_shim(q),
        "provider": MARKET_QUOTES_PROVIDER,
        "quote_source": "yahoo_finance_via_yfinance",
    }


def _crypto_pair_price(from_ccy: str) -> dict[str, Any]:
    sym = from_ccy.upper().strip().replace("-USD", "")
    if sym in ("BTC",):
        return _crypto_quote_from_yahoo("BTC-USD", "BTC")
    if sym in ("ETH",):
        return _crypto_quote_from_yahoo("ETH-USD", "ETH")
    yid = f"{sym}-USD" if sym.isalnum() else "BTC-USD"
    return _crypto_quote_from_yahoo(yid, sym or "BTC")


def _commodity_wti() -> dict[str, Any]:
    return _wti_quote()


def _equity_quote(symbol: str) -> dict[str, Any]:
    return _normalized_quote_for_symbol(symbol)


def last_trade_price(symbol: str) -> float:
    sym = symbol.upper().strip()
    if "BTC" in sym:
        return float(_crypto_pair_price("BTC").get("price") or 0)
    if sym.startswith("ETH") or sym == "ETH":
        return float(_crypto_pair_price("ETH").get("price") or 0)
    if sym in ("WTI", "OIL", "USO"):
        q = _wti_quote() if sym != "USO" else _equity_quote("USO")
        return float(q.get("price") or 0)
    return float((_equity_quote(sym).get("price")) or 0)


def get_ohlc_history(
    symbol: str,
    *,
    period: str = "1y",
    interval: str = "1d",
) -> dict[str, Any]:
    sym = symbol.upper().strip()
    try:
        yf = _yf()
    except Exception as e:
        logger.warning("yfinance import failed: %s", e)
        return {"symbol": sym, "error": "yfinance_unavailable", "bars": _synthetic_bars(sym)}

    yid = _yahoo_equity_ticker(sym)
    if sym in ("WTI", "OIL"):
        yid = "CL=F"
    elif "BTC" in sym:
        yid = "BTC-USD"
    elif sym.startswith("ETH"):
        yid = "ETH-USD"

    fallbacks: list[tuple[str, str]] = [
        (period, interval),
        ("2y", "1d"),
        ("max", "1d"),
        ("1y", "1wk"),
        ("5y", "1wk"),
    ]
    seen: set[tuple[str, str]] = set()
    hist = None
    for p, iv in fallbacks:
        key = (p, iv)
        if key in seen:
            continue
        seen.add(key)
        try:
            hist = yf.Ticker(yid).history(period=p, interval=iv, auto_adjust=False)
            if hist is not None and not hist.empty:
                break
        except Exception as e:
            logger.debug("OHLC try %s %s %s: %s", yid, p, iv, e)
            hist = None

    if hist is None or hist.empty:
        return {"symbol": sym, "error": "no_data", "bars": _synthetic_bars(sym)}

    bars: list[dict[str, Any]] = []
    for idx, row in hist.iterrows():
        o = _safe_float(row.get("Open"))
        h = _safe_float(row.get("High"))
        lo = _safe_float(row.get("Low"))
        c = _safe_float(row.get("Close"))
        if c <= 0 or o <= 0:
            continue
        if h < lo:
            h, lo = max(h, lo, c), min(h, lo, c)
        vol = row.get("Volume")
        try:
            vol_i = int(vol) if vol is not None and str(vol) != "nan" else None
        except Exception:
            vol_i = None
        pts = pd.Timestamp(cast(Any, idx))
        if pd.isna(pts):
            continue
        # Stubs leave Timestamp | NaT after isna(); runtime path is a real timestamp index.
        p = cast(Any, pts)
        ts = int(p.timestamp())
        date_str = str(p.date())
        bars.append(
            {
                "time": ts,
                "date": date_str,
                "open": o,
                "high": h,
                "low": lo,
                "close": c,
                "volume": vol_i,
            }
        )

    bars.sort(key=lambda b: str(b.get("date") or ""))
    if not bars:
        return {"symbol": sym, "error": "no_data", "bars": _synthetic_bars(sym)}

    return {
        "symbol": sym,
        "period": period,
        "interval": interval,
        "bars": bars,
    }


def _synthetic_bars(symbol: str) -> list[dict[str, Any]]:
    """Last-resort flat series so charts never render totally empty."""
    px = last_trade_price(symbol) or 100.0
    from datetime import date, timedelta

    out: list[dict[str, Any]] = []
    for i in range(30, 0, -1):
        d = date.today() - timedelta(days=i)
        out.append(
            {
                "time": None,
                "date": str(d),
                "open": px,
                "high": px * 1.001,
                "low": px * 0.999,
                "close": px,
                "volume": None,
            }
        )
    return out


def _shorten_business_summary(text: str, max_len: int = 380) -> str:
    """First ~1–2 sentences for UI; prefer breaking at sentence end."""
    t = (text or "").strip()
    if not t:
        return ""
    if len(t) <= max_len:
        return t
    window = t[:max_len]
    for sep in (". ", "; "):
        i = window.rfind(sep)
        if i >= 100:
            return t[: i + 1].strip()
    sp = window.rfind(" ")
    if sp > 50:
        return t[:sp].strip() + "…"
    return window.rstrip() + "…"


def _mover_why_today(symbol: str) -> str:
    """Short catalyst line from latest ticker news headline."""
    sym = symbol.upper().strip()
    if not sym:
        return "No symbol available for catalyst lookup."
    try:
        t = _yf().Ticker(_yahoo_equity_ticker(sym))
        news = getattr(t, "news", None) or []
        for item in news[:3]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if title:
                return title if len(title) <= 180 else (title[:177].rstrip() + "...")
    except Exception as e:
        logger.debug("mover why %s: %s", sym, e)
    return "Likely moving on earnings, guidance, macro tape, or sector flow."


def get_stock_fundamentals(symbol: str) -> dict[str, Any]:
    """yfinance `Ticker.info` slice: summary, valuation, logo via Clearbit from company website."""
    sym = symbol.upper().strip()
    if not sym:
        return {"symbol": "", "error": "symbol_required"}
    yid = _yahoo_equity_ticker(sym)
    try:
        t = _yf().Ticker(yid)
        info = getattr(t, "info", None) or {}
    except Exception as e:
        logger.warning("fundamentals %s: %s", yid, e)
        return {"symbol": sym, "yahoo_id": yid, "error": str(e)}

    if not isinstance(info, dict) or not info:
        return {"symbol": sym, "yahoo_id": yid, "error": "no_info"}

    website = str(info.get("website") or "").strip()
    logo_url: str | None = None
    if website:
        try:
            from urllib.parse import urlparse

            host = urlparse(website).netloc or ""
            if host.lower().startswith("www."):
                host = host[4:]
            if host:
                logo_url = f"https://logo.clearbit.com/{host}"
        except Exception:
            pass

    raw_summary = info.get("longBusinessSummary") or ""
    summary = _shorten_business_summary(raw_summary if isinstance(raw_summary, str) else "")

    return {
        "symbol": sym,
        "yahoo_id": yid,
        "long_name": info.get("longName") or info.get("shortName") or info.get("displayName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "summary": summary,
        "trailing_pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "trailing_eps": info.get("trailingEps"),
        "profit_margins": info.get("profitMargins"),
        "market_cap": info.get("marketCap"),
        "quote_type": info.get("quoteType"),
        "recommendation_mean": info.get("recommendationMean"),
        "recommendation_key": info.get("recommendationKey"),
        "number_of_analyst_opinions": info.get("numberOfAnalystOpinions"),
        "website": website or None,
        "logo_url": logo_url,
    }


def _quotes_from_yahoo_screener_raw(raw: dict[str, Any], source_tag: str, n: int) -> list[dict[str, Any]]:
    quotes_out: list[dict[str, Any]] = []
    for q in (raw.get("quotes") or [])[:n]:
        if not isinstance(q, dict):
            continue
        sym = str(q.get("symbol") or "").strip().upper()
        if not sym:
            continue
        pct_raw = q.get("regularMarketChangePercent")
        if pct_raw is None:
            pct_raw = q.get("percentchange")
        pct_f = _safe_float(pct_raw, 0.0)
        pct_str = f"{pct_f:.2f}"
        price_f = _safe_float(q.get("regularMarketPrice"), 0.0)
        vol = q.get("regularMarketVolume")
        try:
            vol_i = int(vol) if vol is not None and str(vol) != "nan" else None
        except Exception:
            vol_i = None
        quotes_out.append(
            {
                "kind": "equity",
                "symbol": sym,
                "price": price_f if price_f > 0 else None,
                "change": None,
                "change_percent": pct_str,
                "volume": vol_i,
                "long_name": q.get("longName") or q.get("shortName") or q.get("displayName"),
                "why_today": _mover_why_today(sym),
                "source": source_tag,
            }
        )
    return quotes_out


def get_yahoo_day_movers(count: int = 8, side: str = "gainers") -> dict[str, Any]:
    """Yahoo Finance `day_gainers` / `day_losers` screeners — US equities by session % change."""
    n = min(max(int(count), 1), 25)
    side_l = (side or "gainers").lower().strip()
    if side_l == "losers":
        screener = "day_losers"
        source_tag = "yahoo_day_losers"
        default_title = "Day Losers"
    else:
        screener = "day_gainers"
        source_tag = "yahoo_day_gainers"
        default_title = "Day Gainers"

    try:
        from yfinance import screen
    except Exception as e:
        logger.warning("yfinance screen import failed: %s", e)
        return {"quotes": [], "count": 0, "error": "yfinance_unavailable", "source": source_tag, "side": side_l}

    try:
        raw = screen(screener, count=n)
    except Exception as e:
        logger.warning("Yahoo %s screener failed: %s", screener, e)
        return {"quotes": [], "count": 0, "error": str(e), "source": source_tag, "side": side_l}

    if not isinstance(raw, dict):
        return {"quotes": [], "count": 0, "error": "invalid_screener_response", "source": source_tag, "side": side_l}

    quotes_out = _quotes_from_yahoo_screener_raw(raw, source_tag, n)
    return {
        "quotes": quotes_out,
        "count": len(quotes_out),
        "source": source_tag,
        "side": side_l,
        "screener_title": raw.get("title") or default_title,
    }


def get_market_prices(symbols: list[str]) -> dict[str, Any]:
    quotes: list[dict[str, Any]] = []
    for raw in symbols[:24]:
        s = raw.strip().upper()
        if not s:
            continue
        try:
            if s in ("WTI", "OIL"):
                quotes.append(_commodity_wti())
                continue
            if s == "USO":
                quotes.append(_equity_quote("USO"))
                continue
            fx_pairs = {"EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCAD", "NZDUSD"}
            if s in fx_pairs:
                quotes.append(_fx_quote(s))
                continue
            if "BTC" in s or s.startswith("ETH"):
                cc = "BTC" if "BTC" in s else "ETH"
                quotes.append(_crypto_pair_price(cc))
                continue
            quotes.append(_equity_quote(s))
        except Exception as e:
            logger.warning("Quote failed %s: %s", s, e)
            px = float(MOCK_EQUITY_PRICES.get(s, 100.0))
            quotes.append(
                {
                    "kind": "equity",
                    "symbol": s,
                    "price": px,
                    "change": 0.0,
                    "change_percent": "0.00",
                    "volume": None,
                    "error": str(e),
                }
            )

    return {"quotes": quotes, "count": len(quotes)}
