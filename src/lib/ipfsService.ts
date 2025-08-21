// IPFS Service for uploading files to IPFS using Pinata

/**
 * Uploads a file to IPFS via Pinata and returns the CID (Content Identifier)
 * 
 * This implementation uses the Pinata IPFS service.
 */
export async function uploadToIPFS(file: File | string | object): Promise<string> {
  try {
    // Normalize to JSON content (client sends JSON to our server route)
    let jsonContent: any;
    if (file instanceof File) {
      const text = await file.text();
      jsonContent = JSON.parse(text);
    } else if (typeof file === 'string') {
      try {
        jsonContent = JSON.parse(file);
      } catch {
        // Treat as raw string content
        jsonContent = file;
      }
    } else {
      jsonContent = file;
    }

    const resp = await fetch('/api/ipfs/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: jsonContent }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `HTTP ${resp.status}`);
    }

    const result = await resp.json();
    if (!result.IpfsHash) {
      throw new Error('No IPFS hash returned');
    }
    return result.IpfsHash as string;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload to IPFS: ${errorMessage}`);
  }
}