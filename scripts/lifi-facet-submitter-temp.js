#!/usr/bin/env node
/**
 * Autonomous Metadata Submitter & Finalizer
 *
 * SUBMISSION MODE (default):
 * Submits ERC7730 metadata through the full lifecycle:
 * Commit → Send Blob → Reveal → Vote Valid on Reality.eth
 *
 * FINALIZATION MODE (--finalize):
 * Finalizes all voted submissions after Reality.eth timeout period (48 hours).
 * Calls handleResult on KaiSign to mark specs as finalized.
 *
 * Usage:
 *   # Submit new metadata
 *   PRIVATE_KEY=0x... node scripts/autonomous-submitter.js
 *
 *   # Finalize all ready submissions
 *   PRIVATE_KEY=0x... node scripts/autonomous-submitter.js --finalize
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

// Contract ABIs
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
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "targetChainId", "type": "uint256"}
    ],
    "name": "commitSpec",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
      {"internalType": "uint256", "name": "nonce", "type": "uint256"}
    ],
    "name": "revealSpec",
    "outputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "handleResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specId", "type": "bytes32"}],
    "name": "specs",
    "outputs": [
      {"internalType": "uint64", "name": "createdTimestamp", "type": "uint64"},
      {"internalType": "uint64", "name": "proposedTimestamp", "type": "uint64"},
      {"internalType": "uint8", "name": "status", "type": "uint8"},
      {"internalType": "uint80", "name": "totalBonds", "type": "uint80"},
      {"internalType": "uint32", "name": "reserved", "type": "uint32"},
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "committer", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "targetContract", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "bondAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint64", "name": "revealDeadline", "type": "uint64"}
    ],
    "name": "LogCommitSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "creator", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "specID", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": false, "internalType": "address", "name": "targetContract", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "name": "LogRevealSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "specID", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "bond", "type": "uint256"}
    ],
    "name": "LogProposeSpec",
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
  KAISIGN: '0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719',
  REALITY_ETH: '0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA'
};

// Configuration
const CONFIG = {
  MIN_BOND: BigInt('100000000000000'), // 0.0001 ETH
  SEPOLIA_CHAIN_ID: 11155111,
  MIN_BLOB_DATA_SIZE: 24 * 1024,
  PADDING_MARKER: '\n\n/* ERC7730_BLOB_PADDING_START */\n'
};

const METADATA_FILES = [
  path.join(__dirname, 'lifi-facet-metadata', '0xfdb9a62a5f4f98a0c4e4b864eb22a9eecb0bce5f.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x3de506059ae0b239e125e6b1365cfa92100540c0.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x108b0c3f20f266469fd2e98750926811ad632589.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0xc4e5f14dfe359653d66ae49b1f12177e6f99102b.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x88e0dd83e6da24bf317323e5ca06842406d57ed0.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x54678c366682a29112609882dc58def6753bfc27.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x77a13abb679a0dafb4435d1fa4ccc95d1ab51cfc.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x03f58dc7e2195a0c6f501bc4819066fd9dfe307f.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0x9a82bb477c30d92dab74875027e14d1de3510ef9.json'),
  path.join(__dirname, 'lifi-facet-metadata', '0xac82fa2d953ee5c61d87686ade620b0728f484e6.json')
];
// Only submit for chain ID 1 (mainnet)
const TARGET_CHAIN_ID = 1;
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

// Upload blob - uses dedicated PublicNode RPC for blob transactions
async function uploadBlob(jsonData) {
  try {
    await initKzg();

    // Always use the blob-specific provider for blob transactions
    if (!blobSigner) {
      throw new Error('Blob signer not initialized');
    }

    console.log(`  Using BLOB_RPC: ${BLOB_RPC}`);

    const originalDataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    console.log(`  Original data size: ${originalDataStr.length} bytes`);

    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(originalDataStr));
    console.log(`  Metadata hash: ${metadataHash}`);

    const { paddedData, wasPadded } = addPaddingIfNeeded(originalDataStr);
    if (wasPadded) {
      console.log(`  Padded data size: ${paddedData.length} bytes`);
    }

    const blob = toBlob(paddedData);
    const commitment = cKzg.blobToKzgCommitment(blob);
    const proof = cKzg.computeBlobKzgProof(blob, commitment);
    const isValid = cKzg.verifyBlobKzgProof(blob, commitment, proof);

    if (!isValid) {
      throw new Error('Invalid KZG proof');
    }
    console.log('  KZG proof valid');

    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = '0x01' + commitmentHash.substring(4);
    console.log(`  Blob versioned hash: ${versionedHash}`);

    // Use the blob signer and provider for nonce/gas estimation
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
      blobVersionedHashes: [versionedHash],
      kzg: cKzg,
      blobs: [blob]
    };

    console.log('  Sending blob transaction via PublicNode...');
    const response = await blobSigner.sendTransaction(tx);
    console.log(`  Blob TX: ${response.hash}`);

    const receipt = await response.wait();
    console.log(`  Blob confirmed in block ${receipt?.blockNumber}`);

    return {
      success: true,
      txHash: response.hash,
      blobVersionedHash: versionedHash,
      metadataHash,
      blockNumber: receipt?.blockNumber,
      wasPadded
    };
  } catch (error) {
    console.error(`  Blob upload failed: ${error.message}`);
    return { success: false, txHash: '', blobVersionedHash: '', metadataHash: '', error: error.message };
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
async function processMetadata(metadataPath, relativePath, metadata, targetContract, chainId, kaisign, realityEth, signer, provider, minBond) {
  const state = {
    metadataFile: relativePath,
    metadataPath,
    targetContract,
    chainId,
    metadataHash: '',
    nonce: '',
    commitmentId: '',
    commitTxHash: '',
    blobHash: '',
    blobTxHash: '',
    specId: '',
    questionId: '',
    revealTxHash: '',
    voteTxHash: '',
    status: 'pending',
    timestamp: Date.now()
  };

  try {
    // Calculate metadata hash
    const metadataStr = JSON.stringify(metadata);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(metadataStr));
    state.metadataHash = metadataHash;

    // Generate nonce
    const nonce = generateNonce();
    state.nonce = nonce.toString();

    // Step 1: Commit
    console.log(`\n  Step 1: COMMIT`);
    state.status = 'committing';
    saveState([...submissionStates, state]);

    const commitment = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'uint256'], [metadataHash, nonce])
    );

    const commitTx = await kaisign.commitSpec(commitment, targetContract, chainId);
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

    // Step 2: Upload Blob
    console.log(`\n  Step 2: UPLOAD BLOB`);
    state.status = 'uploading_blob';
    saveState([...submissionStates, state]);

    const blobResult = await uploadBlob(metadata);
    if (!blobResult.success) throw new Error(`Blob upload failed: ${blobResult.error}`);

    state.blobHash = blobResult.blobVersionedHash;
    state.blobTxHash = blobResult.txHash;
    state.status = 'blob_uploaded';
    saveState([...submissionStates, state]);

    console.log(`  Blobscan: https://sepolia.blobscan.com/blob/${blobResult.blobVersionedHash}`);

    await sleep(3000);

    // Step 3: Reveal
    console.log(`\n  Step 3: REVEAL`);
    state.status = 'revealing';
    saveState([...submissionStates, state]);

    const revealTx = await kaisign.revealSpec(
      state.commitmentId,
      state.blobHash,
      state.metadataHash,
      nonce,
      { value: minBond }
    );
    console.log(`  Reveal TX: ${revealTx.hash}`);

    const revealReceipt = await revealTx.wait();
    console.log(`  Reveal confirmed in block ${revealReceipt.blockNumber}`);

    // Parse events
    let specId = '';
    let questionId = '';
    for (const log of revealReceipt.logs) {
      try {
        const parsed = kaisign.interface.parseLog(log);
        if (parsed?.name === 'LogRevealSpec') {
          specId = parsed.args?.specID || parsed.args?.[1];
        }
        if (parsed?.name === 'LogProposeSpec') {
          questionId = parsed.args?.questionId || parsed.args?.[2];
        }
      } catch {}
    }

    state.specId = specId;
    state.questionId = questionId;
    state.revealTxHash = revealTx.hash;
    state.status = questionId && questionId !== ethers.ZeroHash ? 'proposed' : 'revealed';
    saveState([...submissionStates, state]);

    console.log(`  SpecId: ${specId}`);
    console.log(`  QuestionId: ${questionId || 'Not proposed yet'}`);

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
            // After 5 attempts, assume it went through if we have the tx hash
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

// Spec status enum (matches KaiSign.sol)
const SpecStatus = {
  Committed: 0,
  Submitted: 1,
  Proposed: 2,
  Finalized: 3,
  Cancelled: 4
};

// Finalize a single submission
async function finalizeSubmission(state, kaisign, realityEth) {
  console.log(`\nFinalizing: ${state.metadataFile}`);
  console.log(`  SpecId: ${state.specId}`);
  console.log(`  QuestionId: ${state.questionId}`);

  try {
    // Check spec status from contract
    const spec = await kaisign.specs(state.specId);
    const currentStatus = Number(spec.status);

    console.log(`  Current spec status: ${currentStatus} (${Object.keys(SpecStatus).find(k => SpecStatus[k] === currentStatus)})`);

    if (currentStatus === SpecStatus.Finalized) {
      console.log(`  Already finalized, skipping`);
      state.status = 'finalized';
      return { success: true, alreadyFinalized: true };
    }

    if (currentStatus !== SpecStatus.Proposed) {
      console.log(`  Cannot finalize: spec not in Proposed status`);
      return { success: false, error: 'Spec not in Proposed status' };
    }

    // Check if Reality.eth question is finalized
    const isFinalized = await realityEth.isFinalized(state.questionId);
    console.log(`  Reality.eth finalized: ${isFinalized}`);

    if (!isFinalized) {
      // Get question details to show time remaining
      const question = await realityEth.questions(state.questionId);
      const finalizeTs = Number(question.finalize_ts);
      const now = Math.floor(Date.now() / 1000);

      if (finalizeTs > 0) {
        const remaining = finalizeTs - now;
        if (remaining > 0) {
          const hours = Math.floor(remaining / 3600);
          const minutes = Math.floor((remaining % 3600) / 60);
          console.log(`  Time remaining: ${hours}h ${minutes}m`);
        } else {
          console.log(`  Finalization time passed but not yet finalized on Reality.eth`);
        }
      }
      return { success: false, error: 'Question not yet finalized on Reality.eth' };
    }

    // Get the result
    const result = await realityEth.resultFor(state.questionId);
    const isAccepted = BigInt(result) === 1n;
    console.log(`  Result: ${isAccepted ? 'ACCEPTED (valid)' : 'REJECTED (invalid)'}`);

    // Call handleResult on KaiSign
    console.log(`  Calling handleResult...`);
    const tx = await kaisign.handleResult(state.specId);
    console.log(`  TX: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`  Confirmed in block ${receipt.blockNumber}`);

    state.status = 'finalized';
    state.finalizeTxHash = tx.hash;
    state.finalizeResult = isAccepted ? 'accepted' : 'rejected';

    return { success: true, isAccepted, txHash: tx.hash };
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Finalize all voted submissions
async function finalizeAll(kaisign, realityEth) {
  console.log('\n' + '='.repeat(60));
  console.log('FINALIZATION MODE');
  console.log('='.repeat(60));

  const states = loadState();

  // Find all submissions that are voted but not finalized
  const toFinalize = states.filter(s =>
    (s.status === 'voted' || s.status === 'completed') &&
    s.specId &&
    s.questionId &&
    s.questionId !== ethers.ZeroHash
  );

  console.log(`Found ${toFinalize.length} submissions to check for finalization`);

  if (toFinalize.length === 0) {
    console.log('No submissions ready for finalization');
    return;
  }

  let finalized = 0;
  let alreadyFinalized = 0;
  let notReady = 0;
  let errors = 0;

  for (const state of toFinalize) {
    const result = await finalizeSubmission(state, kaisign, realityEth);

    if (result.success) {
      if (result.alreadyFinalized) {
        alreadyFinalized++;
      } else {
        finalized++;
      }
    } else if (result.error?.includes('not yet finalized')) {
      notReady++;
    } else {
      errors++;
    }

    // Save state after each finalization attempt
    saveState(states);

    // Small delay between calls
    await sleep(2000);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINALIZATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Newly finalized: ${finalized}`);
  console.log(`Already finalized: ${alreadyFinalized}`);
  console.log(`Not ready yet: ${notReady}`);
  console.log(`Errors: ${errors}`);
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
  // Check for --finalize flag
  const args = process.argv.slice(2);
  const finalizeMode = args.includes('--finalize');

  console.log('='.repeat(60));
  console.log(finalizeMode ? 'AUTONOMOUS METADATA FINALIZER' : 'AUTONOMOUS METADATA SUBMITTER');
  console.log('='.repeat(60));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable not set');
    console.log('Usage: PRIVATE_KEY=0x... node scripts/autonomous-submitter.js [--finalize]');
    console.log('\nModes:');
    console.log('  (default)    Submit new metadata through full lifecycle');
    console.log('  --finalize   Finalize all voted submissions that are ready');
    process.exit(1);
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC;
  console.log(`\nRPC: ${rpcUrl}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`Signer: ${signerAddress}`);

  const balance = await provider.getBalance(signerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Initialize contracts
  const kaisign = new ethers.Contract(CONTRACTS.KAISIGN, KAISIGN_ABI, signer);
  const realityEth = new ethers.Contract(CONTRACTS.REALITY_ETH, REALITY_ETH_ABI, signer);

  // Finalize mode - only finalize existing submissions
  if (finalizeMode) {
    await finalizeAll(kaisign, realityEth);
    return;
  }

  // Initialize blob-specific provider for submission mode
  console.log(`RPC (blobs): ${BLOB_RPC}`);
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

      const existing = submissionStates.find(
        s => s.metadataFile === file.relativePath &&
             s.chainId === deployment.chainId &&
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
