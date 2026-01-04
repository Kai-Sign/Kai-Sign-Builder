"""
Metadata Cache Module

Provides in-memory caching for ERC7730 metadata with optional file-based persistence.
This serves as a fallback when blob data is pruned from the beacon chain (~18 days).

The cache is keyed by (address, chainId) tuples normalized to lowercase.
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# In-memory cache: {"{address_lower}_{chain_id}": metadata_dict}
_metadata_cache: Dict[str, Dict[str, Any]] = {}

# Cache file path for persistence (optional)
CACHE_DIR = Path(os.getenv("METADATA_CACHE_DIR", "/tmp/kaisign_metadata_cache"))
CACHE_INDEX_FILE = CACHE_DIR / "index.json"


def _cache_key(address: str, chain_id: int) -> str:
    """Generate cache key from address and chain ID."""
    addr = address.lower()
    if not addr.startswith("0x"):
        addr = "0x" + addr
    return f"{addr}_{chain_id}"


def get_cached_metadata(address: str, chain_id: int) -> Optional[Dict[str, Any]]:
    """
    Get metadata from cache if available.

    Args:
        address: Contract address (with or without 0x prefix)
        chain_id: Chain ID where the contract is deployed

    Returns:
        Cached metadata dict or None if not found
    """
    key = _cache_key(address, chain_id)
    metadata = _metadata_cache.get(key)
    if metadata:
        logger.info(f"Cache HIT for {address} on chain {chain_id}")
        return metadata
    logger.debug(f"Cache MISS for {address} on chain {chain_id}")
    return None


def set_cached_metadata(address: str, chain_id: int, metadata: Dict[str, Any]) -> None:
    """
    Store metadata in cache.

    Args:
        address: Contract address
        chain_id: Chain ID
        metadata: ERC7730 metadata dict to cache
    """
    key = _cache_key(address, chain_id)
    _metadata_cache[key] = metadata
    logger.info(f"Cached metadata for {address} on chain {chain_id}")


def load_metadata_from_file(file_path: str) -> Optional[Dict[str, Any]]:
    """
    Load a single metadata file and add to cache.

    Args:
        file_path: Path to the JSON metadata file

    Returns:
        The loaded metadata or None if failed
    """
    try:
        with open(file_path, 'r') as f:
            metadata = json.load(f)

        # Extract address and chainId from metadata
        contract = metadata.get("context", {}).get("contract", {})

        # Support both formats: direct address/chainId or deployments
        if "address" in contract and "chainId" in contract:
            address = contract["address"]
            chain_id = contract["chainId"]
            set_cached_metadata(address, chain_id, metadata)
            return metadata
        elif "deployments" in contract:
            # Multiple deployments format
            for network, deployment in contract["deployments"].items():
                if "address" in deployment and "chainId" in deployment:
                    address = deployment["address"]
                    chain_id = deployment["chainId"]
                    set_cached_metadata(address, chain_id, metadata)
            return metadata
        else:
            logger.warning(f"No address/chainId found in {file_path}")
            return None

    except Exception as e:
        logger.error(f"Failed to load metadata from {file_path}: {e}")
        return None


def load_metadata_from_directory(dir_path: str, recursive: bool = True) -> int:
    """
    Load all metadata JSON files from a directory.

    Args:
        dir_path: Path to directory containing JSON files
        recursive: If True, search subdirectories as well

    Returns:
        Number of files successfully loaded
    """
    count = 0
    path = Path(dir_path)

    if not path.exists():
        logger.warning(f"Directory does not exist: {dir_path}")
        return 0

    pattern = "**/*.json" if recursive else "*.json"
    for json_file in path.glob(pattern):
        if json_file.name == "index.json":  # Skip index files
            continue
        if load_metadata_from_file(str(json_file)):
            count += 1

    logger.info(f"Loaded {count} metadata files from {dir_path}")
    return count


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    contracts = set()
    chains = set()

    for key in _metadata_cache.keys():
        parts = key.rsplit("_", 1)
        if len(parts) == 2:
            contracts.add(parts[0])
            chains.add(int(parts[1]))

    return {
        "total_entries": len(_metadata_cache),
        "unique_contracts": len(contracts),
        "chains": sorted(list(chains)),
        "cache_keys": list(_metadata_cache.keys())
    }


def clear_cache() -> None:
    """Clear all cached metadata."""
    _metadata_cache.clear()
    logger.info("Metadata cache cleared")


def save_cache_to_disk() -> bool:
    """
    Persist cache to disk for survival across restarts.

    Returns:
        True if successful, False otherwise
    """
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        # Save each metadata file separately for easier management
        index = {}
        for key, metadata in _metadata_cache.items():
            file_path = CACHE_DIR / f"{key}.json"
            with open(file_path, 'w') as f:
                json.dump(metadata, f)
            index[key] = str(file_path)

        # Save index
        with open(CACHE_INDEX_FILE, 'w') as f:
            json.dump(index, f, indent=2)

        logger.info(f"Saved {len(index)} entries to disk cache")
        return True

    except Exception as e:
        logger.error(f"Failed to save cache to disk: {e}")
        return False


def load_cache_from_disk() -> int:
    """
    Load cache from disk.

    Returns:
        Number of entries loaded
    """
    try:
        if not CACHE_INDEX_FILE.exists():
            logger.info("No disk cache found")
            return 0

        with open(CACHE_INDEX_FILE, 'r') as f:
            index = json.load(f)

        count = 0
        for key, file_path in index.items():
            try:
                with open(file_path, 'r') as f:
                    _metadata_cache[key] = json.load(f)
                count += 1
            except Exception as e:
                logger.warning(f"Failed to load {file_path}: {e}")

        logger.info(f"Loaded {count} entries from disk cache")
        return count

    except Exception as e:
        logger.error(f"Failed to load cache from disk: {e}")
        return 0


def bulk_load_metadata(metadata_list: list) -> int:
    """
    Load multiple metadata entries at once.

    Args:
        metadata_list: List of metadata dicts with address and chainId

    Returns:
        Number of entries successfully loaded
    """
    count = 0
    for metadata in metadata_list:
        try:
            contract = metadata.get("context", {}).get("contract", {})

            if "address" in contract and "chainId" in contract:
                address = contract["address"]
                chain_id = contract["chainId"]
                set_cached_metadata(address, chain_id, metadata)
                count += 1
            elif "deployments" in contract:
                for network, deployment in contract["deployments"].items():
                    if "address" in deployment and "chainId" in deployment:
                        address = deployment["address"]
                        chain_id = deployment["chainId"]
                        set_cached_metadata(address, chain_id, metadata)
                        count += 1
        except Exception as e:
            logger.warning(f"Failed to cache metadata entry: {e}")

    return count
