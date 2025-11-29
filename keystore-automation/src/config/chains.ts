export interface ChainConfig {
  id: number;
  name: string;
  rpc: string;
  explorer: string;
  apiKey?: string;
  apiUrl?: string;
  kaisignAddress?: string;
  realityEthAddress?: string;
  minBondEth: string;
  gasMultiplier: number;
  enabled: boolean;
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    name: 'Ethereum',
    rpc: process.env.ETHEREUM_RPC_URL || '',
    explorer: 'https://etherscan.io',
    apiUrl: 'https://api.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY,
    minBondEth: '0.05',
    gasMultiplier: 1.2,
    enabled: true
  },

  // Sepolia Testnet (Primary testing chain)
  11155111: {
    id: 11155111,
    name: 'Sepolia',
    rpc: process.env.SEPOLIA_RPC_URL || '',
    explorer: 'https://sepolia.etherscan.io',
    apiUrl: 'https://api-sepolia.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY,
    kaisignAddress: process.env.KAISIGN_V1_ADDRESS || '0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719',
    realityEthAddress: process.env.REALITY_ETH_ADDRESS || '0x5b7dD1E86623dDB25ff312e17C5c51f9ee4C1555',
    minBondEth: '0.01',
    gasMultiplier: 1.1,
    enabled: true
  },

  // Polygon
  137: {
    id: 137,
    name: 'Polygon',
    rpc: process.env.POLYGON_RPC_URL || '',
    explorer: 'https://polygonscan.com',
    apiUrl: 'https://api.polygonscan.com/api',
    apiKey: process.env.POLYGONSCAN_API_KEY,
    minBondEth: '20.0', // MATIC
    gasMultiplier: 1.3,
    enabled: true
  },

  // Arbitrum One
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    rpc: process.env.ARBITRUM_RPC_URL || '',
    explorer: 'https://arbiscan.io',
    apiUrl: 'https://api.arbiscan.io/api',
    apiKey: process.env.ARBISCAN_API_KEY,
    minBondEth: '0.02',
    gasMultiplier: 1.1,
    enabled: true
  },

  // Base
  8453: {
    id: 8453,
    name: 'Base',
    rpc: process.env.BASE_RPC_URL || '',
    explorer: 'https://basescan.org',
    apiUrl: 'https://api.basescan.org/api',
    apiKey: process.env.BASESCAN_API_KEY,
    minBondEth: '0.02',
    gasMultiplier: 1.1,
    enabled: true
  },

  // Optimism
  10: {
    id: 10,
    name: 'Optimism',
    rpc: process.env.OPTIMISM_RPC_URL || '',
    explorer: 'https://optimistic.etherscan.io',
    apiUrl: 'https://api-optimistic.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY,
    minBondEth: '0.02',
    gasMultiplier: 1.1,
    enabled: true
  }
};

export const getChainConfig = (chainId: number): ChainConfig => {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  return config;
};

export const getEnabledChains = (): ChainConfig[] => {
  return Object.values(CHAIN_CONFIGS).filter(chain => chain.enabled);
};