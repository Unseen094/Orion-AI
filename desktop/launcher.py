"""Orion desktop launcher: runs the FastAPI backend in a thread and opens
the app in a native WebView2 window. This is the entry point for the EXE.

Startup is instant: a splash window appears first, the heavy backend imports
and server start happen in the background, then the app loads.

Usage:
    python desktop/launcher.py          # dev: backend + window on a free port
    built/Orion.exe                     # PyInstaller --windowed build
"""

from __future__ import annotations

import logging
import os
import socket
import sys
import threading
import time
from pathlib import Path

SPLASH_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0a0a0e;color:#f5f5f7;display:flex;
flex-direction:column;align-items:center;justify-content:center;font-family:monospace}
.orb{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff5d74,#d6083a 60%,#6b0418);
box-shadow:0 0 40px 8px rgba(214,8,58,.55);animation:p 1s ease-in-out infinite alternate}
@keyframes p{from{transform:scale(.85)}to{transform:scale(1.1)}}
h1{font-size:15px;letter-spacing:.5em;margin:22px 0 6px;color:#ff2d4b}
p{font-size:10px;letter-spacing:.2em;color:#888}
</style></head><body>
<div class="orb"></div><h1>ORION</h1><p>STARTING SYSTEM</p>
</body></html>"""


def _find_free_port(preferred: int = 8000) -> int:
    for port in range(preferred, preferred + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("no free port found")


def _is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def _wait_ready(port: int, timeout: float = 60.0) -> None:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as r:
                if r.status == 200:
                    return
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("backend failed to start")


def main() -> None:
    # Keep the very first frame fast: only webview is imported at module scope.
    import webview

    port = int(os.environ.get("ORION_PORT", 8000))
    if port == 8000 and not _is_free(port):
        port = _find_free_port()

    url = f"http://127.0.0.1:{port}/"
    window = webview.create_window(
        "Orion — AI Operating System",
        html=SPLASH_HTML,
        width=1440,
        height=900,
        min_size=(1024, 700),
    )

    def _background(window, url, port):
        try:
            _start_backend(port)
            _wait_ready(port)
            window.load_url(url)
        except Exception:
            _log_failure()
            try:
                window.load_html("<html><body style='background:#0a0a0e;color:#ff2d4b;font-family:monospace;padding:40px'>ORION FAILED TO START — check %APPDATA%\\Orion\\orion.log</body></html>")
            except Exception:
                pass

    # Heavy imports + server start happen after the splash is visible.
    threading.Thread(target=_background, args=(window, url, port), daemon=True).start()
    webview.start()


def _start_backend(port: int) -> None:
    import uvicorn

    from app import config
    from app.main import app as orion_app
    from app.services.logger import get_logger

    get_logger("orion").info("desktop launcher: starting backend on port %s", port)
    server_config = uvicorn.Config(orion_app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(server_config)
    threading.Thread(target=server.run, daemon=True, name="orion-uvicorn").start()


def _log_failure() -> None:
    try:
        import traceback

        from app.services.logger import get_logger

        get_logger("orion").error("startup failed:\n%s", traceback.format_exc())
    except Exception:
        pass


if __name__ == "__main__":
    main()
