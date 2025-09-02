import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from api.security import enforce_api_key
from api.kms import KmsEthereumSigner

load_dotenv()


router = APIRouter(prefix="/kms", tags=["kms"], dependencies=[Depends(enforce_api_key)])


class SignDigestRequest(BaseModel):
    digest: str  # 0x + 64 hex chars


def _get_signer() -> KmsEthereumSigner:
    key_id = os.getenv("AWS_KMS_KEY_ID")
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
    if not key_id:
        raise HTTPException(status_code=503, detail="AWS_KMS_KEY_ID not configured")
    if not region:
        raise HTTPException(status_code=503, detail="AWS_REGION not configured")
    return KmsEthereumSigner(key_id=key_id, region=region)


@router.get("/address")
def get_address():
    signer = _get_signer()
    return {"address": signer.get_eth_address()}


@router.post("/signDigest")
def sign_digest(req: SignDigestRequest):
    signer = _get_signer()
    r, s, v, y_parity = signer.sign_digest(req.digest)
    return {
        "r": f"0x{r:064x}",
        "s": f"0x{s:064x}",
        "v": v,
        "yParity": y_parity,
    }


