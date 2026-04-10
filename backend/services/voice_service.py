import os
import tempfile
import asyncio


def text_to_speech(text: str) -> bytes:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("text is required")
    # Prefer Edge neural voices first (far less robotic than local SAPI).
    voice = (os.getenv("EDGE_TTS_VOICE") or "en-US-JennyNeural").strip()
    rate = (os.getenv("EDGE_TTS_RATE") or "-2%").strip()
    pitch = (os.getenv("EDGE_TTS_PITCH") or "+0Hz").strip()
    try:
        import edge_tts  # type: ignore[import-untyped]

        async def _render() -> bytes:
            communicate = edge_tts.Communicate(raw[:5000], voice=voice, rate=rate, pitch=pitch)
            chunks: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    data = chunk.get("data")
                    if isinstance(data, (bytes, bytearray)):
                        chunks.append(bytes(data))
            return b"".join(chunks)

        audio = asyncio.run(_render())
        if audio:
            return audio
    except Exception:
        # Fall through to local pyttsx3 fallback.
        pass

    try:
        import pyttsx3  # type: ignore[import-untyped]
    except Exception as e:
        raise RuntimeError(
            "TTS engines unavailable. Install edge-tts (preferred) or pyttsx3."
        ) from e

    engine = pyttsx3.init()
    # Slower cadence + full volume sounds more human on SAPI voices.
    engine.setProperty("rate", int(os.getenv("PYTTSX3_RATE", "155")))
    engine.setProperty("volume", float(os.getenv("PYTTSX3_VOLUME", "1.0")))
    try:
        voices = engine.getProperty("voices") or []
        preferred = None
        for v in voices:
            name = str(getattr(v, "name", "")).lower()
            vid = str(getattr(v, "id", "")).lower()
            if any(k in name for k in ("zira", "aria", "jenny", "samantha")):
                preferred = v
                break
            if "female" in name or "female" in vid:
                preferred = v
                break
        if preferred is None and voices:
            preferred = voices[0]
        if preferred is not None:
            engine.setProperty("voice", getattr(preferred, "id"))
    except Exception:
        # Keep default voice if lookup fails on this platform.
        pass

    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        engine.save_to_file(raw[:5000], path)
        engine.runAndWait()
        with open(path, "rb") as f:
            return f.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
