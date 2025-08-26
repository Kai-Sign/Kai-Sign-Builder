import { blobValidationService, BlobValidationResult } from './blobValidationService';

export type BlobPostResult = {
  txHash: string;
  blobVersionedHash: string;
  etherscanBlobUrl: string;
  blockNumber?: number | null;
};

export async function postToBlob(json: object | string): Promise<BlobPostResult> {
  const body = typeof json === 'string' ? { json } : { json };
  const res = await fetch('/api/blob/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data?.blobVersionedHash) {
    throw new Error('Blob upload did not return versioned hash');
  }
  return data as BlobPostResult;
}

/**
 * Validates a blob hash before using it in transactions
 */
export async function validateBlobHash(blobHash: string): Promise<BlobValidationResult> {
  return await blobValidationService.validateBlobHash(blobHash);
}

/**
 * Validates multiple blob hashes at once
 */
export async function validateMultipleBlobHashes(blobHashes: string[]): Promise<Map<string, BlobValidationResult>> {
  return await blobValidationService.validateMultipleBlobHashes(blobHashes);
}

/**
 * Posts blob and validates the result
 */
export async function postToBlobWithValidation(json: object | string): Promise<BlobPostResult> {
  const result = await postToBlob(json);
  
  // Validate the returned blob hash
  const validation = await validateBlobHash(result.blobVersionedHash);
  if (!validation.isValid || !validation.exists) {
    throw new Error(`Blob posted but validation failed: ${validation.error || 'Unknown error'}`);
  }
  
  return result;
}


