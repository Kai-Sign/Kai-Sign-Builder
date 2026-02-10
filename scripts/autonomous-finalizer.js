#!/usr/bin/env node
/**
 * Autonomous Finalizer
 *
 * Finalizes specs on KaiSignRegistry v2 after Reality.eth questions resolve:
 * - Check isFinalized(questionId) on Reality.eth
 * - Get resultFor(questionId) → approved (1) or rejected (0)
 * - Approved: compute merkle leaf + proof, call finalize(uid, newRoot, proof)
 * - Rejected: call finalize(uid, 0x0, [])
 * - Update submission-state.json with finalizeTxHash and new status
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/autonomous-finalizer.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Contract ABIs ───────────────────────────────────────────────────────────

const KAISIGN_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "uid", "type": "bytes32"},
      {"internalType": "bytes32", "name": "newMerkleRoot", "type": "bytes32"},
      {"internalType": "bytes32[]", "name": "merkleProof", "type": "bytes32[]"}
    ],
    "name": "finalize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
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
  },
  {
    "inputs": [],
    "name": "currentIdx",
    "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "merkleRoot",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "uid", "type": "bytes32"}],
    "name": "questionIds",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const REALITY_ETH_ABI = [
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "isFinalized",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "resultFor",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "questions",
    "outputs": [
      {"internalType": "bytes32", "name": "content_hash", "type": "bytes32"},
      {"internalType": "address", "name": "arbitrator", "type": "address"},
      {"internalType": "uint32", "name": "opening_ts", "type": "uint32"},
      {"internalType": "uint32", "name": "timeout", "type": "uint32"},
      {"internalType": "uint32", "name": "finalize_ts", "type": "uint32"},
      {"internalType": "bool", "name": "is_pending_arbitration", "type": "bool"},
      {"internalType": "uint256", "name": "bounty", "type": "uint256"},
      {"internalType": "bytes32", "name": "best_answer", "type": "bytes32"},
      {"internalType": "bytes32", "name": "history_hash", "type": "bytes32"},
      {"internalType": "uint256", "name": "bond", "type": "uint256"},
      {"internalType": "uint256", "name": "min_bond", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ─── Contract addresses ──────────────────────────────────────────────────────

const CONTRACTS = {
  KAISIGN: process.env.KAISIGN_ADDRESS || '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa',  // KaiSignRegistry v2 on Sepolia
  REALITY_ETH: process.env.REALITY_ETH_ADDRESS || '0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA'
};

// ─── Leaf typehash (matches KaiSignRegistry.sol line ~462) ───────────────────

const LEAF_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,uint256 idx,bool revoked)')
);

// ─── Configuration ───────────────────────────────────────────────────────────

const STATE_FILE = path.join(__dirname, 'submission-state.json');
const MERKLE_FILE = path.join(__dirname, 'merkle-state.json');
const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// Reality.eth answer constants
const ANSWER_YES = ethers.zeroPadValue(ethers.toBeHex(1), 32); // approved
const ANSWER_INVALID = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// ─── Append-Only Merkle Tree (position-based, NOT sorted pairs) ──────────────

class AppendOnlyMerkleTree {
  constructor() {
    this.leaves = [];
  }

  append(leaf) {
    this.leaves.push(leaf);
  }

  pop() {
    return this.leaves.pop();
  }

  get size() {
    return this.leaves.length;
  }

  getRoot() {
    if (this.leaves.length === 0) return ethers.ZeroHash;

    // Pad to next power of 2
    const n = nextPow2(this.leaves.length);
    const padded = [...this.leaves];
    while (padded.length < n) {
      padded.push(ethers.ZeroHash);
    }

    // Build tree bottom-up
    let layer = padded;
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(hashPair(layer[i], layer[i + 1]));
      }
      layer = next;
    }
    return layer[0];
  }

  getProof(index) {
    if (index < 0 || index >= this.leaves.length) {
      throw new Error(`Index ${index} out of bounds (${this.leaves.length} leaves)`);
    }

    const n = nextPow2(this.leaves.length);
    const padded = [...this.leaves];
    while (padded.length < n) {
      padded.push(ethers.ZeroHash);
    }

    const proof = [];
    let layer = padded;
    let pos = index;

    while (layer.length > 1) {
      // Sibling is the other node in the pair
      const sibling = (pos % 2 === 0) ? pos + 1 : pos - 1;
      proof.push(layer[sibling]);

      // Build next layer
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(hashPair(layer[i], layer[i + 1]));
      }
      layer = next;
      pos = Math.floor(pos / 2);
    }

    return proof;
  }
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// keccak256(abi.encodePacked(left, right)) — just concatenation of two bytes32
function hashPair(left, right) {
  return ethers.keccak256(ethers.concat([left, right]));
}

// ─── Leaf computation (matches KaiSignRegistry.sol) ──────────────────────────

function computeLeaf(chainId, extcodehash, metadataHash, idx, revoked) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
      [LEAF_TYPEHASH, chainId, extcodehash, metadataHash, idx, revoked]
    )
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveState(states) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(states, null, 2));
}

function loadMerkleState() {
  try {
    if (fs.existsSync(MERKLE_FILE)) {
      return JSON.parse(fs.readFileSync(MERKLE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveMerkleState(leaves, root, currentIdx) {
  fs.writeFileSync(MERKLE_FILE, JSON.stringify({ leaves, root, currentIdx }, null, 2));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('AUTONOMOUS FINALIZER');
  console.log('='.repeat(60));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable not set');
    console.log('Usage: PRIVATE_KEY=0x... node scripts/autonomous-finalizer.js');
    process.exit(1);
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC;
  console.log(`\nSepolia RPC: ${rpcUrl}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`Signer: ${signerAddress}`);

  const balance = await provider.getBalance(signerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.01')) {
    console.warn('\nWARNING: Balance is low. You may need more ETH for finalization transactions.');
  }

  // Initialize contracts
  console.log(`KaiSign Registry: ${CONTRACTS.KAISIGN}`);
  console.log(`Reality.eth:      ${CONTRACTS.REALITY_ETH}`);
  const kaisign = new ethers.Contract(CONTRACTS.KAISIGN, KAISIGN_ABI, signer);
  const realityEth = new ethers.Contract(CONTRACTS.REALITY_ETH, REALITY_ETH_ABI, signer);

  // Load state
  const states = loadState();
  console.log(`\nLoaded ${states.length} total entries from state file`);

  // Filter to specs ready for finalization
  const candidates = states.filter(
    s => s.status === 'completed' && s.uid && s.questionId
  );
  console.log(`Found ${candidates.length} completed specs with uid + questionId`);

  if (candidates.length === 0) {
    console.log('Nothing to finalize.');
    return;
  }

  // ── Step 1: Load or reconstruct merkle tree ────────────────────────────────

  console.log('\n' + '-'.repeat(60));
  console.log('LOADING MERKLE TREE');
  console.log('-'.repeat(60));

  const onChainIdx = Number(await kaisign.currentIdx());
  const onChainRoot = await kaisign.merkleRoot();
  console.log(`On-chain currentIdx: ${onChainIdx}`);
  console.log(`On-chain merkleRoot: ${onChainRoot}`);

  const tree = new AppendOnlyMerkleTree();
  let treeLoaded = false;

  // Try loading from local cache first
  const cached = loadMerkleState();
  if (cached && cached.currentIdx === onChainIdx && cached.root === onChainRoot) {
    console.log(`\nLoaded ${cached.leaves.length} leaves from ${MERKLE_FILE}`);
    for (const leaf of cached.leaves) {
      tree.append(leaf);
    }
    const localRoot = tree.getRoot();
    if (localRoot === onChainRoot) {
      console.log('Local merkle root matches on-chain ✓');
      treeLoaded = true;
    } else {
      console.log('Local cache root mismatch — rebuilding from on-chain...');
      tree.leaves = [];
    }
  }

  // Fall back to on-chain reconstruction
  if (!treeLoaded && onChainIdx > 0) {
    console.log(`\nReconstructing tree from on-chain attestations...`);

    const finalizedEntries = [];
    for (const entry of states) {
      if (!entry.uid) continue;
      try {
        const att = await kaisign.getAttestation(entry.uid);
        if (Number(att.finalizedAt) > 0 && Number(att.idx) > 0) {
          finalizedEntries.push({
            idx: Number(att.idx),
            chainId: att.chainId,
            extcodehash: att.extcodehash,
            metadataHash: att.metadataHash,
            revoked: att.revoked,
          });
        }
      } catch (err) {
        console.log(`  Warning: could not read attestation for uid ${entry.uid}: ${err.message}`);
      }
    }

    // Sort by idx to rebuild tree in correct order
    finalizedEntries.sort((a, b) => a.idx - b.idx);
    console.log(`Found ${finalizedEntries.length} finalized attestations on-chain`);

    if (finalizedEntries.length !== onChainIdx) {
      console.error(`ERROR: Found ${finalizedEntries.length} finalized entries but currentIdx is ${onChainIdx}`);
      console.error('State file may be incomplete. Cannot safely reconstruct tree.');
      process.exit(1);
    }

    // Rebuild tree
    for (const entry of finalizedEntries) {
      const leaf = computeLeaf(
        entry.chainId,
        entry.extcodehash,
        entry.metadataHash,
        entry.idx,
        entry.revoked
      );
      tree.append(leaf);
    }

    const computedRoot = tree.getRoot();
    console.log(`Computed merkle root: ${computedRoot}`);

    if (computedRoot !== onChainRoot) {
      console.error(`ERROR: Computed root does not match on-chain root!`);
      console.error(`  Computed: ${computedRoot}`);
      console.error(`  On-chain: ${onChainRoot}`);
      process.exit(1);
    }
    console.log('Merkle root verified ✓');

    // Save to local cache
    saveMerkleState(tree.leaves, computedRoot, onChainIdx);
    console.log(`Saved merkle state to ${MERKLE_FILE}`);
  } else if (!treeLoaded) {
    console.log('No existing finalized specs. Starting with empty tree.');
    saveMerkleState([], ethers.ZeroHash, 0);
  }

  let localIdx = onChainIdx;

  // ── Step 2: Check Reality.eth finalization status ─────────────────────────

  console.log('\n' + '-'.repeat(60));
  console.log('CHECKING REALITY.ETH FINALIZATION STATUS');
  console.log('-'.repeat(60));

  const approved = [];
  const rejected = [];
  const notReady = [];
  const invalid = [];
  const alreadyFinalized = [];

  // Batch check in parallel (20 at a time to avoid RPC rate limits)
  const BATCH_SIZE = 20;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (entry) => {
      // Check if already finalized on-chain (skip if so)
      const att = await kaisign.getAttestation(entry.uid);
      if (Number(att.finalizedAt) > 0) return { entry, category: 'alreadyFinalized' };

      const finalized = await realityEth.isFinalized(entry.questionId);
      if (!finalized) return { entry, category: 'notReady' };

      const result = await realityEth.resultFor(entry.questionId);
      if (result === ANSWER_YES) return { entry, category: 'approved' };
      if (result === ANSWER_INVALID) return { entry, category: 'invalid' };
      return { entry, category: 'rejected' };
    }));

    for (const r of results) {
      if (r.status === 'rejected') {
        notReady.push(batch[results.indexOf(r)]);
        continue;
      }
      const { entry, category } = r.value;
      if (category === 'approved') approved.push(entry);
      else if (category === 'rejected') rejected.push(entry);
      else if (category === 'alreadyFinalized') alreadyFinalized.push(entry);
      else if (category === 'invalid') invalid.push(entry);
      else notReady.push(entry);
    }

    if (i + BATCH_SIZE < candidates.length) {
      process.stdout.write(`  Checked ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}...\r`);
    }
  }
  console.log(`  Checked ${candidates.length}/${candidates.length} specs`);

  console.log(`\nFinalization status:`);
  console.log(`  Approved (to finalize with merkle): ${approved.length}`);
  console.log(`  Rejected (to finalize as revoked):  ${rejected.length}`);
  console.log(`  Already finalized on-chain:         ${alreadyFinalized.length}`);
  console.log(`  Invalid answer:                     ${invalid.length}`);
  console.log(`  Not yet finalized:                  ${notReady.length}`);

  const toProcess = [...rejected, ...approved]; // rejected first (no tree changes)

  if (toProcess.length === 0) {
    console.log('\nNo specs ready for finalization yet.');
    printSummary(states);
    return;
  }

  // ── Step 3: Process rejected specs first ──────────────────────────────────

  console.log('\n' + '-'.repeat(60));
  console.log('PROCESSING FINALIZATIONS');
  console.log('-'.repeat(60));

  let finalizedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (const entry of rejected) {
    console.log(`\n[REJECTED] ${entry.metadataFile} (chain ${entry.chainId})`);
    console.log(`  UID: ${entry.uid}`);

    try {
      const tx = await kaisign.finalize(entry.uid, ethers.ZeroHash, []);
      console.log(`  Finalize TX: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`  Confirmed in block ${receipt.blockNumber}`);

      entry.finalizeTxHash = tx.hash;
      entry.finalizeResult = 'rejected';
      entry.status = 'rejected';
      rejectedCount++;
      saveState(states);

      await sleep(3000);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      errorCount++;
      // Don't update state on failure
    }
  }

  // ── Step 4: Process approved specs sequentially (each changes merkle root) ─

  for (const entry of approved) {
    console.log(`\n[APPROVED] ${entry.metadataFile} (chain ${entry.chainId})`);
    console.log(`  UID: ${entry.uid}`);

    try {
      // Expected idx for this spec
      const expectedIdx = localIdx + 1;

      // Compute leaf
      const leaf = computeLeaf(
        entry.chainId,
        entry.extcodehash,
        entry.metadataHash,
        expectedIdx,
        false // not revoked
      );

      // Append to tree and compute new root + proof
      tree.append(leaf);
      const newRoot = tree.getRoot();
      const leafIndex = tree.size - 1;
      const proof = tree.getProof(leafIndex);

      console.log(`  Expected idx: ${expectedIdx}`);
      console.log(`  Leaf: ${leaf}`);
      console.log(`  New root: ${newRoot}`);
      console.log(`  Proof length: ${proof.length}`);

      const tx = await kaisign.finalize(entry.uid, newRoot, proof);
      console.log(`  Finalize TX: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`  Confirmed in block ${receipt.blockNumber}`);

      entry.finalizeTxHash = tx.hash;
      entry.finalizeResult = 'accepted';
      entry.status = 'finalized';
      localIdx = expectedIdx;
      finalizedCount++;
      saveState(states);
      saveMerkleState(tree.leaves, newRoot, localIdx);

      await sleep(3000);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      // Rollback tree state
      tree.pop();
      console.log('  Tree state rolled back. Stopping approved processing.');
      errorCount++;
      break; // Stop on first error since tree state may be inconsistent
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n' + '-'.repeat(60));
  console.log('FINALIZATION RESULTS');
  console.log('-'.repeat(60));
  console.log(`  Approved & finalized: ${finalizedCount}`);
  console.log(`  Rejected & finalized: ${rejectedCount}`);
  console.log(`  Not ready:            ${notReady.length}`);
  console.log(`  Invalid answers:      ${invalid.length}`);
  console.log(`  Errors:               ${errorCount}`);

  if (finalizedCount > 0) {
    const newOnChainRoot = await kaisign.merkleRoot();
    console.log(`\n  Final on-chain merkle root: ${newOnChainRoot}`);
    console.log(`  Local computed root:        ${tree.getRoot()}`);
    if (newOnChainRoot === tree.getRoot()) {
      console.log('  Roots match ✓');
    } else {
      console.log('  WARNING: Roots do not match!');
    }
  }

  printSummary(states);
}

function printSummary(states) {
  console.log('\n' + '='.repeat(60));
  console.log('OVERALL STATE SUMMARY');
  console.log('='.repeat(60));

  const completed = states.filter(s => s.status === 'completed').length;
  const finalized = states.filter(s => s.status === 'finalized').length;
  const rejectedSpecs = states.filter(s => s.status === 'rejected').length;
  const errors = states.filter(s => s.status === 'error').length;
  const other = states.length - completed - finalized - rejectedSpecs - errors;

  console.log(`Total entries: ${states.length}`);
  console.log(`  Completed (awaiting finalization): ${completed}`);
  console.log(`  Finalized (approved):              ${finalized}`);
  console.log(`  Rejected:                          ${rejectedSpecs}`);
  console.log(`  Errors:                            ${errors}`);
  console.log(`  Other:                             ${other}`);
  console.log('\nState saved to:', STATE_FILE);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
