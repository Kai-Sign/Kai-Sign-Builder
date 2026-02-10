import { ethers } from 'ethers';
import { CONFIG, BlobUploadResult } from './types';
import { createRequire } from 'module';

// Create require for ESM context
const require = createRequire(import.meta.url);

// c-kzg will be required at runtime
let cKzg: any = null;

/**
 * Initialize KZG library
 */
async function initKzg(): Promise<void> {
  if (cKzg) return;

  try {
    cKzg = require('c-kzg');
    try {
      cKzg.loadTrustedSetup(0, cKzg.DEFAULT_TRUSTED_SETUP_PATH);
    } catch {
      // Already loaded
    }
    console.log('  KZG library initialized');
  } catch (error) {
    throw new Error('c-kzg library not available. Run: npm install c-kzg');
  }
}

/**
 * Convert data string to blob format
 * Each field element in the blob can only use 31 bytes (to stay < field modulus)
 */
function toBlob(data: string): Uint8Array {
  const BLOB_SIZE = 131072; // 4096 * 32 bytes
  const blob = new Uint8Array(BLOB_SIZE);
  const bytes = Buffer.from(data);

  let blobIndex = 0;
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;

    if (fieldIndex >= 4096) break;

    // Each 32-byte field: first byte is 0, next 31 bytes are data
    const byteVal = bytes[i] ?? 0;
    blob[fieldIndex * 32 + byteIndex + 1] = byteVal;
    blobIndex++;
  }

  return blob;
}

/**
 * Add padding to small data for cost-effective blob upload
 */
function addPaddingIfNeeded(data: string): { paddedData: string; wasPadded: boolean } {
  if (data.length >= CONFIG.MIN_BLOB_DATA_SIZE) {
    return { paddedData: data, wasPadded: false };
  }

  const paddingNeeded = CONFIG.MIN_BLOB_DATA_SIZE - data.length - CONFIG.PADDING_MARKER.length;
  if (paddingNeeded <= 0) {
    return { paddedData: data, wasPadded: false };
  }

  const padding = '0'.repeat(paddingNeeded);
  return {
    paddedData: data + CONFIG.PADDING_MARKER + padding,
    wasPadded: true
  };
}

/**
 * Upload JSON data as EIP-4844 blob transaction
 */
export async function uploadBlob(
  jsonData: any,
  signer: ethers.Signer,
  provider: ethers.Provider
): Promise<BlobUploadResult> {
  try {
    await initKzg();

    // Prepare data
    const originalDataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    console.log(`  Original data size: ${originalDataStr.length} bytes`);

    // Calculate metadata hash BEFORE padding (semantic hash)
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(originalDataStr));
    console.log(`  Metadata hash: ${metadataHash}`);

    // Add padding if needed
    const { paddedData, wasPadded } = addPaddingIfNeeded(originalDataStr);
    if (wasPadded) {
      console.log(`  Padded data size: ${paddedData.length} bytes`);
    }

    // Create blob
    const blob = toBlob(paddedData);

    // Generate KZG commitment and proof
    const commitment: Uint8Array = cKzg.blobToKzgCommitment(blob);
    const proof: Uint8Array = cKzg.computeBlobKzgProof(blob, commitment);
    const isValid: boolean = cKzg.verifyBlobKzgProof(blob, commitment, proof);

    if (!isValid) {
      throw new Error('Invalid KZG proof');
    }
    console.log('  KZG proof valid');

    // Calculate versioned hash (0x01 prefix for KZG)
    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = ('0x01' + commitmentHash.substring(4)) as `0x${string}`;
    console.log(`  Blob versioned hash: ${versionedHash}`);

    // Get transaction parameters
    const nonce = await signer.getNonce();
    const latest = await provider.getBlock('latest');
    const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits('1', 'gwei');

    // Build Type 3 (EIP-4844) transaction
    const tx: any = {
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

    // Send transaction
    console.log('  Sending blob transaction...');
    const response = await signer.sendTransaction(tx);
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
  } catch (error: any) {
    console.error(`  Blob upload failed: ${error.message}`);
    return {
      success: false,
      txHash: '',
      blobVersionedHash: '',
      metadataHash: '',
      error: error.message
    };
  }
}

/**
 * Calculate metadata hash for JSON data
 */
export function calculateMetadataHash(jsonData: any): string {
  const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  return ethers.keccak256(ethers.toUtf8Bytes(dataStr));
}

/**
 * Generate explorer links for blob transaction
 */
export function getBlobExplorerLinks(txHash: string, blobHash: string): {
  etherscan: string;
  blobscan: string;
} {
  return {
    etherscan: `https://sepolia.etherscan.io/tx/${txHash}`,
    blobscan: `https://sepolia.blobscan.com/blob/${blobHash}`
  };
}
