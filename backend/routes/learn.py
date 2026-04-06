"""Learn section — modules, quizzes, certificates (demo)."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.data.learn_modules import LEARN_MODULES, QUIZZES
from backend.services.ai_extended_service import learn_tutor_reply
from backend.services.learn_community_service import (
    add_reply as community_add_reply,
    create_post as community_create_post,
    list_posts as community_list_posts,
    risk_preview as community_risk_preview,
)
from backend.services.learn_service import certificate as build_certificate
from backend.services.voice_service import text_to_speech

router = APIRouter()


class LearnTutorIn(BaseModel):
    module_id: str = Field(..., min_length=1, max_length=64)
    question: str = Field(..., min_length=3, max_length=2000)


class CommunityPostIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=256)
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10, max_length=5000)


class CommunityReplyIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=256)
    body: str = Field(..., min_length=5, max_length=2000)


@router.get("/modules")
def list_modules():
    out = [{**m, "question_count": len(QUIZZES.get(m["id"], []))} for m in LEARN_MODULES]
    return {"modules": out}


@router.get("/module/{module_id}")
def get_module(module_id: str):
    for m in LEARN_MODULES:
        if m["id"] == module_id:
            return m
    return {"error": "not_found", "module_id": module_id}


@router.get("/quiz/{module_id}")
def get_quiz(module_id: str):
    q = QUIZZES.get(module_id, [])
    # strip correct answers for client — send indices only on submit server-side in prod
    safe = [{k: v for k, v in item.items() if k != "correct"} for item in q]
    return {"module_id": module_id, "questions": safe, "_note": "POST answers to validate"}


@router.post("/quiz/{module_id}/submit")
def submit_quiz(module_id: str, body: dict):
    answers = body.get("answers") or []
    qlist = QUIZZES.get(module_id, [])
    correct = 0
    for i, q in enumerate(qlist):
        if i < len(answers) and answers[i] == q.get("correct"):
            correct += 1
    total = len(qlist) or 1
    score = round(100 * correct / total)
    return {"module_id": module_id, "score": score, "passed": score >= 60}


@router.get("/certificate/{user_id}/{module_id}")
def certificate(user_id: str, module_id: str):
    return build_certificate(user_id, module_id)


@router.post("/tutor")
def learn_tutor(body: LearnTutorIn):
    """Ask the Learn tutor (Mistral AI chat)."""
    m = next((x for x in LEARN_MODULES if x["id"] == body.module_id), None)
    if not m:
        return {"error": "unknown_module", "module_id": body.module_id}
    raw_topics = m.get("topics")
    topics = [str(t) for t in raw_topics] if isinstance(raw_topics, list) else []
    return learn_tutor_reply(
        str(m.get("title") or body.module_id),
        str(m.get("summary") or ""),
        topics,
        body.question,
    )


@router.get("/community/risk-preview/{user_id}")
def learn_community_risk_preview(user_id: str):
    """Portfolio risk only (no LLM) — for badges in the peer circle."""
    return community_risk_preview(user_id)


@router.get("/community/posts")
def learn_community_posts():
    return community_list_posts()


@router.post("/community/posts")
def learn_community_create_post(body: CommunityPostIn):
    out = community_create_post(body.user_id, body.title, body.body)
    if out.get("error"):
        raise HTTPException(
            status_code=400,
            detail=out.get("detail") or out.get("error"),
        )
    return out


@router.post("/community/posts/{post_id}/reply")
def learn_community_reply(post_id: str, body: CommunityReplyIn):
    out = community_add_reply(post_id, body.user_id, body.body)
    if out.get("error") == "not_found":
        raise HTTPException(status_code=404, detail="Thread not found")
    if out.get("error"):
        raise HTTPException(
            status_code=400,
            detail=out.get("detail") or out.get("error"),
        )
    return out


@router.post("/audio/{module_id}")
def learn_audio(module_id: str, body: Optional[dict] = None):
    text = (body or {}).get("text") or ""
    if not text:
        m = next((x for x in LEARN_MODULES if x["id"] == module_id), None)
        text = f"Module {m['title'] if m else module_id}. {m['summary'] if m else ''}"
    try:
        audio = text_to_speech(text[:4000])
    except Exception as e:
        return {"error": str(e), "fallback": "use browser speech or configure ElevenLabs"}
    return Response(content=audio, media_type="audio/mpeg")
