from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.services.macro_service import get_macro_data
from backend.services.market_service import get_market_prices
from backend.services.news_service import (
    categorize_article_bucket,
    get_multi_ticker_news,
    get_news_sentiment,
)
from backend.services.voice_service import text_to_speech

logger = logging.getLogger(__name__)


@dataclass
class PodcastState:
    audio: bytes | None = None
    script: str | None = None
    generated_at: datetime | None = None


_close = PodcastState()
_open = PodcastState()
_scheduler_started = False

_HARDCODED_MARKET_PARAGRAPH = (
    "Macro update: Treasury yields and inflation-sensitive sectors remain in focus as traders parse the latest "
    "economic prints and central-bank tone, with risk assets still reacting sharply to changes in growth and rates "
    "expectations. Geopolitical headline watch remains active around Red Sea shipping disruptions and broader "
    "Middle East tensions, both of which can quickly feed into energy prices, freight costs, and global risk "
    "sentiment. Single-name spotlight: Nike's recent earnings reflected mixed consumer demand dynamics and margin "
    "pressure from promotions in parts of the business, while management emphasized product cycles and inventory "
    "discipline as key levers for stabilization into upcoming quarters."
)


def _norm_session(session: str | None) -> str:
    return "open" if (session or "").strip().lower() == "open" else "close"


def _state_for(session: str | None) -> PodcastState:
    return _open if _norm_session(session) == "open" else _close


def _parse_change_percent(q: dict) -> float:
    try:
        return float(str(q.get("change_percent") or "0").strip())
    except Exception:
        return 0.0


def _format_money(x: float) -> str:
    return f"${x:,.2f}"


def _one_line_story(article: dict) -> str:
    title = (article.get("title") or "").strip()
    summary = (article.get("summary") or "").strip()
    if summary and len(summary) > 40:
        clip = summary[:220].rsplit(" ", 1)[0]
        return f"{title}. {clip}."
    return title or "Headline unavailable."


def _is_live_article(article: dict) -> bool:
    src = str(article.get("source") or "").lower()
    title = str(article.get("title") or "").lower()
    summary = str(article.get("summary") or "").lower()
    blob = f"{src} {title} {summary}"
    blocked = (
        "offline fallback",
        "placeholder item",
        "fallback headline",
        "synthetic line",
        "rate-limited",
        "unreachable",
        "temporary fallback",
    )
    return not any(k in blob for k in blocked)


def _build_market_open_text() -> str:
    """Shorter pre-market / opening-bell style script (distinct from full close recap)."""
    date_et = datetime.now(ZoneInfo("America/New_York")).strftime("%B %d, %Y")
    news: dict = {}
    try:
        news = get_multi_ticker_news(limit=32)
    except Exception as e:
        logger.warning("open podcast multi news: %s", e)
        try:
            news = get_news_sentiment("SPY", limit=14)
        except Exception as e2:
            logger.warning("open podcast SPY news: %s", e2)
            news = {}

    raw_articles = [a for a in (news.get("articles") or []) if _is_live_article(a)]
    buckets = _pick_categorized_stories(raw_articles)
    parts: list[str] = [
        f"Good morning. This is your market open briefing for {date_et}. "
        "Here is a fast read on macro, sectors, and the early tape.",
        _HARDCODED_MARKET_PARAGRAPH,
    ]
    if buckets.get("macro"):
        parts.append(f"Macro: {_one_line_story(buckets['macro'][0])}")
    if buckets.get("sector"):
        parts.append(f"Sector theme: {_one_line_story(buckets['sector'][0])}")
    if buckets.get("intl"):
        parts.append(f"International: {_one_line_story(buckets['intl'][0])}")
    if buckets.get("geo"):
        parts.append(f"Geopolitical: {_one_line_story(buckets['geo'][0])}")
    take_stock = buckets.get("stock") or []
    if take_stock:
        parts.append(f"Stock story: {_one_line_story(take_stock[0])}")

    try:
        qr = get_market_prices(["SPY", "QQQ", "NVDA", "AAPL", "MSFT"])
        qs = [q for q in (qr.get("quotes") or []) if not q.get("error")]
        tape_bits = []
        for q in qs[:6]:
            sym = str(q.get("symbol") or "")
            cp = _parse_change_percent(q)
            tape_bits.append(f"{sym} {cp:+.1f} percent")
        if tape_bits:
            parts.append("Early reference tape: " + "; ".join(tape_bits) + ".")
    except Exception as e:
        logger.warning("open podcast quotes: %s", e)

    avg_sentiment = float(news.get("avg_sentiment") or 0.0)
    parts.append(
        f"Headline sentiment score is about {avg_sentiment:.2f} on a minus-one to plus-one scale. "
        "Tune in again after the close for the full recap with movers, mega-caps, and more headline depth."
    )
    return " ".join(parts)[:3200]


def _pick_categorized_stories(articles: list[dict]) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {
        "macro": [],
        "sector": [],
        "intl": [],
        "geo": [],
        "stock": [],
    }
    seen_titles: set[str] = set()
    for a in articles:
        title = (a.get("title") or "").strip()
        if not title or title in seen_titles:
            continue
        b = categorize_article_bucket(a)
        if not b:
            continue
        seen_titles.add(title)
        buckets[b].append(a)
    return buckets


def _build_market_close_text() -> str:
    """Create a plain-English market close script.

    If Gemini is available, we could further polish, but we keep this deterministic so
    the podcast is still generated even without GEMINI_API_KEY.
    """

    # Movers / leaders universe (matches Market Pulse UI).
    movers_symbols = ["NVDA", "TSLA", "AMD", "NFLX", "META", "AAPL", "MSFT", "AMZN", "COIN", "PLTR"]
    cap_leaders_symbols = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK.B"]

    macro = {}
    try:
        macro = get_macro_data() or {}
    except Exception as e:
        logger.warning("macro fetch failed: %s", e)

    # Price snapshot + movers.
    price_symbols = list(dict.fromkeys(movers_symbols + cap_leaders_symbols + ["WTI", "BTC", "ETH"]))
    quotes_resp = get_market_prices(price_symbols)
    quotes = quotes_resp.get("quotes") or []

    by_symbol = {str(q.get("symbol") or "").upper(): q for q in quotes if q.get("symbol")}

    movers = [by_symbol[s] for s in movers_symbols if by_symbol.get(s)]
    movers = [q for q in movers if q.get("kind") == "equity" and not q.get("error")]
    movers_sorted = sorted(movers, key=lambda q: abs(_parse_change_percent(q)), reverse=True)

    risers = [q for q in movers_sorted if _parse_change_percent(q) > 0][:3]
    fallers = [q for q in movers_sorted if _parse_change_percent(q) < 0][:3]

    leaders = [by_symbol[s] for s in cap_leaders_symbols if by_symbol.get(s)]
    leaders = [q for q in leaders if q.get("kind") == "equity"]

    # Multi-source news for podcast narrative (macro / sector / intl / geo / stocks).
    news = {}
    try:
        news = get_multi_ticker_news(limit=45)
    except Exception as e:
        logger.warning("multi-ticker news fetch failed: %s", e)
        try:
            news = get_news_sentiment("SPY", limit=18)
        except Exception as e2:
            logger.warning("fallback news sentiment fetch failed: %s", e2)

    avg_sentiment = float(news.get("avg_sentiment") or 0.0)
    raw_articles = [a for a in (news.get("articles") or []) if _is_live_article(a)]
    buckets = _pick_categorized_stories(raw_articles)

    def take(bucket: str, n: int = 1) -> list[dict]:
        return buckets.get(bucket, [])[:n]

    macro_story = take("macro", 1)
    sector_story = take("sector", 1)
    intl_story = take("intl", 1)
    geo_story = take("geo", 1)
    stock_stories = take("stock", 4)[:2]
    top_headlines = raw_articles[:3]
    if len(stock_stories) < 2:
        # Fill from uncategorized equity headlines (title-only bucket).
        for a in raw_articles:
            if len(stock_stories) >= 2:
                break
            t = (a.get("title") or "").strip()
            if not t or a in stock_stories:
                continue
            if any(s.get("title") == t for s in stock_stories):
                continue
            stock_stories.append(a)

    narrative_parts: list[str] = [
        "This is your condensed market podcast, built from several headline streams.",
        _HARDCODED_MARKET_PARAGRAPH,
    ]
    if macro_story:
        narrative_parts.append(f"Macro angle: {_one_line_story(macro_story[0])}")
    if sector_story:
        narrative_parts.append(f"Sector focus: {_one_line_story(sector_story[0])}")
    if intl_story:
        narrative_parts.append(f"International: {_one_line_story(intl_story[0])}")
    if geo_story:
        narrative_parts.append(f"Geopolitical: {_one_line_story(geo_story[0])}")
    stock_lines = 0
    for i, a in enumerate(stock_stories[:2]):
        label = "Earnings and single-name" if i == 0 else "Another name to watch"
        narrative_parts.append(f"{label}: {_one_line_story(a)}")
        stock_lines += 1
    if stock_lines == 0 and top_headlines:
        narrative_parts.append(f"Single-name context: {_one_line_story(top_headlines[0])}")

    # Commodities & crypto quick mention.
    wti = by_symbol.get("WTI")
    btc = by_symbol.get("BTC") or by_symbol.get("BTC/USD") or next(
        (q for q in quotes if str(q.get("symbol") or "").upper().startswith("BTC")), None
    )
    eth = by_symbol.get("ETH") or by_symbol.get("ETH/USD") or next(
        (q for q in quotes if str(q.get("symbol") or "").upper().startswith("ETH")), None
    )

    date_et = datetime.now(ZoneInfo("America/New_York")).strftime("%b %d, %Y")

    macro_line = "Macro snapshot unavailable."
    if macro:
        cpi = macro.get("cpi")
        rates = macro.get("rates")
        gdp = macro.get("gdp")
        if cpi is not None or rates is not None or gdp is not None:
            macro_line = (
                f"Macro today: CPI index {cpi:.1f} if available, fed funds {rates:.2f}%,"
                f" and GDP level {gdp:.0f} billion dollars."
            )

    def qline(q: dict) -> str:
        sym = str(q.get("symbol") or "—")
        px = q.get("price")
        cp = _parse_change_percent(q)
        if isinstance(px, (int, float)) and px:
            return f"{sym} at {px:.2f}, {cp:+.2f}%"
        return f"{sym} (data unavailable)"

    movers_block = "Top movers: "
    if risers:
        movers_block += "risers: " + ", ".join([qline(q) for q in risers])
    if fallers:
        movers_block += ". " if risers else ""
        movers_block += "fallers: " + ", ".join([qline(q) for q in fallers])
    if not risers and not fallers:
        movers_block = "Top movers are unavailable right now due to data limits."

    leaders_block = "Largest-cap watchlist: " + ", ".join(
        [qline(q) for q in leaders[:6] if q]
    )

    crypto_block = ""
    if btc and isinstance(btc.get("price"), (int, float)):
        crypto_block += f"Bitcoin trades around {btc['price']:.0f} dollars. "
    if eth and isinstance(eth.get("price"), (int, float)):
        crypto_block += f"Ethereum trades around {eth['price']:.0f} dollars. "
    if not crypto_block and (wti and isinstance(wti.get("price"), (int, float))):
        crypto_block = f"WTI oil is around {wti['price']:.2f} dollars per barrel."
    elif wti and isinstance(wti.get("price"), (int, float)):
        crypto_block += f"WTI oil is around {wti['price']:.2f} dollars per barrel."

    sentiment_label = "neutral"
    if avg_sentiment > 0.15:
        sentiment_label = "positive"
    elif avg_sentiment < -0.15:
        sentiment_label = "negative"

    headlines_block = ""
    if top_headlines:
        headlines_block = "Headline snapshot: " + "; ".join(
            [f"{a.get('title')}" for a in top_headlines if a.get("title")][:3]
        ) + "."

    # Closing guidance.
    guidance = (
        "For the next session, watch how leadership names confirm strength or weakness, "
        "and treat large swings as signal for risk control, not a guarantee of trend."
    )

    # Fallback: deterministic script (multi-article narrative + tape + sentiment).
    narrative = " ".join(narrative_parts)
    return (
        f"Market close recap for {date_et}. {narrative} "
        f"{macro_line} "
        f"{movers_block}. "
        f"{leaders_block}. "
        f"{crypto_block} "
        f"Aggregated headline sentiment is {sentiment_label}, score {avg_sentiment:.2f}. "
        f"{headlines_block} "
        f"{guidance}"
    )[:4800]


def generate_market_podcast_audio(session: str | None = "close") -> bytes | None:
    """Generate podcast MP3 for `close` (afternoon recap) or `open` (morning briefing)."""
    st = _state_for(session)
    script = _build_market_open_text() if _norm_session(session) == "open" else _build_market_close_text()
    st.script = script
    try:
        audio = text_to_speech(script)
    except Exception as e:
        logger.exception("TTS generation failed: %s", e)
        st.audio = None
        st.generated_at = datetime.now(tz=ZoneInfo("UTC"))
        return None

    st.audio = audio
    st.generated_at = datetime.now(tz=ZoneInfo("UTC"))
    return audio


def generate_market_close_podcast_audio() -> bytes | None:
    """Backward-compatible alias."""
    return generate_market_podcast_audio("close")


def get_latest_podcast_audio(session: str | None = None) -> tuple[bytes | None, datetime | None]:
    st = _state_for(session)
    return st.audio, st.generated_at


def get_latest_podcast_script(session: str | None = None) -> tuple[str | None, datetime | None]:
    st = _state_for(session)
    return st.script, st.generated_at


def start_market_podcast_scheduler() -> None:
    """Schedule podcast generation at 4:05pm America/New_York (weekdays)."""
    global _scheduler_started
    if _scheduler_started:
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except Exception as e:
        logger.warning("APScheduler not available: %s", e)
        return

    sched = BackgroundScheduler(timezone=ZoneInfo("America/New_York"))
    trigger = CronTrigger(hour=16, minute=5, day_of_week="mon-fri")

    def job_close():
        try:
            audio = generate_market_podcast_audio("close")
            if audio:
                logger.info("Market close podcast generated at %s", _close.generated_at)
        except Exception as e:
            logger.exception("Market close podcast job failed: %s", e)

    def job_open():
        try:
            audio = generate_market_podcast_audio("open")
            if audio:
                logger.info("Market open podcast generated at %s", _open.generated_at)
        except Exception as e:
            logger.exception("Market open podcast job failed: %s", e)

    trigger_open = CronTrigger(hour=9, minute=35, day_of_week="mon-fri")

    sched.add_job(job_close, trigger=trigger, id="market_close_podcast", replace_existing=True, max_instances=1)
    sched.add_job(job_open, trigger=trigger_open, id="market_open_podcast", replace_existing=True, max_instances=1)
    sched.start()
    _scheduler_started = True
    logger.info("Market open/close podcast schedulers started")

