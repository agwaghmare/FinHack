"""Suggest same-sector, similar–market-cap peers for equity comparison (yfinance)."""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)


def _yf():
    import yfinance as yf

    return yf


def _norm_ticker(symbol: str) -> str:
    return symbol.upper().strip().replace(".", "-")


# Liquid US equities by Yahoo `sector` (equities only — no index ETFs).
_SECTOR_TICKERS: dict[str, list[str]] = {
    "Technology": [
        "AAPL",
        "MSFT",
        "GOOGL",
        "GOOG",
        "META",
        "NVDA",
        "AVGO",
        "ADBE",
        "CRM",
        "ORCL",
        "CSCO",
        "AMD",
        "INTC",
        "QCOM",
        "TXN",
        "AMAT",
        "NOW",
        "MU",
        "LRCX",
        "KLAC",
        "PANW",
        "SNPS",
        "CDNS",
        "MRVL",
        "FTNT",
        "CRWD",
        "ADSK",
        "INTU",
        "APH",
        "NXPI",
    ],
    "Communication Services": [
        "GOOGL",
        "GOOG",
        "META",
        "NFLX",
        "DIS",
        "CMCSA",
        "T",
        "VZ",
        "TMUS",
        "CHTR",
        "EA",
        "TTWO",
        "OMC",
    ],
    "Healthcare": [
        "UNH",
        "JNJ",
        "LLY",
        "ABBV",
        "MRK",
        "TMO",
        "ABT",
        "DHR",
        "PFE",
        "BMY",
        "AMGN",
        "GILD",
        "CVS",
        "CI",
        "ISRG",
        "MDT",
        "SYK",
        "BSX",
        "REGN",
        "VRTX",
    ],
    "Financial Services": [
        "JPM",
        "BAC",
        "WFC",
        "GS",
        "MS",
        "C",
        "BLK",
        "SCHW",
        "AXP",
        "USB",
        "PNC",
        "TFC",
        "BK",
        "COF",
        "SPGI",
        "MCO",
        "CB",
        "AIG",
    ],
    "Consumer Cyclical": [
        "AMZN",
        "TSLA",
        "HD",
        "MCD",
        "NKE",
        "LOW",
        "TJX",
        "BKNG",
        "SBUX",
        "GM",
        "F",
        "MAR",
        "ABNB",
        "ORLY",
        "AZO",
        "ROST",
        "YUM",
        "CMG",
    ],
    "Consumer Defensive": [
        "WMT",
        "PG",
        "COST",
        "KO",
        "PEP",
        "PM",
        "MO",
        "MDLZ",
        "CL",
        "KMB",
        "GIS",
        "HSY",
        "KHC",
    ],
    "Industrials": [
        "GE",
        "CAT",
        "RTX",
        "HON",
        "UNP",
        "UPS",
        "DE",
        "BA",
        "LMT",
        "MMM",
        "GD",
        "NOC",
        "CSX",
        "NSC",
        "WM",
        "EMR",
        "ETN",
        "ITW",
    ],
    "Energy": [
        "XOM",
        "CVX",
        "COP",
        "SLB",
        "EOG",
        "MPC",
        "PSX",
        "VLO",
        "OXY",
        "WMB",
        "KMI",
    ],
    "Utilities": ["NEE", "DUK", "SO", "AEP", "SRE", "EXC", "XEL", "ED", "PEG", "WEC"],
    "Real Estate": ["PLD", "AMT", "EQIX", "CCI", "PSA", "SPG", "O", "WELL", "DLR", "AVB"],
    "Basic Materials": ["LIN", "APD", "ECL", "SHW", "NEM", "FCX", "NUE", "DD", "DOW", "PPG"],
}

# Yahoo sometimes uses this label — map to our pool key.
_SECTOR_ALIASES = {
    "Information Technology": "Technology",
}

_FALLBACK_LIQUID = [
    "MSFT",
    "AAPL",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "JPM",
    "V",
    "UNH",
    "XOM",
    "JNJ",
    "WMT",
    "PG",
    "MA",
    "HD",
]


def _cap_bucket_label(mc: float | None) -> str | None:
    if mc is None or mc <= 0:
        return None
    if mc >= 200e9:
        return "Mega cap"
    if mc >= 10e9:
        return "Large cap"
    if mc >= 2e9:
        return "Mid cap"
    return "Small cap"


def _pick_peers_from_scored(scored: list[tuple[str, float]], lim: int) -> list[str]:
    """Take top `lim` symbols by score, skipping GOOG when GOOGL is already chosen."""
    out: list[str] = []
    for sym, _ in scored:
        if len(out) >= lim:
            break
        if sym == "GOOG" and "GOOGL" in out:
            continue
        out.append(sym)
    return out


def _caps_in_same_ballpark(anchor: float, other: float) -> bool:
    if anchor <= 0 or other <= 0:
        return False
    b1 = _cap_bucket_label(anchor)
    b2 = _cap_bucket_label(other)
    if b1 and b2 and b1 == b2:
        return True
    lo, hi = min(anchor, other), max(anchor, other)
    return (hi / lo) <= 5.0


def _fast_market_cap(sym: str) -> float | None:
    yid = _norm_ticker(sym)
    try:
        t = _yf().Ticker(yid)
        fi = getattr(t, "fast_info", None) or {}
        cap = fi.get("market_cap") or fi.get("marketCap")
        if cap is not None:
            return float(cap)
        info = getattr(t, "info", None) or {}
        cap2 = info.get("marketCap")
        return float(cap2) if cap2 is not None else None
    except Exception as e:
        logger.debug("fast cap %s: %s", sym, e)
        return None


def suggest_sector_peers(symbol: str, limit: int = 3) -> dict[str, Any]:
    """
    Return tickers in the same Yahoo sector with similar market cap (same cap bucket or within 5×).
    ETFs get broad index proxies for comparison context.
    """
    lim = int(min(max(limit, 1), 8))
    sym = _norm_ticker(symbol)
    try:
        t = _yf().Ticker(sym)
        info = getattr(t, "info", None) or {}
    except Exception as e:
        logger.warning("peer suggest ticker %s: %s", sym, e)
        return {
            "symbol": sym,
            "peers": [],
            "error": str(e),
        }

    if not isinstance(info, dict):
        info = {}

    qt = str(info.get("quoteType") or "")
    if qt == "ETF":
        return {
            "symbol": sym,
            "is_etf": True,
            "peers": ["SPY", "QQQ", "IVV"][:lim],
            "sector": info.get("sector"),
            "message": "Funds are shown vs broad index ETFs. Stock peers apply to common equities.",
            "cap_bucket": None,
            "industry": info.get("industry"),
        }

    sector_raw = str(info.get("sector") or "").strip()
    sector = _SECTOR_ALIASES.get(sector_raw, sector_raw)
    anchor_cap = info.get("marketCap")
    try:
        anchor_cap_f = float(anchor_cap) if anchor_cap is not None else 0.0
    except (TypeError, ValueError):
        anchor_cap_f = 0.0

    industry = str(info.get("industry") or "").strip() or None
    bucket = _cap_bucket_label(anchor_cap_f if anchor_cap_f > 0 else None)

    candidates = list(dict.fromkeys(_SECTOR_TICKERS.get(sector, [])))
    if not candidates:
        candidates = list(_FALLBACK_LIQUID)

    candidates = [c for c in candidates if _norm_ticker(c) != sym]

    scored: list[tuple[str, float]] = []
    for c in candidates[:40]:
        cap = _fast_market_cap(c)
        if cap is None or cap <= 0:
            continue
        if anchor_cap_f > 0 and not _caps_in_same_ballpark(anchor_cap_f, cap):
            continue
        dist = abs(math.log(max(cap, 1.0) / max(anchor_cap_f, 1.0))) if anchor_cap_f > 0 else 0.0
        scored.append((_norm_ticker(c), dist))

    scored.sort(key=lambda x: x[1])
    peers = _pick_peers_from_scored(scored, lim)

    if not peers and anchor_cap_f > 0:
        # Widen: same sector, closest caps only by distance (ignore bucket)
        scored2: list[tuple[str, float]] = []
        for c in candidates[:40]:
            cap = _fast_market_cap(c)
            if cap is None or cap <= 0:
                continue
            dist = abs(math.log(max(cap, 1.0) / max(anchor_cap_f, 1.0)))
            scored2.append((_norm_ticker(c), dist))
        scored2.sort(key=lambda x: x[1])
        peers = _pick_peers_from_scored(scored2, lim)

    note: str | None = None
    if not peers:
        note = "Could not find close sector/cap peers from the liquid universe; compare manually."

    return {
        "symbol": sym,
        "is_etf": False,
        "peers": peers,
        "sector": sector_raw or sector,
        "industry": industry,
        "cap_bucket": bucket,
        "anchor_market_cap": round(anchor_cap_f, 2) if anchor_cap_f > 0 else None,
        "message": note,
    }
