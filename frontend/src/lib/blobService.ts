import { blobValidationService, BlobValidationResult } from './blobValidationService';

export type BlobPostResult = {
  txHash: string;
  blobVersionedHash: string;
  etherscanBlobUrl: string;
  blockNumber?: number | null;
};

export async function postToBlob(json: object | string): Promise<BlobPostResult> {
  const body = typeof json === 'string' ? { json } : { json };
  console.log('Posting blob with body:', body);
  
  const res = await fetch('/api/blob/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  console.log('Response status:', res.status);
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Blob post failed:', text);
    throw new Error(text || `HTTP ${res.status}`);
  }
  
  const data = await res.json();
  console.log('Blob post response data:', data);
  
  if (!data?.blobVersionedHash) {
    console.error('Missing blobVersionedHash in response:', data);
    throw new Error('Blob upload did not return versioned hash');
  }
  
  console.log('Blob post successful:', data);
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
  console.log('Starting postToBlobWithValidation...');
  
  const result = await postToBlob(json);
  console.log('Blob posted successfully, now validating...');
  
  // Validate the returned blob hash
  const validation = await validateBlobHash(result.blobVersionedHash);
  console.log('Validation result:', validation);
  
  if (!validation.isValid || !validation.exists) {
    console.error('Validation failed:', validation);
    throw new Error(`Blob posted but validation failed: ${validation.error || 'Unknown error'}`);
  }
  
  console.log('Validation successful, returning result');
  return result;
}


