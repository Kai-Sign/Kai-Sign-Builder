interface IPFSMetadataResponse {
  spec_id: string;
  ipfs_hash?: string;
  contract_address?: string;
  chain_id?: number;
  error?: string;
}

export async function fetchIPFSMetadataFromAPI(specID: string): Promise<IPFSMetadataResponse> {
  // Validate and format spec_id before sending
  function validateAndFormatSpecId(id: string): string {
    if (!id) {
      throw new Error("Spec ID cannot be empty");
    }
    
    // Remove any whitespace
    id = id.trim();
    
    // If it doesn't start with 0x, add it
    if (!id.startsWith('0x')) {
      id = '0x' + id;
    }
    
    // Remove 0x prefix for length checking
    const hexPart = id.slice(2);
    
    // Check if it's valid hex
    if (!/^[a-fA-F0-9]+$/.test(hexPart)) {
      throw new Error("Spec ID must contain only hexadecimal characters");
    }
    
    // Pad to 64 characters (32 bytes) if needed
    if (hexPart.length < 64) {
      const paddedHex = hexPart.padStart(64, '0');
      id = '0x' + paddedHex;
    } else if (hexPart.length > 64) {
      // Truncate if too long
      const truncatedHex = hexPart.slice(0, 64);
      id = '0x' + truncatedHex;
    }
    
    // Final validation: should be exactly 66 characters (0x + 64 hex chars)
    if (id.length !== 66) {
      throw new Error(`Invalid spec ID format. Expected 66 characters, got ${id.length}`);
    }
    
    return id;
  }

  const maxRetries = 3;
  let retryDelay = 1000; // Start with 1 second delay
  
  // Validate and format the spec ID
  let formattedSpecId: string;
  try {
    formattedSpecId = validateAndFormatSpecId(specID);
    console.log(`Original spec ID: ${specID}`);
    console.log(`Formatted spec ID: ${formattedSpecId}`);
  } catch (validationError) {
    throw new Error(`Invalid spec ID format: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
  }
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use Railway API by default, allow override with NEXT_PUBLIC_API_URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kai-sign-production.up.railway.app';
      const endpoint = `${apiUrl}/api/py/getIPFSMetadata`;
      
      console.log(`Calling Railway API (attempt ${attempt + 1}):`, endpoint);
      
      const requestBody = { spec_id: formattedSpecId };
      console.log(`Request body:`, JSON.stringify(requestBody));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      });

      // Handle 502/503/504 errors with retry
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt < maxRetries) {
          console.log(`Backend not ready (${response.status}), retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2; // Exponential backoff
          continue;
        } else {
          throw new Error(`Backend service is currently unavailable (${response.status}). Please try again later.`);
        }
      }

      // Handle 422 validation errors specifically
      if (response.status === 422) {
        try {
          const errorData = await response.json();
          console.error('Validation Error Details:', errorData);
          
          let validationMessage = "Request validation failed.";
          if (errorData.detail && Array.isArray(errorData.detail)) {
            const errors = errorData.detail.map((err: any) => 
              `${err.loc?.join('.') || 'field'}: ${err.msg || err.type}`
            ).join('; ');
            validationMessage = `Validation failed: ${errors}`;
          } else if (errorData.detail) {
            validationMessage = `Validation failed: ${errorData.detail}`;
          }
          
          throw new Error(validationMessage);
        } catch (parseError) {
          throw new Error("Request validation failed. Please check the spec_id format.");
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: IPFSMetadataResponse = await response.json();
      return data;
      
    } catch (error) {
      // Only retry on network errors or specific API errors
      if (error instanceof TypeError && error.message.includes("fetch") && attempt < maxRetries) {
        console.log(`Network error, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
        continue;
      }
      
      console.error('Error fetching IPFS metadata from API:', error);
      throw error;
    }
  }
  
  throw new Error("Failed to fetch IPFS metadata after multiple attempts");
}

export function formatContractAddress(address: string): string {
  if (!address) return '';
  
  // If it's already a full address, return as is
  if (address.startsWith('0x') && address.length === 42) {
    return address;
  }
  
  // If it's a short address like "7b24ed5", pad it to full address
  if (!address.startsWith('0x')) {
    return `0x${address.padStart(40, '0')}`;
  }
  
  return address;
}

export function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    56: 'BSC',
    43114: 'Avalanche',
    250: 'Fantom',
    42161: 'Arbitrum One',
    10: 'Optimism',
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
} 