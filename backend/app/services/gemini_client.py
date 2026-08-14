"""Gemini integration: BYOK, streaming, JSON mode, function calling.

Offline-safe: every entry point raises GeminiUnavailable when there is no key,
so the orchestrator can fall back to cached responses / heuristics.
"""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Awaitable, Callable

from .. import config
from .. import db
from .logger import get_logger
from .prompts import DECISION_PROMPT, SYSTEM_ACTION_PROMPT

DEFAULT_MODEL = config.DEFAULT_MODEL

# Fail fast when the API is unreachable / the key is bad, so the UI
# never hangs on a silent stream. 60s covers long streaming generations.
REQUEST_TIMEOUT_MS = 60_000

log = get_logger("orion.gemini")


class GeminiUnavailable(Exception):
    pass


def has_key() -> bool:
    return bool(db.get_setting("api_key"))


def get_api_key() -> str | None:
    return db.get_setting("api_key")


def _client():
    from google import genai
    from google.genai import types

    key = get_api_key()
    if not key:
        raise GeminiUnavailable("no api key configured")
    return genai.Client(
        api_key=key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )


def _json_response(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def decide(message: str, model: str = DEFAULT_MODEL) -> dict[str, Any]:
    from google.genai import types

    client = _client()
    resp = client.models.generate_content(
        model=model,
        contents=message,
        config=types.GenerateContentConfig(
            system_instruction=DECISION_PROMPT,
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return _json_response(resp.text or "")


def extract_system_action(message: str, model: str = DEFAULT_MODEL) -> dict[str, Any]:
    from google.genai import types

    client = _client()
    resp = client.models.generate_content(
        model=model,
        contents=message,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_ACTION_PROMPT,
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )
    return _json_response(resp.text or "")


def _to_schema(schema: dict[str, Any]):
    from google.genai import types

    return types.Schema(
        type="OBJECT",
        properties={
            k: _to_schema(v) for k, v in (schema.get("properties") or {}).items()
        },
        required=schema.get("required", []),
    )


def _build_tool(tool: dict[str, Any]):
    from google.genai import types

    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name=tool["name"],
                description=tool.get("description", ""),
                parameters=_to_schema(tool.get("schema", {"type": "object", "properties": {}})),
            )
        ]
    )


async def stream_chat(
    messages: list[dict[str, str]],
    system_instruction: str,
    tool_descriptors: list[dict[str, Any]],
    execute_tool: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]],
    model: str = DEFAULT_MODEL,
    max_tool_rounds: int = 4,
) -> AsyncGenerator[dict[str, Any], None]:
    """Streams a chat turn, executing function calls in a loop.

    Yields events: {"type": "token"|"tool"|"done"|"error", ...}"""
    from google.genai import types

    client = _client()

    contents: list[Any] = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=m["content"])]))

    tools = [_build_tool(t) for t in tool_descriptors]
    gen_config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        tools=tools if tools else None,
        temperature=0.5,
    )

    for _round in range(max_tool_rounds):
        tool_calls: list[types.FunctionCall] = []
        stream = await client.aio.models.generate_content_stream(
            model=model, contents=contents, config=gen_config
        )
        async for chunk in stream:
            if not chunk.candidates:
                continue
            for part in chunk.candidates[0].content.parts or []:
                if part.function_call is not None:
                    tool_calls.append(part.function_call)
                elif part.text:
                    yield {"type": "token", "text": part.text}

        if not tool_calls:
            yield {"type": "done"}
            return

        for call in tool_calls:
            yield {"type": "tool", "name": call.name}
            try:
                result = await execute_tool(call.name, dict(call.args or {}))
            except Exception as exc:  # noqa: BLE001
                result = {"error": str(exc)}
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=call.name, response={"result": result}
                            )
                        )
                    ],
                )
            )

    yield {"type": "done"}
