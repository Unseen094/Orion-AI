import os
import sys
from pathlib import Path

_IS_FROZEN = getattr(sys, "frozen", False)
_MEIPASS = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))

if _IS_FROZEN:
    # Bundled resources live next to the exe's extracted temp dir.
    SEED_DIR = _MEIPASS / "seed"
    FRONTEND_DIST = _MEIPASS / "frontend"
    # Writable user data goes in %APPDATA%\Orion so the app can update the DB.
    DATA_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "Orion"
    BASE_DIR = DATA_DIR
else:
    BASE_DIR = Path(__file__).resolve().parent.parent
    DATA_DIR = BASE_DIR / "app" / "data"
    SEED_DIR = DATA_DIR / "seed"
    FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

DB_PATH = DATA_DIR / "orion.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_MODEL = "gemini-2.5-flash"
FAST_MODEL = "gemini-2.5-flash"  # Use same model - user's quota is limited

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

OFFLINE = os.environ.get("ORION_OFFLINE", "0") == "1"
