"""
Metadata Hash Index Store

Provides metadata lookup by metadataHash with SQLite persistence and LRU caching.
Returns ALL components needed to replicate on-chain leaf hash for merkle proof verification.

Key Features:
- 3-layer cache: L1 in-memory LRU → L2 SQLite → 404
- Returns leaf hash components: chainId, extcodehash, metadataHash, idx, revoked
- Auto-loads from submission-state.json on first startup
- Webhooks for real-time updates from autonomous-submitter
"""

import os
import json
import sqlite3
import logging
import time
from typing import Optional, Dict, List, Any
from pathlib import Path
from eth_abi import encode
from eth_utils import keccak

logger = logging.getLogger(__name__)

# ============================================================================
# CONSTANTS
# ============================================================================

# Leaf typehash from KaiSignRegistry.sol
LEAF_TYPEHASH = keccak(
    text='RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,uint256 idx,bool revoked)'
)

# Cache configuration
CACHE_SIZE = int(os.getenv("METADATA_HASH_CACHE_SIZE", "1000"))

# Database paths
RAILWAY_VOLUME_PATH = Path("/data")
FALLBACK_PATH = Path("/tmp/kaisign_hash_index")
DB_DIR = RAILWAY_VOLUME_PATH / "hash_index" if RAILWAY_VOLUME_PATH.exists() else FALLBACK_PATH
DB_FILE = DB_DIR / "metadata_hash_registry.db"

# KaiSign contract configuration
KAISIGN_ADDRESS = os.getenv('KAISIGN_ADDRESS', '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa')
SEPOLIA_RPC_URL = os.getenv('SEPOLIA_RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com')

# KaiSign ABI for getAttestation
KAISIGN_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "uid", "type": "bytes32"}],
        "name": "getAttestation",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "uid", "type": "bytes32"},
                    {"internalType": "uint256", "name": "chainId", "type": "uint256"},
                    {"internalType": "bytes32", "name": "extcodehash", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
                    {"internalType": "address", "name": "attester", "type": "address"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "uint64", "name": "idx", "type": "uint64"},
                    {"internalType": "bool", "name": "revoked", "type": "bool"},
                    {"internalType": "uint256", "name": "finalizedAt", "type": "uint256"},
                    {"internalType": "uint256", "name": "revokeProposedAt", "type": "uint256"}
                ],
                "internalType": "struct KaiSignRegistry.Attestation",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# ============================================================================
# L1 CACHE (In-Memory LRU)
# ============================================================================

_hash_cache: Dict[str, Dict[str, Any]] = {}
_cache_order: List[str] = []
_cache_stats = {
    "l1_hits": 0,
    "l2_hits": 0,
    "misses": 0
}

def _update_lru(key: str) -> None:
    """Update LRU order for cache key."""
    if key in _cache_order:
        _cache_order.remove(key)
    _cache_order.append(key)

    # Evict oldest if over limit
    while len(_cache_order) > CACHE_SIZE:
        oldest = _cache_order.pop(0)
        _hash_cache.pop(oldest, None)

def _normalize_hash(h: str) -> str:
    """Normalize hash to lowercase with 0x prefix."""
    if not h.startswith("0x"):
        h = "0x" + h
    return h.lower()

# ============================================================================
# L2 STORAGE (SQLite)
# ============================================================================

_db_conn: Optional[sqlite3.Connection] = None

def _ensure_db_dir() -> bool:
    """Ensure database directory exists."""
    try:
        DB_DIR.mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Failed to create DB directory {DB_DIR}: {e}")
        return False

def _get_db() -> sqlite3.Connection:
    """Get database connection (singleton)."""
    global _db_conn
    if _db_conn is None:
        _ensure_db_dir()
        _db_conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
        _db_conn.row_factory = sqlite3.Row

        # Performance optimizations
        _db_conn.execute("PRAGMA journal_mode=WAL")
        _db_conn.execute("PRAGMA synchronous=NORMAL")
        _db_conn.execute("PRAGMA cache_size=-64000")
        _db_conn.execute("PRAGMA temp_store=MEMORY")
        _db_conn.execute("PRAGMA mmap_size=268435456")

    return _db_conn

def init_hash_db() -> bool:
    """
    Initialize SQLite database with schema and indexes.

    Returns:
        True if successful, False otherwise
    """
    try:
        db = _get_db()

        # Create main table
        db.execute("""
            CREATE TABLE IF NOT EXISTS metadata_registry (
                -- Primary lookup key
                metadata_hash TEXT PRIMARY KEY NOT NULL,

                -- Contract identification
                target_contract TEXT NOT NULL,
                chain_id INTEGER NOT NULL,

                -- Metadata content (JSON blob)
                metadata_json TEXT NOT NULL,

                -- LEAF HASH COMPONENTS (critical for verification)
                extcodehash TEXT NOT NULL,
                idx INTEGER,
                revoked INTEGER NOT NULL DEFAULT 0,

                -- LEAF HASH (computed from components for direct lookup)
                leaf_hash TEXT,

                -- Additional context
                blob_hash TEXT,
                uid TEXT UNIQUE,
                commitment_id TEXT,

                -- Metadata
                status TEXT DEFAULT 'finalized',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                metadata_file TEXT
            )
        """)

        # Create indexes for fast lookups
        db.execute("CREATE INDEX IF NOT EXISTS idx_contract_chain ON metadata_registry(target_contract, chain_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_blob_hash ON metadata_registry(blob_hash)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_uid ON metadata_registry(uid)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_idx ON metadata_registry(idx)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_status ON metadata_registry(status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_leaf_hash ON metadata_registry(leaf_hash)")

        db.commit()
        logger.info("✅ Hash index database initialized")

        # Run migration to add leaf_hash column if needed
        _migrate_add_leaf_hash()

        return True

    except Exception as e:
        logger.error(f"Failed to initialize hash database: {e}")
        return False

def _migrate_add_leaf_hash() -> bool:
    """
    Migration: Add leaf_hash column and populate it for existing entries.

    Returns:
        True if successful or not needed
    """
    try:
        db = _get_db()

        # Check if column already exists
        cursor = db.execute("PRAGMA table_info(metadata_registry)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'leaf_hash' in columns:
            logger.debug("leaf_hash column already exists, skipping migration")
            return True

        logger.info("🔄 Running migration: adding leaf_hash column...")

        # Add column
        db.execute("ALTER TABLE metadata_registry ADD COLUMN leaf_hash TEXT")

        # Populate for all entries with idx
        cursor = db.execute("""
            SELECT metadata_hash, chain_id, extcodehash, idx, revoked
            FROM metadata_registry
            WHERE idx IS NOT NULL
        """)

        updated = 0
        for row in cursor.fetchall():
            leaf_hash = compute_leaf_hash(
                chain_id=row[1],
                extcodehash=row[2],
                metadata_hash=row[0],
                idx=row[3],
                revoked=bool(row[4])
            )

            db.execute(
                "UPDATE metadata_registry SET leaf_hash = ? WHERE metadata_hash = ?",
                (leaf_hash, row[0])
            )
            updated += 1

        # Create index
        db.execute("CREATE INDEX IF NOT EXISTS idx_leaf_hash ON metadata_registry(leaf_hash)")

        db.commit()
        logger.info(f"✅ Migration complete: populated {updated} leaf hashes")
        return True

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False

# ============================================================================
# LEAF HASH COMPUTATION
# ============================================================================

def compute_leaf_hash(
    chain_id: int,
    extcodehash: str,
    metadata_hash: str,
    idx: int,
    revoked: bool
) -> str:
    """
    Compute leaf hash matching KaiSignRegistry.sol formula.

    Formula: keccak256(abi.encode(LEAF_TYPEHASH, chainId, extcodehash, metadataHash, idx, revoked))

    Args:
        chain_id: Chain ID
        extcodehash: Contract bytecode hash (32 bytes hex)
        metadata_hash: Metadata content hash (32 bytes hex)
        idx: Position in merkle tree (1-indexed)
        revoked: Revocation status

    Returns:
        Leaf hash as 0x-prefixed hex string
    """
    # Normalize inputs
    extcodehash_bytes = bytes.fromhex(extcodehash[2:] if extcodehash.startswith("0x") else extcodehash)
    metadata_hash_bytes = bytes.fromhex(metadata_hash[2:] if metadata_hash.startswith("0x") else metadata_hash)

    # Encode using eth_abi (matches Solidity abi.encode)
    encoded = encode(
        ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
        [LEAF_TYPEHASH, chain_id, extcodehash_bytes, metadata_hash_bytes, idx, revoked]
    )

    # Hash
    leaf_hash = keccak(encoded)
    return '0x' + leaf_hash.hex()

# ============================================================================
# QUERY OPERATIONS
# ============================================================================

def get_metadata_by_hash(metadata_hash: str) -> Optional[Dict[str, Any]]:
    """
    3-layer lookup: L1 cache → L2 SQLite → 404

    Queries by EITHER metadata_hash OR leaf_hash, allowing lookups from both
    the extension (which uses leaf hash) and direct metadata hash queries.

    Args:
        metadata_hash: 32-byte hex hash - either metadata hash OR leaf hash (with or without 0x prefix)

    Returns:
        Dict with metadata and leaf components, or None if not found

    Response format:
    {
        "metadata_hash": "0x...",
        "metadata": {...},
        "leaf_components": {
            "chain_id": 1,
            "extcodehash": "0x...",
            "metadata_hash": "0x...",
            "idx": 123,
            "revoked": false
        },
        "leaf_hash": "0x...",
        "target_contract": "0x...",
        "chain_id": 1,
        "blob_hash": "0x...",
        "uid": "0x...",
        "status": "finalized"
    }
    """
    global _cache_stats

    # Normalize
    key = _normalize_hash(metadata_hash)

    # L1: Check in-memory cache
    if key in _hash_cache:
        _update_lru(key)
        _cache_stats["l1_hits"] += 1
        logger.debug(f"L1 cache HIT for {key[:10]}...")
        return _hash_cache[key]

    # L2: Check SQLite (query by metadata_hash OR leaf_hash)
    try:
        db = _get_db()
        cursor = db.execute(
            """
            SELECT
                metadata_hash, metadata_json, target_contract, chain_id,
                extcodehash, idx, revoked, blob_hash, uid, status, metadata_file, leaf_hash
            FROM metadata_registry
            WHERE metadata_hash = ? OR leaf_hash = ?
            """,
            (key, key)
        )
        row = cursor.fetchone()

        if row:
            _cache_stats["l2_hits"] += 1
            logger.debug(f"L2 cache HIT for {key[:10]}...")

            # Parse metadata JSON
            metadata = json.loads(row["metadata_json"])

            # Use stored leaf hash, or compute if not stored
            leaf_hash = row["leaf_hash"]
            if not leaf_hash and row["idx"] is not None:
                leaf_hash = compute_leaf_hash(
                    chain_id=row["chain_id"],
                    extcodehash=row["extcodehash"],
                    metadata_hash=key,
                    idx=row["idx"],
                    revoked=bool(row["revoked"])
                )

            # Build result
            result = {
                "metadata_hash": key,
                "metadata": metadata,
                "leaf_components": {
                    "chain_id": row["chain_id"],
                    "extcodehash": row["extcodehash"],
                    "metadata_hash": key,
                    "idx": row["idx"],
                    "revoked": bool(row["revoked"])
                },
                "leaf_hash": leaf_hash,
                "target_contract": row["target_contract"],
                "chain_id": row["chain_id"],
                "blob_hash": row["blob_hash"],
                "uid": row["uid"],
                "status": row["status"]
            }

            # Store in L1 cache
            _hash_cache[key] = result
            _update_lru(key)

            return result

    except Exception as e:
        logger.error(f"Error querying SQLite: {e}")

    # Miss
    _cache_stats["misses"] += 1
    logger.debug(f"Cache MISS for {key[:10]}...")
    return None

def get_hashes_by_contract(address: str, chain_id: int) -> List[str]:
    """
    Reverse lookup: contract → list of metadata hashes.

    Args:
        address: Contract address
        chain_id: Chain ID

    Returns:
        List of metadata hashes for this contract
    """
    addr = _normalize_hash(address)

    try:
        db = _get_db()
        cursor = db.execute(
            "SELECT metadata_hash FROM metadata_registry WHERE target_contract = ? AND chain_id = ?",
            (addr, chain_id)
        )
        return [row["metadata_hash"] for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error in reverse lookup: {e}")
        return []

# ============================================================================
# UPDATE OPERATIONS
# ============================================================================

def upsert_metadata(
    metadata_hash: str,
    metadata: Dict[str, Any],
    target_contract: str,
    chain_id: int,
    extcodehash: str,
    idx: Optional[int],
    revoked: bool,
    **kwargs
) -> bool:
    """
    Insert or update metadata entry.

    Args:
        metadata_hash: Content hash
        metadata: Full metadata dict
        target_contract: Contract address
        chain_id: Chain ID
        extcodehash: Contract bytecode hash
        idx: Position in merkle tree (None if not yet finalized)
        revoked: Revocation status
        **kwargs: Additional fields (blob_hash, uid, commitment_id, etc.)

    Returns:
        True if successful
    """
    key = _normalize_hash(metadata_hash)
    addr = _normalize_hash(target_contract)

    try:
        db = _get_db()

        now = int(time.time())
        metadata_json = json.dumps(metadata)

        # Compute leaf hash if idx is available
        leaf_hash = None
        if idx is not None:
            leaf_hash = compute_leaf_hash(
                chain_id=chain_id,
                extcodehash=extcodehash,
                metadata_hash=key,
                idx=idx,
                revoked=revoked
            )

        db.execute(
            """
            INSERT INTO metadata_registry (
                metadata_hash, metadata_json, target_contract, chain_id,
                extcodehash, idx, revoked, leaf_hash,
                blob_hash, uid, commitment_id,
                status, created_at, updated_at, metadata_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(metadata_hash) DO UPDATE SET
                metadata_json = excluded.metadata_json,
                idx = excluded.idx,
                revoked = excluded.revoked,
                leaf_hash = excluded.leaf_hash,
                updated_at = excluded.updated_at
            """,
            (
                key, metadata_json, addr, chain_id,
                extcodehash, idx, int(revoked), leaf_hash,
                kwargs.get('blob_hash'), kwargs.get('uid'), kwargs.get('commitment_id'),
                kwargs.get('status', 'finalized'), now, now, kwargs.get('metadata_file')
            )
        )

        db.commit()

        # Invalidate L1 cache for this entry
        _hash_cache.pop(key, None)

        logger.info(f"✅ Upserted metadata {key[:10]}... (idx={idx})")
        return True

    except Exception as e:
        logger.error(f"Failed to upsert metadata: {e}")
        return False

# ============================================================================
# BULK LOADING
# ============================================================================

def load_from_submission_state(state_file: str) -> int:
    """
    Load all finalized entries from submission-state.json.

    Queries on-chain to get idx and revoked status for each entry.
    This may take 30-60 seconds for ~450 entries due to RPC calls.

    Args:
        state_file: Path to submission-state.json

    Returns:
        Number of entries successfully loaded
    """
    try:
        from web3 import Web3

        logger.info(f"📥 Loading from {state_file}...")

        # Connect to Sepolia with retry
        rpc_url = SEPOLIA_RPC_URL
        logger.info(f"Connecting to RPC: {rpc_url}")

        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 60}))

        # Test connection with retry
        max_retries = 3
        for attempt in range(max_retries):
            try:
                w3.eth.block_number  # Test call
                logger.info(f"✅ Connected to RPC")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"RPC connection attempt {attempt+1} failed, retrying...")
                    time.sleep(2)
                else:
                    logger.error(f"❌ Failed to connect after {max_retries} attempts: {e}")
                    return 0

        kaisign = w3.eth.contract(address=KAISIGN_ADDRESS, abi=KAISIGN_ABI)
        logger.info(f"✅ Connected to KaiSign at {KAISIGN_ADDRESS}")

        # Load submission state
        with open(state_file, 'r') as f:
            states = json.load(f)

        loaded = 0
        failed = 0

        for i, entry in enumerate(states):
            # Only process finalized entries with UID
            if entry.get('status') != 'finalized' or not entry.get('uid'):
                continue

            try:
                # Query on-chain for idx and revoked
                uid_bytes = bytes.fromhex(entry['uid'][2:])
                attestation = kaisign.functions.getAttestation(uid_bytes).call()

                idx = attestation[7]
                revoked = attestation[8]

                # Read metadata file
                metadata_path = entry.get('metadataPath')
                if not metadata_path or not os.path.exists(metadata_path):
                    logger.warning(f"⚠️  Metadata file not found: {metadata_path}")
                    failed += 1
                    continue

                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)

                # Upsert to database
                success = upsert_metadata(
                    metadata_hash=entry['metadataHash'],
                    metadata=metadata,
                    target_contract=entry['targetContract'],
                    chain_id=entry['chainId'],
                    extcodehash=entry['extcodehash'],
                    idx=idx,
                    revoked=revoked,
                    blob_hash=entry.get('blobHash'),
                    uid=entry['uid'],
                    commitment_id=entry.get('commitmentId'),
                    status=entry['status'],
                    metadata_file=entry.get('metadataFile')
                )

                if success:
                    loaded += 1
                    # Progress indicator every 50 entries
                    if loaded % 50 == 0:
                        logger.info(f"⏳ Progress: {loaded} loaded, {failed} failed")
                else:
                    failed += 1

            except Exception as e:
                logger.warning(f"⚠️  Failed to load uid {entry.get('uid', 'unknown')}: {e}")
                failed += 1
                continue

        logger.info(f"✅ Loaded {loaded} entries ({failed} failed)")
        return loaded

    except Exception as e:
        logger.error(f"Fatal error loading from submission state: {e}")
        import traceback
        traceback.print_exc()
        return 0

def rebuild_index() -> int:
    """
    Drop and recreate entire index from submission-state.json.

    Returns:
        Number of entries indexed
    """
    logger.info("🔄 Rebuilding hash index...")

    try:
        # Clear database
        db = _get_db()
        db.execute("DELETE FROM metadata_registry")
        db.commit()

        # Clear L1 cache
        _hash_cache.clear()
        _cache_order.clear()

        # Reload
        state_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "scripts/submission-state.json"
        )

        return load_from_submission_state(state_file)

    except Exception as e:
        logger.error(f"Failed to rebuild index: {e}")
        return 0

# ============================================================================
# STATISTICS
# ============================================================================

def get_hash_stats() -> Dict[str, Any]:
    """
    Get cache and database statistics.

    Returns:
        Dict with stats: total_entries, l1_size, l1_hits, l2_hits, misses
    """
    try:
        db = _get_db()
        cursor = db.execute("SELECT COUNT(*) as count FROM metadata_registry")
        total = cursor.fetchone()["count"]

        return {
            "total_entries": total,
            "l1_size": len(_hash_cache),
            "l1_max_size": CACHE_SIZE,
            "l1_hits": _cache_stats["l1_hits"],
            "l2_hits": _cache_stats["l2_hits"],
            "misses": _cache_stats["misses"],
            "db_file": str(DB_FILE),
            "db_size_mb": round(DB_FILE.stat().st_size / 1024 / 1024, 2) if DB_FILE.exists() else 0
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return {
            "total_entries": 0,
            "l1_size": len(_hash_cache),
            "l1_max_size": CACHE_SIZE,
            "l1_hits": _cache_stats["l1_hits"],
            "l2_hits": _cache_stats["l2_hits"],
            "misses": _cache_stats["misses"],
            "error": str(e)
        }
