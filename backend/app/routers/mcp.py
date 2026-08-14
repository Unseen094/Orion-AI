from fastapi import APIRouter

from ..schemas import McpExecuteRequest
from ..services.runtime import registry

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/servers")
async def servers():
    return {"servers": registry.servers()}


@router.get("/tools")
async def tools():
    return {"tools": registry.all_tools()}


@router.post("/execute")
async def execute(payload: McpExecuteRequest):
    result = await registry.dispatch(payload.server, payload.tool, payload.args)
    return {"ok": True, "result": result}
