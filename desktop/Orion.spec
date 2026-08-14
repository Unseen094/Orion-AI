# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Orion desktop EXE.

Build from repo root:
    .\.venv\Scripts\pyinstaller desktop\Orion.spec
"""

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

ROOT = Path(SPECPATH).resolve().parent  # repo root (spec lives in repo_root/desktop)
backend = ROOT / "backend"

# --- collect data-heavy third-party packages ---------------------------------
datas = []
binaries = []
hiddenimports = []

for pkg in ("google.genai", "google.auth", "google.oauth2", "pydantic", "pyautogui", "pythonnet", "clr_loader", "pyscreeze", "PIL"):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

# --- bundle seeds + built frontend -------------------------------------------
seed = backend / "app" / "data" / "seed"
if seed.exists():
    datas.append((str(seed), "seed"))
dist = ROOT / "frontend" / "dist"
if dist.exists():
    datas.append((str(dist), "frontend"))

# --- webview platform backends ------------------------------------------------
hiddenimports += [
    "webview.platforms.edgechromium",
    "webview.platforms.winforms",
    "clr",
]

# app package is imported lazily (inside functions) in launcher.py
hiddenimports += ["app", "app.main", "app.config", "app.services.logger"]

# Persistent extraction dir: onefile unpacks here once and reuses it, so
# subsequent launches skip the slow cold-extract + Defender rescan.
import os as _os
_runtime_tmpdir = _os.path.join(_os.environ.get("LOCALAPPDATA", _os.environ.get("TEMP", ".")), "Orion", "rt")

a = Analysis(
    ["launcher.py"],
    pathex=[str(backend)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Orion",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=_runtime_tmpdir,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
