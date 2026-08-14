"""Project / file tools for the Coding Yard."""

from typing import Any

from ... import db
from .base import ToolProvider


class ProjectTools(ToolProvider):
    name = "project_tools"
    description = "Create and edit projects and files inside the Coding Yard."

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "create_project",
                "description": "Create a new project in the Coding Yard.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Project name"},
                        "template": {
                            "type": "string",
                            "description": "template: react-dashboard, node-api or vanilla",
                        },
                    },
                    "required": ["name"],
                },
            },
            {
                "name": "write_file",
                "description": "Create or overwrite a file in the current project.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "integer"},
                        "path": {"type": "string", "description": "e.g. src/App.tsx"},
                        "content": {"type": "string"},
                    },
                    "required": ["project_id", "path", "content"],
                },
            },
            {
                "name": "list_projects",
                "description": "List all projects in the Coding Yard.",
                "schema": {"type": "object", "properties": {}},
            },
            {
                "name": "read_file",
                "description": "Read a file from the current project.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "integer"},
                        "path": {"type": "string"},
                    },
                    "required": ["project_id", "path"],
                },
            },
            {
                "name": "delete_file",
                "description": "Delete a file from the current project.",
                "schema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "integer"},
                        "path": {"type": "string"},
                    },
                    "required": ["project_id", "path"],
                },
            },
            {
                "name": "delete_project",
                "description": "Delete a project and all of its files.",
                "schema": {
                    "type": "object",
                    "properties": {"project_id": {"type": "integer"}},
                    "required": ["project_id"],
                },
            },
            {
                "name": "run_project",
                "description": "Simulate running the current project (dev server output).",
                "schema": {
                    "type": "object",
                    "properties": {"project_id": {"type": "integer"}},
                    "required": ["project_id"],
                },
            },
        ]

    async def execute(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool == "create_project":
            project = db.create_project(args["name"], args.get("template"))
            return {"project": project}
        if tool == "write_file":
            db.write_file(args["project_id"], args["path"], args["content"])
            return {"ok": True, "path": args["path"]}
        if tool == "list_projects":
            return {"projects": db.list_projects()}
        if tool == "read_file":
            file = db.read_file(args["project_id"], args["path"])
            return {"path": args["path"], "content": (file or {}).get("content", "")}
        if tool == "delete_file":
            db.delete_file(args["project_id"], args["path"])
            return {"ok": True, "deleted": args["path"]}
        if tool == "delete_project":
            db.delete_project(args["project_id"])
            return {"ok": True, "deleted_project": args["project_id"]}
        if tool == "run_project":
            return {"lines": run_output(args.get("project_id"))}
        return {"error": f"unknown tool {tool}"}


def run_output(project_id: Any) -> list[str]:
    name = "project"
    p = db.get_project(int(project_id)) if project_id else None
    if p:
        name = p["name"]
    return [
        f"$ orion run {name}",
        f"  ✔ preparing {name}...",
        "  ⚡ dev server ready at http://localhost:3000",
        "  ✓ compiled successfully",
        "  ✓ no errors, no warnings",
        "  ● waiting for changes...",
    ]
