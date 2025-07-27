// IPFS Service for uploading files to IPFS using Pinata

/**
 * Uploads a file to IPFS via Pinata and returns the CID (Content Identifier)
 * 
 * This implementation uses the Pinata IPFS service.
 */
export async function uploadToIPFS(file: File | string | object): Promise<string> {
  try {
    // Prepare the file data
    let formData = new FormData();
    let fileToUpload: Blob;
    
    if (typeof file === 'string') {
      // If file is a string (JSON string), convert it to a blob
      fileToUpload = new Blob([file], { type: 'application/json' });
      formData.append('file', fileToUpload, 'erc7730-spec.json');
    } else if (file instanceof File) {
      // If file is already a File object
      formData.append('file', file);
    } else {
      // If file is an object, stringify it and convert to blob
      const jsonString = JSON.stringify(file, null, 2); // Pretty print with indentation
      fileToUpload = new Blob([jsonString], { type: 'application/json' });
      formData.append('file', fileToUpload, 'erc7730-spec.json');
    }

    // Get Pinata API credentials
    const apiKey = process.env.NEXT_PUBLIC_IPFS_API_KEY || '';
    const apiSecret = process.env.NEXT_PUBLIC_IPFS_API_SECRET || '';
    const jwtToken = process.env.NEXT_PUBLIC_PINATA_JWT || '';
    
    // Check if we have either JWT or API key/secret pair
    const hasJWT = !!jwtToken;
    const hasApiCredentials = !!(apiKey && apiSecret);
    
    if (!hasJWT && !hasApiCredentials) {
      throw new Error('Pinata credentials not found. Please add either NEXT_PUBLIC_PINATA_JWT or both NEXT_PUBLIC_IPFS_API_KEY and NEXT_PUBLIC_IPFS_API_SECRET to your environment variables.');
    }
    
    // Add metadata
    formData.append('pinataMetadata', JSON.stringify({
      name: 'ERC7730-Specification',
      keyvalues: {
        type: 'erc7730',
        timestamp: new Date().toISOString()
      }
    }));
    
    // Add options (include the hash in the response)
    formData.append('pinataOptions', JSON.stringify({
      cidVersion: 0 // Use CIDv0 for better compatibility
    }));
    
    // Prepare headers based on available authentication method
    const headers: Record<string, string> = {};
    if (hasJWT) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    } else {
      headers['pinata_api_key'] = apiKey;
      headers['pinata_secret_api_key'] = apiSecret;
    }
    
    // Using Pinata API
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData,
    });
    
    // Handle errors
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || responseText;
          } catch {
            errorMessage = responseText;
          }
        }
      } catch (e) {
        // Use default error message if we can't read the response
      }
      
      throw new Error(`Failed to upload to IPFS: ${errorMessage}`);
    }
    
    // Process successful response
    const result = await response.json();
    
    if (!result.IpfsHash) {
      throw new Error('No IPFS hash returned from Pinata');
    }
    
    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    // Wrap the error in a structured response for user feedback
    throw new Error(`Failed to upload to IPFS. Please check your network connection or Pinata credentials. Details: ${error.message}`);
  }
} 