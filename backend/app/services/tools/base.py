"""MCP-ready tool provider interface.

Every capability Orion exposes is a ToolProvider with list_tools()/execute().
The Gemini tool layer AND the MCP adapter both dispatch through here, so a real
MCP server later plugs into the same registry without touching the Yards.
"""

from abc import ABC, abstractmethod
from typing import Any


class ToolProvider(ABC):
    name: str = "provider"
    description: str = ""

    @abstractmethod
    def tools(self) -> list[dict[str, Any]]:
        """Returns a list of tool descriptors:
        {"name": str, "description": str, "schema": {"type": "object", "properties": {...}}}
        """

    @abstractmethod
    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool. Returns a JSON-serializable result."""

    async def list_tools(self) -> list[dict[str, Any]]:
        return self.tools()

    async def call(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        return await self.execute(tool, args)


class ToolRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, ToolProvider] = {}

    def register(self, provider: ToolProvider) -> None:
        self._providers[provider.name] = provider

    def servers(self) -> list[dict[str, Any]]:
        return [
            {
                "name": p.name,
                "description": p.description,
                "tools": [t["name"] for t in p.tools()],
            }
            for p in self._providers.values()
        ]

    def all_tools(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for p in self._providers.values():
            for t in p.tools():
                out.append({**t, "server": p.name})
        return out

    async def dispatch(self, server: str, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        provider = self._providers.get(server)
        if not provider:
            return {"error": f"unknown server: {server}"}
        return await provider.execute(tool, args)
