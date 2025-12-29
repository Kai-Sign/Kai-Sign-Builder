import { ethStorageService } from './ethStorageService';

export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// EthStorage network configuration for wallet
export const ETHSTORAGE_NETWORK_CONFIG: NetworkConfig = {
  chainId: '0xD05', // 3333 in hex
  chainName: 'EthStorage Testnet',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['http://65.108.236.27:9540'],
  blockExplorerUrls: ['http://65.108.236.27:9540']
};

/**
 * Add EthStorage network to MetaMask or other compatible wallets
 */
export async function addEthStorageNetwork(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!window.ethereum) {
      throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
    }

    // Request to add the network
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [ETHSTORAGE_NETWORK_CONFIG]
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to add EthStorage network:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to add network to wallet' 
    };
  }
}

/**
 * Switch to EthStorage network
 */
export async function switchToEthStorageNetwork(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!window.ethereum) {
      throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
    }

    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ETHSTORAGE_NETWORK_CONFIG.chainId }]
    });

    return { success: true };
  } catch (error: any) {
    // If the network isn't added, add it first
    if (error.code === 4902) {
      return await addEthStorageNetwork();
    }
    
    console.error('Failed to switch to EthStorage network:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to switch network' 
    };
  }
}

/**
 * Check if user is on EthStorage network
 */
export async function isOnEthStorageNetwork(): Promise<boolean> {
  try {
    if (!window.ethereum) {
      return false;
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === ETHSTORAGE_NETWORK_CONFIG.chainId;
  } catch {
    return false;
  }
}

/**
 * Get current network chain ID
 */
export async function getCurrentChainId(): Promise<string | null> {
  try {
    if (!window.ethereum) {
      return null;
    }

    return await window.ethereum.request({ method: 'eth_chainId' });
  } catch {
    return null;
  }
}