"""Utility tools: date/time, safe math, notifications, opening URLs."""

from __future__ import annotations

import ast
import datetime
import math
import subprocess
from typing import Any

from . import computer_control as cc
from .tools.base import ToolProvider

_MATH_FUNCS = {
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "log2": math.log2,
    "exp": math.exp,
    "abs": abs,
    "round": round,
    "floor": math.floor,
    "ceil": math.ceil,
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau,
}


def safe_calculate(expr: str) -> float | int:
    """Evaluate an arithmetic expression with a whitelist of ops/functions."""
    tree = ast.parse(expr, mode="eval")
    allowed_ops = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv)
    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and not isinstance(node.op, allowed_ops):
            raise ValueError("operator not allowed")
        if isinstance(node, ast.Name) and node.id not in _MATH_FUNCS and node.id not in ("True", "False"):
            raise ValueError(f"'{node.id}' not allowed")
        if isinstance(node, ast.Attribute):
            raise ValueError("attribute access not allowed")
        if isinstance(node, ast.Call) and not (
            isinstance(node.func, ast.Name) and node.func.id in _MATH_FUNCS
        ):
            raise ValueError("function not allowed")
    result = eval(compile(tree, "<calc>", "eval"), {"__builtins__": {}}, _MATH_FUNCS)  # noqa: S307
    return round(result, 6) if isinstance(result, float) else result


class UtilityTools(ToolProvider):
    name = "utility_tools"
    description = "General utilities: time, safe math, notifications, opening URLs."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "now",
                "description": "Return the current local date, time, timezone and weekday.",
                "schema": {"type": "object", "properties": {}},
            },
            {
                "name": "calculate",
                "description": "Evaluate a math expression safely, e.g. '12 * 3.5', 'sqrt(144)', '2 ** 10'.",
                "schema": {
                    "type": "object",
                    "properties": {"expression": {"type": "string"}},
                    "required": ["expression"],
                },
            },
            {
                "name": "notify",
                "description": "Show a desktop notification popup on the machine.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "message": {"type": "string"},
                        "timeout": {"type": "integer", "description": "seconds to show, default 3"},
                    },
                    "required": ["title", "message"],
                },
            },
            {
                "name": "open_url",
                "description": "Open a URL in the default web browser.",
                "schema": {
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"],
                },
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool == "now":
            now = datetime.datetime.now().astimezone()
            return {
                "datetime": now.isoformat(),
                "date": now.strftime("%Y-%m-%d"),
                "time": now.strftime("%H:%M:%S"),
                "timezone": now.tzname(),
                "utc_offset": now.strftime("%z"),
                "weekday": now.strftime("%A"),
            }
        if tool == "calculate":
            expr = str(args.get("expression", "")).strip()
            try:
                return {"expression": expr, "result": safe_calculate(expr)}
            except Exception as exc:  # noqa: BLE001
                return {"expression": expr, "error": str(exc)}
        if tool == "notify":
            title = str(args.get("title", "Orion"))
            message = str(args.get("message", ""))
            timeout = int(args.get("timeout") or 3)
            await cc.emit("notify", title, message=message)
            if not cc.is_sim_mode():
                cc._check_kill()
                safe_title = title.replace("'", "''")
                safe_msg = message.replace("'", "''")
                subprocess.Popen(  # detached so the stream is not blocked
                    [
                        "powershell.exe",
                        "-NoProfile",
                        "-NonInteractive",
                        "-Command",
                        f"(New-Object -ComObject WScript.Shell).Popup('{safe_msg}', {timeout}, '{safe_title}', 64)",
                    ],
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
            return {
                "ok": True,
                "mode": "sim" if cc.is_sim_mode() else "real",
                "title": title,
                "message": message,
            }
        if tool == "open_url":
            url = str(args.get("url", "")).strip()
            if not url.startswith(("http://", "https://")):
                url = "https://" + url
            await cc.emit("open", url)
            if not cc.is_sim_mode():
                cc._check_kill()
                subprocess.Popen(["cmd", "/c", "start", "", url])
            return {"ok": True, "mode": "sim" if cc.is_sim_mode() else "real", "url": url}
        return {"error": f"unknown tool {tool}"}
