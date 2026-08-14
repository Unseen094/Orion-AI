from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..schemas import CreateProjectRequest, FilePayload
from ..services.runtime import registry
from ..services.tools.project_tools import run_output

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
async def list_projects():
    return db.list_projects()


@router.post("")
async def create_project(payload: CreateProjectRequest):
    project = db.create_project(payload.name, payload.template)
    if payload.template:
        seed_project(project["id"], payload.template)
    return db.get_project(project["id"])


@router.get("/{project_id}")
async def get_project(project_id: int):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "project not found")
    project["files"] = [f["path"] for f in db.list_files(project_id)]
    return project


@router.get("/{project_id}/files")
async def files(project_id: int):
    return db.list_files(project_id)


@router.put("/{project_id}/files")
async def write(project_id: int, payload: FilePayload):
    if not db.get_project(project_id):
        raise HTTPException(404, "project not found")
    db.write_file(project_id, payload.path, payload.content)
    return {"ok": True}


@router.delete("/{project_id}/files")
async def delete(project_id: int, payload: FilePayload):
    db.delete_file(project_id, payload.path)
    return {"ok": True}


@router.post("/{project_id}/run")
async def run(project_id: int):
    if not db.get_project(project_id):
        raise HTTPException(404, "project not found")
    return {"lines": run_output(project_id)}


def seed_project(project_id: int, template: str) -> None:
    """Seeds a template project with a few real, runnable-looking files."""
    from . import templates as tpl

    files = tpl.load(template)
    for path, content in files.items():
        db.write_file(project_id, path, content)
