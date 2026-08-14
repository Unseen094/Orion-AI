"""System introspection tools: hardware/OS stats, open windows, screenshots.

Everything here is read-only and safe — it never mutates the machine, so these
tools run in sim mode exactly like real mode.
"""

from __future__ import annotations

import asyncio
import datetime
import os
import platform
import shutil
import socket
from pathlib import Path
from typing import Any

from .. import config
from . import computer_control as cc
from .tools.base import ToolProvider


def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except Exception:
        return "127.0.0.1"


def _native_stats() -> dict[str, Any]:
    """CPU name (registry), RAM (GlobalMemoryStatusEx), uptime (GetTickCount64).

    Pure WinAPI — fast, reliable, and works identically in the frozen EXE
    (no PowerShell/CIM subprocess, which can thrash on low-memory machines).
    """
    info: dict[str, Any] = {}
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as key:
            value, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            info["cpu_name"] = str(value).strip()
    except Exception:
        pass

    try:
        import ctypes

        class _MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        mem = _MEMORYSTATUSEX()
        mem.dwLength = ctypes.sizeof(_MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
            info["ram_total_gb"] = round(mem.ullTotalPhys / 2**30, 1)
            info["ram_free_gb"] = round(mem.ullAvailPhys / 2**30, 1)
            info["ram_load_percent"] = mem.dwMemoryLoad
    except Exception:
        pass

    try:
        import ctypes

        info["uptime_seconds"] = int(ctypes.windll.kernel32.GetTickCount64() / 1000)
    except Exception:
        pass
    return info


def _system_stats() -> dict[str, Any]:
    info: dict[str, Any] = {
        "os": platform.platform(),
        "hostname": socket.gethostname(),
        "arch": platform.machine(),
        "cpu_count": os.cpu_count(),
        "python": platform.python_version(),
        "ip": _local_ip(),
    }
    try:
        du = shutil.disk_usage(str(Path.home().anchor or Path.home()))
        info["disk_total_gb"] = round(du.total / 2**30, 1)
        info["disk_free_gb"] = round(du.free / 2**30, 1)
    except Exception:
        pass
    info.update(_native_stats())
    return info


def _open_windows(limit: int = 30) -> list[dict[str, Any]]:
    """Visible window titles via ctypes (no extra dependencies)."""
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32

        def _cb(hwnd: int, _lp: int) -> bool:
            if not user32.IsWindowVisible(hwnd):
                return True
            length = user32.GetWindowTextLengthW(hwnd)
            if length == 0:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value.strip()
            if not title or title in ("Default IME", "Program Manager", "Windows Input Experience"):
                return True
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            _windows.append({"title": title[:120], "pid": pid.value})
            return True

        _windows: list[dict[str, Any]] = []
        CB = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        callback = CB(_cb)  # keep a reference so it is not GC'd
        user32.EnumWindows(callback, 0)
        return _windows[:limit]
    except Exception:
        return []


class SystemInfoTools(ToolProvider):
    name = "system_info_tools"
    description = "Read-only OS introspection: system stats, open windows, screenshots."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "system_info",
                "description": "Return OS, hostname, CPU, RAM, disk, uptime, IP and Python version.",
                "schema": {"type": "object", "properties": {}},
            },
            {
                "name": "list_windows",
                "description": "List the titles of the visible windows currently open on the machine.",
                "schema": {
                    "type": "object",
                    "properties": {"limit": {"type": "integer", "description": "max windows, default 30"}},
                },
            },
            {
                "name": "screenshot",
                "description": "Capture a screenshot of the screen and save it as a PNG.",
                "schema": {"type": "object", "properties": {}},
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            if tool == "system_info":
                return _system_stats()
            if tool == "list_windows":
                return {"windows": _open_windows(args.get("limit") or 30)}
            if tool == "screenshot":
                return await _take_screenshot()
        except cc.SystemActionAborted:
            return {"error": "system action aborted by kill switch"}
        return {"error": f"unknown tool {tool}"}


async def _take_screenshot() -> dict[str, Any]:
    def _capture() -> dict[str, Any]:
        import pyautogui

        img = pyautogui.screenshot()
        cap_dir = config.DATA_DIR / "captures"
        cap_dir.mkdir(parents=True, exist_ok=True)
        path = cap_dir / f"orion_{datetime.datetime.now():%Y%m%d_%H%M%S}.png"
        img.save(path)
        return {
            "path": str(path),
            "width": img.width,
            "height": img.height,
            "size_bytes": path.stat().st_size,
        }

    return await asyncio.to_thread(_capture)
