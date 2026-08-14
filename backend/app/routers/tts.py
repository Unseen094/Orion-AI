from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import Response

from ..schemas import TtsRequest
from ..services import tts
from ..services.logger import get_logger

router = APIRouter(prefix="/api/tts", tags=["tts"])
log = get_logger("orion.tts.api")


@router.get("/voices")
async def get_voices():
    return {"voices": tts.voices()}


@router.post("/speak")
async def speak(payload: TtsRequest):
    if not payload.text.strip():
        return Response(
            content=json.dumps({"error": "empty text"}),
            status_code=400,
            media_type="application/json",
        )
    if not tts.is_configured():
        return Response(
            content=json.dumps({"error": "no Gemini API key configured"}),
            status_code=503,
            media_type="application/json",
        )
    try:
        wav = await asyncio.to_thread(
            tts.synthesize, payload.text.strip(), payload.voice
        )
        return Response(
            content=wav,
            media_type="audio/wav",
            headers={"X-Voice": payload.voice or tts.DEFAULT_VOICE},
        )
    except tts.TTSUnavailable as exc:
        log.warning("tts unavailable: %s", exc)
        return Response(
            content=json.dumps({"error": str(exc)}),
            status_code=503,
            media_type="application/json",
        )
    except Exception as exc:
        log.exception("tts failed")
        return Response(
            content=json.dumps({"error": f"tts error: {exc}"}),
            status_code=500,
            media_type="application/json",
        )
