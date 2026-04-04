import logging
import os

import requests

from backend.utils.env_keys import elevenlabs_key

logger = logging.getLogger(__name__)


def _speak_once(
    *,
    key: str,
    text: str,
    voice_id: str,
    model_id: str,
    voice_settings: dict,
) -> requests.Response:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text[:5000],
        "model_id": model_id,
        "voice_settings": voice_settings,
    }
    return requests.post(url, json=payload, headers=headers, timeout=120)


def text_to_speech(text: str) -> bytes:
    key = elevenlabs_key()
    if not key or key == "YOUR_KEY":
        raise ValueError(
            "ELEVENLABS_API_KEY (or elevenlabs_key in .env) is not set or invalid"
        )

    # Warmer default voice for market briefings; can still override via .env
    voice_id = (os.getenv("ELEVENLABS_VOICE_ID") or "EXAVITQu4vr4xnSDxMaL").strip()
    # Fallback warm voice if configured voice is invalid/not found.
    fallback_voice_id = "EXAVITQu4vr4xnSDxMaL"
    model_id = os.getenv("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2"

    voice_settings = {
        # Less robotic profile: more expressive cadence + strong voice match.
        "stability": float(os.getenv("ELEVENLABS_STABILITY", "0.18")),
        "similarity_boost": float(os.getenv("ELEVENLABS_SIMILARITY", "0.92")),
    }
    style_raw = os.getenv("ELEVENLABS_STYLE", "").strip()
    if style_raw:
        try:
            voice_settings["style"] = float(style_raw)
        except ValueError:
            pass

    response = _speak_once(
        key=key,
        text=text,
        voice_id=voice_id,
        model_id=model_id,
        voice_settings=voice_settings,
    )
    # Auto-retry once with warm fallback voice for misconfigured IDs (e.g., "alloy").
    if response.status_code == 404 and "voice_not_found" in (response.text or "") and voice_id != fallback_voice_id:
        logger.warning("Configured ElevenLabs voice '%s' not found. Retrying with fallback voice.", voice_id)
        response = _speak_once(
            key=key,
            text=text,
            voice_id=fallback_voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
        )

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
