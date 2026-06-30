// Build a seed frontier for KaiSignRegistry.migrate() from local metadata JSONs.
// Path-adjusted copy of ../kaisign-backend/scripts/build-seed-frontier.mjs.
//
// For each formal ERC-7730 v2-equivalent metadata JSON under backend/metadata, derive:
//   chainId      -> from JSON (context.contract.chainId or context.contract.deployments[0].chainId)
//   extcodehash  -> keccak256(runtime bytecode) fetched via RPC for the given chain
//   metadataHash -> keccak256(canonical JSON bytes of the file contents)
//
// Leaf encoding matches ../v1-core/src/KaiSignRegistry.sol:
//   leaf = keccak256(abi.encode(LEAF_TYPEHASH, chainId, extcodehash, metadataHash, revoked))
//
// One availability leaf (revoked=false) is emitted per (chainId, address, metadataHash).
// This matches the on-chain migrated tree: KaiSignRegistry.migrate() seeded the
// frontier from a replay that contains only availability leaves. Revocation
// leaves are appended later by on-chain revoke flows; they are NOT in the
// migrated baseline. The extension verifier accepts `revocation: null` for
// non-revoked metadata.
//
// Output: defaults to ../v1-core/script/seed-frontier.json. Override with
//   --output <path>   CLI flag, or
//   SEED_FRONTIER_OUTPUT  env var
// Metadata root defaults to ./metadata (copied from ../kaisign-backend/backend/metadata).
//
// Output shape:
//   { frontier: bytes32[20], currentIdx, merkleRoot,
//     leaves: [{path, chainId, address, extcodehash, metadataHash, revoked, leafIndex, leaf}],
//     skipped: [...] }

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const { keccak256, concat, AbiCoder } = ethers;
const coder = AbiCoder.defaultAbiCoder();

// ---------- config ----------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const METADATA_ROOT = resolve(REPO_ROOT, 'metadata');
const DEFAULT_OUTPUT_PATH = resolve(REPO_ROOT, 'seed-frontier.json');

function resolveOutputPath() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' || argv[i] === '-o') {
      const next = argv[i + 1];
      if (!next) throw new Error('--output requires a path argument');
      return resolve(process.cwd(), next);
    }
    if (argv[i].startsWith('--output=')) {
      return resolve(process.cwd(), argv[i].slice('--output='.length));
    }
  }
  if (process.env.SEED_FRONTIER_OUTPUT) {
    return resolve(process.cwd(), process.env.SEED_FRONTIER_OUTPUT);
  }
  return DEFAULT_OUTPUT_PATH;
}

const OUTPUT_PATH = resolveOutputPath();
const CACHE_PATH = resolve(SCRIPT_DIR, 'extcodehash-cache.json');
const TREE_DEPTH = 20;

// LEAF_TYPEHASH = keccak256("RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,bool revoked)")
const LEAF_TYPEHASH = keccak256(
  ethers.toUtf8Bytes('RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,bool revoked)')
);

const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '1EFr4OH_BpQp-qxV_7Vv5';

// chainId -> Alchemy subdomain. Only chains in this map are fetched; others are skipped.
const ALCHEMY_CHAINS = {
  1:         'eth-mainnet',
  10:        'opt-mainnet',
  56:        'bnb-mainnet',
  100:       'gnosis-mainnet',
  137:       'polygon-mainnet',
  146:       'sonic-mainnet',
  324:       'zksync-mainnet',
  8453:      'base-mainnet',
  42161:     'arb-mainnet',
  42220:     'celo-mainnet',
  43114:     'avax-mainnet',
  59144:     'linea-mainnet',
  534352:    'scroll-mainnet',
  11155111:  'eth-sepolia',
  11155420:  'opt-sepolia',
  84532:     'base-sepolia',
  421614:    'arb-sepolia',
  534351:    'scroll-sepolia',
  43113:     'avax-fuji',
};

// Chains not supported by Alchemy — use official public RPCs as fallback.
const FALLBACK_RPCS = {
  250:   'https://rpcapi.fantom.network',             // Fantom
  1088:  'https://andromeda.metis.io/?owner=1088',    // Metis
  1868:  'https://rpc.soneium.org',                   // Soneium
  9745:  'https://rpc.plumenetwork.xyz',              // Plume
  34443: 'https://mainnet.mode.network',              // Mode
  57073: 'https://rpc-gel.inkonchain.com',            // Ink
  81457: 'https://rpc.blast.io',                      // Blast
};

function rpcUrl(chainId) {
  const sub = ALCHEMY_CHAINS[chainId];
  if (sub) return `https://${sub}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  return FALLBACK_RPCS[chainId] || null;
}

// ---------- metadata parsing ----------

function listJsonFiles(rootDir) {
  // Collect ALL JSON files under the metadata root — no validation gate.
  const out = [];
  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = resolve(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== '_backlog') {
        walk(full);
      } else if (e.isFile() && e.name.endsWith('.json') && e.name !== 'MANIFEST.json' && e.name !== 'selector-exclusions.json') {
        out.push(full);
      }
    }
  }
  walk(rootDir);
  return out.sort();
}

function normalizeContractBinding(chainId, address) {
  return {
    bindingType: 'contract',
    chainId: Number(chainId),
    address: String(address).toLowerCase(),
    requiresCode: true,
  };
}

function isConcreteAddress(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address);
}

function normalizeEip712Binding(eip712) {
  const domain = eip712?.domain || {};
  return {
    bindingType: 'eip712',
    chainId: domain.chainId ? Number(domain.chainId) : 0,
    address: isConcreteAddress(domain.verifyingContract) ? String(domain.verifyingContract).toLowerCase() : null,
    requiresCode: false,
    domain,
    primaryType: eip712?.primaryType || null,
  };
}

function computeEip712BindingHash(binding) {
  return keccak256(canonicalJsonBytes({
    kaisignBinding: 'eip712-domain-v1',
    chainId: binding.chainId,
    domain: binding.domain || {},
    primaryType: binding.primaryType || null,
  }));
}

function extractBindings(json) {
  const c = json?.context?.contract;
  if (c) {
    if (Array.isArray(c.deployments) && c.deployments.length) {
      return c.deployments
        .filter((d) => d?.chainId && isConcreteAddress(d?.address))
        .map((d) => normalizeContractBinding(d.chainId, d.address));
    }
    if (c.deployments && typeof c.deployments === 'object') {
      return Object.values(c.deployments)
        .filter((d) => d?.chainId && isConcreteAddress(d?.address))
        .map((d) => normalizeContractBinding(d.chainId, d.address));
    }
    if (c.chainId && isConcreteAddress(c.address)) {
      return [normalizeContractBinding(c.chainId, c.address)];
    }
  }

  const eip712 = json?.context?.eip712;
  if (eip712) {
    return [normalizeEip712Binding(eip712)];
  }

  return [];
}

function skippedBindingReason(json) {
  const c = json?.context?.contract;
  if (c) {
    if (c.address && !isConcreteAddress(c.address)) return `invalid contract address ${c.address}`;
    if (Array.isArray(c.deployments) && c.deployments.some((d) => d?.address && !isConcreteAddress(d.address))) {
      return 'invalid contract deployment address';
    }
    if (c.deployments && typeof c.deployments === 'object' && !Array.isArray(c.deployments)) {
      const values = Object.values(c.deployments);
      if (values.some((d) => d?.address && !isConcreteAddress(d.address))) return 'invalid contract deployment address';
    }
    return 'contract metadata has no concrete address/deployments';
  }

  if (json?.context?.eip712) return 'eip712 metadata has no binding';
  return 'not contract or eip712 clear-signing metadata';
}

function canonicalJsonBytes(obj) {
  // Sort keys recursively for a stable hash. Whitespace stripped.
  const sorted = (v) => {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sorted(v[k]);
      return out;
    }
    return v;
  };
  return ethers.toUtf8Bytes(JSON.stringify(sorted(obj)));
}

// ---------- extcodehash fetch ----------

let cache = {};
if (existsSync(CACHE_PATH)) {
  try { cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8')); } catch {}
}

function cacheKey(chainId, address) {
  return `${chainId}:${address}`;
}

async function fetchExtcodehash(chainId, address) {
  const key = cacheKey(chainId, address);
  if (cache[key]) return cache[key];

  const url = rpcUrl(chainId);
  if (!url) {
    throw new Error(`no RPC endpoint for chainId ${chainId}`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    }),
  });
  if (!res.ok) throw new Error(`eth_getCode ${chainId} ${address} -> HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`eth_getCode ${chainId} ${address} -> ${body.error.message}`);
  const code = body.result;
  if (!code || code === '0x') {
    throw new Error(`no code deployed at ${address} on chain ${chainId}`);
  }
  const hash = keccak256(code);
  cache[key] = hash;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  return hash;
}

// ---------- leaf + tree math ----------

function computeLeaf(chainId, extcodehash, metadataHash, revoked) {
  // abi.encode(LEAF_TYPEHASH, chainId, extcodehash, metadataHash, revoked)
  const encoded = coder.encode(
    ['bytes32', 'uint256', 'bytes32', 'bytes32', 'bool'],
    [LEAF_TYPEHASH, chainId, extcodehash, metadataHash, revoked]
  );
  return keccak256(encoded);
}

function computeFrontier(leaves) {
  // Mirrors src/KaiSignRegistry.sol::_insertLeaf and compute-frontier.mjs.
  // Internal nodes use keccak256(abi.encodePacked(left, right)) which is the raw concat.
  const ZERO = '0x' + '0'.repeat(64);
  const filledSubtrees = new Array(TREE_DEPTH).fill(ZERO);

  // Precompute zeros[i]
  const zeros = [ZERO];
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeros[i] = keccak256(concat([zeros[i - 1], zeros[i - 1]]));
  }

  let root = ZERO;

  for (let idx = 0; idx < leaves.length; idx++) {
    const leaf = leaves[idx];
    let pos = idx; // 0-based
    let currentHash = leaf;

    for (let i = 0; i < TREE_DEPTH; i++) {
      if (pos % 2 === 0) {
        filledSubtrees[i] = currentHash;
        currentHash = keccak256(concat([currentHash, zeros[i]]));
      } else {
        currentHash = keccak256(concat([filledSubtrees[i], currentHash]));
      }
      pos = Math.floor(pos / 2);
    }
    root = currentHash;
  }

  return { frontier: filledSubtrees, root };
}

// ---------- main ----------

async function main() {
  const candidates = listJsonFiles(METADATA_ROOT);
  console.log(`Scanning ${candidates.length} metadata files under ${METADATA_ROOT}`);

  const leaves = [];
  const leafMeta = [];
  const skipped = [];

  for (const path of candidates) {
    const raw = readFileSync(path, 'utf-8');
    let json;
    try { json = JSON.parse(raw); } catch (e) {
      skipped.push({ path, reason: 'invalid JSON' });
      continue;
    }

    const bindings = extractBindings(json);
    if (bindings.length === 0) {
      skipped.push({ path, reason: skippedBindingReason(json) });
      continue;
    }

    const metadataHash = keccak256(canonicalJsonBytes(json));

    for (const binding of bindings) {
      const { chainId, address, bindingType } = binding;
      if (binding.requiresCode && !rpcUrl(chainId)) {
        skipped.push({ path, chainId, address, reason: `unsupported chain ${chainId}` });
        continue;
      }

      let extcodehash;
      if (binding.bindingType === 'eip712') {
        extcodehash = computeEip712BindingHash(binding);
      } else {
        try {
          extcodehash = await fetchExtcodehash(chainId, address);
        } catch (e) {
          skipped.push({ path, chainId, address, reason: e.message });
          continue;
        }
      }

      // One availability leaf per (chainId, address, metadataHash). Order
      // matches the on-chain migrate() replay (sorted filesystem walk).
      const leafIndex = leaves.length;
      const leaf = computeLeaf(chainId, extcodehash, metadataHash, false);
      leaves.push(leaf);
      leafMeta.push({
        path: relative(METADATA_ROOT, path),
        bindingType,
        chainId,
        address,
        extcodehash,
        metadataHash,
        revoked: false,
        leafIndex,
        leaf,
      });

      if (leaves.length % 50 === 0) {
        console.log(`  [${leaves.length}] ${relative(METADATA_ROOT, path)} ${address || '(eip712 wildcard)'} chain=${chainId}`);
      }
    }
  }

  console.log(`\nAccepted ${leaves.length} leaves, skipped ${skipped.length} entries`);
  if (skipped.length) {
    const byReason = {};
    for (const s of skipped) {
      const k = s.reason.split(':')[0];
      byReason[k] = (byReason[k] || 0) + 1;
    }
    console.log('Skipped breakdown:', byReason);
  }

  const { frontier, root } = computeFrontier(leaves);

  console.log(`\n=== FRONTIER ===`);
  frontier.forEach((s, i) => console.log(`  [${i}] ${s}`));
  console.log(`\ncurrentIdx: ${leaves.length}`);
  console.log(`merkleRoot: ${root}`);

  // Ensure output dir exists
  const outDir = OUTPUT_PATH.substring(0, OUTPUT_PATH.lastIndexOf('/'));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        leafTypehash: LEAF_TYPEHASH,
        treeDepth: TREE_DEPTH,
        currentIdx: leaves.length,
        merkleRoot: root,
        frontier,
        leaves: leafMeta,
        skipped,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
}

export {
  canonicalJsonBytes,
  computeEip712BindingHash,
  computeFrontier,
  computeLeaf,
  extractBindings,
  isConcreteAddress,
};
