// IPFS Metadata Service for fetching and parsing ERC7730 specifications

// Use environment variable for IPFS gateway URL
const IPFS_GATEWAY_URL = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || "https://ipfs.io/ipfs";

export interface ERC7730Metadata {
  contractAddress?: string;
  chainId?: number;
  deployments?: Array<{
    chainId: number;
    address: string;
  }>;
  domain?: {
    name?: string;
    chainId?: number;
    verifyingContract?: string;
  };
  metadata?: {
    owner?: string;
  };
  ipfsUrl: string;
}

/**
 * Fetches IPFS content and extracts ERC7730 metadata
 */
export async function fetchIPFSMetadata(ipfsHash: string): Promise<ERC7730Metadata> {
  const ipfsUrl = `${IPFS_GATEWAY_URL}/${ipfsHash}`;
  
  try {
    console.log(`Fetching IPFS content from: ${ipfsUrl}`);
    
    const response = await fetch(ipfsUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS content: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log('Raw IPFS content:', content);
    
    // Parse JSON content
    let jsonData;
    try {
      jsonData = JSON.parse(content);
    } catch (parseError) {
      throw new Error('IPFS content is not valid JSON');
    }
    
    console.log('Parsed IPFS JSON:', jsonData);
    
    // Extract metadata according to ERC7730 specification
    const metadata: ERC7730Metadata = {
      ipfsUrl
    };
    
    // Extract contract address and chain ID from context.contract.deployments (new ERC7730 format)
    if (jsonData.context?.contract?.deployments && Array.isArray(jsonData.context.contract.deployments)) {
      metadata.deployments = jsonData.context.contract.deployments;
      
      // Get the first deployment for primary contract address and chain ID
      if (jsonData.context.contract.deployments.length > 0) {
        const firstDeployment = jsonData.context.contract.deployments[0];
        metadata.contractAddress = firstDeployment.address;
        metadata.chainId = firstDeployment.chainId;
      }
    }
    // Fallback: Extract contract address and chain ID from context.eip712.deployments (old format)
    else if (jsonData.context?.eip712?.deployments && Array.isArray(jsonData.context.eip712.deployments)) {
      metadata.deployments = jsonData.context.eip712.deployments;
      
      // Get the first deployment for primary contract address and chain ID
      if (jsonData.context.eip712.deployments.length > 0) {
        const firstDeployment = jsonData.context.eip712.deployments[0];
        metadata.contractAddress = firstDeployment.address;
        metadata.chainId = firstDeployment.chainId;
      }
    }
    
    // Extract domain information
    if (jsonData.context?.eip712?.domain) {
      metadata.domain = jsonData.context.eip712.domain;
      
      // Fallback to domain for contract address and chain ID if not found in deployments
      if (!metadata.contractAddress && jsonData.context.eip712.domain.verifyingContract) {
        metadata.contractAddress = jsonData.context.eip712.domain.verifyingContract;
      }
      
      if (!metadata.chainId && jsonData.context.eip712.domain.chainId) {
        metadata.chainId = jsonData.context.eip712.domain.chainId;
      }
    }
    
    // Extract metadata
    if (jsonData.metadata) {
      metadata.metadata = jsonData.metadata;
    }
    
    console.log('Extracted metadata:', metadata);
    
    return metadata;
  } catch (error) {
    console.error('Error fetching IPFS metadata:', error);
    throw error;
  }
}

/**
 * Formats contract address for display (adds 0x prefix if missing)
 */
export function formatContractAddress(address: string): string {
  if (!address) return '';
  
  // Add 0x prefix if missing
  if (!address.startsWith('0x')) {
    return `0x${address}`;
  }
  
  return address;
}

/**
 * Gets chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const chainNames: { [key: number]: string } = {
    1: 'Ethereum Mainnet',
    3: 'Ropsten Testnet',
    4: 'Rinkeby Testnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon Mainnet',
    80001: 'Polygon Mumbai Testnet',
    56: 'BSC Mainnet',
    97: 'BSC Testnet',
    43114: 'Avalanche Mainnet',
    43113: 'Avalanche Fuji Testnet',
    250: 'Fantom Mainnet',
    4002: 'Fantom Testnet',
    42161: 'Arbitrum One',
    421613: 'Arbitrum Goerli',
    10: 'Optimism',
    420: 'Optimism Goerli'
  };
  
  return chainNames[chainId] || `Chain ID ${chainId}`;
} 