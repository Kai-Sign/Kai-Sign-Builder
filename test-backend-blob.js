/**
 * Blob Posting Test using backend's ethers.js approach
 */

import { ethers } from 'ethers';
import { KZG } from 'micro-eth-signer/advanced/kzg.js';
import { trustedSetup } from '@paulmillr/trusted-setups';
import dotenv from 'dotenv';

dotenv.config();

// Initialize KZG
console.log('Initializing KZG...');
const kzg = new KZG(trustedSetup);
console.log('KZG initialized');

// KZG adapter
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

// Convert data to blob format
function toBlobs(data) {
  const BLOB_SIZE = 131072;
  const blob = new Uint8Array(BLOB_SIZE);
  const bytes = Buffer.from(data);
  let blobIndex = 0;

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
    "contract": {
      "deployments": [{ "chainId": 1, "address": "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9" }]
    }
  },
  "metadata": { "owner": "KaiSign" }
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Backend-style Blob Posting (ethers.js)               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/E3YEqAK6XBFSxRckQ7v8D';

  if (!privateKey) {
    console.log('PRIVATE_KEY required');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`RPC: ${rpcUrl}\n`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.01')) {
    console.log('Need at least 0.01 ETH');
    process.exit(1);
  }

  // Prepare blob data
  const dataStr = JSON.stringify(testErc7730);
  console.log(`\nData size: ${dataStr.length} bytes`);

  const blobUint8 = toBlobs(dataStr);
  console.log(`Blob size: ${blobUint8.length} bytes`);

  // Generate KZG commitment and proof
  console.log('\nGenerating KZG commitment...');
  const commitment = kzgAdapter.blobToKzgCommitment(blobUint8);
  const proof = kzgAdapter.computeBlobKzgProof(blobUint8, commitment);
  const isValid = kzgAdapter.verifyBlobKzgProof(blobUint8, commitment, proof);
  console.log(`Proof valid: ${isValid}`);

  // Create versioned hash
  const commitmentHash = ethers.sha256(commitment);
  const versionedHash = '0x01' + commitmentHash.substring(4);
  console.log(`Versioned hash: ${versionedHash}`);

  // Get transaction params
  const nonce = await wallet.getNonce();
  const latestBlock = await provider.getBlock('latest');
  const baseFee = latestBlock.baseFeePerGas;

  console.log(`\nNonce: ${nonce}`);
  console.log(`Base fee: ${ethers.formatUnits(baseFee, 'gwei')} gwei`);

  const maxPriorityFee = ethers.parseUnits('2', 'gwei');
  const maxFeePerGas = baseFee * 2n + maxPriorityFee;
  const maxBlobFee = ethers.parseUnits('30', 'gwei');

  // Create blob transaction (same as backend)
  const blobTx = {
    type: 3,
    to: '0x0000000000000000000000000000000000000000',
    data: '0x',
    value: 0n,
    chainId: 11155111,
    nonce: nonce,
    gasLimit: 21000n,
    maxPriorityFeePerGas: maxPriorityFee,
    maxFeePerGas: maxFeePerGas,
    maxFeePerBlobGas: maxBlobFee,
    blobVersionedHashes: [versionedHash],
    kzg: kzgAdapter,
    blobs: [blobUint8]
  };

  console.log('\nSending blob transaction...');

  try {
    const txResponse = await wallet.sendTransaction(blobTx);
    console.log(`\n✅ Transaction sent: ${txResponse.hash}`);
    console.log(`Blob hash: ${versionedHash}`);

    console.log('\nWaiting for confirmation...');
    const receipt = await txResponse.wait();

    console.log(`\n🎉 Confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    console.log(`\nEtherscan: https://sepolia.etherscan.io/tx/${txResponse.hash}`);
    console.log(`Blobscan: https://sepolia.blobscan.com/tx/${txResponse.hash}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.info) console.log('Info:', error.info);
  }
}

main().catch(console.error);
