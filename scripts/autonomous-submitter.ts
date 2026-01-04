#!/usr/bin/env npx ts-node
/**
 * Autonomous Metadata Submitter
 *
 * Submits ERC7730 metadata through the full lifecycle:
 * Commit → Send Blob → Reveal → Vote Valid on Reality.eth
 *
 * Usage:
 *   npx ts-node scripts/autonomous-submitter.ts
 *
 * Or with explicit private key:
 *   PRIVATE_KEY=0x... npx ts-node scripts/autonomous-submitter.ts
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
import { fileURLToPath as fileURLToPathDotenv } from 'url';
import { dirname as dirnameDotenv } from 'path';

const __filenameDotenv = fileURLToPathDotenv(import.meta.url);
const __dirnameDotenv = dirnameDotenv(__filenameDotenv);
dotenv.config({ path: `${__dirnameDotenv}/../.env` });

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  ManifestFile,
  MetadataFile,
  SubmissionState,
  SubmissionStatus,
  CONFIG
} from './lib/types';
import { KaiSignContract } from './lib/kaisign-contract';
import { RealityEthContract } from './lib/reality-eth-contract';
import { uploadBlob, calculateMetadataHash, getBlobExplorerLinks } from './lib/blob-uploader';

// Configuration
const METADATA_FILES = [
  path.join(__dirname, 'safe-multisend-metadata.json'),
  path.join(__dirname, 'safe-proxy-metadata.json'),
  path.join(__dirname, 'metadata/aa/safe-singleton.json'),
  path.join(__dirname, 'metadata/aa/safe-multisend.json'),
  path.join(__dirname, 'metadata/aa/safe-proxy-factory.json'),
  path.join(__dirname, 'lifi-facet-metadata/lifi-diamond-combined.json')
];
const STATE_FILE = path.join(__dirname, 'submission-state.json');
const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// Global state
let submissionStates: SubmissionState[] = [];

/**
 * Load submission state from file
 */
function loadState(): SubmissionState[] {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('No existing state file, starting fresh');
  }
  return [];
}

/**
 * Save submission state to file
 */
function saveState(states: SubmissionState[]): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(states, null, 2));
}

/**
 * Load metadata files directly from configured paths
 */
function loadContractMetadata(metadataFiles: string[]): Array<{
  filePath: string;
  relativePath: string;
  data: MetadataFile;
  deployments: Array<{ network: string; address: string; chainId: number }>;
}> {
  console.log(`Loading ${metadataFiles.length} metadata files`);

  const results: Array<{
    filePath: string;
    relativePath: string;
    data: MetadataFile;
    deployments: Array<{ network: string; address: string; chainId: number }>;
  }> = [];

  for (const fullPath of metadataFiles) {
    const relativePath = path.basename(fullPath);

    try {
      const data: MetadataFile = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

      // Extract deployments
      const deployments: Array<{ network: string; address: string; chainId: number }> = [];

      if (data.context?.contract?.deployments) {
        for (const [network, deployment] of Object.entries(data.context.contract.deployments)) {
          if (deployment.address && deployment.chainId) {
            deployments.push({
              network,
              address: deployment.address,
              chainId: deployment.chainId
            });
          }
        }
      }

      if (deployments.length > 0) {
        results.push({
          filePath: fullPath,
          relativePath,
          data,
          deployments
        });
        console.log(`  Loaded ${relativePath}: ${deployments.length} deployments`);
      } else {
        console.log(`  Skipping ${relativePath}: No deployments found`);
      }
    } catch (error: any) {
      console.error(`  Error loading ${relativePath}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Generate random nonce
 */
function generateNonce(): bigint {
  const bytes = crypto.randomBytes(32);
  return BigInt('0x' + bytes.toString('hex'));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single metadata file submission
 */
async function processMetadata(
  metadataPath: string,
  relativePath: string,
  metadata: MetadataFile,
  targetContract: string,
  chainId: number,
  kaisign: KaiSignContract,
  realityEth: RealityEthContract,
  signer: ethers.Signer,
  provider: ethers.Provider,
  minBond: bigint
): Promise<SubmissionState> {
  // Initialize state
  const state: SubmissionState = {
    metadataFile: relativePath,
    metadataPath,
    targetContract,
    chainId,
    metadataHash: '',
    nonce: '',
    commitment: '',
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
    const metadataHash = calculateMetadataHash(metadata);
    state.metadataHash = metadataHash;

    // Generate nonce
    const nonce = generateNonce();
    state.nonce = nonce.toString();

    console.log(`\n  Step 1: COMMIT`);
    state.status = 'committing';
    saveState([...submissionStates, state]);

    // Commit
    const commitResult = await kaisign.commitSpec(
      metadataHash,
      nonce,
      targetContract,
      chainId
    );

    if (!commitResult.success) {
      throw new Error(`Commit failed: ${commitResult.error}`);
    }

    state.commitmentId = commitResult.commitmentId;
    state.commitTxHash = commitResult.txHash;
    state.status = 'committed';
    saveState([...submissionStates, state]);

    // Small delay before blob upload
    await sleep(3000);

    console.log(`\n  Step 2: UPLOAD BLOB`);
    state.status = 'uploading_blob';
    saveState([...submissionStates, state]);

    // Upload blob
    const blobResult = await uploadBlob(metadata, signer, provider);

    if (!blobResult.success) {
      throw new Error(`Blob upload failed: ${blobResult.error}`);
    }

    state.blobHash = blobResult.blobVersionedHash;
    state.blobTxHash = blobResult.txHash;
    state.status = 'blob_uploaded';
    saveState([...submissionStates, state]);

    const links = getBlobExplorerLinks(blobResult.txHash, blobResult.blobVersionedHash);
    console.log(`  Blobscan: ${links.blobscan}`);

    // Small delay before reveal
    await sleep(3000);

    console.log(`\n  Step 3: REVEAL`);
    state.status = 'revealing';
    saveState([...submissionStates, state]);

    // Reveal with bond
    const revealResult = await kaisign.revealSpec(
      state.commitmentId,
      state.blobHash,
      state.metadataHash,
      nonce,
      minBond
    );

    if (!revealResult.success) {
      throw new Error(`Reveal failed: ${revealResult.error}`);
    }

    state.specId = revealResult.specId;
    state.questionId = revealResult.questionId;
    state.revealTxHash = revealResult.txHash;
    state.status = 'revealed';

    if (state.questionId && state.questionId !== ethers.ZeroHash) {
      state.status = 'proposed';
    }
    saveState([...submissionStates, state]);

    // If we have a questionId, vote on it
    if (state.questionId && state.questionId !== ethers.ZeroHash) {
      // Small delay before voting
      await sleep(5000);

      console.log(`\n  Step 4: VOTE VALID`);
      state.status = 'voting';
      saveState([...submissionStates, state]);

      const voteResult = await realityEth.voteValid(state.questionId);

      if (!voteResult.success) {
        throw new Error(`Vote failed: ${voteResult.error}`);
      }

      state.voteTxHash = voteResult.txHash;
      state.status = 'voted';
      saveState([...submissionStates, state]);
    }

    state.status = 'completed';
    console.log(`\n  Status: SUCCESS`);

  } catch (error: any) {
    state.status = 'error';
    state.error = error.message;
    console.error(`\n  Status: ERROR - ${error.message}`);
  }

  return state;
}

/**
 * Print summary of all submissions
 */
function printSummary(states: SubmissionState[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const completed = states.filter(s => s.status === 'completed').length;
  const errors = states.filter(s => s.status === 'error').length;
  const pending = states.filter(s => !['completed', 'error'].includes(s.status)).length;

  console.log(`Total processed: ${states.length}`);
  console.log(`  Completed: ${completed}`);
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

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AUTONOMOUS METADATA SUBMITTER');
  console.log('='.repeat(60));

  // Check for private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable not set');
    console.log('Usage: PRIVATE_KEY=0x... npx ts-node scripts/autonomous-submitter.ts');
    process.exit(1);
  }

  // Setup provider and signer
  const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC;
  console.log(`\nRPC: ${rpcUrl}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`Signer: ${signerAddress}`);

  // Check balance
  const balance = await provider.getBalance(signerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.05')) {
    console.warn('\nWARNING: Balance is low. You may need more ETH for all submissions.');
  }

  // Initialize contracts
  const kaisign = new KaiSignContract(signer);
  const realityEth = new RealityEthContract(signer);

  // Get minimum bond
  const minBond = await kaisign.getMinBond();
  console.log(`Min bond: ${ethers.formatEther(minBond)} ETH`);

  // Load existing state
  submissionStates = loadState();
  const existingFiles = new Set(submissionStates.map(s => `${s.metadataFile}-${s.chainId}`));

  // Load metadata files
  console.log(`\nLoading metadata files...`);
  const metadataFiles = loadContractMetadata(METADATA_FILES);
  console.log(`Found ${metadataFiles.length} contract files with deployments`);

  // Count total deployments
  let totalDeployments = 0;
  for (const file of metadataFiles) {
    totalDeployments += file.deployments.length;
  }
  console.log(`Total deployments to process: ${totalDeployments}`);

  // Process each metadata file
  let processed = 0;
  for (const file of metadataFiles) {
    for (const deployment of file.deployments) {
      processed++;
      const key = `${file.relativePath}-${deployment.chainId}`;

      // Skip already processed
      const existing = submissionStates.find(
        s => s.metadataFile === file.relativePath &&
             s.chainId === deployment.chainId &&
             s.status === 'completed'
      );

      if (existing) {
        console.log(`\n[${processed}/${totalDeployments}] SKIP: ${file.relativePath} (chain ${deployment.chainId}) - Already completed`);
        continue;
      }

      console.log(`\n[${processed}/${totalDeployments}] ${file.relativePath}`);
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

      // Update states
      const existingIndex = submissionStates.findIndex(
        s => s.metadataFile === file.relativePath && s.chainId === deployment.chainId
      );
      if (existingIndex >= 0) {
        submissionStates[existingIndex] = state;
      } else {
        submissionStates.push(state);
      }
      saveState(submissionStates);

      // Delay between submissions
      if (processed < totalDeployments) {
        console.log('\n  Waiting 10 seconds before next submission...');
        await sleep(10000);
      }
    }
  }

  // Print summary
  printSummary(submissionStates);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
