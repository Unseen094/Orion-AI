"""Computer control: pyautogui wrapper with simulation mode and a kill switch.

sim mode:      nothing touches the real machine; actions still emit events.
kill switch:   any action checks a shared flag (Esc in the UI hits /api/system/kill).
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

_kill = threading.Event()
_sim_mode = True

_event_subscribers: list[asyncio.Queue] = []
_sub_lock = threading.Lock()


def set_sim_mode(enabled: bool) -> None:
    global _sim_mode
    _sim_mode = enabled


def is_sim_mode() -> bool:
    return _sim_mode


def kill_switch() -> None:
    _kill.set()


def arm_kill_switch() -> None:
    _kill.clear()


def is_killed() -> bool:
    return _kill.is_set()


def subscribe_events() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    with _sub_lock:
        _event_subscribers.append(q)
    return q


def unsubscribe_events(q: asyncio.Queue) -> None:
    with _sub_lock:
        if q in _event_subscribers:
            _event_subscribers.remove(q)


async def emit(kind: str, target: str | None = None, **extra: Any) -> None:
    event = {"type": "system.action", "kind": kind, "target": target, **extra}
    with _sub_lock:
        subs = list(_event_subscribers)
    for q in subs:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


def _check_kill() -> None:
    if _kill.is_set():
        raise SystemActionAborted("aborted by kill switch")


class SystemActionAborted(Exception):
    pass


async def type_text(text: str, delay: float = 0.02) -> dict[str, Any]:
    _check_kill()
    await emit("type", text)
    if not _sim_mode:
        import pyautogui

        for _ in range(3):
            if _kill.is_set():
                break
            await asyncio.sleep(0)
        pyautogui.typewrite(text, interval=delay)
    return {"ok": True, "action": "type", "text": text, "mode": "sim" if _sim_mode else "real"}


async def press_key(keys: str) -> dict[str, Any]:
    _check_kill()
    await emit("key", keys)
    if not _sim_mode:
        import pyautogui

        parts = [k.strip() for k in keys.split("+") if k.strip()]
        if len(parts) > 1:
            pyautogui.hotkey(*parts)
        else:
            pyautogui.press(keys)
    return {"ok": True, "action": "press", "keys": keys, "mode": "sim" if _sim_mode else "real"}


async def scroll(clicks: int = -3) -> dict[str, Any]:
    _check_kill()
    await emit("scroll", str(clicks))
    if not _sim_mode:
        import pyautogui

        pyautogui.scroll(int(clicks))
    return {"ok": True, "action": "scroll", "clicks": int(clicks), "mode": "sim" if _sim_mode else "real"}


async def move_mouse(x: int, y: int) -> dict[str, Any]:
    _check_kill()
    await emit("move", f"{x},{y}")
    if not _sim_mode:
        import pyautogui

        pyautogui.moveTo(x, y, duration=0.25)
    return {"ok": True, "action": "move", "x": x, "y": y, "mode": "sim" if _sim_mode else "real"}


async def click(x: int | None = None, y: int | None = None, button: str = "left") -> dict[str, Any]:
    _check_kill()
    await emit("click", button)
    if not _sim_mode:
        import pyautogui

        if x is not None and y is not None:
            pyautogui.moveTo(x, y, duration=0.2)
        pyautogui.click(button=button)
    return {"ok": True, "action": "click", "button": button, "mode": "sim" if _sim_mode else "real"}


async def open_app(app: str) -> dict[str, Any]:
    _check_kill()
    await emit("open", app)
    if not _sim_mode:
        import subprocess

        try:
            subprocess.Popen(["start", app], shell=True)
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
    return {"ok": True, "action": "open", "app": app, "mode": "sim" if _sim_mode else "real"}
