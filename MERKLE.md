# KaiSign metadata Merkle verification

This repo carries a full local copy of the metadata set from:

`../kaisign-backend/backend/metadata`

Users can verify that complete metadata set without running or trusting the KaiSign backend.
The backend can serve metadata, but it is not the trust anchor. The trust anchor is the on-chain registry Merkle root.

Current Sepolia registry:

`0x655084b6A0f2Ee600bd31A71820b5E068b7870d0`

## Rebuild the complete metadata set root

```bash
npm install
node scripts/build-merkle-root.mjs
```

Output:

`seed-frontier.json`

That file contains:

- `currentIdx`: number of leaves inserted
- `merkleRoot`: rebuilt root for the complete metadata set
- `frontier`: depth-20 incremental tree frontier
- `leaves[]`: every metadata leaf with path, chainId, address/binding, extcodehash, metadataHash, and leaf index
- `skipped[]`: files not included and why

The script is a path-adjusted copy of `../kaisign-backend/scripts/build-seed-frontier.mjs`:

- backend metadata root: `backend/metadata`
- Builder metadata root: `metadata`
- backend default output: `../v1-core/script/seed-frontier.json`
- Builder default output: `seed-frontier.json`

The hashing and tree logic are otherwise the same as backend:

```solidity
LEAF_TYPEHASH = keccak256("RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,bool revoked)");
leaf = keccak256(abi.encode(LEAF_TYPEHASH, chainId, extcodehash, metadataHash, false));
```

Contract metadata uses:

```text
extcodehash = keccak256(runtime bytecode from eth_getCode(address))
metadataHash = keccak256(canonical JSON bytes with recursively sorted keys)
```

EIP-712 metadata uses the same deterministic `eip712-domain-v1` binding hash as the backend script, so typed-data metadata is included in the same complete tree without requiring deployed bytecode.

## How users verify metadata without the backend

A user can get metadata from anywhere:

- this repo's `metadata/` directory
- a copied metadata set
- `../kaisign-extension`
- MCP
- IPFS/blob storage
- a mirror
- the KaiSign backend API
- any custom distributor

The source does not need to be trusted if the user verifies the metadata against the on-chain Merkle root.

Verification flow:

1. Fetch/read the metadata JSON.
2. Canonicalize it with recursively sorted object keys and no whitespace.
3. Compute `metadataHash = keccak256(canonicalJsonBytes(metadata))`.
4. Compute the binding hash:
   - contract metadata: `keccak256(await eth_getCode(address))`
   - EIP-712 metadata: the backend-compatible deterministic binding hash in `scripts/build-merkle-root.mjs`
5. Compute the availability leaf with `revoked=false`.
6. Verify the Merkle proof for that leaf against the registry root.

If the proof matches the on-chain root, the metadata bytes are part of the committed metadata set. If anyone changes the JSON, the `metadataHash` changes and the proof fails.

## Complete-set confirmation

To confirm the local metadata set is the committed set:

```bash
node scripts/build-merkle-root.mjs
jq -r '.currentIdx, .merkleRoot' seed-frontier.json
```

Then compare `seed-frontier.json.merkleRoot` to the registry root read from the deployed KaiSign registry.
A matching root means the local `metadata/` set, leaf order, binding logic, and Merkle construction reproduce the committed tree.

This is the important property: wallets, extensions, MCP clients, CLIs, and offline users can use the metadata set directly and validate it cryptographically without depending on the backend.