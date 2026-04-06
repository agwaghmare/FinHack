from fastapi import APIRouter, Query

from backend.services.news_service import get_narrative_digest, get_news_sentiment

router = APIRouter()


@router.get("/sentiment/{symbol}")
def sentiment(
    symbol: str,
    limit: int = Query(30, ge=5, le=100, description="Max articles to return"),
):
    return get_news_sentiment(symbol, limit=limit)


@router.get("/narrative-digest")
def narrative_digest(
    limit: int = Query(72, ge=20, le=100, description="Pool size before bucketing"),
):
    """Curated headline + summary per narrative lane (Market Pulse)."""
    return get_narrative_digest(limit=limit)
