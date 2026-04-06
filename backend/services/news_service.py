"""Market news: GNews.io + yfinance headlines; lexical sentiment; always returns articles."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

import requests

from backend.utils.env_keys import gnews_key

logger = logging.getLogger(__name__)

GNEWS_SEARCH = "https://gnews.io/api/v4/search"

NEWS_PIPELINE_ID = "gnews+yfinance+static_fallback"

_POS = (
    "surge",
    "rally",
    "gain",
    "jump",
    "soar",
    "beat",
    "bull",
    "record",
    "growth",
    "profit",
    "upgrade",
    "strong",
    "optim",
    "rebound",
    "outperform",
)
_NEG = (
    "plunge",
    "crash",
    "slump",
    "miss",
    "loss",
    "bear",
    "downgrade",
    "lawsuit",
    "fraud",
    "recession",
    "layoff",
    "fear",
    "warning",
    "probe",
    "investigation",
    "bankrupt",
    "selloff",
)


def _yf():
    import yfinance as yf

    return yf


def _yahoo_ticker(symbol: str) -> str:
    return symbol.upper().strip().replace(".", "-")


def _safe_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _normalize_tickers_param(symbol: str) -> str:
    raw = (symbol or "").strip()
    if not raw:
        return "SPY"
    parts = re.split(r"[,;]\s*", raw)
    out = [p.strip().upper() for p in parts if p.strip()]
    return ",".join(out) if out else "SPY"


# def _gnews_query(tickers_csv: str) -> str:
#     parts = [p.strip() for p in tickers_csv.split(",") if p.strip()][:8]
#     if not parts:
#         return "stock market OR federal reserve OR earnings"
#     return "(" + " OR ".join(parts) + ") stock market"

COMPANY_NAMES = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Google Alphabet",
    "GOOG": "Google Alphabet",
    "AMZN": "Amazon",
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "META": "Meta Facebook",
    "NFLX": "Netflix",
    "AMD": "AMD semiconductor",
    "INTC": "Intel",
    "CRM": "Salesforce",
    "ORCL": "Oracle",
    "UBER": "Uber",
    "LYFT": "Lyft",
    "SHOP": "Shopify",
    "SQ": "Block Square payments",
    "PYPL": "PayPal",
    "JPM": "JPMorgan Chase",
    "BAC": "Bank of America",
    "GS": "Goldman Sachs",
    "MS": "Morgan Stanley",
    "SPY": "S&P 500 market",
    "QQQ": "Nasdaq tech market",
}

def _gnews_query(tickers_csv: str) -> str:
    parts = [p.strip() for p in tickers_csv.split(",") if p.strip()][:8]
    terms = []
    for t in parts:
        company = COMPANY_NAMES.get(t.upper(), "")
        if company:
            terms.append(f'"{company}"')
        else:
            terms.append(t)
    return "(" + " OR ".join(terms) + ") stock"

def _article_from_gnews(raw: dict) -> dict:
    src = raw.get("source") or {}
    name = src.get("name") if isinstance(src, dict) else str(src or "GNews")
    return {
        "title": (raw.get("title") or "Untitled").strip(),
        "url": (raw.get("url") or "#").strip(),
        "summary": (raw.get("description") or raw.get("content") or "").strip(),
        "source": name or "GNews",
        "time_published": raw.get("publishedAt") or "",
        "banner_image": raw.get("image"),
        "category_within_source": None,
    }


def _fetch_gnews(tickers_csv: str, max_n: int) -> list[dict]:
    key = gnews_key()
    if not key:
        return []
    q = _gnews_query(tickers_csv)
    try:
        r = requests.get(
            GNEWS_SEARCH,
            params={
                "q": q,
                "apikey": key,
                "lang": "en",
                "country": "us",
                "max": min(max(max_n, 1), 100),
            },
            timeout=25,
        )
        if not r.ok:
            logger.warning("GNews HTTP %s: %s", r.status_code, r.text[:200])
            return []
        data = r.json()
        if not isinstance(data, dict):
            return []
        arts = data.get("articles") or []
        out: list[dict] = []
        for x in arts:
            if isinstance(x, dict) and (x.get("title") or "").strip():
                out.append(_article_from_gnews(x))
        return out
    except Exception as e:
        logger.warning("GNews request failed: %s", e)
        return []


def _yf_url_from_content(content: dict) -> str:
    """Resolve article URL from yfinance nested news payload (canonical / click-through)."""
    for key in ("clickThroughUrl", "canonicalUrl"):
        block = content.get(key)
        if isinstance(block, dict):
            u = (block.get("url") or "").strip()
            if u and u.startswith("http"):
                return u
    preview = content.get("previewUrl")
    if isinstance(preview, str) and preview.startswith("http"):
        return preview.strip()
    return ""


def _article_from_yfinance_row(item: dict, *, ticker: str) -> dict | None:
    """
    yfinance >= 0.2.40 returns news rows as {id, content: {title, canonicalUrl, ...}}.
    Older builds used a flat {title, link, publisher, providerPublishTime, summary}.
    """
    sym = _yahoo_ticker(ticker)
    quote_news = f"https://finance.yahoo.com/quote/{sym}/news/"

    content = item.get("content")
    if isinstance(content, dict):
        title = (content.get("title") or "").strip()
        if not title:
            return None
        link = _yf_url_from_content(content)
        if not link:
            link = quote_news
        summary = (content.get("summary") or content.get("description") or "").strip()
        pub = (content.get("pubDate") or content.get("displayTime") or "").strip()
        pr = content.get("provider")
        provider: dict = pr if isinstance(pr, dict) else {}
        publisher = (str(provider.get("displayName") or "Yahoo Finance")).strip() or "Yahoo Finance"
        return {
            "title": title,
            "url": link,
            "summary": summary,
            "source": publisher,
            "time_published": pub,
            "banner_image": None,
            "category_within_source": None,
        }

    title = (item.get("title") or "").strip()
    if not title:
        return None
    link = (item.get("link") or "").strip() or quote_news
    pub = ""
    raw_pub = item.get("providerPublishTime")
    if raw_pub is not None:
        try:
            pub = datetime.fromtimestamp(int(raw_pub), tz=timezone.utc).isoformat()
        except Exception:
            pub = str(raw_pub)
    return {
        "title": title,
        "url": link,
        "summary": (item.get("summary") or "").strip(),
        "source": (item.get("publisher") or "Yahoo Finance"),
        "time_published": pub,
        "banner_image": None,
        "category_within_source": None,
    }


def _fetch_yfinance_news(tickers: list[str], need: int) -> list[dict]:
    if need <= 0:
        return []

    out: list[dict] = []
    seen_titles: set[str] = set()
    for ticker in tickers:
        try:
            t = _yf().Ticker(_yahoo_ticker(ticker))
            news = getattr(t, "news", None) or []
        except Exception as e:
            logger.warning("yfinance news %s: %s", ticker, e)
            continue
        for item in news:
            if not isinstance(item, dict):
                continue
            row = _article_from_yfinance_row(item, ticker=ticker)
            if not row:
                continue
            title = row["title"]
            tkey = title.lower()[:140]
            if tkey in seen_titles:
                continue
            seen_titles.add(tkey)
            out.append(row)
            if len(out) >= need:
                break
        if len(out) >= need:
            break
    return out

def _static_articles(missing: int) -> list[dict]:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pool = [
        {
            "title": "Markets digest macro data and central-bank guidance",
            "url": "https://finance.yahoo.com/news/",
            "summary": "Placeholder item while live feeds catch up — your portfolio tools still work.",
            "source": "FinSight (offline fallback)",
        },
        {
            "title": "Earnings and guidance remain key drivers of sector rotation",
            "url": "https://finance.yahoo.com/markets/",
            "summary": "Fallback headline — add GNEWS_API_KEY for broader real-time coverage.",
            "source": "FinSight (offline fallback)",
        },
        {
            "title": "Volatility reflects rates, labor prints, and positioning into month-end",
            "url": "https://finance.yahoo.com/markets/stocks/",
            "summary": "Synthetic line — APIs or upstream news may be rate-limited or unreachable.",
            "source": "FinSight (offline fallback)",
        },
        {
            "title": "Investors balance growth outlook with credit and liquidity conditions",
            "url": "https://finance.yahoo.com/topic/economic-news/",
            "summary": "Ensures Insights and podcasts always have narrative context.",
            "source": "FinSight (offline fallback)",
        },
    ]
    out: list[dict] = []
    i = 0
    while len(out) < missing and (i < 50):
        row = pool[i % len(pool)]
        out.append(
            {
                **row,
                "time_published": ts,
                "banner_image": None,
                "category_within_source": None,
            }
        )
        i += 1
    return out


def _dedupe(articles: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for a in articles:
        url = ((a.get("url") or "").split("?")[0]).lower().strip()
        title = (a.get("title") or "").lower().strip()[:120]
        key = url if url and url != "#" else title
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(a)
    return out


def _lexical_sentiment(article: dict) -> None:
    t = f"{article.get('title') or ''} {article.get('summary') or ''}".lower()
    p = sum(1 for w in _POS if w in t)
    n = sum(1 for w in _NEG if w in t)
    if p == 0 and n == 0:
        article["overall_sentiment_score"] = 0.0
        article["overall_sentiment_label"] = "Neutral"
        return
    score = (p - n) / max(p + n, 1)
    score = max(-1.0, min(1.0, score))
    article["overall_sentiment_score"] = round(score, 4)
    if score >= 0.25:
        article["overall_sentiment_label"] = "Bullish"
    elif score <= -0.25:
        article["overall_sentiment_label"] = "Bearish"
    else:
        article["overall_sentiment_label"] = "Neutral"


def get_news_sentiment(symbol: str, limit: int = 30) -> dict:
    tickers = _normalize_tickers_param(symbol)
    lim = int(min(max(limit, 5), 100))
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        ticker_list = ["SPY"]
    providers: list[str] = []
    articles: list[dict] = []

    # Try yfinance first — free, no API key
    yfn = _fetch_yfinance_news(ticker_list, lim)
    if yfn:
        articles.extend(yfn)
        providers.append("yfinance")

    # Use GNews to fill remaining slots if we have quota
    if len(articles) < lim:
        need = lim - len(articles)
        gn = _fetch_gnews(tickers, need)
        if gn:
            articles.extend(gn)
            providers.append("gnews")

    articles = _dedupe(articles)

    # Only inject static placeholders if every live source failed.
    if len(articles) == 0:
        floor = min(lim, 6)
        articles.extend(_static_articles(floor))
        providers.append("fallback")

    articles = articles[:lim]
    for a in articles:
        _lexical_sentiment(a)

    scores: list[float] = []
    for a in articles:
        s = _safe_float(a.get("overall_sentiment_score"))
        if s is not None:
            scores.append(float(s))
    avg = sum(scores) / len(scores) if scores else 0.0

    payload = {
        "symbol": tickers,
        "avg_sentiment": round(avg, 4),
        "articles": articles,
        "article_count": len(articles),
        "news_providers": list(dict.fromkeys(providers)) or ["fallback"],
        "pipeline": NEWS_PIPELINE_ID,
    }
    if providers == ["fallback"] or providers == []:
        payload["api_message"] = (
            "Live news feed unavailable right now. Add GNEWS_API_KEY and verify network access; "
            "showing temporary fallback headlines."
        )
    return payload

# def get_news_sentiment(symbol: str, limit: int = 30) -> dict:
#     tickers = _normalize_tickers_param(symbol)
#     lim = int(min(max(limit, 5), 100))
#     prefer = tickers.split(",")[0].strip().upper() or "SPY"

#     providers: list[str] = []
#     articles: list[dict] = []

#     gn = _fetch_gnews(tickers, lim)
#     if gn:
#         articles.extend(gn)
#         providers.append("gnews")

#     if len(articles) < lim:
#         need = lim - len(articles)
#         yfn = _fetch_yfinance_news(prefer, need)
#         if yfn:
#             articles.extend(yfn)
#             providers.append("yfinance")

#     articles = _dedupe(articles)

#     floor = min(lim, 10)
#     if len(articles) < floor:
#         articles.extend(_static_articles(floor - len(articles)))
#         providers.append("fallback")

#     articles = articles[:lim]
#     for a in articles:
#         _lexical_sentiment(a)

#     scores: list[float] = []
#     for a in articles:
#         s = _safe_float(a.get("overall_sentiment_score"))
#         if s is not None:
#             scores.append(float(s))
#     avg = sum(scores) / len(scores) if scores else 0.0

#     return {
#         "symbol": tickers,
#         "avg_sentiment": round(avg, 4),
#         "articles": articles,
#         "article_count": len(articles),
#         "news_providers": list(dict.fromkeys(providers)) or ["fallback"],
#         "pipeline": NEWS_PIPELINE_ID,
#     }


def get_multi_ticker_news(limit: int = 40) -> dict:
    tickers = "SPY,QQQ,XLK,XLF,NVDA,AAPL,MSFT,TSLA,GOOGL,META"
    return get_news_sentiment(tickers, limit=limit)


def _article_digest_slice(a: dict) -> dict[str, Any]:
    title = (a.get("title") or "").strip() or "Untitled"
    summary = (a.get("summary") or "").strip()
    if len(summary) > 1200:
        summary = summary[:1197] + "…"
    return {
        "title": title,
        "summary": summary or title,
        "url": (a.get("url") or "#").strip(),
        "source": (a.get("source") or "").strip() or "News",
        "time_published": (a.get("time_published") or "").strip(),
        "sentiment_label": a.get("overall_sentiment_label"),
    }


def get_narrative_digest(limit: int = 72) -> dict[str, Any]:
    """
    One curated story per narrative lane for dashboards (Market Pulse).
    Buckets: macro, sector, international, geopolitical, two_names (0–2 stock catalysts).
    """
    base = get_multi_ticker_news(limit=min(max(limit, 20), 100))
    articles: list[dict] = list(base.get("articles") or [])

    macro: dict | None = None
    sector: dict | None = None
    international: dict | None = None
    geopolitical: dict | None = None
    two_names: list[dict] = []

    used: set[str] = set()

    def key_url(a: dict) -> str:
        u = ((a.get("url") or "").split("?")[0]).lower().strip()
        if u and u != "#":
            return u
        return (a.get("title") or "").lower().strip()[:160]

    for a in articles:
        k = key_url(a)
        if k in used:
            continue
        b = categorize_article_bucket(a)
        if b == "macro" and macro is None:
            macro = _article_digest_slice(a)
            used.add(k)
        elif b == "sector" and sector is None:
            sector = _article_digest_slice(a)
            used.add(k)
        elif b == "intl" and international is None:
            international = _article_digest_slice(a)
            used.add(k)
        elif b == "geo" and geopolitical is None:
            geopolitical = _article_digest_slice(a)
            used.add(k)
        elif b == "stock" and len(two_names) < 2:
            two_names.append(_article_digest_slice(a))
            used.add(k)

    return {
        "buckets": {
            "macro": macro,
            "sector": sector,
            "international": international,
            "geopolitical": geopolitical,
            "two_names": two_names,
        },
        "pipeline": base.get("pipeline"),
        "article_count": len(articles),
    }


def categorize_article_bucket(article: dict) -> str | None:
    """Assign one narrative bucket: geo, macro, intl, sector, stock."""
    t = f"{article.get('title') or ''} {article.get('summary') or ''}".lower()
    geo_kw = (
        "war",
        "conflict",
        "sanctions",
        "geopolitical",
        "nato",
        "ukraine",
        "russia",
        "iran",
        "middle east",
        "taiwan",
        "election",
        "gaza",
        "israel",
        "defense",
    )
    if any(k in t for k in geo_kw):
        return "geo"
    macro_kw = (
        "fed ",
        "fomc",
        "cpi",
        "inflation",
        "gdp",
        "jobs report",
        "payrolls",
        "treasury",
        "recession",
        "rates",
        "yield curve",
        "consumer price",
    )
    if any(k in t for k in macro_kw):
        return "macro"
    intl_kw = (
        "europe",
        "china",
        "japan",
        "emerging",
        "currency",
        "forex",
        "fx ",
        "yen",
        "euro",
        "ecb",
        "boj",
        "international",
        "foreign",
        "trade deal",
        "overseas",
        "dollar index",
    )
    if any(k in t for k in intl_kw):
        return "intl"
    sector_kw = (
        "semiconductor",
        "chip",
        "bank",
        "energy sector",
        "healthcare sector",
        "tech sector",
        "sector",
        "xlk",
        "xlf",
        "xle",
    )
    if any(k in t for k in sector_kw):
        return "sector"
    stock_kw = (
        "earnings",
        "guidance",
        "eps",
        "revenue",
        "nvidia",
        "apple",
        "microsoft",
        "tesla",
        "amazon",
        "meta",
        "alphabet",
    )
    if any(k in t for k in stock_kw):
        return "stock"
    return None
