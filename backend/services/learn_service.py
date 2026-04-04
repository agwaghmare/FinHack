"""Learn domain service: modules, quiz checks, certificates, and tutor wiring."""

from __future__ import annotations

from typing import Any

from backend.data.learn_modules import LEARN_MODULES, QUIZZES
from backend.services.ai_extended_service import learn_tutor_reply


def module_ids() -> list[str]:
    return [str(m.get("id") or "") for m in LEARN_MODULES if str(m.get("id") or "").strip()]


def list_modules() -> dict[str, Any]:
    out = [{**m, "question_count": len(QUIZZES.get(m["id"], []))} for m in LEARN_MODULES]
    return {"modules": out}


def get_module(module_id: str) -> dict[str, Any]:
    for m in LEARN_MODULES:
        if m["id"] == module_id:
            return m
    return {"error": "not_found", "module_id": module_id}


def get_quiz(module_id: str) -> dict[str, Any]:
    q = QUIZZES.get(module_id, [])
    safe = [{k: v for k, v in item.items() if k != "correct"} for item in q]
    return {"module_id": module_id, "questions": safe, "_note": "POST answers to validate"}


def submit_quiz(module_id: str, answers: list[int]) -> dict[str, Any]:
    qlist = QUIZZES.get(module_id, [])
    correct = 0
    for i, q in enumerate(qlist):
        if i < len(answers) and answers[i] == q.get("correct"):
            correct += 1
    total = len(qlist) or 1
    score = round(100 * correct / total)
    return {"module_id": module_id, "score": score, "passed": score >= 60}


def certificate(user_id: str, module_id: str) -> dict[str, Any]:
    title = next((m["title"] for m in LEARN_MODULES if m["id"] == module_id), module_id)
    return {
        "user_id": user_id,
        "module_id": module_id,
        "title": title,
        "credential": f"cert-{module_id}-{user_id[:8]}",
        "message": "Demo certificate — complete quiz with score >= 60 for full unlock.",
    }


def tutor(module_id: str, question: str) -> dict[str, Any]:
    m = next((x for x in LEARN_MODULES if x["id"] == module_id), None)
    if not m:
        return {
            "error": "unknown_module",
            "module_id": module_id,
            "valid_module_ids": module_ids(),
            "hint": "Use one of the IDs from GET /learn/modules (e.g. market-basics).",
        }
    raw_topics = m.get("topics")
    topics = [str(t) for t in raw_topics] if isinstance(raw_topics, list) else []
    return learn_tutor_reply(
        str(m.get("title") or module_id),
        str(m.get("summary") or ""),
        topics,
        question,
    )


def module_audio_text(module_id: str, body_text: str | None) -> str:
    if body_text and body_text.strip():
        return body_text.strip()
    m = next((x for x in LEARN_MODULES if x["id"] == module_id), None)
    return f"Module {m['title'] if m else module_id}. {m['summary'] if m else ''}"

