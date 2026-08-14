"""System tools: expose computer control to the AI as MCP-shaped tools."""

from typing import Any

from .. import computer_control as cc
from .base import ToolProvider


class SystemTools(ToolProvider):
    name = "system_tools"
    description = "Real OS control: type text, press keys, move/click the mouse, open apps."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "system_type",
                "description": "Type text as if on a real keyboard.",
                "schema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
            },
            {
                "name": "system_press",
                "description": "Press a keyboard key or combo, e.g. 'enter', 'ctrl+s', 'alt+tab'.",
                "schema": {"type": "object", "properties": {"keys": {"type": "string"}}, "required": ["keys"]},
            },
            {
                "name": "system_click",
                "description": "Click the mouse (optionally at coordinates).",
                "schema": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "integer"},
                        "y": {"type": "integer"},
                        "button": {"type": "string", "enum": ["left", "right", "middle"]},
                    },
                },
            },
            {
                "name": "system_open",
                "description": "Open an app on the machine (e.g. 'notepad', 'calculator').",
                "schema": {"type": "object", "properties": {"app": {"type": "string"}}, "required": ["app"]},
            },
            {
                "name": "system_move_mouse",
                "description": "Move the mouse pointer to screen coordinates.",
                "schema": {
                    "type": "object",
                    "properties": {"x": {"type": "integer"}, "y": {"type": "integer"}},
                    "required": ["x", "y"],
                },
            },
            {
                "name": "system_scroll",
                "description": "Scroll the mouse wheel. Positive scrolls up, negative scrolls down.",
                "schema": {
                    "type": "object",
                    "properties": {"clicks": {"type": "integer", "description": "wheel clicks, default -3 (down)"}},
                },
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            if tool == "system_type":
                return await cc.type_text(args.get("text", ""))
            if tool == "system_press":
                return await cc.press_key(args.get("keys", ""))
            if tool == "system_click":
                return await cc.click(args.get("x"), args.get("y"), args.get("button", "left"))
            if tool == "system_open":
                return await cc.open_app(args.get("app", ""))
            if tool == "system_move_mouse":
                return await cc.move_mouse(int(args.get("x", 0)), int(args.get("y", 0)))
            if tool == "system_scroll":
                return await cc.scroll(int(args.get("clicks", -3)))
        except cc.SystemActionAborted:
            return {"error": "system action aborted by kill switch"}
        return {"error": f"unknown tool {tool}"}
