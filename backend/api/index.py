from fastapi import FastAPI, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from subprocess import Popen, PIPE
from dotenv import load_dotenv
import os
import json
import requests
from typing import Optional, List
import asyncio
import logging
from datetime import datetime

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
from starlette.exceptions import HTTPException as StarletteHTTPException

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

# Define USE_MOCK environment variable - set to False by default
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"

# Environment variables for contract interaction
ALCHEMY_RPC_URL = os.getenv("ALCHEMY_RPC_URL")
KAISIGN_CONTRACT_ADDRESS = os.getenv("KAISIGN_CONTRACT_ADDRESS", "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf")

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

# Configure CORS with specific origins
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

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