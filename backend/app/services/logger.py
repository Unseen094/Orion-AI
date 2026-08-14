"""Orion logging: rotating file log in the data dir + console mirror.

Everything logs through `get_logger("orion.<area>")`. The file lives at
DATA_DIR/orion.log (%APPDATA%\\Orion in the desktop EXE) and is readable
in-app via GET /api/system/logs.
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from .. import config

_configured = False


def setup_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    try:
        handler = RotatingFileHandler(
            config.DATA_DIR / "orion.log",
            maxBytes=1_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        handler.setFormatter(fmt)
        root.addHandler(handler)
    except Exception:
        pass

    try:
        console = logging.StreamHandler()
        console.setFormatter(fmt)
        root.addHandler(console)
    except Exception:
        pass


def get_logger(name: str = "orion") -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)
