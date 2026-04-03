"""FinSight chatbot via google.generativeai (Gemini). Uses GEMINI_API_KEY / GOOGLE_API_KEY from env."""

from __future__ import annotations

import logging
import os

import google.generativeai as genai

from backend.utils.env_keys import gemini_key

logger = logging.getLogger(__name__)

# Prefer env override; fall back if a model ID is unavailable on your account.
_DEFAULT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
_FALLBACK_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
)

_configured_key: str | None = None


def _ensure_configured() -> bool:
    global _configured_key
    api_key = gemini_key()
    if not api_key:
        return False
    if _configured_key != api_key:
        genai.configure(api_key=api_key)
        _configured_key = api_key
    return True


def ask_chatbot(question: str) -> dict:
    """
    Ask the Gemini chatbot a question.

    Returns:
        {"reply": str} on success, or {"error": str} on failure / missing key.
    """
    if not question or not str(question).strip():
        return {"error": "Question cannot be empty"}

    if not _ensure_configured():
        return {
            "error": "Missing GEMINI_API_KEY (or GOOGLE_API_KEY / GENAI aliases) in API environment.",
        }

    q = str(question).strip()
    models_to_try: list[str] = []
    if _DEFAULT_MODEL not in _FALLBACK_MODELS:
        models_to_try.append(_DEFAULT_MODEL)
    for m in _FALLBACK_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_err: Exception | None = None
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(q)
            text = (getattr(response, "text", None) or "").strip()
            if not text:
                last_err = RuntimeError("Empty response text from model")
                continue
            return {"reply": text}
        except Exception as e:
            last_err = e
            logger.warning("Gemini chat model %s failed: %s", model_name, e)
            continue

    err_msg = str(last_err) if last_err else "No response from any model"
    logger.exception("Gemini chatbot failed: %s", err_msg)
    return {"error": f"Chatbot service error: {err_msg}"}
