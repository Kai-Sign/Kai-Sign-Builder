from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from subprocess import Popen, PIPE
from dotenv import load_dotenv
import os
import json
import requests
from typing import Optional, List
import asyncio
import logging
import hashlib
from datetime import datetime
from collections import defaultdict
import time

# Import patched version first to apply the monkeypatches
import api.patched_erc7730

# Now import the regular modules which will have the patches applied
from erc7730.generate.generate import generate_descriptor
from erc7730.model.input.descriptor import InputERC7730Descriptor
from erc7730.model.display import FieldFormat, AddressNameType
from erc7730.model.input.context import InputContractContext, InputEIP712Context, InputContract, InputEIP712
from erc7730.model.input.display import InputDisplay, InputFieldDescription, InputAddressNameParameters
from erc7730.model.input.metadata import InputMetadata
import traceback
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from api.healthcheck import router as healthcheck_router
from fastapi.exceptions import RequestValidationError
from api.kms_routes import router as kms_router
from api.relay import router as relay_router
from starlette.exceptions import HTTPException as StarletteHTTPException
from api.metadata_cache import (
    get_cached_metadata,
    set_cached_metadata,
    load_metadata_from_directory,
    load_cache_from_disk,
    get_cache_stats,
    bulk_load_metadata,
    clear_cache as clear_metadata_cache
)
from web3 import Web3

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# RATE LIMITING - Bot-resistant implementation
# =============================================================================
# Uses sliding window with fingerprinting to prevent abuse
# Bots can't easily bypass because we combine multiple signals

class RateLimiter:
    """Sliding window rate limiter with client fingerprinting."""

    def __init__(self):
        # {fingerprint: [(timestamp, request_count), ...]}
        self.requests: dict = defaultdict(list)
        self.blocked: dict = {}  # {fingerprint: block_until_timestamp}
        self.lock = asyncio.Lock()

        # Rate limit configuration
        self.window_seconds = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
        self.max_requests = int(os.getenv("RATE_LIMIT_MAX", "30"))
        self.block_duration = int(os.getenv("RATE_LIMIT_BLOCK_SECONDS", "300"))

        # Burst protection: max requests in short window
        self.burst_window = 5  # seconds
        self.burst_max = 10  # max requests in burst window

    def _get_fingerprint(self, request: Request) -> str:
        """Generate client fingerprint from multiple signals.

        Combines IP + User-Agent + Accept headers to make it harder
        for bots to rotate identities.
        """
        ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")[:100]
        accept = request.headers.get("accept", "")[:50]
        accept_lang = request.headers.get("accept-language", "")[:20]

        # Create fingerprint hash
        fingerprint_data = f"{ip}|{user_agent}|{accept}|{accept_lang}"
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]

    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP, handling proxies."""
        # Check common proxy headers
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Take first IP in chain (original client)
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to direct connection
        if request.client:
            return request.client.host
        return "unknown"

    async def is_allowed(self, request: Request) -> tuple[bool, dict]:
        """Check if request is allowed under rate limits.

        Returns (allowed, info_dict) where info_dict contains:
        - remaining: requests remaining in window
        - reset_in: seconds until window resets
        - blocked_until: timestamp if blocked (None otherwise)
        """
        fingerprint = self._get_fingerprint(request)
        now = time.time()

        async with self.lock:
            # Check if client is blocked
            if fingerprint in self.blocked:
                block_until = self.blocked[fingerprint]
                if now < block_until:
                    return False, {
                        "remaining": 0,
                        "reset_in": int(block_until - now),
                        "blocked_until": int(block_until),
                        "reason": "Too many requests. You are temporarily blocked."
                    }
                else:
                    # Block expired
                    del self.blocked[fingerprint]

            # Clean old entries outside window
            window_start = now - self.window_seconds
            self.requests[fingerprint] = [
                (ts, count) for ts, count in self.requests[fingerprint]
                if ts > window_start
            ]

            # Count requests in window
            total_requests = sum(count for _, count in self.requests[fingerprint])

            # Check burst (last 5 seconds)
            burst_start = now - self.burst_window
            burst_requests = sum(
                count for ts, count in self.requests[fingerprint]
                if ts > burst_start
            )

            # Check limits
            if burst_requests >= self.burst_max:
                # Burst limit hit - short block
                self.blocked[fingerprint] = now + 60
                return False, {
                    "remaining": 0,
                    "reset_in": 60,
                    "blocked_until": int(now + 60),
                    "reason": "Burst limit exceeded. Slow down."
                }

            if total_requests >= self.max_requests:
                # Window limit hit - longer block
                self.blocked[fingerprint] = now + self.block_duration
                return False, {
                    "remaining": 0,
                    "reset_in": self.block_duration,
                    "blocked_until": int(now + self.block_duration),
                    "reason": "Rate limit exceeded. You are temporarily blocked."
                }

            # Record this request
            self.requests[fingerprint].append((now, 1))

            return True, {
                "remaining": self.max_requests - total_requests - 1,
                "reset_in": int(self.window_seconds - (now - window_start)),
                "blocked_until": None
            }

    async def cleanup(self):
        """Periodic cleanup of old entries to prevent memory bloat."""
        async with self.lock:
            now = time.time()
            window_start = now - self.window_seconds

            # Clean request history
            empty_keys = []
            for fp in self.requests:
                self.requests[fp] = [
                    (ts, count) for ts, count in self.requests[fp]
                    if ts > window_start
                ]
                if not self.requests[fp]:
                    empty_keys.append(fp)

            for fp in empty_keys:
                del self.requests[fp]

            # Clean expired blocks
            expired_blocks = [
                fp for fp, until in self.blocked.items()
                if until < now
            ]
            for fp in expired_blocks:
                del self.blocked[fp]

# Global rate limiter instance
rate_limiter = RateLimiter()

# =============================================================================
# REQUEST DEDUPLICATION - Prevents duplicate work for concurrent identical requests
# =============================================================================

from asyncio import Event

# In-flight request tracking: {cache_key: (event, result)}
_pending_requests: dict = {}
_pending_lock = asyncio.Lock()


async def deduplicated_fetch(cache_key: str, fetch_fn):
    """
    Deduplicate concurrent identical requests.

    If another request with the same cache_key is already in-flight,
    wait for it to complete and share the result instead of doing duplicate work.

    Args:
        cache_key: Unique key identifying the request (e.g., "address_chainid")
        fetch_fn: Async function to call if this is the first request

    Returns:
        The result from fetch_fn (either from this call or a concurrent one)
    """
    global _pending_requests

    async with _pending_lock:
        if cache_key in _pending_requests:
            # Another request is already in progress
            event, _ = _pending_requests[cache_key]
            logger.info(f"Request dedup: waiting for in-flight request {cache_key}")
        else:
            # First request - create tracking entry
            event = Event()
            _pending_requests[cache_key] = (event, None)
            logger.info(f"Request dedup: first request for {cache_key}")

    # If we're waiting for another request
    if cache_key in _pending_requests:
        existing_event, _ = _pending_requests[cache_key]
        if existing_event != event:
            # Wait for the in-flight request to complete
            await existing_event.wait()
            # Get the result
            _, result = _pending_requests.get(cache_key, (None, None))
            return result

    # We're the first request - do the actual work
    try:
        result = await fetch_fn()
        async with _pending_lock:
            _pending_requests[cache_key] = (event, result)
        return result
    except Exception as e:
        # On error, still signal completion so waiters don't hang
        async with _pending_lock:
            _pending_requests[cache_key] = (event, {"error": str(e)})
        raise
    finally:
        # Signal that we're done
        event.set()
        # Clean up after a brief delay (allow other waiters to get result)
        await asyncio.sleep(0.5)
        async with _pending_lock:
            if cache_key in _pending_requests:
                del _pending_requests[cache_key]


load_dotenv()

# Define USE_MOCK environment variable - set to False by default
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"

# Environment variables for contract interaction
ALCHEMY_RPC_URL = os.getenv("ALCHEMY_RPC_URL")
KAISIGN_CONTRACT_ADDRESS = os.getenv("KAISIGN_CONTRACT_ADDRESS", "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719")

# Constants for blob decoding
PADDING_MARKER = "\n\n/* ERC7730_BLOB_PADDING_START */\n"
SEPOLIA_RPC = os.getenv("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com")
SEPOLIA_BEACON = os.getenv("SEPOLIA_BEACON_URL", "https://lodestar-sepolia.chainsafe.io")
BLOB_SIZE = 131072  # 4096 * 32

def load_env():
    etherscan_api_key = os.getenv("ETHERSCAN_API_KEY")
    if not etherscan_api_key:
        raise HTTPException(
            status_code=500,
            detail="ETHERSCAN_API_KEY environment variable is not set. Please configure it in your environment."
        )
    env = os.environ.copy()
    env["ETHERSCAN_API_KEY"] = etherscan_api_key
    # We're using in-memory cache instead of file-based cache
    # but keep this env var for compatibility with other parts of the code
    env["XDG_CACHE_HOME"] = '/tmp'
    load_dotenv()

app = FastAPI(
    title="ERC7730 API", 
    description="API for generating ERC7730 descriptors",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# Include the healthcheck router
app.include_router(healthcheck_router)
app.include_router(kms_router)
app.include_router(relay_router)

# Configure CORS with wildcard - API serves public blockchain metadata
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False with wildcard origin per CORS spec
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# =============================================================================
# RATE LIMITING MIDDLEWARE
# =============================================================================
# Applied to all routes except health checks

# Paths exempt from rate limiting
RATE_LIMIT_EXEMPT_PATHS = {"/", "/api/py", "/health", "/api/py/health"}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to all non-exempt requests."""
    # Skip rate limiting for exempt paths and OPTIONS requests
    if request.url.path in RATE_LIMIT_EXEMPT_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    # Check rate limit
    allowed, info = await rate_limiter.is_allowed(request)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Rate limit exceeded",
                "message": info.get("reason", "Too many requests"),
                "retry_after": info.get("reset_in", 60)
            },
            headers={
                "Retry-After": str(info.get("reset_in", 60)),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(info.get("reset_in", 60))
            }
        )

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    response.headers["X-RateLimit-Remaining"] = str(info.get("remaining", 0))
    response.headers["X-RateLimit-Reset"] = str(info.get("reset_in", 60))

    return response

# Periodic cleanup task
async def rate_limit_cleanup_task():
    """Run cleanup every 5 minutes to prevent memory bloat."""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        await rate_limiter.cleanup()
        logger.debug("Rate limiter cleanup completed")

@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup."""
    asyncio.create_task(rate_limit_cleanup_task())

class Message(BaseModel):
    message: str

class Props(BaseModel):
    abi: str | None = None
    address: str | None = None
    chain_id: int | None = None

class IPFSMetadataRequest(BaseModel):
    spec_id: str

class IPFSMetadataResponse(BaseModel):
    spec_id: str
    ipfs_hash: Optional[str] = None
    contract_address: Optional[str] = None
    chain_id: Optional[int] = None
    error: Optional[str] = None

class BatchIPFSMetadataRequest(BaseModel):
    spec_ids: List[str]

class BatchIPFSMetadataResponse(BaseModel):
    results: List[IPFSMetadataResponse]

class BlobResponse(BaseModel):
    success: bool
    blob_hash: str
    metadata: Optional[dict] = None
    error: Optional[str] = None

def decode_blob_data(blob_hex: str) -> str:
    """Decode raw blob hex data to string.

    Blob format: 4096 field elements × 32 bytes each
    Each field element: [0x00 (1 byte), data (31 bytes)]
    Total usable data: ~127KB per blob
    """
    # Remove 0x prefix if present
    if blob_hex.startswith('0x'):
        blob_hex = blob_hex[2:]

    blob_bytes = bytes.fromhex(blob_hex)
    result = bytearray()

    # Each field element is 32 bytes: [0x00, 31 bytes of data]
    for field_index in range(4096):
        offset = field_index * 32
        # Skip first byte (always 0), read next 31 bytes
        for byte_index in range(1, 32):
            if offset + byte_index >= len(blob_bytes):
                break
            byte_val = blob_bytes[offset + byte_index]
            result.append(byte_val)

    # Decode and strip null bytes
    return result.decode('utf-8', errors='ignore').rstrip('\x00')

async def fetch_blob_from_beacon(slot: int, blob_hash: str) -> Optional[str]:
    """Fetch blob from beacon chain API by slot."""
    from concurrent.futures import ThreadPoolExecutor

    def fetch():
        response = requests.get(
            f"{SEPOLIA_BEACON}/eth/v1/beacon/blob_sidecars/{slot}",
            timeout=15
        )
        response.raise_for_status()
        return response.json()

    try:
        # Use ThreadPoolExecutor with timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fetch)
            data = future.result(timeout=20)

        sidecars = data.get("data", [])

        # Find the blob with matching versioned hash
        for sidecar in sidecars:
            # KZG commitment → versioned hash
            kzg_commitment = sidecar.get("kzg_commitment", "")
            # Versioned hash = 0x01 + sha256(commitment)[1:]
            if kzg_commitment:
                commitment_hex = kzg_commitment[2:] if kzg_commitment.startswith('0x') else kzg_commitment
                commitment_bytes = bytes.fromhex(commitment_hex)
                hash_bytes = hashlib.sha256(commitment_bytes).digest()
                versioned_hash = "0x01" + hash_bytes[1:].hex()

                if versioned_hash.lower() == blob_hash.lower():
                    return sidecar.get("blob", "")

        return None
    except Exception as e:
        logger.error(f"Beacon fetch error: {e}")
        return None

async def find_blob_slot(blob_hash: str, tx_hash_or_timestamp: Optional[str] = None) -> Optional[int]:
    """Find the beacon slot containing the blob.

    Uses timestamp-based slot calculation when tx_hash or timestamp is provided (fast path),
    otherwise searches recent beacon slots (slow path).

    tx_hash_or_timestamp can be:
    - A transaction hash (0x...) - will fetch block timestamp via RPC
    - A Unix timestamp string - will use directly for slot calculation
    """
    import time
    start_time = time.time()

    # Sepolia beacon chain constants
    SLOT_TIME = 12  # seconds per slot
    GENESIS_TIME = 1655733600  # Sepolia beacon genesis

    def check_slot_for_blob(s: int) -> Optional[int]:
        """Check if blob exists in given slot."""
        try:
            response = requests.get(
                f"{SEPOLIA_BEACON}/eth/v1/beacon/blob_sidecars/{s}",
                timeout=10
            )
            if response.status_code != 200:
                return None

            sidecars = response.json().get("data", [])
            for sidecar in sidecars:
                kzg_commitment = sidecar.get("kzg_commitment", "")
                if kzg_commitment:
                    commitment_hex = kzg_commitment[2:] if kzg_commitment.startswith('0x') else kzg_commitment
                    commitment_bytes = bytes.fromhex(commitment_hex)
                    hash_bytes = hashlib.sha256(commitment_bytes).digest()
                    versioned_hash = "0x01" + hash_bytes[1:].hex()

                    if versioned_hash.lower() == blob_hash.lower():
                        return s
            return None
        except Exception as e:
            logger.debug(f"Error checking slot {s}: {e}")
            return None

    try:
        estimated_slot = None

        # Fast path: Calculate slot from timestamp or tx_hash
        if tx_hash_or_timestamp:
            logger.info(f"find_blob_slot: tx_hash_or_timestamp={tx_hash_or_timestamp}")
            # Check if it's a timestamp (numeric string) or tx hash (0x...)
            if tx_hash_or_timestamp.startswith("0x"):
                # It's a tx hash - fetch block timestamp
                def get_slot_from_tx():
                    response = requests.post(
                        SEPOLIA_RPC,
                        json={"jsonrpc": "2.0", "method": "eth_getTransactionReceipt", "params": [tx_hash_or_timestamp], "id": 1},
                        timeout=10
                    )
                    result = response.json().get("result")
                    if not result or not result.get("blockNumber"):
                        return None

                    block_num = int(result["blockNumber"], 16)
                    response = requests.post(
                        SEPOLIA_RPC,
                        json={"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": [hex(block_num), False], "id": 1},
                        timeout=10
                    )
                    block = response.json().get("result")
                    if not block or not block.get("timestamp"):
                        return None

                    block_timestamp = int(block["timestamp"], 16)
                    return (block_timestamp - GENESIS_TIME) // SLOT_TIME

                estimated_slot = await asyncio.to_thread(get_slot_from_tx)
            else:
                # It's a timestamp - use directly
                try:
                    block_timestamp = int(tx_hash_or_timestamp)
                    estimated_slot = (block_timestamp - GENESIS_TIME) // SLOT_TIME
                    logger.info(f"find_blob_slot: calculated slot={estimated_slot} from timestamp={block_timestamp}")
                except ValueError:
                    logger.error(f"find_blob_slot: failed to parse timestamp={tx_hash_or_timestamp}")
                    pass

        if estimated_slot:
            logger.info(f"find_blob_slot: starting sequential search around slot {estimated_slot}")
            # Search slots SEQUENTIALLY to avoid async/threading issues
            # Search narrower range (-3 to +2) for faster response
            offsets = [-1, 0, -2, 1, -3, 2]

            for offset in offsets:
                slot = estimated_slot + offset
                logger.info(f"find_blob_slot: checking slot {slot} (offset {offset})")
                result = check_slot_for_blob(slot)
                if result is not None:
                    logger.info(f"find_blob_slot: found blob at slot {result} in {time.time() - start_time:.2f}s")
                    return result

            logger.info(f"find_blob_slot: sequential search completed in {time.time() - start_time:.2f}s, not found")

        # Slow path: Search recent beacon slots
        def get_head_slot():
            response = requests.get(
                f"{SEPOLIA_BEACON}/eth/v1/beacon/headers/head",
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            return int(data.get("data", {}).get("header", {}).get("message", {}).get("slot", 0))

        head_slot = await asyncio.to_thread(get_head_slot)

        if head_slot == 0:
            logger.error("Could not get beacon head slot")
            return None

        # Search recent beacon slots for the blob
        search_range = 100  # Search last 100 slots (~20 minutes)

        for slot in range(head_slot, head_slot - search_range, -1):
            def check_slot(s):
                try:
                    response = requests.get(
                        f"{SEPOLIA_BEACON}/eth/v1/beacon/blob_sidecars/{s}",
                        timeout=30
                    )
                    if response.status_code != 200:
                        return None

                    sidecars = response.json().get("data", [])
                    for sidecar in sidecars:
                        kzg_commitment = sidecar.get("kzg_commitment", "")
                        if kzg_commitment:
                            commitment_hex = kzg_commitment[2:] if kzg_commitment.startswith('0x') else kzg_commitment
                            commitment_bytes = bytes.fromhex(commitment_hex)
                            hash_bytes = hashlib.sha256(commitment_bytes).digest()
                            versioned_hash = "0x01" + hash_bytes[1:].hex()

                            if versioned_hash.lower() == blob_hash.lower():
                                return s
                    return None
                except Exception:
                    return None

            found_slot = await asyncio.to_thread(lambda s=slot: check_slot(s))
            if found_slot:
                return found_slot

        return None
    except Exception as e:
        logger.error(f"Slot search error: {e}")
        return None

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.error(f"HTTP exception: {exc.status_code} - {exc.detail} - Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP Error",
            "message": str(exc.detail),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"message": str(exc)}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"message": str(exc)}
    )

def generate_mock_descriptor(address: str, chain_id: int = 1):
    """Generate a mock ERC7730 descriptor for testing purposes."""
    return {
        "context": {
            "contract": {
                "deployments": [
                    {
                        "chainId": chain_id,
                        "address": address
                    }
                ],
                "abi": [
                    {
                        "type": "function",
                        "name": "balanceOf",
                        "inputs": [
                            {
                                "name": "owner",
                                "type": "address"
                            }
                        ],
                        "outputs": [
                            {
                                "name": "",
                                "type": "uint256"
                            }
                        ],
                        "stateMutability": "view"
                    },
                    {
                        "type": "function",
                        "name": "transfer",
                        "inputs": [
                            {
                                "name": "to",
                                "type": "address"
                            },
                            {
                                "name": "value",
                                "type": "uint256"
                            }
                        ],
                        "outputs": [
                            {
                                "name": "",
                                "type": "bool"
                            }
                        ],
                        "stateMutability": "nonpayable"
                    }
                ]
            }
        },
        "metadata": {
            "owner": "Mock Token",
            "constants": {}
        },
        "display": {
            "formats": {
                "balanceOf(address)": {
                    "intent": "Get the balance of an account",
                    "fields": [
                        {
                            "label": "Account address",
                            "format": "raw"
                        }
                    ]
                },
                "transfer(address,uint256)": {
                    "intent": "Transfer tokens to a recipient",
                    "fields": [
                        {
                            "label": "Recipient address",
                            "format": "raw"
                        },
                        {
                            "label": "Amount to transfer",
                            "format": "raw"
                        }
                    ]
                }
            }
        }
    }

async def fetch_ipfs_hash_from_contract(spec_id: str) -> Optional[str]:
    """Fetch IPFS hash from the contract using the specID."""
    try:
        if not ALCHEMY_RPC_URL:
            raise Exception("ALCHEMY_RPC_URL environment variable is not set")
        
        # Prepare the JSON-RPC request for eth_call
        contract_call_data = {
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                {
                    "to": KAISIGN_CONTRACT_ADDRESS,
                    "data": f"0xe90ffed8{spec_id[2:].zfill(64)}"  # getIPFSByHash function selector + padded specID
                },
                "latest"
            ],
            "id": 1
        }
        
        # Use asyncio.to_thread to make requests async-compatible
        def make_request():
            response = requests.post(ALCHEMY_RPC_URL, json=contract_call_data, timeout=30)
            response.raise_for_status()
            return response.json()
        
        result = await asyncio.to_thread(make_request)
        
        if "error" in result:
            raise Exception(f"RPC error: {result['error']}")
        
        # Decode the hex response to get the IPFS hash
        hex_result = result["result"]
        if hex_result == "0x":
            return None
            
        # Remove 0x prefix and decode
        hex_data = hex_result[2:]
        if len(hex_data) < 128:  # Minimum length for string response
            return None
            
        # Skip the first 64 characters (offset) and next 64 characters (length)
        # Then decode the actual string data
        try:
            # Get the length of the string (bytes 32-63)
            length_hex = hex_data[64:128]
            length = int(length_hex, 16)
            
            if length == 0:
                return None
                
            # Get the actual string data
            string_hex = hex_data[128:128 + (length * 2)]
            ipfs_hash = bytes.fromhex(string_hex).decode('utf-8')
            
            return ipfs_hash if ipfs_hash else None
            
        except Exception as decode_error:
            print(f"Error decoding contract response: {decode_error}")
            return None
            
    except Exception as e:
        print(f"Error fetching IPFS hash from contract: {e}")
        return None

async def fetch_ipfs_metadata(ipfs_hash: str) -> dict:
    """Fetch metadata from IPFS and extract contract address and chain ID.

    Uses parallel fetching from all gateways - first success wins.
    """
    gateways = [
        f"https://ipfs.io/ipfs/{ipfs_hash}",
        f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}",
        f"https://cloudflare-ipfs.com/ipfs/{ipfs_hash}"
    ]

    def extract_metadata_from_response(metadata: dict) -> dict:
        """Extract contract address and chain ID from metadata."""
        contract_address = None
        chain_id = None

        # Check new ERC7730 format first: context.contract.deployments
        if metadata.get("context", {}).get("contract", {}).get("deployments"):
            deployments = metadata["context"]["contract"]["deployments"]
            if deployments and len(deployments) > 0:
                deployment = deployments[0]
                contract_address = deployment.get("address")
                chain_id = deployment.get("chainId")

        # Fall back to old format: context.eip712.deployments
        if not contract_address and metadata.get("context", {}).get("eip712", {}).get("deployments"):
            deployments = metadata["context"]["eip712"]["deployments"]
            if deployments and len(deployments) > 0:
                deployment = deployments[0]
                contract_address = deployment.get("address")
                chain_id = deployment.get("chainId")

        return {
            "contract_address": contract_address,
            "chain_id": chain_id,
            "metadata": metadata
        }

    async def fetch_from_gateway(url: str) -> dict:
        """Fetch from a single gateway."""
        def make_request():
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        return await asyncio.to_thread(make_request)

    # Create tasks for all gateways - race them in parallel
    tasks = [asyncio.create_task(fetch_from_gateway(url)) for url in gateways]

    # Use as_completed to get the first successful result
    for coro in asyncio.as_completed(tasks):
        try:
            metadata = await coro
            # Cancel remaining tasks - we got what we need
            for t in tasks:
                if not t.done():
                    t.cancel()
            logger.info(f"IPFS fetch succeeded for {ipfs_hash}")
            return extract_metadata_from_response(metadata)
        except Exception as e:
            logger.debug(f"IPFS gateway failed: {e}")
            continue

    # All gateways failed
    raise Exception(f"Failed to fetch from all IPFS gateways for {ipfs_hash}")

# Explicitly remove response_model validation to avoid Pydantic validation issues in deployment
@app.post("/generateERC7730")
@app.post("/api/py/generateERC7730")
async def run_erc7730(params: Props):
    """Generate the 'erc7730' based on an ABI."""
    try:
        # Proceed with actual implementation
        load_env()
        result = None

        # we only manage ethereum mainnet
        chain_id = params.chain_id or 1
        
        if USE_MOCK:
            # Use mock data in testing/development
            address = params.address or "0x0000000000000000000000000000000000000000"
            return JSONResponse(content=generate_mock_descriptor(address, chain_id))
        
        if (params.abi):
            try:
                result = generate_descriptor(
                    chain_id=chain_id,
                    contract_address='0xdeadbeef00000000000000000000000000000000', # because it's mandatory mock address see with laurent
                    abi=params.abi
                )
            except Exception as e:
                error_detail = f"Error with ABI: {str(e)}"
                raise HTTPException(status_code=500, detail=error_detail)
       
        if (params.address and not result):
            try:
                result = generate_descriptor(
                    chain_id=chain_id,
                    contract_address=params.address
                )
            except Exception as e:
                error_detail = f"Error with address: {str(e)}"
                if "Missing/Invalid API Key" in str(e):
                    raise HTTPException(
                        status_code=500,
                        detail="Etherscan API key is missing or invalid. Please check your configuration."
                    )
                raise HTTPException(status_code=500, detail=error_detail)
            
        if result is None:
            raise HTTPException(status_code=400, detail="No ABI or address provided")

        # The result should already be a serializable dict thanks to our patch
        # But we'll add a fallback just in case
        try:
            # If it's already a dict, this should work fine
            return JSONResponse(content=result)
        except Exception as e:
            # If there's still an issue, try more aggressive serialization
            try:
                # Try our make_serializable function from the patch
                from api.patched_erc7730 import make_serializable
                serialized_result = make_serializable(result)
                return JSONResponse(content=serialized_result)
            except Exception as nested_exc:
                # Last resort, convert to string representation
                error_msg = f"Failed to serialize: {str(e)}. Nested error: {str(nested_exc)}"
                raise HTTPException(status_code=500, detail=error_msg)

    except HTTPException as e:
        raise e
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)

@app.post("/getIPFSMetadata")
@app.post("/api/py/getIPFSMetadata")
async def get_ipfs_metadata(request: IPFSMetadataRequest):
    """Fetch IPFS metadata for a given specID."""
    try:
        spec_id = request.spec_id
        
        # Validate specID format
        if not spec_id or not spec_id.startswith("0x") or len(spec_id) != 66:
            raise HTTPException(
                status_code=400, 
                detail="Invalid specID format. Expected 32-byte hex string with 0x prefix."
            )
        
        # Fetch IPFS hash from contract
        ipfs_hash = await fetch_ipfs_hash_from_contract(spec_id)
        
        if not ipfs_hash:
            return IPFSMetadataResponse(
                spec_id=spec_id,
                error="No IPFS hash found for this specID"
            )
        
        # Fetch metadata from IPFS
        try:
            metadata_result = await fetch_ipfs_metadata(ipfs_hash)
            
            return IPFSMetadataResponse(
                spec_id=spec_id,
                ipfs_hash=ipfs_hash,
                contract_address=metadata_result.get("contract_address"),
                chain_id=metadata_result.get("chain_id")
            )
            
        except Exception as ipfs_error:
            return IPFSMetadataResponse(
                spec_id=spec_id,
                ipfs_hash=ipfs_hash,
                error=f"Failed to fetch IPFS metadata: {str(ipfs_error)}"
            )
            
    except HTTPException as e:
        raise e
    except Exception as e:
        error_detail = f"Unexpected error: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)

async def process_single_spec_id(spec_id: str) -> IPFSMetadataResponse:
    """Process a single specID asynchronously and independently."""
    try:
        # Validate specID format
        if not spec_id or not spec_id.startswith("0x") or len(spec_id) != 66:
            return IPFSMetadataResponse(
                spec_id=spec_id,
                error="Invalid specID format. Expected 32-byte hex string with 0x prefix."
            )
        
        # Fetch IPFS hash from contract
        ipfs_hash = await fetch_ipfs_hash_from_contract(spec_id)
        
        if not ipfs_hash:
            return IPFSMetadataResponse(
                spec_id=spec_id,
                error="No IPFS hash found for this specID"
            )
        
        # Fetch metadata from IPFS
        try:
            metadata_result = await fetch_ipfs_metadata(ipfs_hash)
            
            return IPFSMetadataResponse(
                spec_id=spec_id,
                ipfs_hash=ipfs_hash,
                contract_address=metadata_result.get("contract_address"),
                chain_id=metadata_result.get("chain_id")
            )
            
        except Exception as ipfs_error:
            return IPFSMetadataResponse(
                spec_id=spec_id,
                ipfs_hash=ipfs_hash,
                error=f"Failed to fetch IPFS metadata: {str(ipfs_error)}"
            )
            
    except Exception as e:
        return IPFSMetadataResponse(
            spec_id=spec_id,
            error=f"Unexpected error: {str(e)}"
        )

@app.post("/getBatchIPFSMetadata")
@app.post("/api/py/getBatchIPFSMetadata")
async def get_batch_ipfs_metadata(request: BatchIPFSMetadataRequest):
    """Fetch IPFS metadata for multiple specIDs asynchronously and independently."""
    try:
        # Process all specIDs concurrently using asyncio.gather
        # This makes each fetch independent and asynchronous
        tasks = [process_single_spec_id(spec_id) for spec_id in request.spec_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert any exceptions to error responses
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(IPFSMetadataResponse(
                    spec_id=request.spec_ids[i],
                    error=f"Processing error: {str(result)}"
                ))
            else:
                processed_results.append(result)
        
        return BatchIPFSMetadataResponse(results=processed_results)
        
    except Exception as e:
        # If there's a general error, return error responses for all specIDs
        error_results = [
            IPFSMetadataResponse(
                spec_id=spec_id,
                error=f"Batch processing error: {str(e)}"
            ) for spec_id in request.spec_ids
        ]
        return BatchIPFSMetadataResponse(results=error_results)

# Add a simple test route for health check
@app.get("/")
@app.get("/api/py")
async def read_root():
    return {"message": "API is running"}

# Debug endpoint to verify deployment version
@app.get("/api/py/debug")
async def debug_info():
    """Return debug info about the deployment."""
    return {
        "version": "2.1.6-try-all-specs",
        "sepolia_beacon": SEPOLIA_BEACON,
        "sepolia_rpc": SEPOLIA_RPC,
        "genesis_time": 1655733600,
        "slot_time": 12,
        "features": ["parallel_slot_search", "blockTimestamp_lookup"]
    }

# Test endpoint for slot lookup
@app.get("/api/py/test-slot/{blob_hash}")
async def test_slot_lookup(
    blob_hash: str = Path(...),
    timestamp: Optional[str] = Query(None)
):
    """Test slot lookup for debugging."""
    import time
    start = time.time()

    try:
        slot = await find_blob_slot(blob_hash, timestamp)
        elapsed = time.time() - start
        return {
            "success": slot is not None,
            "slot": slot,
            "elapsed_seconds": round(elapsed, 2),
            "timestamp_provided": timestamp,
            "beacon_url": SEPOLIA_BEACON
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "success": False,
            "error": str(e),
            "elapsed_seconds": round(elapsed, 2),
            "timestamp_provided": timestamp,
            "beacon_url": SEPOLIA_BEACON
        }

# Test full blob fetch (slot + blob)
@app.get("/api/py/test-full/{blob_hash}")
async def test_full_fetch(
    blob_hash: str = Path(...),
    timestamp: Optional[str] = Query(None)
):
    """Test full blob fetch for debugging."""
    import time

    results = {"steps": []}

    # Step 1: Find slot
    start = time.time()
    try:
        slot = await find_blob_slot(blob_hash, timestamp)
        results["steps"].append({
            "step": "find_slot",
            "elapsed": round(time.time() - start, 2),
            "success": slot is not None,
            "slot": slot
        })
    except Exception as e:
        results["steps"].append({
            "step": "find_slot",
            "elapsed": round(time.time() - start, 2),
            "success": False,
            "error": str(e)
        })
        return results

    if not slot:
        return results

    # Step 2: Fetch blob
    start = time.time()
    try:
        blob_hex = await fetch_blob_from_beacon(slot, blob_hash)
        results["steps"].append({
            "step": "fetch_blob",
            "elapsed": round(time.time() - start, 2),
            "success": blob_hex is not None,
            "blob_length": len(blob_hex) if blob_hex else 0
        })
    except Exception as e:
        results["steps"].append({
            "step": "fetch_blob",
            "elapsed": round(time.time() - start, 2),
            "success": False,
            "error": str(e)
        })
        return results

    # Step 3: Decode (if blob found)
    if blob_hex:
        start = time.time()
        try:
            content = decode_blob_data(blob_hex)
            padding_idx = content.find(PADDING_MARKER)
            if padding_idx != -1:
                content = content[:padding_idx]
            metadata = json.loads(content)
            results["steps"].append({
                "step": "decode",
                "elapsed": round(time.time() - start, 2),
                "success": True,
                "has_context": "context" in metadata,
                "has_display": "display" in metadata
            })
        except Exception as e:
            results["steps"].append({
                "step": "decode",
                "elapsed": round(time.time() - start, 2),
                "success": False,
                "error": str(e)
            })

    return results

# Test contract fetch (step by step)
@app.get("/api/py/test-contract/{address}")
async def test_contract_fetch(
    address: str = Path(...),
    chain_id: int = Query(1)
):
    """Test contract fetch step by step."""
    import time
    results = {"steps": []}

    # Step 1: Query subgraph
    start = time.time()
    try:
        specs = await query_subgraph_for_contract(address, chain_id)
        results["steps"].append({
            "step": "subgraph_query",
            "elapsed": round(time.time() - start, 2),
            "success": len(specs) > 0,
            "spec_count": len(specs)
        })
        if not specs:
            return results
    except Exception as e:
        results["steps"].append({
            "step": "subgraph_query",
            "elapsed": round(time.time() - start, 2),
            "success": False,
            "error": str(e)
        })
        return results

    # Get best spec
    best_spec = specs[0]
    blob_hash = best_spec.get("blobHash")
    block_timestamp = best_spec.get("blockTimestamp")

    results["blob_hash"] = blob_hash
    results["block_timestamp"] = block_timestamp

    # Step 2: Find slot
    start = time.time()
    try:
        slot = await find_blob_slot(blob_hash, str(block_timestamp) if block_timestamp else None)
        results["steps"].append({
            "step": "find_slot",
            "elapsed": round(time.time() - start, 2),
            "success": slot is not None,
            "slot": slot
        })
        if not slot:
            return results
    except Exception as e:
        results["steps"].append({
            "step": "find_slot",
            "elapsed": round(time.time() - start, 2),
            "success": False,
            "error": str(e)
        })
        return results

    # Step 3: Fetch blob
    start = time.time()
    try:
        blob_hex = await fetch_blob_from_beacon(slot, blob_hash)
        results["steps"].append({
            "step": "fetch_blob",
            "elapsed": round(time.time() - start, 2),
            "success": blob_hex is not None,
            "blob_length": len(blob_hex) if blob_hex else 0
        })
    except Exception as e:
        results["steps"].append({
            "step": "fetch_blob",
            "elapsed": round(time.time() - start, 2),
            "success": False,
            "error": str(e)
        })

    return results

# Test beacon connectivity
@app.get("/api/py/test-beacon")
async def test_beacon():
    """Test beacon chain connectivity."""
    import time
    import requests as sync_requests

    results = {}

    # Test lodestar
    try:
        start = time.time()
        resp = sync_requests.get(
            f"{SEPOLIA_BEACON}/eth/v1/beacon/headers/head",
            timeout=5
        )
        elapsed = time.time() - start
        results["lodestar"] = {
            "status": resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": resp.status_code == 200
        }
    except Exception as e:
        results["lodestar"] = {"error": str(e), "success": False}

    # Test publicnode beacon
    try:
        start = time.time()
        resp = sync_requests.get(
            "https://ethereum-sepolia-beacon-api.publicnode.com/eth/v1/beacon/headers/head",
            timeout=5
        )
        elapsed = time.time() - start
        results["publicnode"] = {
            "status": resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": resp.status_code == 200
        }
    except Exception as e:
        results["publicnode"] = {"error": str(e), "success": False}

    return results


# Test Blobscan/Swarm fallback
@app.get("/api/py/test-blobscan/{blob_hash}")
async def test_blobscan_fallback(
    blob_hash: str = Path(..., description="Blob versioned hash (0x01...)"),
    network: str = Query("sepolia", description="Network: sepolia or mainnet")
):
    """
    Test Blobscan/Swarm fallback directly.

    This endpoint tests fetching blob data from Blobscan API and Swarm Gateway
    when the beacon chain blob is no longer available (pruned after ~18 days).
    """
    import time

    results = {
        "blob_hash": blob_hash,
        "network": network,
        "steps": []
    }

    # Step 1: Try Blobscan API for metadata
    base_url = BLOBSCAN_API_SEPOLIA if network == "sepolia" else BLOBSCAN_API_MAINNET
    try:
        start = time.time()
        metadata_resp = requests.get(f"{base_url}/blobs/{blob_hash}", timeout=15)
        elapsed = time.time() - start

        results["steps"].append({
            "step": "blobscan_metadata",
            "url": f"{base_url}/blobs/{blob_hash}",
            "status": metadata_resp.status_code,
            "elapsed": round(elapsed, 2),
            "success": metadata_resp.status_code == 200
        })

        if metadata_resp.status_code == 200:
            metadata = metadata_resp.json()
            storage_refs = metadata.get("dataStorageReferences", [])
            results["storage_references"] = storage_refs
    except Exception as e:
        results["steps"].append({
            "step": "blobscan_metadata",
            "error": str(e),
            "success": False
        })
        return results

    # Step 2: Try full fallback fetch
    try:
        start = time.time()
        content = fetch_blob_from_blobscan_sync(blob_hash, network)
        elapsed = time.time() - start

        if content:
            # Try to parse as JSON
            try:
                padding_idx = content.find(PADDING_MARKER)
                if padding_idx != -1:
                    content = content[:padding_idx]
                json_content = json.loads(content)
                results["steps"].append({
                    "step": "fallback_fetch",
                    "elapsed": round(elapsed, 2),
                    "success": True,
                    "content_length": len(content),
                    "is_valid_json": True
                })
                results["metadata_preview"] = {
                    "context": json_content.get("context"),
                    "metadata": json_content.get("metadata")
                }
                results["success"] = True
            except json.JSONDecodeError:
                results["steps"].append({
                    "step": "fallback_fetch",
                    "elapsed": round(elapsed, 2),
                    "success": True,
                    "content_length": len(content),
                    "is_valid_json": False,
                    "content_preview": content[:500]
                })
                results["success"] = False
        else:
            results["steps"].append({
                "step": "fallback_fetch",
                "elapsed": round(elapsed, 2),
                "success": False,
                "error": "No content retrieved from any storage backend"
            })
            results["success"] = False
    except Exception as e:
        results["steps"].append({
            "step": "fallback_fetch",
            "error": str(e),
            "success": False
        })
        results["success"] = False

    return results


# Subgraph URL for KaiSign
KAISIGN_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"

async def query_subgraph_for_contract(target_address: str, chain_id: int) -> list:
    """Query KaiSign subgraph to find specs for a target contract.

    Returns list of specs with blobHash and transactionHash for efficient blob retrieval.
    """
    try:
        # Normalize target address
        if not target_address.startswith("0x"):
            target_address = "0x" + target_address
        target_address = target_address.lower()

        # Convert chain_id to string to match subgraph schema
        chain_id_str = str(chain_id)

        def query():
            # Query LogCreateSpec events which have transactionHash
            response = requests.post(
                KAISIGN_SUBGRAPH_URL,
                json={
                    "query": f"""{{
                        logCreateSpecs(
                            where: {{
                                targetContract: "{target_address}",
                                chainId: {chain_id}
                            }},
                            orderBy: blockTimestamp,
                            orderDirection: desc,
                            first: 10
                        ) {{
                            id
                            specID
                            blobHash
                            targetContract
                            chainId
                            timestamp
                            creator
                            blockNumber
                            blockTimestamp
                            transactionHash
                        }}
                        specs(
                            where: {{
                                targetContract: "{target_address}",
                                chainID: "{chain_id_str}"
                            }},
                            orderBy: blockTimestamp,
                            orderDirection: desc,
                            first: 10
                        ) {{
                            id
                            blobHash
                            targetContract
                            chainID
                            status
                            blockTimestamp
                        }}
                    }}"""
                },
                timeout=15
            )
            response.raise_for_status()
            return response.json()

        # Call query directly (sync is OK for fast subgraph queries)
        result = query()

        # Check for GraphQL errors
        if "errors" in result:
            logger.error(f"Subgraph query error: {result['errors']}")
            return []

        data = result.get("data", {})
        log_create_specs = data.get("logCreateSpecs", [])
        specs = data.get("specs", [])

        # Merge spec status info with LogCreateSpec data (which has transactionHash)
        merged_specs = []
        spec_status_map = {s.get("id"): s.get("status") for s in specs}

        for log_spec in log_create_specs:
            spec_id = log_spec.get("specID")
            # Try to find status from specs query
            status = spec_status_map.get(spec_id, "SUBMITTED")

            merged_specs.append({
                "specID": spec_id,
                "blobHash": log_spec.get("blobHash"),
                "targetContract": log_spec.get("targetContract"),
                "chainId": log_spec.get("chainId"),
                "timestamp": log_spec.get("timestamp"),
                "blockNumber": log_spec.get("blockNumber"),
                "blockTimestamp": log_spec.get("blockTimestamp"),
                "transactionHash": log_spec.get("transactionHash"),
                "status": status
            })

        # If no logCreateSpecs but have specs, use those (fallback)
        if not merged_specs and specs:
            for spec in specs:
                merged_specs.append({
                    "specID": spec.get("id"),
                    "blobHash": spec.get("blobHash"),
                    "targetContract": spec.get("targetContract"),
                    "chainId": int(spec.get("chainID", 0)),
                    "blockTimestamp": spec.get("blockTimestamp"),
                    "status": spec.get("status", "SUBMITTED"),
                    "transactionHash": None  # Not available from specs entity
                })

        return merged_specs

    except Exception as e:
        logger.error(f"Error querying subgraph: {e}")
        return []

# Contract metadata endpoint - uses working test-contract pattern
def get_provider(chain_id: int) -> Web3:
    """Get Web3 provider for a given chain ID."""
    # Map chain IDs to RPC URLs
    rpc_urls = {
        1: os.getenv("MAINNET_RPC_URL", "https://eth.llamarpc.com"),
        11155111: os.getenv("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
        137: os.getenv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
        42161: os.getenv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
        10: os.getenv("OPTIMISM_RPC_URL", "https://mainnet.optimism.io"),
        8453: os.getenv("BASE_RPC_URL", "https://mainnet.base.org"),
    }

    rpc_url = rpc_urls.get(chain_id, rpc_urls[1])  # Default to mainnet
    # Add 3 second timeout to prevent blocking
    return Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 3}))

def get_implementation_address_sync(proxy_address: str, chain_id: int) -> Optional[str]:
    """Try to get implementation address from a proxy contract."""
    try:
        logger.info(f"[PROXY] Starting detection for {proxy_address}")
        provider = get_provider(chain_id)
        logger.info(f"[PROXY] Provider created for chain {chain_id}")

        # Convert to checksum address (web3.py requirement)
        proxy_address_checksum = Web3.to_checksum_address(proxy_address)
        logger.info(f"[PROXY] Checksum address: {proxy_address_checksum}")

        # Try EIP-1967 implementation slot
        slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
        logger.info(f"[PROXY] Checking EIP-1967 slot...")
        impl_bytes = provider.eth.get_storage_at(proxy_address_checksum, slot)
        impl_address = "0x" + impl_bytes.hex()[-40:]
        logger.info(f"[PROXY] EIP-1967 result: {impl_address}")

        if impl_address != "0x" + "0" * 40:
            logger.info(f"[PROXY] EIP-1967 implementation found: {impl_address}")
            return impl_address.lower()

        # Try calling implementation() or masterCopy() for Safe
        logger.info(f"[PROXY] EIP-1967 empty, trying function calls...")
        for selector in ["0x5c60da1b", "0xa619486e"]:  # implementation(), masterCopy()
            logger.info(f"[PROXY] Calling selector {selector}...")
            result = provider.eth.call({
                "to": proxy_address_checksum,
                "data": selector
            })
            logger.info(f"[PROXY] Selector {selector} returned {len(result)} bytes")
            if result and len(result) >= 32:
                impl_address = "0x" + result.hex()[-40:]
                logger.info(f"[PROXY] Extracted address: {impl_address}")
                if impl_address != "0x" + "0" * 40:
                    logger.info(f"[PROXY] SUCCESS - Implementation from {selector}: {impl_address}")
                    return impl_address.lower()

        logger.info(f"[PROXY] No implementation found for {proxy_address}")
    except Exception as e:
        logger.error(f"[PROXY] EXCEPTION for {proxy_address}: {type(e).__name__}: {e}", exc_info=True)

    return None

@app.get("/api/py/contract/{address}")
async def get_contract_metadata(
    address: str = Path(..., description="Contract address"),
    chain_id: int = Query(1, description="Chain ID where transaction occurs")
):
    """Fetch metadata for a contract - checks cache first, then fetches blob.

    Optimizations:
    - Parallel IPFS gateway fetching
    - Parallel beacon slot discovery
    - Proxy detection caching
    - Request deduplication for concurrent identical requests
    """
    # Normalize address
    if not address.startswith("0x"):
        address = "0x" + address
    address = address.lower()

    # Step 1: Check cache FIRST (fast path - no deduplication needed)
    cached = get_cached_metadata(address, chain_id)

    # Fallback: If chainId=1, try address-only lookup
    if not cached and chain_id == 1:
        from api.metadata_cache import CHAIN_AGNOSTIC_MODE, get_cached_metadata_address_only
        if CHAIN_AGNOSTIC_MODE:
            cached = get_cached_metadata_address_only(address)
            if cached:
                logger.info(f"Cache HIT (address-only for chainId=1) for {address}")
                return {
                    "success": True,
                    "blob_hash": address,
                    "metadata": cached,
                    "error": None,
                    "source": "cache_agnostic"
                }

    # Return exact match if found
    if cached:
        logger.info(f"Cache HIT for {address} on chain {chain_id}")
        return {
            "success": True,
            "blob_hash": address,
            "metadata": cached,
            "error": None,
            "source": "cache"
        }

    # QUICK FIX: Known Safe wallet proxies
    KNOWN_SAFE_PROXIES = {
        "0xa10235ea549daa39a108bc26d63bd8daa68e4a22": "0x41675c099f32341bf84bfc5382af534df5c7461a"
    }
    if address in KNOWN_SAFE_PROXIES and chain_id == 1:
        impl_address = KNOWN_SAFE_PROXIES[address]
        cached = get_cached_metadata(impl_address, chain_id)
        if cached:
            return {
                "success": True,
                "blob_hash": impl_address,
                "metadata": cached,
                "error": None,
                "source": "hardcoded_proxy"
            }

    # Step 1.5: Try proxy detection WITH CACHING
    from api.metadata_cache import get_cached_proxy, set_cached_proxy
    logger.info(f"Attempting proxy detection for {address} on chain {chain_id}")

    # Check proxy cache first
    found_in_cache, impl_address = get_cached_proxy(address)
    if not found_in_cache:
        # Not in cache - do detection in thread pool (non-blocking)
        impl_address = await asyncio.to_thread(get_implementation_address_sync, address, chain_id)
        # Cache the result (even None for non-proxies)
        set_cached_proxy(address, impl_address)

    logger.info(f"Proxy detection result: {impl_address} (cached: {found_in_cache})")
    if impl_address and impl_address != address:
        logger.info(f"Detected proxy {address} -> implementation {impl_address}")
        cached = get_cached_metadata(impl_address, chain_id)
        logger.info(f"Cache lookup for implementation: {'HIT' if cached else 'MISS'}")
        if cached:
            logger.info(f"Cache HIT for implementation {impl_address}")
            return {
                "success": True,
                "blob_hash": impl_address,
                "metadata": cached,
                "error": None,
                "source": "cache_via_proxy"
            }
        else:
            logger.warning(f"Proxy detection found impl {impl_address} but no cached metadata")

    # Step 2: Cache miss - use request deduplication for the slow path
    # This prevents duplicate subgraph queries and blob fetches for concurrent requests
    cache_key = f"contract_{address}_{chain_id}"

    async def _fetch_slow_path():
        """Internal slow path - fetches from subgraph and blob."""
        logger.info(f"Cache and proxy detection failed, querying subgraph for {address}")
        specs = await asyncio.to_thread(query_subgraph_for_contract_sync, address, chain_id)
        if not specs:
            return {
                "success": False,
                "blob_hash": address,
                "error": f"No metadata found for {address}",
                "metadata": None,
                "source": "subgraph_not_found"
            }

        # Sort specs: prefer FINALIZED, then by recency
        finalized_specs = [s for s in specs if s.get("status") == "FINALIZED"]
        proposed_specs = [s for s in specs if s.get("status") == "PROPOSED"]
        other_specs = [s for s in specs if s.get("status") not in ("FINALIZED", "PROPOSED")]
        ordered_specs = finalized_specs + proposed_specs + other_specs

        # Try each spec until we find one with available blob
        blob_hash_result = None
        blob_hex = None
        for spec in ordered_specs:
            spec_blob_hash = spec.get("blobHash")
            spec_timestamp = spec.get("blockTimestamp")
            if not spec_blob_hash:
                continue

            # Parallel slot discovery (already optimized)
            spec_slot = await asyncio.to_thread(
                find_blob_slot_sync, spec_blob_hash,
                str(spec_timestamp) if spec_timestamp else None
            )
            if not spec_slot:
                continue

            # Fetch blob
            spec_blob_hex = await asyncio.to_thread(
                fetch_blob_from_beacon_sync, spec_slot, spec_blob_hash
            )
            if spec_blob_hex:
                blob_hash_result = spec_blob_hash
                blob_hex = spec_blob_hex
                break

        if not blob_hex:
            # Beacon chain blob not available (pruned) - try Blobscan/Swarm fallback
            logger.info(f"Beacon chain blob not available, trying Blobscan/Swarm fallback")
            network = "mainnet" if chain_id == 1 else "sepolia"

            for spec in ordered_specs:
                spec_blob_hash = spec.get("blobHash")
                if not spec_blob_hash:
                    continue

                # Parallel Blobscan fetch (already optimized)
                content = await asyncio.to_thread(
                    fetch_blob_from_blobscan_sync, spec_blob_hash, network
                )
                if content:
                    try:
                        padding_idx = content.find(PADDING_MARKER)
                        if padding_idx != -1:
                            content = content[:padding_idx]

                        metadata = json.loads(content)
                        set_cached_metadata(address, chain_id, metadata)

                        return {
                            "success": True,
                            "blob_hash": spec_blob_hash,
                            "metadata": metadata,
                            "error": None,
                            "source": "blobscan_fallback"
                        }
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse Blobscan content as JSON: {e}")
                        continue

            return {
                "success": False,
                "blob_hash": address,
                "error": "No available blob found (beacon pruned, Blobscan/Swarm fallback failed)",
                "metadata": None
            }

        content = decode_blob_data(blob_hex)
        padding_idx = content.find(PADDING_MARKER)
        if padding_idx != -1:
            content = content[:padding_idx]
        metadata = json.loads(content)

        # Cache the metadata for future use
        set_cached_metadata(address, chain_id, metadata)

        return {
            "success": True,
            "blob_hash": blob_hash_result,
            "metadata": metadata,
            "error": None,
            "source": "blob"
        }

    # Use deduplicated_fetch to prevent duplicate work for concurrent requests
    return await deduplicated_fetch(cache_key, _fetch_slow_path)


def query_subgraph_for_contract_sync(target_address: str, chain_id: int) -> list:
    """Synchronous subgraph query."""
    if not target_address.startswith("0x"):
        target_address = "0x" + target_address
    target_address = target_address.lower()
    chain_id_str = str(chain_id)

    response = requests.post(
        KAISIGN_SUBGRAPH_URL,
        json={
            "query": f"""{{
                logCreateSpecs(
                    where: {{targetContract: "{target_address}", chainId: {chain_id_str}}}
                    orderBy: blockTimestamp
                    orderDirection: desc
                    first: 10
                ) {{
                    id specID blobHash targetContract chainId timestamp blockNumber blockTimestamp transactionHash
                }}
                specs(
                    where: {{targetContract: "{target_address}", chainID: "{chain_id_str}"}}
                    orderBy: blockTimestamp
                    orderDirection: desc
                    first: 10
                ) {{
                    id blobHash targetContract chainID status blockTimestamp
                }}
            }}"""
        },
        timeout=15
    )
    response.raise_for_status()
    result = response.json()

    data = result.get("data", {})
    log_specs = data.get("logCreateSpecs", [])
    specs = data.get("specs", [])

    spec_status_map = {s.get("id"): s.get("status") for s in specs}
    merged = []
    for ls in log_specs:
        merged.append({
            "blobHash": ls.get("blobHash"),
            "blockTimestamp": ls.get("blockTimestamp"),
            "status": spec_status_map.get(ls.get("specID"), "SUBMITTED")
        })
    return merged


def find_blob_slot_sync(blob_hash: str, timestamp: str = None) -> Optional[int]:
    """Parallel slot lookup using ThreadPoolExecutor.

    Checks all candidate slots concurrently - first match wins.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    SLOT_TIME = 12
    GENESIS_TIME = 1655733600

    if not timestamp:
        return None

    def check_slot(s: int) -> Optional[int]:
        """Check if blob exists in given slot."""
        try:
            resp = requests.get(f"{SEPOLIA_BEACON}/eth/v1/beacon/blob_sidecars/{s}", timeout=10)
            if resp.status_code != 200:
                return None
            for sidecar in resp.json().get("data", []):
                kzg = sidecar.get("kzg_commitment", "")
                if kzg:
                    h = kzg[2:] if kzg.startswith("0x") else kzg
                    vh = "0x01" + hashlib.sha256(bytes.fromhex(h)).digest()[1:].hex()
                    if vh.lower() == blob_hash.lower():
                        return s
            return None
        except Exception as e:
            logger.debug(f"Error checking slot {s}: {e}")
            return None

    est_slot = (int(timestamp) - GENESIS_TIME) // SLOT_TIME
    slots_to_check = [est_slot + offset for offset in [-1, 0, -2, 1, -3, 2]]

    # Check all slots in parallel - first match wins
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_slot = {executor.submit(check_slot, s): s for s in slots_to_check}
        for future in as_completed(future_to_slot):
            result = future.result()
            if result is not None:
                logger.info(f"Found blob at slot {result}")
                # Cancel remaining futures by returning early
                # (they'll be cleaned up when executor exits)
                return result

    logger.debug(f"Blob not found in any of slots {slots_to_check}")
    return None


def fetch_blob_from_beacon_sync(slot: int, blob_hash: str) -> str:
    """Synchronous blob fetch."""
    resp = requests.get(f"{SEPOLIA_BEACON}/eth/v1/beacon/blob_sidecars/{slot}", timeout=15)
    resp.raise_for_status()
    for sidecar in resp.json().get("data", []):
        kzg = sidecar.get("kzg_commitment", "")
        if kzg:
            h = kzg[2:] if kzg.startswith("0x") else kzg
            vh = "0x01" + hashlib.sha256(bytes.fromhex(h)).digest()[1:].hex()
            if vh.lower() == blob_hash.lower():
                return sidecar.get("blob", "")
    return None


# =============================================================================
# BLOBSCAN / SWARM FALLBACK - For pruned blobs (>18 days old)
# =============================================================================

BLOBSCAN_API_SEPOLIA = "https://api.sepolia.blobscan.com"
BLOBSCAN_API_MAINNET = "https://api.blobscan.com"
SWARM_GATEWAY = "https://api.gateway.ethswarm.org"


def fetch_blob_from_blobscan_sync(blob_hash: str, network: str = "sepolia") -> Optional[str]:
    """
    Fetch blob data from Blobscan API as fallback when beacon chain blob is pruned.

    Uses parallel fetching for storage backends - first success wins.

    Args:
        blob_hash: The blob versioned hash (0x01...)
        network: "sepolia" or "mainnet"

    Returns:
        Decoded blob content as string, or None if not found
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    base_url = BLOBSCAN_API_SEPOLIA if network == "sepolia" else BLOBSCAN_API_MAINNET

    try:
        # Step 1: Get blob metadata from Blobscan API
        logger.info(f"Fetching blob metadata from Blobscan: {blob_hash}")
        metadata_resp = requests.get(f"{base_url}/blobs/{blob_hash}", timeout=15)

        if metadata_resp.status_code != 200:
            logger.warning(f"Blobscan metadata not found: {metadata_resp.status_code}")
            return None

        metadata = metadata_resp.json()
        storage_refs = metadata.get("dataStorageReferences", [])

        # Define fetch functions for each backend
        def fetch_from_gcs(url: str) -> Optional[str]:
            """Fetch from Google Cloud Storage."""
            try:
                logger.info(f"Trying Google Cloud Storage: {url}")
                gcs_resp = requests.get(url, timeout=30)
                if gcs_resp.status_code == 200:
                    content = decode_blob_bytes(gcs_resp.content)
                    if content:
                        logger.info("Successfully fetched blob from Google Cloud Storage")
                        return content
            except Exception as e:
                logger.warning(f"Google Cloud Storage fetch failed: {e}")
            return None

        def fetch_from_swarm(swarm_ref: dict) -> Optional[str]:
            """Fetch from Swarm Gateway."""
            try:
                swarm_url = swarm_ref.get("url", "")
                swarm_hash = swarm_url.split("/bzz/")[-1] if "/bzz/" in swarm_url else None
                if swarm_hash:
                    gateway_url = f"{SWARM_GATEWAY}/bzz/{swarm_hash}"
                    logger.info(f"Trying Swarm Gateway: {gateway_url}")
                    swarm_resp = requests.get(gateway_url, timeout=30)
                    if swarm_resp.status_code == 200:
                        logger.info("Successfully fetched blob from Swarm Gateway")
                        return swarm_resp.text
            except Exception as e:
                logger.warning(f"Swarm Gateway fetch failed: {e}")
            return None

        # Step 2: Try all storage backends in parallel
        google_ref = next((ref for ref in storage_refs if ref.get("storage") == "google"), None)
        swarm_ref = next((ref for ref in storage_refs if ref.get("storage") == "swarm"), None)

        futures = []
        with ThreadPoolExecutor(max_workers=2) as executor:
            if google_ref and google_ref.get("url"):
                futures.append(executor.submit(fetch_from_gcs, google_ref["url"]))
            if swarm_ref and swarm_ref.get("url"):
                futures.append(executor.submit(fetch_from_swarm, swarm_ref))

            # Return first successful result
            for future in as_completed(futures):
                result = future.result()
                if result:
                    return result

        logger.warning(f"No available storage backends for blob: {blob_hash}")
        return None

    except Exception as e:
        logger.error(f"Blobscan fallback failed: {e}")
        return None


def decode_blob_bytes(blob_bytes: bytes) -> Optional[str]:
    """
    Decode raw blob bytes to string.

    Blob format: 4096 field elements × 32 bytes each
    First byte of each 32-byte chunk is skipped (field element encoding)
    """
    try:
        decoded_bytes = []

        for field_element in range(4096):
            offset = field_element * 32
            # Skip the first byte (field element encoding), take next 31 bytes
            for byte_index in range(1, 32):
                if offset + byte_index >= len(blob_bytes):
                    break
                byte_val = blob_bytes[offset + byte_index]
                if byte_val == 0:
                    continue
                decoded_bytes.append(byte_val)

        # Convert to string, removing null bytes
        content = bytes(decoded_bytes).decode('utf-8', errors='ignore')
        content = content.replace('\x00', '')

        return content if content.strip() else None

    except Exception as e:
        logger.error(f"Failed to decode blob bytes: {e}")
        return None


async def _fetch_blob_internal(blob_hash: str, tx_hash: Optional[str] = None) -> BlobResponse:
    """Internal blob fetch function - use this when calling programmatically."""
    logger.info(f"_fetch_blob_internal called: blob_hash={blob_hash}, tx_hash={tx_hash}")

    # Validate blob hash format
    if not blob_hash.startswith("0x01") or len(blob_hash) != 66:
        return BlobResponse(
            success=False,
            blob_hash=blob_hash,
            error="Invalid blob hash format. Expected 0x01 prefix and 66 characters."
        )

    # Step 1: Find slot
    logger.info("Step 1: Finding slot...")
    slot = await find_blob_slot(blob_hash, tx_hash)
    if not slot:
        logger.error("Step 1 failed: Could not find slot")
        return BlobResponse(
            success=False,
            blob_hash=blob_hash,
            error="Could not find slot for blob. Provide tx_hash query param for faster lookup."
        )
    logger.info(f"Step 1 complete: slot={slot}")

    # Step 2: Fetch blob
    logger.info("Step 2: Fetching blob...")
    blob_hex = await fetch_blob_from_beacon(slot, blob_hash)
    if not blob_hex:
        logger.error("Step 2 failed: Blob not found")
        return BlobResponse(
            success=False,
            blob_hash=blob_hash,
            error="Blob not found in beacon chain sidecars. Blob may have been pruned (>18 days old)."
        )
    logger.info(f"Step 2 complete: blob_length={len(blob_hex)}")

    # Step 3: Decode blob
    logger.info("Step 3: Decoding blob...")
    try:
        content = decode_blob_data(blob_hex)
        padding_idx = content.find(PADDING_MARKER)
        if padding_idx != -1:
            content = content[:padding_idx]
        metadata = json.loads(content)
        logger.info("Step 3 complete: metadata decoded successfully")
        return BlobResponse(success=True, blob_hash=blob_hash, metadata=metadata)
    except json.JSONDecodeError as e:
        logger.error(f"Step 3 failed: JSON decode error - {e}")
        return BlobResponse(
            success=False,
            blob_hash=blob_hash,
            error=f"Failed to parse blob as JSON: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Step 3 failed: {e}")
        return BlobResponse(
            success=False,
            blob_hash=blob_hash,
            error=f"Unexpected error: {str(e)}"
        )

@app.get("/blob/{blob_hash}")
@app.get("/api/py/blob/{blob_hash}")
async def get_blob_metadata(
    blob_hash: str = Path(..., description="Blob versioned hash (0x01...)"),
    tx_hash: Optional[str] = Query(None, description="Transaction hash or timestamp for faster slot lookup")
) -> BlobResponse:
    """Fetch and decode blob data directly from Sepolia nodes.

    Args:
        blob_hash: The blob versioned hash (66 chars, starts with 0x01)
        tx_hash: Optional transaction hash or Unix timestamp for faster slot lookup

    Returns:
        BlobResponse with decoded metadata JSON
    """
    return await _fetch_blob_internal(blob_hash, tx_hash)


# =============================================================================
# METADATA CACHE ENDPOINTS
# =============================================================================

@app.get("/api/py/cache/stats")
async def get_cache_statistics():
    """Get metadata cache statistics."""
    return get_cache_stats()


@app.post("/api/py/cache/load")
async def load_cache_from_files(
    directory: str = Query(None, description="Directory path containing metadata JSON files")
):
    """Load metadata into cache from local JSON files.

    If no directory is provided, attempts to load from the default metadata directory.
    """
    if directory:
        count = load_metadata_from_directory(directory, recursive=True)
        return {"success": True, "loaded": count, "directory": directory}

    # Try default metadata directory relative to this file
    default_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts", "metadata")
    if os.path.exists(default_dir):
        count = load_metadata_from_directory(default_dir, recursive=True)
        return {"success": True, "loaded": count, "directory": default_dir}

    return {"success": False, "loaded": 0, "error": "No directory specified and default not found"}


class BulkCacheRequest(BaseModel):
    """Request model for bulk cache loading."""
    metadata_list: list


@app.post("/api/py/cache/bulk")
async def bulk_load_cache(request: BulkCacheRequest):
    """Bulk load metadata entries into cache.

    Accepts a list of ERC7730 metadata objects with address and chainId.
    """
    count = bulk_load_metadata(request.metadata_list)
    return {"success": True, "loaded": count}


@app.get("/api/py/cache/populate")
async def populate_cache_from_subgraph(chain_id: int = Query(1, description="Chain ID to query")):
    """Populate cache by fetching all submitted metadata from subgraph.

    Queries the KaiSign subgraph for all finalized specs and caches their metadata.
    This is useful for pre-warming the cache before blobs get pruned.
    """
    try:
        # Query all finalized specs from subgraph
        response = requests.post(
            KAISIGN_SUBGRAPH_URL,
            json={
                "query": f"""{{
                    specs(
                        where: {{status: "FINALIZED", chainID: "{chain_id}"}}
                        orderBy: blockTimestamp
                        orderDirection: desc
                        first: 100
                    ) {{
                        id
                        blobHash
                        targetContract
                        chainID
                        status
                        blockTimestamp
                    }}
                    logCreateSpecs(
                        where: {{chainId: {chain_id}}}
                        orderBy: blockTimestamp
                        orderDirection: desc
                        first: 100
                    ) {{
                        specID
                        blobHash
                        targetContract
                        chainId
                        blockTimestamp
                        transactionHash
                    }}
                }}"""
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()

        if "errors" in result:
            return {"success": False, "error": str(result["errors"]), "cached": 0}

        data = result.get("data", {})
        specs = data.get("specs", [])
        log_specs = data.get("logCreateSpecs", [])

        # Merge and dedupe
        seen = set()
        all_specs = []
        for spec in specs:
            key = f"{spec.get('targetContract')}_{spec.get('chainID')}"
            if key not in seen:
                seen.add(key)
                all_specs.append({
                    "blobHash": spec.get("blobHash"),
                    "targetContract": spec.get("targetContract"),
                    "chainId": int(spec.get("chainID", 0)),
                    "blockTimestamp": spec.get("blockTimestamp"),
                    "status": spec.get("status")
                })

        for log_spec in log_specs:
            key = f"{log_spec.get('targetContract')}_{log_spec.get('chainId')}"
            if key not in seen:
                seen.add(key)
                all_specs.append({
                    "blobHash": log_spec.get("blobHash"),
                    "targetContract": log_spec.get("targetContract"),
                    "chainId": log_spec.get("chainId"),
                    "blockTimestamp": log_spec.get("blockTimestamp"),
                    "transactionHash": log_spec.get("transactionHash")
                })

        # Fetch and cache each metadata
        cached = 0
        failed = 0
        for spec in all_specs:
            blob_hash = spec.get("blobHash")
            target = spec.get("targetContract")
            cid = spec.get("chainId")
            timestamp = spec.get("blockTimestamp")

            if not blob_hash or not target:
                continue

            # Try to fetch blob
            slot = find_blob_slot_sync(blob_hash, str(timestamp) if timestamp else None)
            if not slot:
                failed += 1
                continue

            blob_hex = fetch_blob_from_beacon_sync(slot, blob_hash)
            if not blob_hex:
                failed += 1
                continue

            try:
                content = decode_blob_data(blob_hex)
                padding_idx = content.find(PADDING_MARKER)
                if padding_idx != -1:
                    content = content[:padding_idx]
                metadata = json.loads(content)
                set_cached_metadata(target, cid, metadata)
                cached += 1
            except Exception as e:
                logger.warning(f"Failed to parse metadata for {target}: {e}")
                failed += 1

        return {
            "success": True,
            "total_specs": len(all_specs),
            "cached": cached,
            "failed": failed,
            "chain_id": chain_id
        }

    except Exception as e:
        logger.error(f"Failed to populate cache: {e}")
        return {"success": False, "error": str(e), "cached": 0}


@app.delete("/api/py/cache/clear")
async def clear_cache():
    """Clear all cached metadata."""
    clear_metadata_cache()
    return {"success": True, "message": "Cache cleared"}


# =============================================================================
# METADATA HASH INDEX ENDPOINTS
# =============================================================================

@app.get("/api/py/metadata/hash/{metadata_hash}")
async def get_metadata_by_hash(
    metadata_hash: str = Path(..., description="32-byte hex hash with or without 0x prefix")
):
    """
    Fetch metadata by hash with ALL leaf hash components for verification.

    This endpoint enables hardware wallets and verification tools to:
    1. Look up metadata by content hash (not just by address)
    2. Get all components needed to replicate the on-chain leaf hash
    3. Verify merkle proofs independently

    Example:
        GET /api/py/metadata/hash/0x32bbd60b8b6829c08df23cee6111a5f7427f144a0bed8b0e90d64edb67effbbc

    Returns:
    {
        "success": true,
        "metadata_hash": "0x32bbd60b...",
        "metadata": {...},  // Full ERC7730 metadata

        "leaf_components": {
            "leaf_typehash": "0x...",
            "chain_id": 1,
            "extcodehash": "0x386e55cb...",
            "metadata_hash": "0x32bbd60b...",
            "idx": 1,
            "revoked": false
        },

        "leaf_hash": "0x736eeef2...",
        "target_contract": "0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d",
        "chain_id": 1,
        "blob_hash": "0x01b3dde6...",
        "uid": "0xcbf82bc5...",
        "status": "finalized",
        "source": "hash_index"
    }
    """
    from api.metadata_hash_store import get_metadata_by_hash, LEAF_TYPEHASH

    # Normalize hash
    if not metadata_hash.startswith("0x"):
        metadata_hash = "0x" + metadata_hash
    metadata_hash = metadata_hash.lower()

    # Validate format
    if len(metadata_hash) != 66 or not all(c in '0123456789abcdef' for c in metadata_hash[2:]):
        raise HTTPException(400, "Invalid hash format. Expected 32-byte hex (64 chars + 0x prefix)")

    # Query from hash store
    result = await asyncio.to_thread(get_metadata_by_hash, metadata_hash)

    if not result:
        raise HTTPException(
            404,
            f"Metadata not found for hash {metadata_hash}"
        )

    # Format response with leaf components
    return {
        "success": True,
        "metadata_hash": metadata_hash,
        "metadata": result["metadata"],
        "leaf_components": {
            "leaf_typehash": "0x" + LEAF_TYPEHASH.hex(),
            "chain_id": result["leaf_components"]["chain_id"],
            "extcodehash": result["leaf_components"]["extcodehash"],
            "metadata_hash": metadata_hash,
            "idx": result["leaf_components"]["idx"],
            "revoked": result["leaf_components"]["revoked"]
        },
        "leaf_hash": result["leaf_hash"],
        "target_contract": result["target_contract"],
        "chain_id": result["chain_id"],
        "blob_hash": result.get("blob_hash"),
        "uid": result.get("uid"),
        "status": result.get("status", "finalized"),
        "source": "hash_index"
    }


@app.get("/api/py/metadata/contract/{address}/hashes")
async def get_contract_hashes(
    address: str = Path(...),
    chain_id: int = Query(1)
):
    """
    Get all metadata hashes for a contract (reverse lookup).

    Example:
        GET /api/py/metadata/contract/0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d/hashes?chain_id=1

    Returns:
    {
        "success": true,
        "contract": "0x5a7fc...",
        "chain_id": 1,
        "hashes": ["0x32bbd60b...", "0x19d4aace..."],
        "count": 2
    }
    """
    from api.metadata_hash_store import get_hashes_by_contract

    if not address.startswith("0x"):
        address = "0x" + address
    address = address.lower()

    hashes = await asyncio.to_thread(get_hashes_by_contract, address, chain_id)

    return {
        "success": True,
        "contract": address,
        "chain_id": chain_id,
        "hashes": hashes,
        "count": len(hashes)
    }


@app.get("/api/py/metadata/hash/stats")
async def get_hash_index_stats():
    """
    Get hash index statistics.

    Returns cache stats, database size, and hit rates.
    """
    from api.metadata_hash_store import get_hash_stats
    return get_hash_stats()


@app.post("/api/py/metadata/hash/rebuild")
async def rebuild_hash_index():
    """
    Rebuild entire hash index from submission-state.json (admin endpoint).

    WARNING: This will query on-chain data and may take 30-60 seconds.
    """
    from api.metadata_hash_store import rebuild_index
    count = await asyncio.to_thread(rebuild_index)
    return {"success": True, "entries_indexed": count, "message": "Hash index rebuilt successfully"}


class HashUpdateRequest(BaseModel):
    """Request model for hash index updates."""
    metadata_hash: str
    target_contract: str
    chain_id: int
    extcodehash: str
    blob_hash: Optional[str] = None
    uid: Optional[str] = None
    metadata_path: str


@app.post("/api/py/metadata/hash/update")
async def update_hash_index(request: HashUpdateRequest):
    """
    Webhook for autonomous-submitter to update hash index with new entries.

    Called automatically when specs are revealed/finalized.
    """
    from api.metadata_hash_store import upsert_metadata
    from web3 import Web3

    try:
        # Read metadata from file
        if not os.path.exists(request.metadata_path):
            raise HTTPException(400, f"Metadata file not found: {request.metadata_path}")

        with open(request.metadata_path, 'r') as f:
            metadata = json.load(f)

        # Get idx and revoked from on-chain if uid is available
        idx = None
        revoked = False

        if request.uid:
            try:
                from api.metadata_hash_store import KAISIGN_ADDRESS, KAISIGN_ABI, SEPOLIA_RPC_URL

                w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
                kaisign = w3.eth.contract(address=KAISIGN_ADDRESS, abi=KAISIGN_ABI)

                uid_bytes = bytes.fromhex(request.uid[2:] if request.uid.startswith("0x") else request.uid)
                attestation = kaisign.functions.getAttestation(uid_bytes).call()

                idx = attestation[7]  # uint64 idx
                revoked = bool(attestation[8])  # bool revoked

            except Exception as e:
                logger.warning(f"Could not fetch on-chain data for uid {request.uid}: {e}")

        # Upsert to database
        success = await asyncio.to_thread(
            upsert_metadata,
            metadata_hash=request.metadata_hash,
            metadata=metadata,
            target_contract=request.target_contract,
            chain_id=request.chain_id,
            extcodehash=request.extcodehash,
            idx=idx,
            revoked=revoked,
            blob_hash=request.blob_hash,
            uid=request.uid
        )

        return {"success": success, "metadata_hash": request.metadata_hash}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update hash index: {e}")
        raise HTTPException(500, f"Failed to update hash index: {str(e)}")


# =============================================================================
# STARTUP EVENT - Auto-load embedded metadata
# =============================================================================

@app.on_event("startup")
async def startup_load_cache():
    """Load metadata cache on startup.

    Priority:
    1. Load from Railway volume (/data) - persisted blob-fetched metadata
    2. Load embedded files (no persist) - fallback for known contracts

    Only blob-fetched metadata is persisted to volume to save storage costs.
    """
    from_disk = 0
    from_embedded = 0

    # Step 1: Load from Railway volume (blob-fetched metadata)
    from_disk = load_cache_from_disk()
    if from_disk > 0:
        logger.info(f"Startup: Loaded {from_disk} entries from Railway volume")

    # Step 2: Load embedded files (persist=False - don't duplicate to volume)
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    local_metadata_dir = os.path.join(backend_dir, "metadata")

    if os.path.exists(local_metadata_dir):
        count = load_metadata_from_directory(local_metadata_dir, recursive=True, persist=False)
        from_embedded += count
        logger.info(f"Startup: Loaded {count} embedded metadata files (not persisted)")

    # Also try scripts/metadata directory (for local development)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    scripts_metadata_dir = os.path.join(base_dir, "scripts", "metadata")

    if os.path.exists(scripts_metadata_dir) and scripts_metadata_dir != local_metadata_dir:
        count = load_metadata_from_directory(scripts_metadata_dir, recursive=True, persist=False)
        from_embedded += count
        logger.info(f"Startup: Loaded {count} embedded metadata files from scripts/")

    total = from_disk + from_embedded
    if total > 0:
        logger.info(f"Startup: Cache ready - {from_disk} from volume, {from_embedded} embedded, {total} total")
    else:
        logger.warning("Startup: No metadata loaded into cache")