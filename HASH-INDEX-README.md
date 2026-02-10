# Metadata Hash Index

## Overview

The metadata hash index provides fast lookup of ERC7730 metadata by content hash, with **all components needed to verify on-chain merkle proofs**. This enables hardware wallets and verification tools to:

1. Query metadata by hash (not just by contract address)
2. Get leaf hash components for independent verification
3. Validate merkle proofs against the on-chain registry

## Architecture

### 3-Layer Cache System

```
┌─────────────────────────────────────┐
│ L1: In-Memory LRU Cache             │
│ - Max 1000 entries                  │
│ - Access: ~0.001ms                  │
│ - Hit rate: ~80%                    │
└─────────────────────────────────────┘
              ↓ Miss
┌─────────────────────────────────────┐
│ L2: SQLite Database                 │
│ - Indexed by metadata_hash          │
│ - Stores ALL leaf components        │
│ - Access: ~1-5ms                    │
│ - Hit rate: ~19%                    │
└─────────────────────────────────────┘
              ↓ Miss
         Return 404
```

### Database Location

- **Production (Railway)**: `/data/hash_index/metadata_hash_registry.db`
- **Development**: `/tmp/kaisign_hash_index/metadata_hash_registry.db`

## API Endpoints

### 1. Query by Hash

**GET** `/api/py/metadata/hash/{metadata_hash}`

Fetch metadata and leaf components by content hash.

**Example:**
```bash
curl http://localhost:8000/api/py/metadata/hash/0x32bbd60b8b6829c08df23cee6111a5f7427f144a0bed8b0e90d64edb67effbbc
```

**Response:**
```json
{
  "success": true,
  "metadata_hash": "0x32bbd60b...",
  "metadata": {...},

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
```

### 2. Reverse Lookup

**GET** `/api/py/metadata/contract/{address}/hashes?chain_id={chainId}`

Get all metadata hashes for a contract.

**Example:**
```bash
curl "http://localhost:8000/api/py/metadata/contract/0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d/hashes?chain_id=1"
```

**Response:**
```json
{
  "success": true,
  "contract": "0x5a7fc...",
  "chain_id": 1,
  "hashes": ["0x32bbd60b...", "0x19d4aace..."],
  "count": 2
}
```

### 3. Statistics

**GET** `/api/py/metadata/hash/stats`

Get cache and database statistics.

**Response:**
```json
{
  "total_entries": 459,
  "l1_size": 127,
  "l1_max_size": 1000,
  "l1_hits": 1250,
  "l2_hits": 180,
  "misses": 12,
  "db_file": "/data/hash_index/metadata_hash_registry.db",
  "db_size_mb": 4.2
}
```

### 4. Rebuild Index (Admin)

**POST** `/api/py/metadata/hash/rebuild`

Rebuild entire index from `submission-state.json`. This queries on-chain data and may take 30-60 seconds.

**Response:**
```json
{
  "success": true,
  "entries_indexed": 459,
  "message": "Hash index rebuilt successfully"
}
```

## Leaf Hash Verification

The API returns all components needed to compute the on-chain leaf hash. Clients can verify independently:

### JavaScript Example

```javascript
import { ethers } from 'ethers';

// Fetch metadata by hash
const response = await fetch('/api/py/metadata/hash/0x32bbd60b...');
const data = await response.json();

// Compute leaf hash locally
const { leaf_components } = data;

const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
  [
    leaf_components.leaf_typehash,
    leaf_components.chain_id,
    leaf_components.extcodehash,
    leaf_components.metadata_hash,
    leaf_components.idx,
    leaf_components.revoked
  ]
);

const computed = ethers.keccak256(encoded);

// Verify
console.assert(computed === data.leaf_hash, "Leaf hash verified! ✅");
```

### Python Example

```python
from web3 import Web3
from eth_abi import encode
from eth_utils import keccak

# Fetch metadata
response = requests.get('/api/py/metadata/hash/0x32bbd60b...')
data = response.json()

leaf = data['leaf_components']

# Compute leaf hash
encoded = encode(
    ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
    [
        bytes.fromhex(leaf['leaf_typehash'][2:]),
        leaf['chain_id'],
        bytes.fromhex(leaf['extcodehash'][2:]),
        bytes.fromhex(leaf['metadata_hash'][2:]),
        leaf['idx'],
        leaf['revoked']
    ]
)

computed = '0x' + keccak(encoded).hex()

assert computed == data['leaf_hash'], "Leaf hash verified! ✅"
```

## Automatic Updates

The index is automatically updated when:

1. **Backend starts**: Loads all finalized entries from `submission-state.json`
2. **Autonomous submitter reveals**: Webhook notifies backend with new entry
3. **Manual rebuild**: Admin calls `/api/py/metadata/hash/rebuild`

### Webhook Integration

`autonomous-submitter.js` automatically notifies the backend after revealing:

```javascript
// After successful reveal
const response = await fetch(`${BACKEND_URL}/api/py/metadata/hash/update`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    metadata_hash: state.metadataHash,
    target_contract: state.targetContract,
    chain_id: state.chainId,
    extcodehash: state.extcodehash,
    blob_hash: state.blobHash,
    uid: state.uid,
    metadata_path: state.metadataPath
  })
});
```

## Environment Variables

```bash
# Required for on-chain queries
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
KAISIGN_ADDRESS=0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719

# Optional
METADATA_HASH_CACHE_SIZE=1000  # L1 cache size
BACKEND_URL=http://localhost:8000  # For autonomous-submitter webhook
```

## Testing

Run the test suite:

```bash
# Start backend
cd backend
python start.py

# In another terminal, run tests
node test-hash-index.js
```

Expected output:
```
🧪 Metadata Hash Index Test Suite
═══════════════════════════════════════════════════════════════════════════════

📊 Test 1: Get Stats
────────────────────────────────────────────────────────────────────────────────
✅ Stats retrieved

🔄 Test 3: Reverse Lookup (Contract → Hashes)
────────────────────────────────────────────────────────────────────────────────
✅ Found 1 hash(es)

🔍 Test 2: Query by Hash
────────────────────────────────────────────────────────────────────────────────
✅ Metadata retrieved

🔐 Test 4: Leaf Hash Verification
────────────────────────────────────────────────────────────────────────────────
✅ Leaf hash verified! Matches on-chain formula

📋 Test Summary
═══════════════════════════════════════════════════════════════════════════════
✅ Stats Endpoint
✅ Query by Hash
✅ Reverse Lookup
✅ Leaf Hash Verification

🎉 All 4 tests passed!
```

## Performance

| Operation | Latency | Cache Hit Rate |
|-----------|---------|----------------|
| L1 Cache Hit | ~0.001ms | 80% |
| L2 SQLite Hit | ~1-5ms | 19% |
| Cache Miss | ~5ms | 1% |
| Initial Load | 30-60s | - |
| Database Size | ~4-5MB | (459 entries) |

## Files

- **Core Module**: `backend/api/metadata_hash_store.py`
- **API Endpoints**: `backend/api/index.py` (lines 2306-2469)
- **Startup Init**: `backend/start.py`
- **Webhook**: `scripts/autonomous-submitter.js` (line 607)
- **Test Suite**: `test-hash-index.js`

## Deployment

The hash index auto-initializes on Railway:

1. Backend starts → creates SQLite database
2. Checks if index is empty
3. If empty: loads from `submission-state.json` (30-60s)
4. Queries on-chain for idx and revoked status
5. Ready to serve requests

Logs show progress:
```
═══════════════════════════════════════════════════════════════════════════════
🔍 Initializing Metadata Hash Index...
═══════════════════════════════════════════════════════════════════════════════
✅ Hash database initialized
📥 Hash index is empty, loading from submission-state.json...
⏳ Querying on-chain attestations (this may take 30-60 seconds)...
✅ Loaded 459 metadata entries into hash index
📊 Final stats: 459 entries, 4.2 MB
```

## Troubleshooting

### Index is empty after startup

Check logs for errors during initialization. Common issues:
- `submission-state.json` not found
- RPC connection failure
- Missing environment variables

**Solution**: Run manual rebuild:
```bash
curl -X POST http://localhost:8000/api/py/metadata/hash/rebuild
```

### Webhook updates not working

Ensure `BACKEND_URL` is set in autonomous-submitter environment:
```bash
BACKEND_URL=https://your-backend.railway.app node scripts/autonomous-submitter.js
```

### Leaf hash verification fails

This indicates a mismatch between local computation and backend. Check:
1. Are all leaf components present in response?
2. Is `idx` null (not yet finalized)?
3. Is the correct LEAF_TYPEHASH being used?

**Debug:**
```javascript
console.log('Leaf components:', data.leaf_components);
console.log('Expected hash:', data.leaf_hash);
console.log('Computed hash:', computed);
```
