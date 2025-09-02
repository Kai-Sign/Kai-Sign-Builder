import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from api.security import enforce_api_key

load_dotenv()


router = APIRouter(prefix="/eth", tags=["eth"], dependencies=[Depends(enforce_api_key)])


class RawTx(BaseModel):
    raw: str


@router.post("/sendRawTransaction")
def send_raw_transaction(payload: RawTx):
    rpc_url = os.getenv("SEPOLIA_RPC_URL") or os.getenv("ALCHEMY_RPC_URL")
    if not rpc_url:
        raise HTTPException(status_code=503, detail="RPC URL not configured")
    if not payload.raw or not payload.raw.startswith("0x"):
        raise HTTPException(status_code=400, detail="raw must be 0x-prefixed hex string")

    try:
        resp = requests.post(
            rpc_url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_sendRawTransaction",
                "params": [payload.raw],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise HTTPException(status_code=502, detail=data["error"]) 
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


