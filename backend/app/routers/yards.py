from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["yards"])


@router.get("/yards")
async def list_yards():
    return {
        "yards": [
            {"id": "coding", "name": "Coding Yard", "status": "available"},
            {"id": "research", "name": "Research Yard", "status": "available"},
        ]
    }
