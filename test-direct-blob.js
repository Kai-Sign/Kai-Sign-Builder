/**
 * Direct Blob Posting to Sepolia (without EthStorage)
 *
 * Posts an ERC7730 JSON as an EIP-4844 blob transaction directly to Sepolia.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node test-direct-blob.js
 */

import { ethers } from 'ethers';
import { KZG } from 'micro-eth-signer/advanced/kzg.js';
import { trustedSetup } from '@paulmillr/trusted-setups';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Sepolia Configuration
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo';
const SEPOLIA_CHAIN_ID = 11155111;

// Initialize KZG
let kzg = null;

async function initKzg() {
  if (!kzg) {
    console.log('Initializing KZG...');
    kzg = new KZG(trustedSetup);
    console.log('KZG initialized successfully');
  }
}

// KZG adapter for ethers.js
function toHexFromBytes(bytes) {
  return '0x' + Buffer.from(bytes).toString('hex');
}

function toBytes(data) {
  return ethers.getBytes(data);
}

const kzgAdapter = {
  blobToKzgCommitment(blob) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = kzg.blobToKzgCommitment(blobHex);
    return toBytes(commitmentHex);
  },
  computeBlobKzgProof(blob, commitment) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = ethers.hexlify(commitment);
    const proofHex = kzg.computeBlobProof(blobHex, commitmentHex);
    return toBytes(proofHex);
  },
  verifyBlobKzgProof(blob, commitment, proof) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = ethers.hexlify(commitment);
    const proofHex = ethers.hexlify(proof);
    return kzg.verifyBlobProof(blobHex, commitmentHex, proofHex);
  }
};

// Convert data to blob format (EIP-4844 compatible)
function toBlob(data) {
  const BLOB_SIZE = 131072; // 4096 * 32
  const blob = new Uint8Array(BLOB_SIZE);

  const bytes = Buffer.from(data);
  let blobIndex = 0;

  // Field element packing: each 32-byte field element can hold 31 bytes of data
  // (first byte must be 0 to keep field element < BLS modulus)
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;

    if (fieldIndex >= 4096) break;

    blob[fieldIndex * 32 + byteIndex + 1] = bytes[i];
    blobIndex++;
  }

  return blob;
}

// Test ERC7730 JSON
const testErc7730 = {
  "$schema": "https://schemas.erc7730.org/erc7730-v1.json",
  "context": {
    "eip712Domain": {
      "name": "KaiSign Direct Blob Test",
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
      "legalName": "KaiSign Direct Blob Test",
      "lastUpdate": new Date().toISOString().split('T')[0]
    }
  },
  "display": {
    "formats": {
      "testBlobFunction(address,uint256)": {
        "intent": "Direct blob test without EthStorage",
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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Direct Blob Posting to Sepolia                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Get private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('❌ PRIVATE_KEY environment variable required');
    console.log('Usage: PRIVATE_KEY=0x... node test-direct-blob.js');
    process.exit(1);
  }

  // Initialize KZG
  await initKzg();

  // Connect to Sepolia
  console.log(`🔗 Connecting to Sepolia: ${SEPOLIA_RPC}`);
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📍 Wallet: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.01')) {
    console.log('❌ Insufficient balance (need at least 0.01 ETH)');
    process.exit(1);
  }

  // Prepare data
  const jsonString = JSON.stringify(testErc7730, null, 2);
  console.log(`\n📦 Preparing blob with ${jsonString.length} bytes of ERC7730 data`);

  // Convert to blob format
  const blobData = toBlob(jsonString);
  console.log(`   Blob size: ${blobData.length} bytes`);

  // Generate KZG commitment and proof
  console.log('\n🔐 Generating KZG commitment and proof...');
  const commitment = kzgAdapter.blobToKzgCommitment(blobData);
  const proof = kzgAdapter.computeBlobKzgProof(blobData, commitment);

  // Verify proof
  const isValid = kzgAdapter.verifyBlobKzgProof(blobData, commitment, proof);
  console.log(`   Proof valid: ${isValid}`);

  if (!isValid) {
    console.log('❌ KZG proof verification failed');
    process.exit(1);
  }

  // Create versioned hash
  const commitmentHash = ethers.sha256(commitment);
  const versionedHash = '0x01' + commitmentHash.substring(4);
  console.log(`   Versioned hash: ${versionedHash}`);

  // Get transaction parameters
  const nonce = await wallet.getNonce();
  const latestBlock = await provider.getBlock('latest');
  const baseFee = latestBlock.baseFeePerGas;

  console.log(`\n📝 Transaction parameters:`);
  console.log(`   Nonce: ${nonce}`);
  console.log(`   Base fee: ${ethers.formatUnits(baseFee, 'gwei')} gwei`);

  // Set gas prices
  const maxPriorityFee = ethers.parseUnits('2', 'gwei');
  const maxFeePerGas = baseFee * 2n + maxPriorityFee;
  const maxBlobFee = ethers.parseUnits('30', 'gwei');

  // Create blob transaction
  const blobTx = {
    type: 3, // EIP-4844 blob transaction
    to: '0x0000000000000000000000000000000000000000', // null address
    data: '0x',
    value: 0n,
    chainId: SEPOLIA_CHAIN_ID,
    nonce: nonce,
    gasLimit: 21000n,
    maxPriorityFeePerGas: maxPriorityFee,
    maxFeePerGas: maxFeePerGas,
    maxFeePerBlobGas: maxBlobFee,
    blobVersionedHashes: [versionedHash],
    // Attach KZG and blob data for ethers.js
    kzg: kzgAdapter,
    blobs: [blobData]
  };

  console.log('\n📤 Sending blob transaction...');

  try {
    const txResponse = await wallet.sendTransaction(blobTx);
    console.log(`\n✅ Transaction sent!`);
    console.log(`   Hash: ${txResponse.hash}`);
    console.log(`   Blob hash: ${versionedHash}`);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await txResponse.wait();

    console.log(`\n🎉 Transaction confirmed!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Blob gas used: ${receipt.blobGasUsed?.toString() || 'N/A'}`);

    console.log('\n📍 Links:');
    console.log(`   Etherscan: https://sepolia.etherscan.io/tx/${txResponse.hash}`);
    console.log(`   Blobscan: https://sepolia.blobscan.com/blob/${versionedHash}`);

    return {
      success: true,
      txHash: txResponse.hash,
      blobVersionedHash: versionedHash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error(`\n❌ Transaction failed: ${error.message}`);

    // Check if it's the Osaka sidecar issue
    if (error.message.includes('osaka') || error.message.includes('sidecar')) {
      console.log('\n⚠️  This might be related to the Osaka/Fusaka hard fork.');
      console.log('   The network may have changed how blob sidecars are handled.');
      console.log('   See: https://blog.ethereum.org/2025/09/26/fusaka-testnet-announcement');
    }

    return {
      success: false,
      error: error.message
    };
  }
}

main().catch(console.error);
