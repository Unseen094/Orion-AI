"""Gemini TTS — server-side speech synthesis.

Uses the ``gemini-2.5-flash-preview-tts`` model with the configured Gemini
API key. The API returns raw L16 PCM audio (24 kHz mono) in the response's
inline data; we wrap that in a RIFF/WAV header so the browser can play it
directly via ``<audio>``.
"""

from __future__ import annotations

import hashlib
import io
import re
import wave
from collections import OrderedDict

from .. import config, db
from .logger import get_logger

log = get_logger("orion.tts")

TTS_MODEL = "gemini-2.5-flash-preview-tts"
DEFAULT_VOICE = "Kore"

GEMINI_VOICES = [
    "Kore",
    "Puck",
    "Ardent",
    "Zephyr",
    "Aoede",
    "Charon",
    "Fenrir",
    "Leda",
    "Orus",
]

REQUEST_TIMEOUT_MS = 120_000

# In-memory LRU cache for TTS audio (max 50 entries, ~5MB typical)
_TTS_CACHE: OrderedDict[str, bytes] = OrderedDict()
_TTS_CACHE_MAX = 50


class TTSUnavailable(Exception):
    pass


def is_configured() -> bool:
    return bool(db.get_setting("api_key"))


def voices() -> list[str]:
    return list(GEMINI_VOICES)


def _cache_key(text: str, voice: str) -> str:
    return hashlib.md5(f"{voice}:{text}".encode()).hexdigest()


def _pcm_to_wav(data: bytes, mime: str) -> bytes:
    rate = 24000
    match = re.search(r"rate=(\d+)", mime)
    if match:
        try:
            rate = int(match.group(1))
        except ValueError:
            pass
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data)
    return buf.getvalue()


def synthesize(text: str, voice: str | None = None) -> bytes:
    """Convert ``text`` to speech and return WAV bytes."""
    if not text.strip():
        raise TTSUnavailable("empty text")
    
    # Check cache first
    voice_name = voice or DEFAULT_VOICE
    key = _cache_key(text, voice_name)
    if key in _TTS_CACHE:
        _TTS_CACHE.move_to_end(key)
        log.info("tts cache hit voice=%s chars=%d", voice_name, len(text))
        return _TTS_CACHE[key]
    
    api_key = db.get_setting("api_key")
    if not api_key:
        raise TTSUnavailable("no Gemini API key configured")
    
    # Lazy import — google.genai can be slow on first load.
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )
    resp = client.models.generate_content(
        model=TTS_MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name
                    )
                )
            ),
        ),
    )
    audio: bytes | None = None
    mime = ""
    for part in (resp.candidates[0].content.parts if resp.candidates else []) or []:
        if part.inline_data and part.inline_data.data:
            audio = part.inline_data.data
            mime = part.inline_data.mime_type or ""
            break
    if not audio:
        raise TTSUnavailable("Gemini returned no audio for this text")
    
    wav = _pcm_to_wav(audio, mime)
    
    # Cache the result
    _TTS_CACHE[key] = wav
    if len(_TTS_CACHE) > _TTS_CACHE_MAX:
        _TTS_CACHE.popitem(last=False)
    
    log.info("tts synth ok voice=%s chars=%d bytes=%d", voice_name, len(text), len(wav))
    return wav
