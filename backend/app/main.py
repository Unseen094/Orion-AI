import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import init_db
from .routers import chat, mcp, projects, research, settings, system, tts, yards
from .services.logger import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    init_db()
    logging.getLogger("orion").info("Orion backend started (offline=%s)", config.OFFLINE)
    yield


app = FastAPI(title="Orion", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (chat.router, yards.router, projects.router, research.router, system.router, settings.router, mcp.router, tts.router):
    app.include_router(router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logging.getLogger("orion.http").exception("request failed: %s %s", request.method, request.url.path)
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    if not request.url.path.startswith("/assets/"):
        logging.getLogger("orion.http").info(
            "%s %s -> %s (%.0fms)", request.method, request.url.path, response.status_code, elapsed_ms
        )
    return response


@app.get("/api/health")
async def health():
    return {"status": "ok", "name": "orion", "offline": config.OFFLINE}


# ---- Serve the built SPA (production / desktop mode) ----
if config.FRONTEND_DIST.exists():
    assets_dir = config.FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str, request: Request):
        target = config.FRONTEND_DIST / full_path
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "not found"}, status_code=404)
        if target.is_file():
            return FileResponse(target)
        index = config.FRONTEND_DIST / "index.html"
        return FileResponse(index) if index.exists() else JSONResponse({"detail": "no build"}, status_code=404)
