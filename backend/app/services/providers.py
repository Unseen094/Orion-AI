"""LLM provider registry.

Providers are stored as a JSON list under the ``providers`` settings key so
users can bring their own Gemini keys OR any OpenAI-compatible endpoint
(Ollama, LM Studio, OpenAI, Groq, OpenRouter, LocalAI, ...).

A provider looks like::

    {
        "id": "gemini",
        "name": "Google Gemini",
        "type": "gemini" | "openai",
        "base_url": "http://localhost:11434/v1",
        "api_key": "",
        "model": "gemini-2.5-flash",
        "enabled": True,
        "is_default": True,
    }

Full API keys are only ever written to the DB; the API masks them.
"""

from __future__ import annotations

import json

from .. import config, db
from .logger import get_logger

log = get_logger("orion.providers")

DEFAULT_PROVIDER_ID = "gemini"


def default_provider_seed() -> list[dict]:
    key = db.get_setting("api_key") or ""
    model = db.get_setting("model") or config.DEFAULT_MODEL
    return [
        {
            "id": DEFAULT_PROVIDER_ID,
            "name": "Google Gemini",
            "type": "gemini",
            "base_url": "",
            "api_key": key,
            "model": model,
            "enabled": True,
            "is_default": True,
        }
    ]


def _sanitize(providers: list | None) -> list[dict]:
    if not isinstance(providers, list):
        return default_provider_seed()
    out: list[dict] = []
    seen: set[str] = set()
    for p in providers:
        if not isinstance(p, dict) or not p.get("id"):
            continue
        pid = str(p["id"])
        if pid in seen:
            continue
        seen.add(pid)
        out.append(
            {
                "id": pid,
                "name": str(p.get("name") or pid),
                "type": p.get("type") if p.get("type") in ("gemini", "openai") else "openai",
                "base_url": str(p.get("base_url") or "").strip(),
                "api_key": str(p.get("api_key") or ""),
                "model": str(p.get("model") or "").strip(),
                "enabled": bool(p.get("enabled", True)),
                "is_default": bool(p.get("is_default", False)),
            }
        )
    if not out:
        return default_provider_seed()
    if not any(p["is_default"] for p in out):
        nxt = next((p for p in out if p["enabled"]), out[0])
        nxt["is_default"] = True
    return out


def load_providers() -> list[dict]:
    raw = db.get_setting("providers")
    if raw:
        try:
            return _sanitize(json.loads(raw))
        except Exception:
            pass
    seed = default_provider_seed()
    save_providers(seed)
    return seed


def save_providers(providers: list | None) -> list[dict]:
    clean = _sanitize(providers)
    db.set_setting("providers", json.dumps(clean))
    _sync_legacy(clean)
    return clean


def get_default() -> dict | None:
    providers = load_providers()
    for p in providers:
        if p["enabled"] and p["is_default"]:
            return p
    for p in providers:
        if p["enabled"]:
            return p
    return None


def is_configured(p: dict) -> bool:
    if p.get("type") == "gemini":
        return bool(p.get("api_key"))
    return bool(p.get("base_url"))


def available() -> bool:
    p = get_default()
    return p is not None and is_configured(p)


def _sync_legacy(providers: list[dict]) -> None:
    """Mirror the Gemini provider into the legacy api_key/model settings."""
    gem = next((p for p in providers if p["type"] == "gemini"), None)
    if gem:
        db.set_setting("api_key", gem.get("api_key") or "")
        if gem.get("model"):
            db.set_setting("model", gem["model"])
    else:
        db.set_setting("api_key", "")
        db.set_setting("model", config.DEFAULT_MODEL)


def sync_legacy() -> None:
    _sync_legacy(load_providers())


def set_legacy_gemini_key(api_key: str) -> None:
    key = api_key.strip()
    db.set_setting("api_key", key)
    providers = load_providers()
    for p in providers:
        if p["type"] == "gemini":
            p["api_key"] = key
    save_providers(providers)


def set_legacy_gemini_model(model: str) -> None:
    db.set_setting("model", model)
    providers = load_providers()
    for p in providers:
        if p["type"] == "gemini":
            p["model"] = model
    save_providers(providers)


def describe() -> list[dict]:
    return [
        {**p, "api_key": "", "api_key_set": bool(p.get("api_key"))}
        for p in load_providers()
    ]
