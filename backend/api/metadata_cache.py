"""
Metadata Cache Module

Provides persistent caching for ERC7730 metadata using Railway volumes.
This serves as a fallback when blob data is pruned from the beacon chain (~18 days).

The cache is keyed by (address, chainId) tuples normalized to lowercase.
Data is persisted to Railway volume at /data for cost-effective storage.
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# In-memory cache: {"{address_lower}_{chain_id}": metadata_dict}
_metadata_cache: Dict[str, Dict[str, Any]] = {}

# Railway volume path - /data is the standard mount point for Railway volumes
# Falls back to /tmp if volume is not mounted (local dev)
RAILWAY_VOLUME_PATH = Path("/data")
FALLBACK_PATH = Path("/tmp/kaisign_metadata_cache")

# Use Railway volume if available, otherwise fallback
CACHE_DIR = RAILWAY_VOLUME_PATH / "metadata_cache" if RAILWAY_VOLUME_PATH.exists() else FALLBACK_PATH
CACHE_INDEX_FILE = CACHE_DIR / "index.json"

# Auto-persist flag - when True, saves to disk on every cache update
AUTO_PERSIST = os.getenv("METADATA_CACHE_AUTO_PERSIST", "true").lower() == "true"


def _ensure_cache_dir():
    """Ensure cache directory exists."""
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Failed to create cache directory {CACHE_DIR}: {e}")
        return False


def _cache_key(address: str, chain_id: int) -> str:
    """Generate cache key from address and chain ID."""
    addr = address.lower()
    if not addr.startswith("0x"):
        addr = "0x" + addr
    return f"{addr}_{chain_id}"


def get_cached_metadata(address: str, chain_id: int) -> Optional[Dict[str, Any]]:
    """
    Get metadata from cache if available.
    Checks in-memory first, then disk.

    Args:
        address: Contract address (with or without 0x prefix)
        chain_id: Chain ID where the contract is deployed

    Returns:
        Cached metadata dict or None if not found
    """
    key = _cache_key(address, chain_id)

    # Check in-memory cache first
    metadata = _metadata_cache.get(key)
    if metadata:
        logger.info(f"Cache HIT (memory) for {address} on chain {chain_id}")
        return metadata

    # Try loading from disk if not in memory
    disk_file = CACHE_DIR / f"{key}.json"
    if disk_file.exists():
        try:
            with open(disk_file, 'r') as f:
                metadata = json.load(f)
            _metadata_cache[key] = metadata  # Load into memory
            logger.info(f"Cache HIT (disk) for {address} on chain {chain_id}")
            return metadata
        except Exception as e:
            logger.warning(f"Failed to load from disk cache: {e}")

    logger.debug(f"Cache MISS for {address} on chain {chain_id}")
    return None


def set_cached_metadata(address: str, chain_id: int, metadata: Dict[str, Any], persist: Optional[bool] = None) -> None:
    """
    Store metadata in cache (memory + disk).

    Args:
        address: Contract address
        chain_id: Chain ID
        metadata: ERC7730 metadata dict to cache
        persist: Whether to persist to disk (defaults to AUTO_PERSIST setting)
    """
    key = _cache_key(address, chain_id)
    _metadata_cache[key] = metadata

    # Persist to disk for Railway volume storage
    should_persist = persist if persist is not None else AUTO_PERSIST
    if should_persist:
        _persist_single_entry(key, metadata)

    logger.info(f"Cached metadata for {address} on chain {chain_id}")


def _persist_single_entry(key: str, metadata: Dict[str, Any]) -> bool:
    """Persist a single cache entry to disk."""
    try:
        _ensure_cache_dir()
        file_path = CACHE_DIR / f"{key}.json"
        with open(file_path, 'w') as f:
            json.dump(metadata, f)
        return True
    except Exception as e:
        logger.warning(f"Failed to persist {key} to disk: {e}")
        return False


def load_metadata_from_file(file_path: str, persist: bool = True) -> Optional[Dict[str, Any]]:
    """
    Load a single metadata file and add to cache.

    Args:
        file_path: Path to the JSON metadata file
        persist: Whether to persist to disk (False for embedded files)

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
            set_cached_metadata(address, chain_id, metadata, persist=persist)
            return metadata
        elif "deployments" in contract:
            deployments = contract["deployments"]
            if isinstance(deployments, list):
                for deployment in deployments:
                    if "address" in deployment and "chainId" in deployment:
                        address = deployment["address"]
                        chain_id = deployment["chainId"]
                        set_cached_metadata(address, chain_id, metadata, persist=persist)
            elif isinstance(deployments, dict):
                for deployment in deployments.values():
                    if "address" in deployment and "chainId" in deployment:
                        address = deployment["address"]
                        chain_id = deployment["chainId"]
                        set_cached_metadata(address, chain_id, metadata, persist=persist)
            return metadata
        else:
            logger.warning(f"No address/chainId found in {file_path}")
            return None

    except Exception as e:
        logger.error(f"Failed to load metadata from {file_path}: {e}")
        return None


def load_metadata_from_directory(dir_path: str, recursive: bool = True, persist: bool = True) -> int:
    """
    Load all metadata JSON files from a directory.

    Args:
        dir_path: Path to directory containing JSON files
        recursive: If True, search subdirectories as well
        persist: Whether to persist to disk (False for embedded files)

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
        if load_metadata_from_file(str(json_file), persist=persist):
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

    # Count disk entries
    disk_entries = 0
    if CACHE_DIR.exists():
        disk_entries = len(list(CACHE_DIR.glob("0x*.json")))

    return {
        "total_entries": len(_metadata_cache),
        "disk_entries": disk_entries,
        "unique_contracts": len(contracts),
        "chains": sorted(list(chains)),
        "cache_dir": str(CACHE_DIR),
        "using_railway_volume": CACHE_DIR.parent == RAILWAY_VOLUME_PATH,
        "auto_persist": AUTO_PERSIST,
        "cache_keys": list(_metadata_cache.keys())
    }


def clear_cache(clear_disk: bool = True) -> None:
    """Clear all cached metadata."""
    _metadata_cache.clear()

    if clear_disk and CACHE_DIR.exists():
        try:
            for f in CACHE_DIR.glob("*.json"):
                f.unlink()
            logger.info("Cleared disk cache")
        except Exception as e:
            logger.warning(f"Failed to clear disk cache: {e}")

    logger.info("Metadata cache cleared")


def save_cache_to_disk() -> bool:
    """
    Persist entire cache to disk (Railway volume).

    Returns:
        True if successful, False otherwise
    """
    try:
        _ensure_cache_dir()

        # Save each metadata file separately for easier management
        saved = 0
        for key, metadata in _metadata_cache.items():
            if _persist_single_entry(key, metadata):
                saved += 1

        # Save index for quick loading
        index = {key: str(CACHE_DIR / f"{key}.json") for key in _metadata_cache.keys()}
        with open(CACHE_INDEX_FILE, 'w') as f:
            json.dump(index, f, indent=2)

        logger.info(f"Saved {saved} entries to disk cache at {CACHE_DIR}")
        return True

    except Exception as e:
        logger.error(f"Failed to save cache to disk: {e}")
        return False


def load_cache_from_disk() -> int:
    """
    Load cache from disk (Railway volume).

    Returns:
        Number of entries loaded
    """
    try:
        if not CACHE_DIR.exists():
            logger.info(f"No disk cache found at {CACHE_DIR}")
            return 0

        count = 0
        for json_file in CACHE_DIR.glob("0x*.json"):
            try:
                key = json_file.stem  # filename without extension
                with open(json_file, 'r') as f:
                    _metadata_cache[key] = json.load(f)
                count += 1
            except Exception as e:
                logger.warning(f"Failed to load {json_file}: {e}")

        logger.info(f"Loaded {count} entries from disk cache at {CACHE_DIR}")
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
                deployments = contract["deployments"]
                if isinstance(deployments, list):
                    for deployment in deployments:
                        if "address" in deployment and "chainId" in deployment:
                            address = deployment["address"]
                            chain_id = deployment["chainId"]
                            set_cached_metadata(address, chain_id, metadata)
                            count += 1
                elif isinstance(deployments, dict):
                    for deployment in deployments.values():
                        if "address" in deployment and "chainId" in deployment:
                            address = deployment["address"]
                            chain_id = deployment["chainId"]
                            set_cached_metadata(address, chain_id, metadata)
                            count += 1
        except Exception as e:
            logger.warning(f"Failed to cache metadata entry: {e}")

    return count


def init_cache() -> Dict[str, Any]:
    """
    Initialize cache on startup.
    Loads from disk first, then from embedded files.

    Returns:
        Stats about what was loaded
    """
    stats = {
        "from_disk": 0,
        "from_embedded": 0,
        "cache_dir": str(CACHE_DIR),
        "using_volume": CACHE_DIR.parent == RAILWAY_VOLUME_PATH
    }

    # Load from disk (Railway volume) first
    stats["from_disk"] = load_cache_from_disk()

    logger.info(f"Cache initialized: {stats}")
    return stats
