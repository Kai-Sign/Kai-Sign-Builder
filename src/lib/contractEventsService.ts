interface IPFSMetadataResponse {
  spec_id: string;
  ipfs_hash?: string;
  contract_address?: string;
  chain_id?: number;
  error?: string;
}

export async function fetchIPFSMetadataFromAPI(specID: string): Promise<IPFSMetadataResponse> {
  try {
    // Use Railway API by default, allow override with NEXT_PUBLIC_API_URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kai-sign-production.up.railway.app';
    const endpoint = `${apiUrl}/api/py/getIPFSMetadata`;
    
    console.log('Calling Railway API:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spec_id: specID
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data: IPFSMetadataResponse = await response.json();
    return data;
    
  } catch (error) {
    console.error('Error fetching IPFS metadata from API:', error);
    throw error;
  }
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