from fastapi import APIRouter, Query

from backend.services.news_service import get_news_sentiment

router = APIRouter()


@router.get("/sentiment/{symbol}")
def sentiment(
    symbol: str,
    limit: int = Query(30, ge=5, le=100, description="Max articles to return"),
):
    return get_news_sentiment(symbol, limit=limit)
