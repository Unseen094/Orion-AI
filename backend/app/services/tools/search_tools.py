"""Search + notes tools for the Research Yard."""

import json
from pathlib import Path
from typing import Any

from ... import config, db
from .base import ToolProvider


def _load_offline_docs() -> list[dict[str, str]]:
    path = config.SEED_DIR / "research_docs.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _rank(query: str, docs: list[dict[str, str]], limit: int = 8) -> list[dict[str, str]]:
    q = query.lower()
    scored = []
    for d in docs:
        hay = (d.get("title", "") + " " + d.get("snippet", "")).lower()
        words = [w for w in q.split() if len(w) > 2]
        score = sum(hay.count(w) for w in words)
        if score > 0:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:limit]]


class SearchTools(ToolProvider):
    name = "search_tools"
    description = "Web search with offline dataset fallback."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "web_search",
                "description": "Search the web for a query and return result titles, urls and snippets.",
                "schema": {
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
            }
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool != "web_search":
            return {"error": f"unknown tool {tool}"}
        return {"results": web_search(args.get("query", ""))}


class NotesTools(ToolProvider):
    name = "notes_tools"
    description = "Persistent notes panel for the Research Yard."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "create_note",
                "description": "Save a note to the Research Yard notes panel.",
                "schema": {
                    "type": "object",
                    "properties": {"text": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}}},
                    "required": ["text"],
                },
            }
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool != "create_note":
            return {"error": f"unknown tool {tool}"}
        note = db.create_note(args["text"], args.get("tags", []))
        return {"note": note}


def web_search(query: str) -> list[dict[str, str]]:
    """Live-ish search attempt, then offline dataset fallback.

    Tries DuckDuckGo HTML via httpx (fast, no key); on any failure returns
    ranked results from the seeded research_docs.json. Demo-safe."""
    try:
        import httpx

        resp = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            timeout=6,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        if resp.status_code == 200:
            results = _parse_ddg(resp.text)
            if results:
                return results
    except Exception:
        pass
    return _rank(query, _load_offline_docs())


def _parse_ddg(html: str) -> list[dict[str, str]]:
    import re

    results: list[dict[str, str]] = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html):
        title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        results.append({"title": title[:160], "url": m.group(1), "snippet": ""})
        if len(results) >= 8:
            break
    snips = list(re.finditer(r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', html))
    for i, s in enumerate(snips[: len(results)]):
        results[i]["snippet"] = re.sub(r"<[^>]+>", "", s.group(1)).strip()[:220]
    return results
