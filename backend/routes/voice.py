from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend.services.voice_service import text_to_speech

router = APIRouter()


@router.post("/generate")
def generate(body: dict):
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        audio = text_to_speech(text)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS failed: {e!s}") from e

    return Response(content=audio, media_type="audio/mpeg")
