"""Orion orchestrator: intent routing + generation.

Flow per message:
  1. Heuristic classifier (fast, synchronous safety net).
  2. Gemini decide (structured JSON) when heuristic is weak.
  3. Emit yard.open event if a Yard should open.
  4. Stream generation with the Yard's system prompt + tool providers.
Offline mode uses canned responses and skips all live AI.
"""

from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path
from typing import Any, AsyncGenerator

from .. import config, db
from . import heuristic
from . import llm
from . import prompts
from .logger import get_logger
from .tools.base import ToolRegistry

log = get_logger("orion.chat")

# Decision cache to avoid repeated LLM calls for similar messages
_DECISION_CACHE: dict[str, str | None] = {}
_DECISION_CACHE_MAX = 100


def _load_canned() -> list[dict[str, str]]:
    path = config.SEED_DIR / "canned_responses.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _pick_canned(message: str, canned: list[dict[str, str]]) -> str:
    text = message.lower()
    for entry in canned:
        for kw in entry.get("keywords", []):
            if kw in text:
                return entry["response"]
    if not canned:
        return "Orion is running in offline mode. Configure a Gemini API key in Settings for live responses."
    return random.choice(canned)["response"]


def _parse_system_action(message: str) -> dict[str, Any]:
    """Offline-safe heuristic parser mirroring SYSTEM_ACTION_PROMPT."""
    import re

    text = message.lower().strip()
    out: dict[str, Any] = {
        "action": None, "target": None, "text": None, "keys": None,
        "x": None, "y": None, "clicks": None, "url": None, "title": None,
    }
    if not text:
        return out

    if "scroll" in text:
        out.update(action="scroll", clicks=3 if "scroll up" in text else -3)
        return out
    if any(k in text for k in ("screenshot", "screen shot", "capture the screen")):
        out.update(action="screenshot")
        return out
    if any(
        k in text
        for k in (
            "system info", "system information", "specs", "how much ram",
            "how much cpu", "free disk", "disk space", "uptime",
        )
    ):
        out.update(action="info")
        return out
    if any(k in text for k in ("what's open", "whats open", "what is open", "open windows", "open applications", "list windows")):
        out.update(action="windows")
        return out

    if "move mouse" in text or "move cursor" in text or "move the mouse" in text:
        m = re.search(r"(\d{1,4})[\s,]+(\d{1,4})", text)
        if m:
            out.update(action="move", x=int(m.group(1)), y=int(m.group(2)))
            return out

    if "clipboard" in text or "copy " in text or text == "copy":
        out.update(action="clipboard", text=_clipboard_payload(message))
        return out

    if any(k in text for k in ("notify", "popup", "notification")) or ("show" in text and "message" in text):
        out.update(action="notify", title="Orion", text=_notify_payload(message))
        return out

    url = _extract_url(message)
    if url:
        out.update(action="open_url", url=url)
        return out

    if "notepad" in text:
        out.update(action="open", target="notepad")
    elif "calculator" in text or "calc" in text:
        out.update(action="open", target="calculator")
    elif "explorer" in text or "file manager" in text:
        out.update(action="open", target="explorer")
    elif any(k in text for k in ("enter", "ctrl+s", "alt+tab", "space", "tab", "escape")):
        keys = next(k for k in ("enter", "ctrl+s", "alt+tab", "space", "tab", "escape") if k in text)
        out.update(action="press", keys=keys)
    elif "click" in text:
        out.update(action="click", target="left")
    else:
        for verb in ("type out ", "type ", "write "):
            idx = text.find(verb)
            if idx != -1:
                payload = message[idx + len(verb) :].strip().strip('"')
                out.update(action="type", text=payload)
                break
    return out


def _extract_url(message: str) -> str | None:
    import re

    m = re.search(r"(https?://[^\s'\"]+|www\.[^\s'\"]+|[a-z0-9-]+(?:\.[a-z]{2,})[^\s'\"]*)", message, re.I)
    if not m:
        return None
    url = m.group(1).rstrip(".,;")
    if url.startswith("www."):
        url = "https://" + url
    elif not url.startswith("http"):
        url = "https://" + url
    return url


def _clipboard_payload(message: str) -> str:
    import re

    low = message.lower()
    idx = low.find("copy")
    payload = message[idx + len("copy"):] if idx != -1 else ""
    if not payload:
        idx = low.find("clipboard")
        payload = message[idx + len("clipboard"):] if idx != -1 else ""
    payload = re.sub(r"\s+to clipboard.*$", "", payload, flags=re.I)
    payload = re.sub(r"\s+(please|thanks|thank you).*$", "", payload, flags=re.I)
    return payload.strip().strip('"').strip(".")


def _notify_payload(message: str) -> str:
    import re

    for marker in (
        "popup saying ", "popup: ", "notification saying ", "notify me ",
        "notify ", "show a message saying ", "show a popup saying ",
    ):
        i = message.lower().find(marker)
        if i != -1:
            return re.sub(r"\s+(please|thanks|thank you).*$", "", message[i + len(marker):], flags=re.I).strip().strip('"')
    return ""


def _format_system_result(action: dict[str, Any], result: dict[str, Any]) -> str:
    mode = result.get("mode", "sim")
    kind = action.get("action")

    if kind == "info":
        return _format_stats(result)
    if kind == "windows":
        wins = result.get("windows") or []
        if not wins:
            return "No visible windows found."
        head = "\n".join(f"• {w.get('title', '?')}" for w in wins[:12])
        more = f"\n… and {len(wins) - 12} more" if len(wins) > 12 else ""
        return f"Currently open:\n{head}{more}"
    if kind == "screenshot":
        return f"Screenshot captured → {result.get('path')} ({result.get('width')}×{result.get('height')})"

    label = {
        "type": "typed", "open": "opened", "press": "pressed", "click": "clicked",
        "move": "moved", "scroll": "scrolled", "open_url": "opened",
        "notify": "showed", "clipboard": "copied",
    }.get(kind, kind)

    if kind == "clipboard":
        text = action.get("text") or ""
        tail = " (simulated)" if mode == "sim" else ""
        return f"Copied {len(text)} characters to the clipboard.{tail}"
    if kind == "move":
        target = f"{action.get('x')},{action.get('y')}"
    elif kind == "scroll":
        target = f"{action.get('clicks') or -3} clicks"
    else:
        target = action.get("text") or action.get("keys") or action.get("url") or action.get("target") or action.get("title") or "it"
    return f"Simulated: {label} {target!r}. (Real mode disabled for safety.)" if mode == "sim" else f"Done: {label} {target!r}."


def _fmt_duration(seconds: int) -> str:
    days, rem = divmod(int(seconds), 86400)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
    if days:
        return f"{days}d {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _format_stats(info: dict[str, Any]) -> str:
    lines: list[str] = []
    if info.get("hostname"):
        lines.append(f"Host: {info['hostname']}")
    if info.get("os"):
        lines.append(f"OS: {info['os']}")
    cpu = info.get("cpu_name")
    if cpu:
        lines.append(f"CPU: {cpu}")
    elif info.get("cpu_count"):
        lines.append(f"CPU cores: {info['cpu_count']}")
    if info.get("ram_total_gb"):
        lines.append(f"RAM: {info['ram_total_gb']} GB total, {info.get('ram_free_gb', '?')} GB free")
    if info.get("disk_total_gb"):
        lines.append(f"Disk: {info['disk_total_gb']} GB total, {info.get('disk_free_gb', '?')} GB free")
    if info.get("uptime_seconds"):
        lines.append(f"Uptime: {_fmt_duration(info['uptime_seconds'])}")
    if info.get("ip"):
        lines.append(f"IP: {info['ip']}")
    if info.get("python"):
        lines.append(f"Python: {info['python']}")
    return "\n".join(lines) if lines else "No system info available."


def _friendly_error(exc: Exception) -> str:
    """Map common provider failures to a short, human message."""
    msg = str(exc)
    low = msg.lower()
    if "api key not valid" in low or "api_key_invalid" in low or "invalid argument" in low and "key" in low:
        return "The API key for this provider is invalid. Re-enter it in Settings → Providers."
    if "quota" in low or "resource_exhausted" in low or "429" in msg:
        return "Provider quota is temporarily exhausted (429). Wait a minute and retry, or switch providers in Settings."
    if "timeout" in low or "unreachable" in low or "connect" in low or "ssl" in low:
        return "Couldn't reach the AI provider. Check your internet connection and the provider URL in Settings."
    if "model" in low and ("not found" in low or "does not support" in low):
        return "That model isn't available on this provider. Pick another in Settings → Providers."
    return f"Orion hit an error ({type(exc).__name__}). Check Settings → Logs for details."


def build_system_prompt(yard: str | None, capabilities: str) -> str:
    base = prompts.SYSTEM.format(capabilities=capabilities)
    context = prompts.YARD_CONTEXT.get(yard or "home", prompts.YARD_CONTEXT["home"])
    return f"{base}\n\n{context}"


class Orchestrator:
    def __init__(self, registry: ToolRegistry) -> None:
        self.registry = registry
        self._canned = _load_canned()

    async def _decide_yard(self, message: str) -> str | None:
        """Returns 'coding' | 'research' | 'system' | 'home' | None"""
        # Check cache first (normalized message)
        cache_key = message.lower().strip()[:100]
        if cache_key in _DECISION_CACHE:
            return _DECISION_CACHE[cache_key]
        
        heur = heuristic.classify(message)
        # Always use heuristic result - skip LLM decision entirely for speed
        result = heur["yard"]
        if len(_DECISION_CACHE) < _DECISION_CACHE_MAX:
            _DECISION_CACHE[cache_key] = result
        return result

    async def _extract_system_action(self, message: str) -> dict[str, Any]:
        if llm.available():
            try:
                action = await llm.extract_system_action(message)
                if action.get("action"):
                    return action
            except Exception:
                pass
        return _parse_system_action(message)

    async def _run_system_action(self, action: dict[str, Any]) -> dict[str, Any]:
        kind = action.get("action")
        if kind == "type":
            return await self.registry.dispatch("system_tools", "system_type", {"text": action.get("text", "")})
        if kind == "open":
            return await self.registry.dispatch("system_tools", "system_open", {"app": action.get("target", "")})
        if kind == "press":
            return await self.registry.dispatch("system_tools", "system_press", {"keys": action.get("keys", "")})
        if kind == "click":
            return await self.registry.dispatch("system_tools", "system_click", {})
        if kind == "move":
            return await self.registry.dispatch("system_tools", "system_move_mouse", {"x": action.get("x", 0), "y": action.get("y", 0)})
        if kind == "scroll":
            return await self.registry.dispatch("system_tools", "system_scroll", {"clicks": action.get("clicks") or -3})
        if kind == "open_url":
            return await self.registry.dispatch("utility_tools", "open_url", {"url": action.get("url", "")})
        if kind == "notify":
            return await self.registry.dispatch("utility_tools", "notify", {"title": action.get("title") or "Orion", "message": action.get("text", "")})
        if kind == "clipboard":
            return await self.registry.dispatch("clipboard_tools", "clipboard_write", {"text": action.get("text", "")})
        if kind == "info":
            return await self.registry.dispatch("system_info_tools", "system_info", {})
        if kind == "windows":
            return await self.registry.dispatch("system_info_tools", "list_windows", {})
        if kind == "screenshot":
            return await self.registry.dispatch("system_info_tools", "screenshot", {})
        return {"error": "unknown system action"}

    async def _stream_system(self, message: str) -> AsyncGenerator[str, None]:
        yield _sse({"type": "yard.close"})
        yield _sse({"type": "orb", "state": "executing"})
        action = await self._extract_system_action(message)
        if action.get("action"):
            yield _sse({"type": "tool", "name": f"system_{action['action']}"})
            result = await self._run_system_action(action)
            text = _format_system_result(action, result)
        else:
            text = "I couldn't parse a clear system action. Try 'open notepad', 'type hello', 'press enter', or 'click the mouse'."
        for chunk in _stream_text(text, emit_done=False):
            yield chunk
        yield _sse({"type": "orb", "state": "idle"})
        yield _sse({"type": "done"})

    async def stream(self, payload: dict[str, Any]) -> AsyncGenerator[str, None]:
        message = payload.get("message", "")
        model = payload.get("model") or llm.default_model()
        offline = bool(payload.get("offline"))
        history = payload.get("history") or []

        yard = await self._decide_yard(message)
        log.info("turn: yard=%s offline=%s msg=%r", yard, offline, message[:60])

        yield _sse({"type": "orb", "state": "thinking"})

        if yard == "system":
            async for chunk in self._stream_system(message):
                yield chunk
            return

        if yard in ("coding", "research"):
            yield _sse({"type": "yard.open", "yard": yard})
        elif yard == "home":
            yield _sse({"type": "yard.close"})

        if offline or not llm.available():
            yield _sse({"type": "orb", "state": "executing"})
            for chunk in _stream_text(_pick_canned(message, self._canned), emit_done=False):
                yield chunk
            yield _sse({"type": "orb", "state": "idle"})
            yield _sse({"type": "done"})
            return

        tool_descriptors = self.registry.all_tools()

        async def execute_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
            server = next((t["server"] for t in tool_descriptors if t["name"] == name), None)
            if not server:
                return {"error": f"unknown tool {name}"}
            return await self.registry.dispatch(server, name, args)

        system_instruction = build_system_prompt(yard, prompts.CAPABILITIES)

        messages = history[-10:] + [{"role": "user", "content": message}]
        try:
            async for event in llm.stream_chat(
                messages=messages,
                system_instruction=system_instruction,
                tool_descriptors=tool_descriptors,
                execute_tool=execute_tool,
                model=model,
            ):
                if event["type"] == "token":
                    yield _sse({"type": "token", "text": event["text"]})
                elif event["type"] == "tool":
                    yield _sse({"type": "tool", "name": event["name"]})
                    yield _sse({"type": "orb", "state": "executing"})
            yield _sse({"type": "orb", "state": "idle"})
            yield _sse({"type": "done"})
        except llm.LLMUnavailable:
            log.warning("provider unavailable; falling back to canned response")
            yield _sse({"type": "error", "message": "No provider configured — used offline response."})
            yield _sse({"type": "token", "text": _pick_canned(message, self._canned)})
            yield _sse({"type": "orb", "state": "idle"})
            yield _sse({"type": "done"})
        except Exception as exc:
            log.exception("live generation failed (yard=%s)", yard)
            yield _sse({"type": "error", "message": _friendly_error(exc)})
            yield _sse({"type": "token", "text": _pick_canned(message, self._canned)})
            yield _sse({"type": "orb", "state": "idle"})
            yield _sse({"type": "done"})


def _stream_text(text: str, chunk: int = 6, emit_done: bool = True):
    for i in range(0, len(text), chunk):
        yield _sse({"type": "token", "text": text[i : i + chunk]})
    if emit_done:
        yield _sse({"type": "done"})


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"
