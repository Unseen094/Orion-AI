import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from ..schemas import NoteCreate, SummaryRequest
from ..services import llm
from ..services import prompts
from ..services.tools.search_tools import web_search

router = APIRouter(prefix="/api/research", tags=["research"])


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    return web_search(q)


@router.post("/summarize")
async def summarize(payload: SummaryRequest):
    async def gen():
        if payload.offline or not llm.available():
            text = offline_summary(payload.query, payload.results)
            async for c in _token_chunks(text):
                yield c
            yield _sse({"type": "done"})
            return

        prompt = prompts.SUMMARIZE_PROMPT.format(query=payload.query)
        contents = [{"role": "user", "content": prompt + "\n\n" + json.dumps(payload.results[:6])}]
        try:
            async def noop(_n, _a):
                return {}

            async for event in llm.stream_chat(
                messages=contents,
                system_instruction="You write concise, well-structured research summaries.",
                tool_descriptors=[],
                execute_tool=noop,
                model=payload.model,
            ):
                if event["type"] == "token":
                    yield _sse({"type": "token", "text": event["text"]})
            yield _sse({"type": "done"})
        except llm.LLMUnavailable:
            text = offline_summary(payload.query, payload.results)
            async for c in _token_chunks(text):
                yield c
            yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/notes")
async def list_notes():
    from .. import db

    return db.list_notes()


@router.post("/notes")
async def create_note(payload: NoteCreate):
    from .. import db

    return db.create_note(payload.text, payload.tags)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: int):
    from .. import db

    db.delete_note(note_id)
    return {"ok": True}


def offline_summary(query: str, results: list[dict]) -> str:
    if not results:
        return f"No results found for \"{query}\"."
    head = f"## {query}\n\n"
    bullets = "\n".join(
        f"- **{r.get('title', 'Source')}** — {r.get('snippet', '')[:180]}" for r in results[:5]
    )
    return head + bullets + f"\n\n_Takeaway: {len(results)} sources reviewed. Offline mode._"


async def _token_chunks(text: str, chunk: int = 6):
    for i in range(0, len(text), chunk):
        yield _sse({"type": "token", "text": text[i : i + chunk]})
    yield _sse({"type": "done"})
def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
