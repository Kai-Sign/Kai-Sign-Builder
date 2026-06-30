"""
KaiSign Metadata Serving Logic

This mirrors the actual backend (kaisign-backend/backend/api/) that serves
metadata to the kai-sign-extension (v3.11+).

Compatible with kai-sign-extension v3.11 and beyond.

Protocol:
  1. Extension requests metadata for (address, chainId)
  2. Server finds the best ERC7730 metadata JSON from local metadata/
  3. Server computes canonical metadataHash
  4. Server looks up the Merkle tree position for that hash
  5. Server returns: metadata + metadataHash + extcodehash + merkle proofs
  6. Extension verifies: recomputes leaf, verifies proof against on-chain merkleRoot

Leaf encoding (KaiSignRegistry v1.0.0):
  leaf = keccak256(abi.encode(
    LEAF_TYPEHASH,           // keccak256("RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,bool revoked)")
    chainId,
    extcodehash,             // keccak256(runtime bytecode from eth_getCode)
    metadataHash,            // keccak256(canonical JSON bytes)
    revoked                  // false = availability leaf, true = revocation leaf
  ))
"""

import json
import time
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

try:
    from eth_abi import encode
    from eth_utils import keccak
    _HAS_ETH = True
except ImportError:
    from hashlib import sha256
    _HAS_ETH = False

from deployment import REGISTRY_NEW_SEPOLIA

logger = logging.getLogger(__name__)

# ---- PATHS (mirrors backend/api/index.py layout) ----
# Production: backend/api/index.py → parent.parent = backend/ → metadata/ at backend/metadata/
# Builder:    backend/serve.py    → parent       = Kai-Sign-Builder/ → metadata/ at repo root
# Both resolve to the metadata directory containing canonical ERC7730 JSON files.
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent   # Kai-Sign-Builder/
DEFAULT_METADATA_DIR = REPO_ROOT / "metadata"
DEFAULT_FRONTIER_PATH = REPO_ROOT / "seed-frontier.json"

# ---- MERKLE TREE CONFIG ----

TREE_DEPTH = 20

LEAF_TYPEHASH_STR = (
    "RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,bool revoked)"
)

# Pre-computed at module load
if _HAS_ETH:
    LEAF_TYPEHASH = "0x" + keccak(text=LEAF_TYPEHASH_STR).hex()
else:
    LEAF_TYPEHASH = None  # not available without eth_abi

# ---- CANONICAL HASH (matches backend/api/index.py _canonical_metadata_hash) ----

def canonicalize(value):
    """Sort all dict keys recursively; used to produce a stable JSON form."""
    if isinstance(value, list):
        return [canonicalize(v) for v in value]
    if isinstance(value, dict):
        return {k: canonicalize(value[k]) for k in sorted(value.keys())}
    return value


def canonical_metadata_hash(metadata: Dict[str, Any]) -> str:
    """
    keccak256(canonical JSON bytes).

    Matches backend/api/index.py::_canonical_metadata_hash and
    build-merkle-root.mjs::canonicalHash.
    """
    canonical = json.dumps(canonicalize(metadata), separators=(",", ":"))
    if _HAS_ETH:
        return "0x" + keccak(text=canonical).hex()
    else:
        return "0x" + sha256(canonical.encode()).hexdigest()


# ---- LEAF HASH (matches metadata_hash_store.py::compute_leaf_hash) ----

def compute_leaf_hash(
    chain_id: int,
    extcodehash: str,
    metadata_hash: str,
    revoked: bool = False
) -> str:
    """
    keccak256(abi.encode(LEAF_TYPEHASH, chainId, extcodehash, metadataHash, revoked))

    Matches KaiSignRegistry.sol v1.0.0 leaf encoding.
    """
    if not _HAS_ETH:
        raise RuntimeError("eth_abi + eth_utils required for leaf hash; pip install eth-abi eth-utils")

    ext_h = bytes.fromhex(extcodehash[2:])
    meta_h = bytes.fromhex(metadata_hash[2:])
    type_h = bytes.fromhex(LEAF_TYPEHASH[2:])

    encoded = encode(
        ['bytes32', 'uint256', 'bytes32', 'bytes32', 'bool'],
        [type_h, chain_id, ext_h, meta_h, revoked]
    )
    return "0x" + keccak(encoded).hex()


# ---- MERKLE TREE (matches metadata_hash_store.py) ----

def _hash_pair(left: str, right: str) -> str:
    left_b = bytes.fromhex(left[2:])
    right_b = bytes.fromhex(right[2:])
    if _HAS_ETH:
        return "0x" + keccak(left_b + right_b).hex()
    else:
        return "0x" + sha256(left_b + right_b).hexdigest()


def _frontier_zero_levels(depth: int = TREE_DEPTH) -> List[str]:
    zero = "0x" + "0" * 64
    out = [zero]
    for _ in range(1, depth):
        out.append(_hash_pair(out[-1], out[-1]))
    return out


def build_incremental_proof(leaves: List[str], index: int, depth: int = TREE_DEPTH) -> List[str]:
    """
    Generate Merkle proof for a leaf at `index` in a fixed-depth incremental tree.

    Mirrors KaiSignRegistry._insertLeaf. At each level, the sibling is the
    matching populated node if present, else the cumulative zero hash.
    Returns `depth` siblings.
    """
    if index < 0 or index >= len(leaves):
        raise IndexError(f"Leaf index {index} out of bounds for {len(leaves)} leaves")

    zeros = _frontier_zero_levels(depth)
    layer = [l.lower() for l in leaves]
    proof: List[str] = []
    pos = index

    for level in range(depth):
        sibling_pos = pos + 1 if pos % 2 == 0 else pos - 1
        if sibling_pos < len(layer):
            proof.append(layer[sibling_pos])
        else:
            proof.append(zeros[level])

        # Build next layer
        next_layer: List[str] = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            right = layer[i + 1] if i + 1 < len(layer) else zeros[level]
            next_layer.append(_hash_pair(left, right))
        layer = next_layer
        pos //= 2

    return proof


def build_merkle_tree(leaves: List[str], depth: int = TREE_DEPTH) -> tuple:
    """
    Build full incremental Merkle tree from ordered leaves.
    Returns (merkle_root, frontier, zeros).
    """
    zeros = _frontier_zero_levels(depth)
    frontier = ["0x" + "0" * 64] * depth
    root = "0x" + "0" * 64

    for idx, leaf in enumerate(leaves):
        current = leaf.lower()
        pos = idx
        for i in range(depth):
            if pos % 2 == 0:
                frontier[i] = current
                current = _hash_pair(current, zeros[i])
            else:
                current = _hash_pair(frontier[i], current)
            pos //= 2
        root = current

    return root, frontier


def verify_proof(leaf: str, index: int, siblings: List[str], expected_root: str) -> bool:
    """Verify a Merkle proof by hashing up the tree."""
    current = leaf.lower()
    for i, sibling in enumerate(siblings):
        if (index >> i) & 1:
            current = _hash_pair(sibling, current)
        else:
            current = _hash_pair(current, sibling)
    return current.lower() == expected_root.lower()


# ---- METADATA LOOKUP (matches backend/api/index.py _find_raw_metadata_candidates) ----

def find_metadata_candidates(address: str, chain_id: int, metadata_dir: Path) -> List[Dict[str, Any]]:
    """
    Scan metadata/ for all JSON files matching (address, chainId).

    Mirrors _find_raw_metadata_candidates in the production backend.
    """
    addr = address.lower()
    candidates = []

    for path in sorted(metadata_dir.rglob("*.json")):
        if path.name in ("MANIFEST.md", "package.json", "token-registry.js"):
            continue
        try:
            meta = json.loads(path.read_text())
        except Exception:
            continue

        if _metadata_matches(meta, addr, chain_id):
            candidates.append({
                "path": str(path),
                "metadata": meta,
                "metadata_hash": canonical_metadata_hash(meta),
            })

    return candidates


def _metadata_matches(metadata: Dict[str, Any], addr: str, chain_id: int) -> bool:
    """Check if metadata context.contract.deployments contains this (address, chainId)."""
    contract = metadata.get("context", {}).get("contract", {})
    deployments = contract.get("deployments")

    if isinstance(deployments, list):
        for dep in deployments:
            if str(dep.get("address", "")).lower() == addr and dep.get("chainId") == chain_id:
                return True
    elif isinstance(deployments, dict):
        for dep in deployments.values():
            if str(dep.get("address", "")).lower() == addr and dep.get("chainId") == chain_id:
                return True

    # Also check direct address/chainId on context.contract
    contract_addr = str(contract.get("address", "")).lower()
    contract_chain = contract.get("chainId")
    return contract_addr == addr and contract_chain == chain_id


def pick_best_candidate(candidates: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Pick the most specific metadata candidate.

    Priority: more ABI entries, more display formats, non-token paths.
    """
    if not candidates:
        return None

    def score(c):
        meta = c.get("metadata", {})
        contract = meta.get("context", {}).get("contract", {})
        abi = contract.get("abi")
        abi_len = len(abi) if isinstance(abi, list) else 0
        display = meta.get("display", {}).get("formats", {})
        display_len = len(display) if isinstance(display, dict) else 0
        path = str(c.get("path", "")).lower()
        generic_penalty = 1 if "/tokens/" in path else 0
        return (abi_len, display_len, -generic_penalty)

    return sorted(candidates, key=score, reverse=True)[0]


# ---- FRONTIER LOADING (mirrors load_frontier_file in metadata_hash_store.py) ----

_frontier_state: Dict[str, Any] = {
    "loaded": False,
    "merkle_root": None,
    "leaves": [],
    "by_metadata_hash": {},
}


def load_frontier(frontier_path: Path) -> Dict[str, Any]:
    """
    Load seed-frontier.json produced by build-merkle-root.mjs.

    Builds lookup tables: metadataHash -> {False: avail_idx, True: revoke_idx}
    """
    global _frontier_state
    payload = json.loads(frontier_path.read_text())

    leaves_meta = payload.get("leaves") or []
    leaves: List[str] = []
    by_metadata_hash: Dict[str, Dict[bool, int]] = {}

    for entry in leaves_meta:
        leaf_hash = str(entry["leaf"]).lower()
        leaves.append(leaf_hash)
        mhash = str(entry["metadataHash"]).lower()
        revoked = bool(entry.get("revoked", False))
        leaf_idx = int(entry["leafIndex"])
        by_metadata_hash.setdefault(mhash, {})[revoked] = leaf_idx

    _frontier_state = {
        "loaded": True,
        "merkle_root": str(payload.get("merkleRoot", "")).lower(),
        "leaves": leaves,
        "by_metadata_hash": by_metadata_hash,
    }

    logger.info("Loaded frontier: %d leaves, root=%s", len(leaves), _frontier_state["merkle_root"])
    return _frontier_state


def get_merkle_proofs(metadata_hash: str) -> Optional[Dict[str, Any]]:
    """
    Build Merkle proofs for a metadata hash from the loaded frontier.

    Returns:
        {
            "availability": {"index": int, "siblings": [bytes32 x 20]} | None,
            "revocation":   {"index": int, "siblings": [bytes32 x 20]} | None
        }
    """
    if not _frontier_state["loaded"]:
        return None

    leaves = _frontier_state["leaves"]
    by_hash = _frontier_state["by_metadata_hash"]
    key = metadata_hash.lower()

    idxs = by_hash.get(key, {})
    avail_idx = idxs.get(False)
    revoke_idx = idxs.get(True)

    if avail_idx is None and revoke_idx is None:
        return None

    return {
        "availability": (
            {"index": avail_idx, "siblings": build_incremental_proof(leaves, avail_idx)}
            if avail_idx is not None else None
        ),
        "revocation": (
            {"index": revoke_idx, "siblings": build_incremental_proof(leaves, revoke_idx)}
            if revoke_idx is not None else None
        ),
    }


# ---- FULL RESPONSE BUILDER (what the extension receives) ----

def serve_metadata(
    address: str,
    chain_id: int,
    metadata_dir: Path,
    frontier_path: Path,
    registry_address: str = REGISTRY_NEW_SEPOLIA,
) -> Dict[str, Any]:
    """
    Build the full response that the kai-sign-extension (v3.11+) receives.

    This is the single function that encapsulates the entire serving logic:
    find metadata → compute hash → get proofs → return verifiable response.

    Returns:
        {
            "success": True,
            "metadata_hash": "0x...",
            "metadata": {...},
            "target_contract": "0x...",
            "chain_id": 1,
            "extcodehash": "0x...",
            "merkle_root": "0x...",
            "registry_address": "0x...",
            "proofs": {"availability": ...} | null,
            "schema_version": "v2",
            "compatible_extensions": ">=3.11"
        }
    """
    # Load frontier if needed
    if not _frontier_state["loaded"] and frontier_path.exists():
        load_frontier(frontier_path)

    # Find best metadata
    candidates = find_metadata_candidates(address, chain_id, metadata_dir)
    best = pick_best_candidate(candidates)

    if not best:
        return {
            "success": False,
            "error": f"No metadata found for {address} on chain {chain_id}",
            "registry_address": registry_address,
            "compatible_extensions": ">=3.11",
        }

    metadata = best["metadata"]
    meta_hash = best["metadata_hash"]

    # Extract extcodehash from the frontier if we have it (server-side precomputed)
    # Otherwise the extension fetches it directly via eth_getCode
    extcodehash = None
    if _frontier_state["loaded"]:
        by_hash = _frontier_state["by_metadata_hash"]
        idxs = by_hash.get(meta_hash.lower(), {})
        # We could look up extcodehash from the frontier leaves_meta,
        # but the canonical approach is: server returns metadata + hash,
        # extension fetches extcodehash via eth_getCode and verifies independently.

    # Get proofs
    proofs = get_merkle_proofs(meta_hash) if _frontier_state["loaded"] else None

    # Get target contract from metadata
    contract = metadata.get("context", {}).get("contract", {})
    target = contract.get("address", address)

    return {
        "success": True,
        "metadata_hash": meta_hash,
        "metadata": metadata,
        "target_contract": target,
        "chain_id": chain_id,
        "merkle_root": _frontier_state.get("merkle_root"),
        "registry_address": registry_address,
        "proofs": proofs,
        "schema_version": "v2",
        "compatible_extensions": ">=3.11",
    }


# ---- DEMO (python backend/serve.py) ----

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    print(f"Metadata dir:  {DEFAULT_METADATA_DIR}  (exists: {DEFAULT_METADATA_DIR.exists()})")
    print(f"Frontier file: {DEFAULT_FRONTIER_PATH} (exists: {DEFAULT_FRONTIER_PATH.exists()})")
    print(f"Registry:      {REGISTRY_NEW_SEPOLIA}")
    print(f"Extension:     >=3.11")
    print()

    if not DEFAULT_METADATA_DIR.exists():
        print("ERROR: metadata/ directory not found. Run from repo root.")
        sys.exit(1)

    # Load frontier for proofs
    if DEFAULT_FRONTIER_PATH.exists():
        print(f"Loading frontier...")
        load_frontier(DEFAULT_FRONTIER_PATH)
        print(f"  Leaves: {len(_frontier_state['leaves'])}")
        print(f"  Root:   {_frontier_state['merkle_root']}")
        print()

    # Example lookup
    address = sys.argv[1] if len(sys.argv) > 1 else "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC
    chain_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    print(f"Looking up {address} on chain {chain_id}...")
    result = serve_metadata(
        address=address,
        chain_id=chain_id,
        metadata_dir=DEFAULT_METADATA_DIR,
        frontier_path=DEFAULT_FRONTIER_PATH,
    )

    if result["success"]:
        print(f"  Found: {result['metadata_hash']}")
        print(f"  Contract: {result['target_contract']}")
        print(f"  Merkle root: {result['merkle_root']}")
        if result["proofs"] and result["proofs"]["availability"]:
            proof = result["proofs"]["availability"]
            print(f"  Proof index: {proof['index']}")
            print(f"  Siblings: {len(proof['siblings'])} (depth 20)")
    else:
        print(f"  Not found: {result.get('error')}")
