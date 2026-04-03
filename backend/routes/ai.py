from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import Response

from backend.services.gemini_chatbot_service import ask_chatbot
from backend.services.ai_extended_service import (
    news_summary,
    portfolio_analysis,
    strategy_suggestions,
)
from backend.services.ai_service import explain_why_matters, generate_insight
from backend.services.voice_service import text_to_speech

router = APIRouter()


class ChatBody(BaseModel):
    question: str = Field("", description="User message for the Gemini chatbot")


@router.post("/chat")
def ai_chat(body: ChatBody):
    """Gemini chatbot using google.generativeai — returns {"reply": str} or {"error": str}."""
    return ask_chatbot(body.question)


@router.post("/insight")
def insight(data: dict):
    return generate_insight(data)


@router.post("/explain")
def explain(body: dict):
    """Why this matters — what it is / why it moved / what it means (Gemini or demo)."""
    return explain_why_matters(body)


@router.get("/portfolio-analysis/{user_id}")
def ai_portfolio_analysis(user_id: str):
    return portfolio_analysis(user_id)


@router.get("/news-summary")
def ai_news_summary():
    return news_summary()


@router.get("/strategy-suggestions/{user_id}")
def ai_strategy_suggestions(user_id: str):
    return strategy_suggestions(user_id)


@router.post("/audio-summary")
def ai_audio_summary(body: dict):
    text = str(body.get("text") or body.get("insight") or "").strip()
    if not text:
        ins = body.get("context") or body
        if ins:
            r = generate_insight(ins if isinstance(ins, dict) else {"data": ins})
            text = str(r.get("insight") or "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="text or context required")
    try:
        audio = text_to_speech(text[:5000])
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return Response(content=audio, media_type="audio/mpeg")
