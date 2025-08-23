export type BlobPostResult = {
  txHash: string;
  blobVersionedHash: string;
  etherscanBlobUrl: string;
  blockNumber?: number | null;
};

export async function postToBlob(json: object | string): Promise<BlobPostResult> {
  const body = typeof json === 'string' ? { json } : { json };
  const res = await fetch('/api/blob/upload', {
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


