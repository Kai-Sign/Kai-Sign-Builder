from fastapi import APIRouter

router = APIRouter()

@router.get("/healthcheck")
def healthcheck():
    """Health check endpoint to verify API is running."""
    return {"status": "ok", "message": "API is running"} 