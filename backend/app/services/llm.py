"""Unified LLM client.

Dispatches each request to the default provider:
  * ``gemini``  -> native google-genai streaming (function calling).
  * ``openai``  -> any OpenAI-compatible ``/chat/completions`` endpoint
                   (Ollama, LM Studio, OpenAI, Groq, OpenRouter, ...).

Every entry point raises :class:`LLMUnavailable` when the provider is missing,
unconfigured or unreachable so callers can fall back to offline responses.
"""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Awaitable, Callable

import httpx

from .. import config
from . import gemini_client as gemini
from . import prompts
from . import providers as prov
from .logger import get_logger

log = get_logger("orion.llm")

_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class LLMUnavailable(Exception):
    pass


# ---- helpers -----------------------------------------------------------


def get_default() -> dict:
    p = prov.get_default()
    if p is None:
        raise LLMUnavailable("no provider configured")
    if not prov.is_configured(p):
        raise LLMUnavailable(f"provider {p['name']!r} is not configured")
    return p


def available() -> bool:
    return prov.available()


def default_model() -> str:
    p = prov.get_default()
    return (p or {}).get("model") or config.DEFAULT_MODEL


def _chat_url(provider: dict) -> str:
    base = (provider.get("base_url") or "").rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _openai_headers(provider: dict) -> dict:
    headers = {"Content-Type": "application/json"}
    if provider.get("api_key"):
        headers["Authorization"] = f"Bearer {provider['api_key']}"
    return headers


def _provider_error(status: int, body: str) -> str:
    try:
        data = json.loads(body)
        return data.get("error", {}).get("message") or data.get("message") or f"HTTP {status}"
    except Exception:
        return f"HTTP {status}: {body[:200]}"


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return {}
    try:
        data = json.loads(text[start : end + 1])
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


# ---- decide / extract (provider-aware) ----------------------------------


async def decide(message: str, model: str | None = None) -> dict[str, Any]:
    p = get_default()
    if p["type"] == "gemini":
        prov.sync_legacy()
        return gemini.decide(message, model or config.FAST_MODEL)
    payload = {
        "messages": [
            {"role": "system", "content": prompts.DECISION_PROMPT},
            {"role": "user", "content": message},
        ],
        "temperature": 0.2,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
    }
    if p.get("model"):
        payload["model"] = p["model"]
    text = await _openai_completion(p, payload)
    return _extract_json(text)


async def extract_system_action(message: str) -> dict[str, Any]:
    p = get_default()
    if p["type"] == "gemini":
        prov.sync_legacy()
        return gemini.extract_system_action(message, p.get("model") or config.DEFAULT_MODEL)
    payload = {
        "messages": [
            {"role": "system", "content": prompts.SYSTEM_ACTION_PROMPT},
            {"role": "user", "content": message},
        ],
        "temperature": 0.1,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
    }
    if p.get("model"):
        payload["model"] = p["model"]
    text = await _openai_completion(p, payload)
    return _extract_json(text)


async def _openai_completion(provider: dict, payload: dict) -> str:
    url = _chat_url(provider)
    headers = _openai_headers(provider)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise LLMUnavailable(f"provider unreachable: {exc}") from exc
    if resp.status_code >= 400:
        raise LLMUnavailable(_provider_error(resp.status_code, resp.text))
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise LLMUnavailable("provider returned an unexpected response") from None


# ---- streaming chat ------------------------------------------------------


async def stream_chat(
    messages: list[dict[str, str]],
    system_instruction: str,
    tool_descriptors: list[dict[str, Any]],
    execute_tool: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]],
    model: str | None = None,
    max_tool_rounds: int = 4,
) -> AsyncGenerator[dict[str, Any], None]:
    """Streams a chat turn through the default provider.

    Yields events: {"type": "token"|"tool"|"done"|"error", ...}"""
    p = get_default()
    if p["type"] == "gemini":
        prov.sync_legacy()
        async for ev in gemini.stream_chat(
            messages=messages,
            system_instruction=system_instruction,
            tool_descriptors=tool_descriptors,
            execute_tool=execute_tool,
            model=model or p.get("model") or config.DEFAULT_MODEL,
            max_tool_rounds=max_tool_rounds,
        ):
            yield ev
        return
    async for ev in _openai_stream_chat(
        p, messages, system_instruction, tool_descriptors, execute_tool, max_tool_rounds
    ):
        yield ev


def _openai_tools(tool_descriptors: list[dict[str, Any]]) -> list[dict] | None:
    if not tool_descriptors:
        return None
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("schema", {"type": "object", "properties": {}}),
            },
        }
        for t in tool_descriptors
    ]


async def _openai_stream_chat(
    provider: dict,
    messages: list[dict[str, str]],
    system_instruction: str,
    tool_descriptors: list[dict[str, Any]],
    execute_tool: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]],
    max_tool_rounds: int,
) -> AsyncGenerator[dict[str, Any], None]:
    url = _chat_url(provider)
    headers = _openai_headers(provider)
    tools = _openai_tools(tool_descriptors)

    msgs: list[dict[str, Any]] = [{"role": "system", "content": system_instruction}]
    for m in messages:
        msgs.append(
            {
                "role": "user" if m["role"] == "user" else "assistant",
                "content": m["content"],
            }
        )

    for _round in range(max_tool_rounds):
        payload: dict[str, Any] = {
            "messages": msgs,
            "temperature": 0.5,
            "stream": True,
        }
        if provider.get("model"):
            payload["model"] = provider["model"]
        if tools:
            payload["tools"] = tools

        tool_calls: dict[int, dict[str, Any]] = {}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if resp.status_code >= 400:
                        body = (await resp.aread()).decode("utf-8", "replace")
                        raise LLMUnavailable(_provider_error(resp.status_code, body))
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except Exception:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        choice = choices[0]
                        delta = choice.get("delta") or {}
                        content = delta.get("content")
                        if content:
                            yield {"type": "token", "text": content}
                        for tc in delta.get("tool_calls") or []:
                            idx = tc.get("index", 0)
                            acc = tool_calls.setdefault(idx, {"id": "", "name": "", "arguments": ""})
                            if tc.get("id"):
                                acc["id"] = tc["id"]
                            fn = tc.get("function") or {}
                            name = fn.get("name")
                            if name:
                                if not acc["name"]:
                                    acc["name"] = name
                                elif name not in acc["name"]:
                                    acc["name"] += name
                            if fn.get("arguments"):
                                acc["arguments"] += fn["arguments"]
                        if choice.get("finish_reason") == "tool_calls":
                            break
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"provider unreachable: {exc}") from exc

        if not tool_calls:
            yield {"type": "done"}
            return

        call_list = [
            {
                "id": tc.get("id") or f"call_{i}",
                "type": "function",
                "function": {"name": tc.get("name"), "arguments": tc.get("arguments") or "{}"},
            }
            for i, tc in tool_calls.items()
        ]
        msgs.append({"role": "assistant", "content": None, "tool_calls": call_list})
        for i, tc in tool_calls.items():
            name = tc.get("name")
            yield {"type": "tool", "name": name}
            try:
                result = await execute_tool(name, json.loads(tc.get("arguments") or "{}"))
            except Exception as exc:  # noqa: BLE001
                result = {"error": str(exc)}
            msgs.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.get("id") or f"call_{i}",
                    "content": json.dumps(result),
                }
            )

    yield {"type": "done"}
