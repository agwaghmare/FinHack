import logging

import requests

from backend.utils.env_keys import elevenlabs_key

logger = logging.getLogger(__name__)


def text_to_speech(text: str) -> bytes:
    key = elevenlabs_key()
    if not key or key == "YOUR_KEY":
        raise ValueError(
            "ELEVENLABS_API_KEY (or elevenlabs_key in .env) is not set or invalid"
        )

    import os

    # Slightly warmer, less flat defaults; override with ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID.
    voice_id = os.getenv("ELEVENLABS_VOICE_ID") or "EXAVITQu4vr4xnSDxMaL"
    model_id = os.getenv("ELEVENLABS_MODEL_ID") or "eleven_turbo_v2"
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    vs = {
        "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.33")),
        "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY", "0.82")),
    }
    style_raw = os.getenv("ELEVENLABS_STYLE", "").strip()
    if style_raw:
        try:
            vs["style"] = float(style_raw)
        except ValueError:
            pass

    payload = {
        "text": text[:5000],
        "model_id": model_id,
        "voice_settings": vs,
    }

    response = requests.post(url, json=payload, headers=headers, timeout=120)
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.error("ElevenLabs error %s: %s", response.status_code, detail)
        if response.status_code == 402:
            raise RuntimeError(
                "ElevenLabs returned 402: paid plan required for API text-to-speech on many accounts. "
                "Upgrade at elevenlabs.io or use the in-app “read aloud” (browser) fallback."
            )
        raise RuntimeError(f"ElevenLabs API {response.status_code}: {detail}")

    return response.content
