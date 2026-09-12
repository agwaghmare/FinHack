from fastapi import APIRouter

from backend.routes.ai import router as ai_router
from backend.routes.alerts import router as alerts_router
from backend.routes.auth import router as auth_router
from backend.routes.learn import router as learn_router
from backend.routes.macro import router as macro_router
from backend.routes.market import router as market_router
from backend.routes.news import router as news_router
from backend.routes.portfolio import router as portfolio_router
from backend.routes.trade import router as trade_router
from backend.routes.trading import router as trading_router
from backend.routes.voice import router as voice_router

api_router = APIRouter()

api_router.include_router(market_router, prefix="/market", tags=["market"])
api_router.include_router(news_router, prefix="/news", tags=["news"])
api_router.include_router(macro_router, prefix="/macro", tags=["macro"])
api_router.include_router(portfolio_router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(voice_router, prefix="/voice", tags=["voice"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(trade_router, prefix="/trade", tags=["trade"])
api_router.include_router(trading_router, prefix="/trading", tags=["trading"])
api_router.include_router(learn_router, prefix="/learn", tags=["learn"])
