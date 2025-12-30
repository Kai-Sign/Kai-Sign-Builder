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
    """Fetch metadata from IPFS and extract contract address and chain ID."""
    try:
        # Try multiple IPFS gateways
        gateways = [
            f"https://ipfs.io/ipfs/{ipfs_hash}",
            f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}",
            f"https://cloudflare-ipfs.com/ipfs/{ipfs_hash}"
        ]
        
        for gateway_url in gateways:
            try:
                # Use asyncio.to_thread to make requests async-compatible
                def make_request():
                    response = requests.get(gateway_url, timeout=10)
                    response.raise_for_status()
                    return response.json()
                
                metadata = await asyncio.to_thread(make_request)
                
                # Extract contract address and chain ID from metadata
                contract_address = None
                chain_id = None
                
                # Check new ERC7730 format first: context.contract.deployments
                if (metadata.get("context", {}).get("contract", {}).get("deployments")):
                    deployments = metadata["context"]["contract"]["deployments"]
                    if deployments and len(deployments) > 0:
                        deployment = deployments[0]
                        contract_address = deployment.get("address")
                        chain_id = deployment.get("chainId")
                
                # Fall back to old format: context.eip712.deployments
                if not contract_address and (metadata.get("context", {}).get("eip712", {}).get("deployments")):
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
                
            except Exception as gateway_error:
                print(f"Failed to fetch from {gateway_url}: {gateway_error}")
                continue
        
        raise Exception("Failed to fetch from all IPFS gateways")
        
    except Exception as e:
        print(f"Error fetching IPFS metadata: {e}")
        raise e

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
        "version": "2.0.8-sync-search",
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
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        result = await asyncio.to_thread(query)

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

@app.get("/contract/{address}")
@app.get("/api/py/contract/{address}")
async def get_contract_metadata(
    address: str = Path(..., description="Contract address"),
    chain_id: int = Query(1, description="Chain ID where transaction occurs")
) -> BlobResponse:
    """Fetch metadata for a contract by querying subgraph then fetching blob.

    Args:
        address: Contract address (0x...)
        chain_id: Chain ID (default: 1)

    Returns:
        BlobResponse with contract metadata
    """
    try:
        # Normalize address
        if not address.startswith("0x"):
            address = "0x" + address
        address = address.lower()

        # Query subgraph for specs (includes transactionHash for fast blob lookup)
        specs = await query_subgraph_for_contract(address, chain_id)

        if not specs:
            return BlobResponse(
                success=False,
                blob_hash=address,
                error=f"No metadata found for contract {address} on chain {chain_id}"
            )

        # Find best spec: prefer FINALIZED > PROPOSED > most recent
        finalized_spec = next((s for s in specs if s.get("status") == "FINALIZED"), None)
        proposed_spec = next((s for s in specs if s.get("status") == "PROPOSED"), None)
        best_spec = finalized_spec or proposed_spec or specs[0]

        logger.info(f"Found spec for {address}: status={best_spec.get('status', 'UNKNOWN')}, blobHash={best_spec.get('blobHash')}")

        blob_hash = best_spec.get("blobHash")
        if not blob_hash:
            return BlobResponse(
                success=False,
                blob_hash=address,
                error="Blob hash not found in subgraph"
            )

        # Get blockTimestamp for faster blob slot lookup (more reliable than tx_hash)
        # The blockTimestamp from subgraph is the reveal tx timestamp, blob is 1-2 slots before
        block_timestamp = best_spec.get("blockTimestamp")
        tx_hash_or_timestamp = None

        if block_timestamp:
            # Use timestamp directly - faster than fetching via tx_hash
            tx_hash_or_timestamp = str(block_timestamp)
            logger.info(f"Using blockTimestamp={block_timestamp} for slot calculation")
        else:
            # Fallback to tx_hash if no timestamp
            tx_hash = best_spec.get("transactionHash")
            if tx_hash:
                if isinstance(tx_hash, bytes):
                    tx_hash = "0x" + tx_hash.hex()
                elif not tx_hash.startswith("0x"):
                    tx_hash = "0x" + tx_hash
                tx_hash_or_timestamp = tx_hash
                logger.info(f"Using tx_hash={tx_hash} for slot calculation")

        logger.info(f"Fetching blob {blob_hash}")

        # Fetch blob metadata using timestamp/tx_hash for faster slot calculation
        blob_response = await get_blob_metadata(blob_hash, tx_hash_or_timestamp)
        return blob_response

    except Exception as e:
        logger.error(f"Contract metadata fetch error: {e}")
        return BlobResponse(
            success=False,
            blob_hash=address,
            error=f"Error fetching contract metadata: {str(e)}"
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
    logger.info(f"get_blob_metadata called: blob_hash={blob_hash}, tx_hash={tx_hash}")

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