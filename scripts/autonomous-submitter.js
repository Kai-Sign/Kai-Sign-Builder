#!/usr/bin/env node
/**
 * Autonomous Metadata Submitter
 *
 * Submits ERC7730 metadata through the full lifecycle:
 * Prepare Blob → Commit → Send Blob TX → Reveal → Vote Valid on Reality.eth
 *
 * Matches deployed KaiSignRegistry v2.0.0 contract which uses:
 * - extcodehash (bytecode hash) instead of contract address
 * - commitment = keccak256(blobHash, nonce)
 * - commitSpec(bytes32 commitment, uint256 chainId, bytes32 extcodehash)
 * - revealSpec(bytes32 commitmentId, bytes32 blobHash, uint256 nonce, bytes32 metadataHash) payable
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/autonomous-submitter.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract ABIs - matches KaiSignRegistry v2.0.0
const KAISIGN_ABI = [
  {
    "inputs": [],
    "name": "minBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "commitment", "type": "bytes32"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"internalType": "bytes32", "name": "extcodehash", "type": "bytes32"}
    ],
    "name": "commitSpec",
    "outputs": [{"internalType": "bytes32", "name": "commitmentId", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"internalType": "uint256", "name": "nonce", "type": "uint256"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"}
    ],
    "name": "revealSpec",
    "outputs": [{"internalType": "bytes32", "name": "uid", "type": "bytes32"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "uid", "type": "bytes32"}],
    "name": "questionIds",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "committer", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"indexed": false, "internalType": "bytes32", "name": "extcodehash", "type": "bytes32"}
    ],
    "name": "LogCommitSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "creator", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "uid", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"indexed": false, "internalType": "bytes32", "name": "extcodehash", "type": "bytes32"}
    ],
    "name": "LogRevealSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "uid", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "bond", "type": "uint256"}
    ],
    "name": "QuestionCreated",
    "type": "event"
  }
];

const REALITY_ETH_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "question_id", "type": "bytes32"},
      {"internalType": "bytes32", "name": "answer", "type": "bytes32"},
      {"internalType": "uint256", "name": "max_previous", "type": "uint256"}
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
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

// Contract addresses
const CONTRACTS = {
  KAISIGN: '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa',  // KaiSignRegistry v2 deployed on Sepolia (0.001 ETH bond)
  REALITY_ETH: '0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA'
};

// Configuration
const CONFIG = {
  MIN_BOND: BigInt('100000000000000'), // 0.0001 ETH
  SEPOLIA_CHAIN_ID: 11155111,
  MIN_BLOB_DATA_SIZE: 24 * 1024,
  PADDING_MARKER: '\n\n/* ERC7730_BLOB_PADDING_START */\n'
};

// Chain RPC map for fetching extcodehash
const CHAIN_RPCS = {
  1: process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  8453: 'https://base-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  56: 'https://bsc-rpc.publicnode.com',
  100: 'https://gnosis-rpc.publicnode.com',
  59144: 'https://linea-rpc.publicnode.com',
  534352: 'https://scroll-rpc.publicnode.com',
  324: 'https://mainnet.era.zksync.io',
  250: 'https://rpcapi.fantom.network',
  81457: 'https://blast-rpc.publicnode.com',
  34443: 'https://mainnet.mode.network',
  1088: 'https://andromeda.metis.io/?owner=1088',
  57073: 'https://rpc-gel.inkonchain.com',
  9745: 'https://rpc.plasma.to',
  42220: 'https://celo-rpc.publicnode.com',
  146: 'https://sonic-rpc.publicnode.com',
  1868: 'https://soneium-rpc.publicnode.com',
  // Testnets
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://base-sepolia-rpc.publicnode.com',
  421614: 'https://arbitrum-sepolia-rpc.publicnode.com',
  43113: 'https://avalanche-fuji-c-chain-rpc.publicnode.com',
  11155420: 'https://optimism-sepolia-rpc.publicnode.com',
  534351: 'https://scroll-sepolia-rpc.publicnode.com',
};

// Cache for extcodehash lookups (address -> bytes32)
const extcodehashCache = new Map();

// Get extcodehash for a contract on a given chain
async function getExtcodehash(address, chainId) {
  const cacheKey = `${chainId}:${address.toLowerCase()}`;
  if (extcodehashCache.has(cacheKey)) {
    return extcodehashCache.get(cacheKey);
  }

  // Select RPC based on chainId
  const rpcUrl = CHAIN_RPCS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC configured for chain ${chainId}`);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(address);

  if (code === '0x') {
    throw new Error(`No code at ${address} on chain ${chainId} (EOA or empty)`);
  }

  const hash = ethers.keccak256(code);
  extcodehashCache.set(cacheKey, hash);
  return hash;
}

// Prepare blob data and compute versioned hash WITHOUT sending the transaction
async function prepareBlobData(jsonData) {
  await initKzg();

  const originalDataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(originalDataStr));

  const { paddedData, wasPadded } = addPaddingIfNeeded(originalDataStr);

  const blob = toBlob(paddedData);
  const commitment = cKzg.blobToKzgCommitment(blob);
  const proof = cKzg.computeBlobKzgProof(blob, commitment);
  const isValid = cKzg.verifyBlobKzgProof(blob, commitment, proof);

  if (!isValid) {
    throw new Error('Invalid KZG proof');
  }

  const commitmentHash = ethers.sha256(commitment);
  const versionedHash = '0x01' + commitmentHash.substring(4);

  return { blob, commitment, proof, versionedHash, metadataHash, originalDataStr, wasPadded };
}

// Dynamically load all metadata files from backend/metadata directory
function getAllMetadataFiles() {
  const metadataDir = path.join(__dirname, '..', 'backend', 'metadata');
  const files = [];

  function walkDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(metadataDir);
  return files;
}

const METADATA_FILES = getAllMetadataFiles();
// Set to a chain ID to filter, or null to process all chains
const TARGET_CHAIN_ID = null;
const STATE_FILE = path.join(__dirname, 'submission-state.json');
const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
// PublicNode RPC required for blob transactions (Alchemy doesn't support EIP-4844 properly)
const BLOB_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

let cKzg = null;
let submissionStates = [];
let blobProvider = null;
let blobSigner = null;

// Initialize KZG
async function initKzg() {
  if (cKzg) return;
  try {
    const createRequire = (await import('module')).createRequire;
    const require = createRequire(import.meta.url);
    cKzg = require('c-kzg');
    try {
      cKzg.loadTrustedSetup(0, cKzg.DEFAULT_TRUSTED_SETUP_PATH);
    } catch {}
    console.log('  KZG library initialized');
  } catch (error) {
    throw new Error('c-kzg library not available. Run: npm install c-kzg');
  }
}

// Convert data to blob format
function toBlob(data) {
  const BLOB_SIZE = 131072;
  const blob = new Uint8Array(BLOB_SIZE);
  const bytes = Buffer.from(data);

  let blobIndex = 0;
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;
    if (fieldIndex >= 4096) break;
    blob[fieldIndex * 32 + byteIndex + 1] = bytes[i] ?? 0;
    blobIndex++;
  }
  return blob;
}

// Add padding for cost efficiency
function addPaddingIfNeeded(data) {
  if (data.length >= CONFIG.MIN_BLOB_DATA_SIZE) {
    return { paddedData: data, wasPadded: false };
  }
  const paddingNeeded = CONFIG.MIN_BLOB_DATA_SIZE - data.length - CONFIG.PADDING_MARKER.length;
  if (paddingNeeded <= 0) {
    return { paddedData: data, wasPadded: false };
  }
  return {
    paddedData: data + CONFIG.PADDING_MARKER + '0'.repeat(paddingNeeded),
    wasPadded: true
  };
}

// Send a pre-prepared blob transaction
async function sendBlobTransaction(preparedBlob) {
  try {
    if (!blobSigner) {
      throw new Error('Blob signer not initialized');
    }

    console.log(`  Using BLOB_RPC: ${BLOB_RPC}`);

    const nonce = await blobSigner.getNonce();
    const latest = await blobProvider.getBlock('latest');
    const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits('1', 'gwei');

    const tx = {
      type: 3,
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: 0n,
      chainId: CONFIG.SEPOLIA_CHAIN_ID,
      nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      maxFeePerGas: baseFee * 2n + ethers.parseUnits('2', 'gwei'),
      maxFeePerBlobGas: ethers.parseUnits('30', 'gwei'),
      blobVersionedHashes: [preparedBlob.versionedHash],
      kzg: cKzg,
      blobs: [preparedBlob.blob]
    };

    console.log('  Sending blob transaction via PublicNode...');
    const response = await blobSigner.sendTransaction(tx);
    console.log(`  Blob TX: ${response.hash}`);

    const receipt = await response.wait();
    console.log(`  Blob confirmed in block ${receipt?.blockNumber}`);

    return {
      success: true,
      txHash: response.hash,
      blockNumber: receipt?.blockNumber
    };
  } catch (error) {
    console.error(`  Blob send failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Generate random nonce
function generateNonce() {
  const bytes = crypto.randomBytes(32);
  return BigInt('0x' + bytes.toString('hex'));
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load/save state
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

// Load contract metadata from direct file paths
function loadContractMetadata(metadataFiles) {
  console.log(`Loading ${metadataFiles.length} metadata files`);

  const results = [];
  for (const fullPath of metadataFiles) {
    const relativePath = path.basename(fullPath);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const deployments = [];

      // Support format 1: deployments object (multiple networks)
      if (data.context?.contract?.deployments) {
        for (const [network, deployment] of Object.entries(data.context.contract.deployments)) {
          if (deployment.address && deployment.chainId) {
            // Normalize address to proper checksum format
            try {
              const normalizedAddress = ethers.getAddress(deployment.address);
              deployments.push({ network, address: normalizedAddress, chainId: deployment.chainId });
            } catch (addrError) {
              console.log(`  Skipping invalid address ${deployment.address} in ${relativePath}: ${addrError.message}`);
            }
          }
        }
      }
      // Support format 2: direct address and chainId (single deployment)
      else if (data.context?.contract?.address && data.context?.contract?.chainId) {
        try {
          const normalizedAddress = ethers.getAddress(data.context.contract.address);
          const chainId = data.context.contract.chainId;
          const network = chainId === 1 ? 'mainnet' : `chain_${chainId}`;
          deployments.push({ network, address: normalizedAddress, chainId });
        } catch (addrError) {
          console.log(`  Skipping invalid address ${data.context.contract.address} in ${relativePath}: ${addrError.message}`);
        }
      }
      if (deployments.length > 0) {
        results.push({ filePath: fullPath, relativePath, data, deployments });
        console.log(`  Loaded ${relativePath}: ${deployments.length} deployments`);
      }
    } catch (error) {
      console.error(`  Error loading ${relativePath}: ${error.message}`);
    }
  }
  return results;
}

// Process single metadata
// Flow: Prepare Blob → Get extcodehash → Commit → Send Blob TX → Reveal → Vote
async function processMetadata(metadataPath, relativePath, metadata, targetContract, chainId, kaisign, realityEth, signer, provider, minBond) {
  const state = {
    metadataFile: relativePath,
    metadataPath,
    targetContract,
    chainId,
    extcodehash: '',
    metadataHash: '',
    nonce: '',
    commitmentId: '',
    commitTxHash: '',
    blobHash: '',
    blobTxHash: '',
    uid: '',
    questionId: '',
    revealTxHash: '',
    voteTxHash: '',
    status: 'pending',
    timestamp: Date.now()
  };

  try {
    // Step 0: Prepare blob data and get extcodehash (before committing)
    console.log(`\n  Step 0: PREPARE`);

    // Get extcodehash from mainnet
    console.log(`  Fetching extcodehash for ${targetContract} on chain ${chainId}...`);
    const extcodehash = await getExtcodehash(targetContract, chainId);
    state.extcodehash = extcodehash;
    console.log(`  extcodehash: ${extcodehash}`);

    // Prepare blob data to get the versioned hash
    console.log(`  Preparing blob data...`);
    const preparedBlob = await prepareBlobData(metadata);
    state.metadataHash = preparedBlob.metadataHash;
    state.blobHash = preparedBlob.versionedHash;
    console.log(`  Blob versioned hash: ${preparedBlob.versionedHash}`);
    console.log(`  Metadata hash: ${preparedBlob.metadataHash}`);
    if (preparedBlob.wasPadded) {
      console.log(`  Data was padded to minimum blob size`);
    }

    // Generate nonce
    const nonce = generateNonce();
    state.nonce = nonce.toString();

    // Commitment = keccak256(abi.encodePacked(blobHash, nonce))
    const commitment = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'uint256'], [preparedBlob.versionedHash, nonce])
    );
    console.log(`  Commitment: ${commitment}`);

    // Step 1: Commit
    console.log(`\n  Step 1: COMMIT`);
    state.status = 'committing';
    saveState([...submissionStates, state]);

    const commitTx = await kaisign.commitSpec(commitment, chainId, extcodehash);
    console.log(`  Commit TX: ${commitTx.hash}`);

    const commitReceipt = await commitTx.wait();
    console.log(`  Commit confirmed in block ${commitReceipt.blockNumber}`);

    // Parse commitment ID from event
    const commitEvent = commitReceipt.logs.find(log => {
      try {
        const parsed = kaisign.interface.parseLog(log);
        return parsed?.name === 'LogCommitSpec';
      } catch { return false; }
    });

    if (!commitEvent) throw new Error('LogCommitSpec event not found');
    const parsedCommit = kaisign.interface.parseLog(commitEvent);
    const commitmentId = parsedCommit?.args?.commitmentId || parsedCommit?.args?.[1];

    state.commitmentId = commitmentId;
    state.commitTxHash = commitTx.hash;
    state.status = 'committed';
    saveState([...submissionStates, state]);

    await sleep(3000);

    // Step 2: Send Blob TX
    console.log(`\n  Step 2: SEND BLOB TX`);
    state.status = 'uploading_blob';
    saveState([...submissionStates, state]);

    const blobResult = await sendBlobTransaction(preparedBlob);
    if (!blobResult.success) throw new Error(`Blob send failed: ${blobResult.error}`);

    state.blobTxHash = blobResult.txHash;
    state.status = 'blob_uploaded';
    saveState([...submissionStates, state]);

    console.log(`  Blobscan: https://sepolia.blobscan.com/blob/${preparedBlob.versionedHash}`);

    await sleep(3000);

    // Step 3: Reveal (also creates Reality.eth question and pays bond)
    console.log(`\n  Step 3: REVEAL`);
    state.status = 'revealing';
    saveState([...submissionStates, state]);

    const revealTx = await kaisign.revealSpec(
      state.commitmentId,
      preparedBlob.versionedHash,
      nonce,
      preparedBlob.metadataHash,
      { value: minBond }
    );
    console.log(`  Reveal TX: ${revealTx.hash}`);

    const revealReceipt = await revealTx.wait();
    console.log(`  Reveal confirmed in block ${revealReceipt.blockNumber}`);

    // Parse events from reveal receipt
    let uid = '';
    let questionId = '';
    for (const log of revealReceipt.logs) {
      try {
        const parsed = kaisign.interface.parseLog(log);
        if (parsed?.name === 'LogRevealSpec') {
          uid = parsed.args?.uid || parsed.args?.[1];
        }
        if (parsed?.name === 'QuestionCreated') {
          questionId = parsed.args?.questionId || parsed.args?.[1];
        }
      } catch {}
    }

    // If QuestionCreated wasn't caught (different interface), read from contract
    if (!questionId && uid) {
      try {
        questionId = await kaisign.questionIds(uid);
      } catch {}
    }

    state.uid = uid;
    state.questionId = questionId;
    state.revealTxHash = revealTx.hash;
    state.status = questionId && questionId !== ethers.ZeroHash ? 'proposed' : 'revealed';
    saveState([...submissionStates, state]);

    console.log(`  UID: ${uid}`);
    console.log(`  QuestionId: ${questionId || 'Not created yet'}`);

    // Notify backend to update hash index
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/py/metadata/hash/update`, {
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

      if (response.ok) {
        console.log(`  ✅ Backend hash index updated`);
      } else {
        console.log(`  ⚠️  Backend update failed (non-critical): ${response.statusText}`);
      }
    } catch (error) {
      console.log(`  ⚠️  Could not notify backend: ${error.message}`);
    }

    // Step 4: Vote (if question exists)
    if (questionId && questionId !== ethers.ZeroHash) {
      await sleep(5000);
      console.log(`\n  Step 4: VOTE VALID`);
      state.status = 'voting';
      saveState([...submissionStates, state]);

      // Get current bond
      const currentBond = await realityEth.getBond(questionId);
      const question = await realityEth.questions(questionId);

      let newBond;
      if (currentBond === 0n) {
        newBond = question.min_bond || CONFIG.MIN_BOND;
      } else {
        newBond = currentBond * 2n;
      }

      console.log(`  Current bond: ${ethers.formatEther(currentBond)} ETH`);
      console.log(`  New bond: ${ethers.formatEther(newBond)} ETH`);

      const validAnswer = ethers.zeroPadValue(ethers.toBeHex(1), 32);
      const voteTx = await realityEth.submitAnswer(questionId, validAnswer, currentBond, { value: newBond });
      console.log(`  Vote TX: ${voteTx.hash}`);

      // Retry logic for getting receipt (RPC can be flaky)
      let voteReceipt = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          voteReceipt = await voteTx.wait();
          break;
        } catch (waitError) {
          if (attempt < 4) {
            console.log(`  Receipt fetch failed, retrying (${attempt + 1}/5)...`);
            await sleep(3000);
          } else {
            console.log(`  Could not get receipt, but TX was sent: ${voteTx.hash}`);
            voteReceipt = { blockNumber: 'unknown' };
          }
        }
      }
      console.log(`  Vote confirmed in block ${voteReceipt.blockNumber}`);

      state.voteTxHash = voteTx.hash;
      state.status = 'voted';
      saveState([...submissionStates, state]);
    }

    state.status = 'completed';
    console.log(`\n  Status: SUCCESS`);

  } catch (error) {
    state.status = 'error';
    state.error = error.message;
    console.error(`\n  Status: ERROR - ${error.message}`);
  }

  return state;
}

// Print summary
function printSummary(states) {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const completed = states.filter(s => s.status === 'completed').length;
  const voted = states.filter(s => s.status === 'voted').length;
  const finalized = states.filter(s => s.status === 'finalized').length;
  const errors = states.filter(s => s.status === 'error').length;
  const pending = states.filter(s => !['completed', 'voted', 'finalized', 'error'].includes(s.status)).length;

  console.log(`Total processed: ${states.length}`);
  console.log(`  Voted (awaiting finalization): ${voted}`);
  console.log(`  Completed (voted): ${completed}`);
  console.log(`  Finalized: ${finalized}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Pending: ${pending}`);

  if (errors > 0) {
    console.log('\nErrors:');
    for (const state of states.filter(s => s.status === 'error')) {
      console.log(`  ${state.metadataFile}: ${state.error}`);
    }
  }

  console.log('\nAll submissions saved to:', STATE_FILE);
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('AUTONOMOUS METADATA SUBMITTER');
  console.log('='.repeat(60));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable not set');
    console.log('Usage: PRIVATE_KEY=0x... node scripts/autonomous-submitter.js');
    process.exit(1);
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC;
  console.log(`\nSepolia RPC: ${rpcUrl}`);
  console.log(`Chain RPCs configured: ${Object.keys(CHAIN_RPCS).length} chains`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`Signer: ${signerAddress}`);

  const balance = await provider.getBalance(signerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Initialize contracts
  const kaisign = new ethers.Contract(CONTRACTS.KAISIGN, KAISIGN_ABI, signer);
  const realityEth = new ethers.Contract(CONTRACTS.REALITY_ETH, REALITY_ETH_ABI, signer);

  // Initialize blob-specific provider
  console.log(`Blob RPC: ${BLOB_RPC}`);
  blobProvider = new ethers.JsonRpcProvider(BLOB_RPC);
  blobSigner = new ethers.Wallet(privateKey, blobProvider);
  console.log(`Blob signer initialized on PublicNode`);

  if (balance < ethers.parseEther('0.05')) {
    console.warn('\nWARNING: Balance is low. You may need more ETH for all submissions.');
  }

  const minBond = await kaisign.minBond();
  console.log(`Min bond: ${ethers.formatEther(minBond)} ETH`);

  submissionStates = loadState();

  console.log(`\nLoading metadata files...`);
  const metadataFiles = loadContractMetadata(METADATA_FILES);
  console.log(`Found ${metadataFiles.length} contract files with deployments`);

  let totalDeployments = 0;
  for (const file of metadataFiles) {
    totalDeployments += file.deployments.length;
  }
  console.log(`Total deployments to process: ${totalDeployments}`);

  let processed = 0;
  for (const file of metadataFiles) {
    for (const deployment of file.deployments) {
      // Filter by target chain ID if set
      if (TARGET_CHAIN_ID && deployment.chainId !== TARGET_CHAIN_ID) {
        console.log(`\nSKIP: ${file.relativePath} (chain ${deployment.chainId}) - Not target chain ${TARGET_CHAIN_ID}`);
        continue;
      }

      processed++;

      // Skip already-completed submissions
      const existing = submissionStates.find(
        s => s.metadataFile === file.relativePath &&
             s.chainId === deployment.chainId &&
             s.targetContract?.toLowerCase() === deployment.address.toLowerCase() &&
             s.status === 'completed'
      );

      if (existing) {
        console.log(`\n[${processed}] SKIP: ${file.relativePath} (chain ${deployment.chainId}) - Already completed`);
        continue;
      }

      console.log(`\n[${processed}] ${file.relativePath}`);
      console.log(`  Target: ${deployment.address} on chain ${deployment.chainId} (${deployment.network})`);

      const state = await processMetadata(
        file.filePath,
        file.relativePath,
        file.data,
        deployment.address,
        deployment.chainId,
        kaisign,
        realityEth,
        signer,
        provider,
        minBond
      );

      const existingIndex = submissionStates.findIndex(
        s => s.metadataFile === file.relativePath && s.chainId === deployment.chainId
      );
      if (existingIndex >= 0) {
        submissionStates[existingIndex] = state;
      } else {
        submissionStates.push(state);
      }
      saveState(submissionStates);

      if (processed < totalDeployments) {
        console.log('\n  Waiting 10 seconds before next submission...');
        await sleep(10000);
      }
    }
  }

  printSummary(submissionStates);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
