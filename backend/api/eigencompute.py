"""
EigenCompute Attestation Service

Provides TEE-backed attestation for API responses, enabling verifiable
computation for metadata fetching endpoints.

When EigenCompute is available, responses include cryptographic proof that:
1. The data was fetched correctly
2. The computation was performed in a TEE
3. The response hasn't been tampered with

References:
- https://developers.eigencloud.xyz/
- https://docs.eigencloud.xyz/
"""

import os
import json
import hashlib
import time
import logging
import asyncio
from typing import Optional
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

# Environment configuration
EIGENCOMPUTE_ENABLED = os.getenv("EIGENCOMPUTE_ENABLED", "false").lower() == "true"
EIGENCOMPUTE_API_KEY = os.getenv("EIGENCOMPUTE_API_KEY", "")
EIGENCOMPUTE_ENDPOINT = os.getenv("EIGENCOMPUTE_ENDPOINT", "https://api.eigencloud.xyz")
EIGENCOMPUTE_TEE_KEY_ID = os.getenv("EIGENCOMPUTE_TEE_KEY_ID", "")

# Verification endpoint base URL
EIGENCOMPUTE_VERIFIER_URL = os.getenv(
    "EIGENCOMPUTE_VERIFIER_URL",
    "https://verify.eigencloud.xyz"
)


@dataclass
class AttestationResult:
    """Result of an attestation request."""
    content_hash: str
    timestamp: int
    tee_signature: Optional[str] = None
    attestation_report: Optional[str] = None
    verifier_url: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "content_hash": self.content_hash,
            "timestamp": self.timestamp,
        }
        if self.tee_signature:
            result["tee_signature"] = self.tee_signature
        if self.attestation_report:
            result["attestation_report"] = self.attestation_report
        if self.verifier_url:
            result["verifier_url"] = self.verifier_url
        if self.error:
            result["error"] = self.error
        return result


def compute_content_hash(data: dict) -> str:
    """
    Compute deterministic SHA256 hash of response data.

    Uses sorted keys and consistent JSON encoding to ensure
    the same data always produces the same hash.
    """
    # Sort keys for deterministic serialization
    canonical_json = json.dumps(data, sort_keys=True, separators=(',', ':'))
    hash_bytes = hashlib.sha256(canonical_json.encode('utf-8')).digest()
    return "0x" + hash_bytes.hex()


def is_enabled() -> bool:
    """Check if EigenCompute attestation is enabled and configured."""
    if not EIGENCOMPUTE_ENABLED:
        return False

    if not EIGENCOMPUTE_API_KEY:
        logger.warning("EIGENCOMPUTE_ENABLED is true but EIGENCOMPUTE_API_KEY is not set")
        return False

    return True


async def generate_attestation(data: dict) -> Optional[AttestationResult]:
    """
    Generate TEE attestation for response data.

    Args:
        data: The response data to attest

    Returns:
        AttestationResult with proof data, or None if attestation is disabled/failed
    """
    if not is_enabled():
        return None

    try:
        # Compute content hash
        content_hash = compute_content_hash(data)
        timestamp = int(time.time())

        # Prepare attestation request
        attestation_request = {
            "content_hash": content_hash,
            "timestamp": timestamp,
            "data_type": "erc7730_metadata",
            "version": "1.0"
        }

        def request_attestation():
            """Make attestation request to EigenCompute."""
            headers = {
                "Authorization": f"Bearer {EIGENCOMPUTE_API_KEY}",
                "Content-Type": "application/json"
            }

            # Request TEE attestation
            response = requests.post(
                f"{EIGENCOMPUTE_ENDPOINT}/v1/attest",
                json=attestation_request,
                headers=headers,
                timeout=30
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(
                    f"EigenCompute attestation failed: {response.status_code} - {response.text}"
                )
                return None

        # Make async request
        result = await asyncio.to_thread(request_attestation)

        if result:
            return AttestationResult(
                content_hash=content_hash,
                timestamp=timestamp,
                tee_signature=result.get("signature"),
                attestation_report=result.get("attestation_report"),
                verifier_url=f"{EIGENCOMPUTE_VERIFIER_URL}/verify/{content_hash}"
            )
        else:
            # Return partial attestation with just the hash (fallback)
            return AttestationResult(
                content_hash=content_hash,
                timestamp=timestamp,
                error="EigenCompute attestation unavailable"
            )

    except requests.exceptions.Timeout:
        logger.error("EigenCompute attestation request timed out")
        content_hash = compute_content_hash(data)
        return AttestationResult(
            content_hash=content_hash,
            timestamp=int(time.time()),
            error="Attestation request timed out"
        )
    except Exception as e:
        logger.error(f"EigenCompute attestation error: {e}")
        content_hash = compute_content_hash(data)
        return AttestationResult(
            content_hash=content_hash,
            timestamp=int(time.time()),
            error=f"Attestation error: {str(e)}"
        )


async def verify_attestation(data: dict, attestation: dict) -> dict:
    """
    Verify an attestation locally and optionally via EigenCompute.

    Args:
        data: The original response data
        attestation: The attestation object to verify

    Returns:
        dict with verification results:
        - hash_valid: bool - whether content hash matches
        - signature_valid: bool - whether TEE signature is valid (if present)
        - verified: bool - overall verification status
        - error: str - error message if verification failed
    """
    result = {
        "hash_valid": False,
        "signature_valid": None,
        "verified": False,
        "error": None
    }

    try:
        # Step 1: Verify content hash
        expected_hash = compute_content_hash(data)
        actual_hash = attestation.get("content_hash", "")

        result["hash_valid"] = expected_hash == actual_hash

        if not result["hash_valid"]:
            result["error"] = "Content hash mismatch"
            return result

        # Step 2: Verify TEE signature (if present and EigenCompute is available)
        tee_signature = attestation.get("tee_signature")

        if tee_signature and is_enabled():
            def verify_signature():
                headers = {
                    "Authorization": f"Bearer {EIGENCOMPUTE_API_KEY}",
                    "Content-Type": "application/json"
                }

                response = requests.post(
                    f"{EIGENCOMPUTE_ENDPOINT}/v1/verify",
                    json={
                        "content_hash": actual_hash,
                        "signature": tee_signature,
                        "timestamp": attestation.get("timestamp")
                    },
                    headers=headers,
                    timeout=30
                )

                if response.status_code == 200:
                    return response.json().get("valid", False)
                return None

            signature_result = await asyncio.to_thread(verify_signature)
            result["signature_valid"] = signature_result

            if signature_result is False:
                result["error"] = "TEE signature verification failed"
                return result

        # Overall verification
        result["verified"] = result["hash_valid"] and (
            result["signature_valid"] is None or result["signature_valid"]
        )

        return result

    except Exception as e:
        result["error"] = f"Verification error: {str(e)}"
        return result


def create_verifiable_response(
    success: bool,
    blob_hash: str,
    metadata: Optional[dict] = None,
    error: Optional[str] = None,
    attestation: Optional[AttestationResult] = None
) -> dict:
    """
    Create a verifiable response with optional attestation.

    This is a helper function to construct the response format
    with attestation data included.
    """
    response = {
        "success": success,
        "blob_hash": blob_hash,
    }

    if metadata is not None:
        response["metadata"] = metadata

    if error is not None:
        response["error"] = error

    if attestation is not None:
        response["attestation"] = attestation.to_dict()
    else:
        response["attestation"] = None

    return response
