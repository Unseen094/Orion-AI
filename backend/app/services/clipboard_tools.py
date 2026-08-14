"""Clipboard tools: read and write the OS clipboard.

Clipboard write follows sim mode (emits the event, touches nothing).
Clipboard read is read-only so it always works.
"""

from __future__ import annotations

import base64
import subprocess
from typing import Any

from . import computer_control as cc
from .tools.base import ToolProvider


def _ps(script: str, timeout: int = 6) -> str | None:
    try:
        encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
        r = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except Exception:
        pass
    return None


def _clipboard_text() -> str:
    return _ps("Get-Clipboard -Raw -ErrorAction SilentlyContinue") or ""


def _set_clipboard(text: str) -> None:
    b64 = base64.b64encode(text.encode("utf-8")).decode("ascii")
    _ps(
        "Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString("
        "[Convert]::FromBase64String('{}'))) -ErrorAction SilentlyContinue".format(b64)
    )


class ClipboardTools(ToolProvider):
    name = "clipboard_tools"
    description = "Read and write the system clipboard."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "clipboard_read",
                "description": "Read the current clipboard text.",
                "schema": {"type": "object", "properties": {}},
            },
            {
                "name": "clipboard_write",
                "description": "Copy text to the clipboard so the user can paste it.",
                "schema": {
                    "type": "object",
                    "properties": {"text": {"type": "string"}},
                    "required": ["text"],
                },
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool == "clipboard_read":
            return {"text": _clipboard_text()[:20000]}
        if tool == "clipboard_write":
            text = str(args.get("text", ""))
            await cc.emit("clipboard", "write", text=text[:80])
            if not cc.is_sim_mode():
                await cc._check_kill()
                _set_clipboard(text)
            return {"ok": True, "mode": "sim" if cc.is_sim_mode() else "real", "chars": len(text)}
        return {"error": f"unknown tool {tool}"}
