import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from .. import config
from ..schemas import EventsRequest, SystemActionRequest
from ..services import computer_control as cc

router = APIRouter(prefix="/api/system", tags=["system"])


@router.post("/events")
async def system_events(_payload: EventsRequest):
    q: asyncio.Queue = cc.subscribe_events()

    async def gen():
        try:
            while True:
                event = await asyncio.wait_for(q.get(), timeout=45)
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.TimeoutError:
            pass
        finally:
            cc.unsubscribe_events(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/type")
async def type_text(payload: SystemActionRequest):
    return await cc.type_text(payload.text or "")


@router.post("/press")
async def press(payload: SystemActionRequest):
    return await cc.press_key(payload.keys or "enter")


@router.post("/click")
async def click(payload: SystemActionRequest):
    return await cc.click(payload.x, payload.y, payload.button or "left")


@router.post("/open")
async def open_app(payload: SystemActionRequest):
    return await cc.open_app(payload.text or "notepad")


@router.post("/kill")
async def kill():
    cc.kill_switch()
    return {"ok": True}


@router.get("/logs")
async def logs(lines: int = Query(80, ge=1, le=500)):
    log_file = config.DATA_DIR / "orion.log"
    if not log_file.exists():
        return {"lines": [], "path": str(log_file)}
    content = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"lines": content[-lines:], "path": str(log_file)}
