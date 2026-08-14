import time

import httpx
from fastapi import APIRouter

from .. import config, db
from ..schemas import ApiKeyRequest, ModelRequest, ProviderTest, ProvidersUpdate, SettingsUpdate
from ..services import computer_control as cc
from ..services import providers as prov

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_settings():
    stored = db.all_settings()
    return {
        "api_key_set": bool(stored.get("api_key")),
        "model": stored.get("model", config.DEFAULT_MODEL),
        "offline_mode": stored.get("offline_mode", "0") == "1" or config.OFFLINE,
        "sim_mode": cc.is_sim_mode(),
        "tts_enabled": stored.get("tts_enabled", "0") == "1",
        "tts_voice": stored.get("tts_voice", ""),
        "tts_engine": stored.get("tts_engine", "web"),
        "tts_gemini_voice": stored.get("tts_gemini_voice", "Kore"),
        "stt_lang": stored.get("stt_lang", "en-US"),
        "providers": prov.describe(),
    }


@router.post("/api-key")
async def set_api_key(payload: ApiKeyRequest):
    prov.set_legacy_gemini_key(payload.api_key)
    return {"ok": True, "api_key_set": True}


@router.post("/model")
async def set_model(payload: ModelRequest):
    prov.set_legacy_gemini_model(payload.model)
    return {"ok": True}


@router.post("")
async def update(payload: SettingsUpdate):
    if payload.offline_mode is not None:
        db.set_setting("offline_mode", "1" if payload.offline_mode else "0")
    if payload.tts_enabled is not None:
        db.set_setting("tts_enabled", "1" if payload.tts_enabled else "0")
    if payload.tts_voice is not None:
        db.set_setting("tts_voice", payload.tts_voice)
    if payload.tts_engine is not None:
        db.set_setting("tts_engine", payload.tts_engine)
    if payload.tts_gemini_voice is not None:
        db.set_setting("tts_gemini_voice", payload.tts_gemini_voice)
    if payload.stt_lang is not None:
        db.set_setting("stt_lang", payload.stt_lang)
    return {"ok": True}


@router.get("/providers")
async def get_providers():
    return {"providers": prov.describe()}


@router.put("/providers")
async def put_providers(payload: ProvidersUpdate):
    return {"providers": prov.save_providers(payload.providers)}


@router.post("/providers/test")
async def test_provider(payload: ProviderTest):
    p = payload.provider or {}
    start = time.perf_counter()

    def _elapsed() -> int:
        return int((time.perf_counter() - start) * 1000)

    try:
        if p.get("type") == "gemini":
            key = (p.get("api_key") or "").strip()
            if not key:
                return {"ok": False, "message": "No API key set.", "latency_ms": 0}
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=key,
                http_options=types.HttpOptions(timeout=20_000),
            )
            resp = client.models.generate_content(
                model=p.get("model") or config.DEFAULT_MODEL,
                contents="Reply with exactly: ok",
                config=types.GenerateContentConfig(max_output_tokens=10),
            )
            text = (resp.text or "").strip()
            ok = bool(text)
            return {"ok": ok, "message": f"OK ({text[:40]})" if ok else "Provider returned no text.", "latency_ms": _elapsed()}

        base = (p.get("base_url") or "").rstrip("/")
        if not base:
            return {"ok": False, "message": "No base URL set.", "latency_ms": 0}
        url = base + "/chat/completions" if not base.endswith("/chat/completions") else base
        headers = {"Content-Type": "application/json"}
        if p.get("api_key"):
            headers["Authorization"] = f"Bearer {p['api_key']}"
        payload_body = {"messages": [{"role": "user", "content": "Reply with exactly: ok"}], "max_tokens": 10}
        if p.get("model"):
            payload_body["model"] = p["model"]
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=payload_body)
        if resp.status_code >= 400:
            try:
                msg = resp.json().get("error", {}).get("message") or resp.json().get("message")
            except Exception:
                msg = None
            return {"ok": False, "message": msg or f"HTTP {resp.status_code}", "latency_ms": _elapsed()}
        try:
            text = resp.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            text = ""
        ok = bool(text)
        return {"ok": ok, "message": f"OK ({text[:40]})" if ok else "Provider returned no text.", "latency_ms": _elapsed()}
    except httpx.HTTPError as exc:
        return {"ok": False, "message": f"Network error: {exc}", "latency_ms": _elapsed()}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": str(exc), "latency_ms": _elapsed()}


@router.post("/sim")
async def set_sim(payload: SettingsUpdate):
    if payload.sim_mode is not None:
        cc.set_sim_mode(payload.sim_mode)
    else:
        cc.set_sim_mode(payload.offline_mode is not True)
    return {"ok": True}


@router.post("/reset")
async def reset():
    db.reset_all()
    return {"ok": True}
