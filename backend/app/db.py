import json
import sqlite3
from contextlib import contextmanager

from . import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    template   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path       TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (project_id, path)
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    messages   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    text       TEXT NOT NULL,
    tags       TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);
"""


def init_db() -> None:
    with connect() as db:
        db.executescript(_SCHEMA)
        db.execute("PRAGMA journal_mode=WAL")


@contextmanager
def connect():
    db = sqlite3.connect(config.DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---- settings ----

def get_setting(key: str, default: str | None = None) -> str | None:
    with connect() as db:
        row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def all_settings() -> dict[str, str]:
    with connect() as db:
        rows = db.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


def reset_all() -> None:
    with connect() as db:
        for table in ("settings", "projects", "files", "conversations", "notes"):
            db.execute(f"DELETE FROM {table}")


# ---- projects ----

def list_projects() -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT id, name, template, created_at FROM projects ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def get_project(project_id: int) -> dict | None:
    with connect() as db:
        row = db.execute("SELECT id, name, template, created_at FROM projects WHERE id = ?", (project_id,)).fetchone()
    return dict(row) if row else None


def create_project(name: str, template: str | None = None) -> dict:
    with connect() as db:
        cur = db.execute("INSERT INTO projects (name, template) VALUES (?, ?)", (name, template))
        pid = cur.lastrowid
    return {"id": pid, "name": name, "template": template}


def delete_project(project_id: int) -> None:
    with connect() as db:
        db.execute("DELETE FROM projects WHERE id = ?", (project_id,))


def list_files(project_id: int) -> list[dict]:
    with connect() as db:
        rows = db.execute(
            "SELECT path, content FROM files WHERE project_id = ? ORDER BY path", (project_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def read_file(project_id: int, path: str) -> dict | None:
    with connect() as db:
        row = db.execute(
            "SELECT path, content FROM files WHERE project_id = ? AND path = ?",
            (project_id, path),
        ).fetchone()
    return dict(row) if row else None


def write_file(project_id: int, path: str, content: str) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO files (project_id, path, content, updated_at) VALUES (?, ?, ?, datetime('now')) "
            "ON CONFLICT(project_id, path) DO UPDATE SET content = excluded.content, updated_at = datetime('now')",
            (project_id, path, content),
        )


def delete_file(project_id: int, path: str) -> None:
    with connect() as db:
        db.execute("DELETE FROM files WHERE project_id = ? AND path = ?", (project_id, path))


# ---- notes ----

def list_notes() -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT id, text, tags, created_at FROM notes ORDER BY id DESC").fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["tags"] = json.loads(item["tags"])
        result.append(item)
    return result


def create_note(text: str, tags: list[str]) -> dict:
    with connect() as db:
        cur = db.execute(
            "INSERT INTO notes (text, tags) VALUES (?, ?)", (text, json.dumps(tags))
        )
        note_id = cur.lastrowid
        row = db.execute("SELECT id, text, tags, created_at FROM notes WHERE id = ?", (note_id,)).fetchone()
    item = dict(row)
    item["tags"] = json.loads(item["tags"])
    return item


def delete_note(note_id: int) -> None:
    with connect() as db:
        db.execute("DELETE FROM notes WHERE id = ?", (note_id,))


# ---- conversations ----

def save_conversation(messages: list[dict]) -> int:
    with connect() as db:
        cur = db.execute("INSERT INTO conversations (messages) VALUES (?)", (json.dumps(messages),))
        return cur.lastrowid
