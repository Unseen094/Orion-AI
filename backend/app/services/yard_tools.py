"""Yard-specific tools for coding and research yards."""

from __future__ import annotations

import asyncio
from typing import Any

from . import computer_control as cc
from .logger import get_logger
from .tools.base import ToolProvider

log = get_logger("orion.tools.yard")


class CodingYardTools(ToolProvider):
    name = "coding_yard_tools"
    description = "Tools for the coding yard: file operations, code execution, project management."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "list_files",
                "description": "List all files in a project directory.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Project path (relative to workspace)"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "read_file",
                "description": "Read the contents of a file.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path (relative to workspace)"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "write_file",
                "description": "Write content to a file (creates or overwrites).",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path (relative to workspace)"},
                        "content": {"type": "string", "description": "Content to write"}
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "run_code",
                "description": "Execute a code snippet and return output.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "language": {"type": "string", "description": "Language (python, javascript, shell)"},
                        "code": {"type": "string", "description": "Code to execute"}
                    },
                    "required": ["language", "code"],
                },
            },
            {
                "name": "search_code",
                "description": "Search for a pattern in code files.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Search pattern (regex)"},
                        "path": {"type": "string", "description": "Directory to search in"}
                    },
                    "required": ["pattern"],
                },
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            if tool == "list_files":
                return await self._list_files(args.get("path", "."))
            if tool == "read_file":
                return await self._read_file(args["path"])
            if tool == "write_file":
                return await self._write_file(args["path"], args["content"])
            if tool == "run_code":
                return await self._run_code(args["language"], args["code"])
            if tool == "search_code":
                return await self._search_code(args["pattern"], args.get("path", "."))
        except cc.SystemActionAborted:
            return {"error": "system action aborted by kill switch"}
        except Exception as e:
            log.exception("coding yard tool failed: %s", tool)
            return {"error": str(e)}
        return {"error": f"unknown tool {tool}"}

    async def _list_files(self, path: str) -> dict[str, Any]:
        import os
        import fnmatch

        def _list():
            files = []
            for root, dirs, filenames in os.walk(path):
                # Skip hidden and common ignored directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'venv', '.git')]
                for f in filenames:
                    if not f.startswith('.'):
                        rel = os.path.relpath(os.path.join(root, f), path)
                        files.append(rel)
            return files[:200]  # Limit to 200 files

        files = await asyncio.to_thread(_list)
        return {"files": files, "count": len(files)}

    async def _read_file(self, path: str) -> dict[str, Any]:
        import os

        def _read():
            if not os.path.exists(path):
                return None
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(100_000)  # Limit to 100KB
            return content

        content = await asyncio.to_thread(_read)
        if content is None:
            return {"error": f"file not found: {path}"}
        return {"content": content, "path": path}

    async def _write_file(self, path: str, content: str) -> dict[str, Any]:
        import os

        def _write():
            os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True

        await asyncio.to_thread(_write)
        log.info("wrote file: %s", path)
        return {"ok": True, "path": path, "bytes": len(content)}

    async def _run_code(self, language: str, code: str) -> dict[str, Any]:
        import subprocess
        import tempfile
        import os

        def _exec():
            if language == "python":
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                    f.write(code)
                    f.flush()
                    try:
                        r = subprocess.run(
                            ["python", f.name],
                            capture_output=True,
                            text=True,
                            timeout=30,
                            cwd=os.getcwd()
                        )
                        return {"stdout": r.stdout, "stderr": r.stderr, "returncode": r.returncode}
                    finally:
                        os.unlink(f.name)
            elif language in ("javascript", "js"):
                with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                    f.write(code)
                    f.flush()
                    try:
                        r = subprocess.run(
                            ["node", f.name],
                            capture_output=True,
                            text=True,
                            timeout=30
                        )
                        return {"stdout": r.stdout, "stderr": r.stderr, "returncode": r.returncode}
                    finally:
                        os.unlink(f.name)
            elif language in ("shell", "bash", "sh"):
                r = subprocess.run(
                    code,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                return {"stdout": r.stdout, "stderr": r.stderr, "returncode": r.returncode}
            return {"error": f"unsupported language: {language}"}

        result = await asyncio.to_thread(_exec)
        return result

    async def _search_code(self, pattern: str, path: str) -> dict[str, Any]:
        import re
        import os

        def _search():
            matches = []
            regex = re.compile(pattern, re.IGNORECASE)
            for root, dirs, files in os.walk(path):
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'venv')]
                for f in files:
                    if f.endswith(('.py', '.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt')):
                        fpath = os.path.join(root, f)
                        try:
                            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fh:
                                for i, line in enumerate(fh, 1):
                                    if regex.search(line):
                                        rel = os.path.relpath(fpath, path)
                                        matches.append({"file": rel, "line": i, "text": line.strip()[:100]})
                                        if len(matches) >= 50:
                                            return matches
                        except Exception:
                            pass
            return matches

        matches = await asyncio.to_thread(_search)
        return {"matches": matches, "count": len(matches)}


class ResearchYardTools(ToolProvider):
    name = "research_yard_tools"
    description = "Tools for the research yard: web search, summarize, note management."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "web_search",
                "description": "Search the web for information.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "summarize_text",
                "description": "Summarize a long text into key points.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to summarize"}
                    },
                    "required": ["text"],
                },
            },
            {
                "name": "extract_urls",
                "description": "Extract URLs from text.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Text to extract URLs from"}
                    },
                    "required": ["text"],
                },
            },
            {
                "name": "create_note",
                "description": "Create a research note with tags.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "Note content"},
                        "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags for the note"}
                    },
                    "required": ["text"],
                },
            },
            {
                "name": "list_notes",
                "description": "List all research notes.",
                "schema": {"type": "object", "properties": {}},
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            if tool == "web_search":
                return await self._web_search(args["query"])
            if tool == "summarize_text":
                return await self._summarize(args["text"])
            if tool == "extract_urls":
                return await self._extract_urls(args["text"])
            if tool == "create_note":
                return await self._create_note(args["text"], args.get("tags", []))
            if tool == "list_notes":
                return await self._list_notes()
        except Exception as e:
            log.exception("research yard tool failed: %s", tool)
            return {"error": str(e)}
        return {"error": f"unknown tool {tool}"}

    async def _web_search(self, query: str) -> dict[str, Any]:
        import httpx

        def _search():
            resp = httpx.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
            # Simple extraction of results
            results = []
            import re
            for match in re.finditer(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', resp.text):
                url, title = match.groups()
                title = re.sub(r'<[^>]+>', '', title)
                results.append({"url": url, "title": title})
            return results[:10]

        results = await asyncio.to_thread(_search)
        return {"results": results, "query": query}

    async def _summarize(self, text: str) -> dict[str, Any]:
        # Simple extractive summary (first 500 chars)
        sentences = text.replace('\n', ' ').split('. ')
        summary = '. '.join(sentences[:5]) + ('...' if len(sentences) > 5 else '')
        return {"summary": summary, "original_length": len(text)}

    async def _extract_urls(self, text: str) -> dict[str, Any]:
        import re
        urls = re.findall(r'https?://[^\s<>"\']+', text)
        return {"urls": list(set(urls))}

    async def _create_note(self, text: str, tags: list[str]) -> dict[str, Any]:
        from .. import db
        note = db.create_note(text, tags)
        return note

    async def _list_notes(self) -> dict[str, Any]:
        from .. import db
        notes = db.list_notes()
        return {"notes": notes, "count": len(notes)}
