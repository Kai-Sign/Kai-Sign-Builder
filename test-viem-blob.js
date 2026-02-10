/**
 * Blob Posting Test using Viem + c-kzg (based on blob-poster repo)
 *
 * Uses the approach from https://github.com/Dhaiwat10/blob-poster
 *
 * Usage:
 *   PRIVATE_KEY=0x... node test-viem-blob.js
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseGwei,
  stringToHex,
  toBlobs,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import cKzg from 'c-kzg';
const { loadTrustedSetup, blobToKzgCommitment, computeBlobKzgProof, computeCellsAndKzgProofs, DEFAULT_TRUSTED_SETUP_PATH } = cKzg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test ERC7730 JSON data
const testErc7730 = {
  "$schema": "https://schemas.erc7730.org/erc7730-v1.json",
  "context": {
    "eip712Domain": {
      "name": "Viem Blob Test",
      "version": "1"
    },
    "contract": {
      "deployments": [
        {
          "chainId": 1,
          "address": "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"
        }
      ]
    }
  },
  "metadata": {
    "owner": "KaiSign",
    "info": {
      "url": "https://kai-sign.com",
      "legalName": "KaiSign Viem Blob Test",
      "lastUpdate": new Date().toISOString().split('T')[0]
    }
  },
  "display": {
    "formats": {
      "testFunction(address,uint256)": {
        "intent": "Viem blob test with c-kzg",
        "fields": [
          {
            "path": "#.recipient",
            "label": "Recipient",
            "format": "addressName"
          },
          {
            "path": "#.amount",
            "label": "Amount",
            "format": "tokenAmount"
          }
        ]
      }
    }
  }
};

async function postBlob(text) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Blob Posting with Viem + c-kzg (blob-poster)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('❌ PRIVATE_KEY environment variable required');
    console.log('Usage: PRIVATE_KEY=0x... node test-viem-blob.js');
    process.exit(1);
  }

  if (!privateKey.startsWith('0x')) {
    console.log('❌ Private key must start with 0x');
    process.exit(1);
  }

  // Initialize KZG
  console.log('🔐 Loading KZG trusted setup...');
  try {
    loadTrustedSetup(0, DEFAULT_TRUSTED_SETUP_PATH);
    console.log('   KZG initialized successfully\n');
  } catch (error) {
    if (!error.message.includes('already loaded')) {
      console.error('   KZG init error:', error.message);
    }
    console.log('   Continuing (KZG may already be loaded)\n');
  }

  // Use cell proofs for post-Fusaka compatibility
  const kzg = {
    blobToKzgCommitment,
    computeBlobKzgProof,
  };

  // Setup account
  const account = privateKeyToAccount(privateKey);
  console.log(`📍 Wallet: ${account.address}`);

  // RPC URL
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
  console.log(`🔗 RPC: ${rpcUrl}\n`);

  // Create clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);

  if (balance < BigInt(1e16)) {
    console.log('❌ Insufficient balance (need at least 0.01 ETH)');
    process.exit(1);
  }

  // Convert text to blobs
  console.log(`\n📦 Preparing blob with ${text.length} bytes of data`);
  const blobData = stringToHex(text);
  const blobs = toBlobs({ data: blobData });
  console.log(`   Created ${blobs.length} blob(s)`);

  // Get current fees
  console.log('\n📊 Fetching current network fees...');
  const [blobBaseFee, block, nonce] = await Promise.all([
    publicClient.getBlobBaseFee(),
    publicClient.getBlock(),
    publicClient.getTransactionCount({ address: account.address }),
  ]);

  const baseFee = block.baseFeePerGas ?? parseGwei('1');
  const maxFeePerBlobGas = blobBaseFee * 2n;
  const maxPriorityFeePerGas = parseGwei('1');
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  console.log(`   Nonce: ${nonce}`);
  console.log(`   Base fee: ${Number(baseFee)} wei`);
  console.log(`   Blob base fee: ${Number(blobBaseFee)} wei`);
  console.log(`   Max fee per blob gas: ${Number(maxFeePerBlobGas)} wei`);

  // Send blob transaction
  console.log('\n📤 Sending blob transaction...');

  try {
    const hash = await walletClient.sendTransaction({
      to: account.address,
      value: 0n,
      blobs,
      kzg,
      maxFeePerBlobGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
    });

    console.log(`\n✅ Transaction sent!`);
    console.log(`   Hash: ${hash}`);

    // Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`\n🎉 Transaction confirmed!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
    console.log(`   Blob gas used: ${receipt.blobGasUsed || 'N/A'}`);

    console.log('\n📍 Links:');
    console.log(`   Etherscan: https://sepolia.etherscan.io/tx/${hash}`);
    console.log(`   Blobscan: https://sepolia.blobscan.com/tx/${hash}`);

    return {
      success: true,
      txHash: hash,
      blockNumber: receipt.blockNumber,
    };

  } catch (error) {
    console.error(`\n❌ Transaction failed: ${error.message}`);

    if (error.message.includes('osaka') || error.message.includes('sidecar')) {
      console.log('\n⚠️  This might be related to the Osaka/Fusaka hard fork.');
      console.log('   The network may have changed how blob sidecars are handled.');
    }

    // Log full error details
    if (error.details) {
      console.log(`\n   Details: ${error.details}`);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

// Run the test
const jsonData = JSON.stringify(testErc7730, null, 2);
postBlob(jsonData).catch(console.error);
