import os
from fastapi import Header, HTTPException, status
from dotenv import load_dotenv

load_dotenv()


async def enforce_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("BACKEND_API_KEY")
    if not expected:
        # If not configured, deny to avoid accidental exposure
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server not configured: BACKEND_API_KEY missing",
        )
    if x_api_key != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


