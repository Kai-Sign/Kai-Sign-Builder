import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, decodeFunctionData } from 'viem'

// Get Alchemy API key from environment
const ALCHEMY_API_KEY = process.env.ALCHEMY_API;

// Network configuration for different chains using Alchemy RPC
const NETWORK_CONFIGS = {
  // Ethereum Networks
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  11155111: {
    name: 'Sepolia Testnet', 
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  17000: {
    name: 'Holesky Testnet',
    rpcUrl: `https://eth-holesky.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Polygon Networks
  137: {
    name: 'Polygon Mainnet',
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  80001: {
    name: 'Polygon Mumbai',
    rpcUrl: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  80002: {
    name: 'Polygon Amoy',
    rpcUrl: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Arbitrum Networks
  42161: {
    name: 'Arbitrum One',
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  421614: {
    name: 'Arbitrum Sepolia',
    rpcUrl: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Optimism Networks
  10: {
    name: 'Optimism Mainnet',
    rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  11155420: {
    name: 'Optimism Sepolia',
    rpcUrl: `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Base Networks
  8453: {
    name: 'Base Mainnet',
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  84532: {
    name: 'Base Sepolia',
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Other EVM Networks supported by Alchemy
  43114: {
    name: 'Avalanche C-Chain',
    rpcUrl: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  43113: {
    name: 'Avalanche Fuji',
    rpcUrl: `https://avax-fuji.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  
  // Fallback to public RPCs for unsupported Alchemy networks
  56: {
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  97: {
    name: 'BNB Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  250: {
    name: 'Fantom',
    rpcUrl: 'https://rpc.ftm.tools',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  },
  1666600000: {
    name: 'Harmony One',
    rpcUrl: 'https://api.harmony.one',
    etherscanApiKey: null
  }
} as const;

class ServerTransactionDecoder {
  private async getEtherscanABI(contractAddress: string, chainId: number): Promise<any[]> {
    const config = NETWORK_CONFIGS[chainId as keyof typeof NETWORK_CONFIGS];
    if (!config.etherscanApiKey) {
      throw new Error('No Etherscan API key available');
    }

    const baseUrl = chainId === 1 ? 'https://api.etherscan.io' :
                    chainId === 11155111 ? 'https://api-sepolia.etherscan.io' :
                    chainId === 137 ? 'https://api.polygonscan.com' :
                    chainId === 42161 ? 'https://api.arbiscan.io' :
                    chainId === 10 ? 'https://api-optimistic.etherscan.io' :
                    chainId === 8453 ? 'https://api.basescan.org' : 'https://api.etherscan.io';

    const url = `${baseUrl}/api?module=contract&action=getabi&address=${contractAddress}&apikey=${config.etherscanApiKey}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        return JSON.parse(data.result);
      }
      throw new Error(`Failed to get ABI: ${data.message || 'Unknown error'}`);
    } catch (error) {
      console.error('Error fetching ABI from Etherscan:', error);
      throw error;
    }
  }

  async decodeTransactionHashForChain(txHash: string, chainId: number) {
    try {
      // Validate transaction hash format
      if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error('Invalid transaction hash format. Must be a 64-character hex string starting with 0x.');
      }

      // Get network config for specified chain
      const config = NETWORK_CONFIGS[chainId as keyof typeof NETWORK_CONFIGS];
      
      if (!config) {
        throw new Error(`Network with chain ID ${chainId} is not supported for transaction decoding.`);
      }

      // Check if Alchemy API key is required but missing
      if (config.rpcUrl.includes('alchemy.com') && !ALCHEMY_API_KEY) {
        throw new Error(`Alchemy API key is required for ${config.name}. Please set ALCHEMY_API in your environment variables.`);
      }

      // Create public client
      const publicClient = createPublicClient({
        transport: http(config.rpcUrl),
      });

      console.log(`Decoding transaction ${txHash} on chain ${chainId} (${config.name})`);
      
      // Get the transaction
      const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
      console.log('Raw transaction:', tx);

      if (!tx.to) {
        throw new Error('Transaction is a contract creation, not a function call');
      }

      if (!tx.input || tx.input === '0x') {
        throw new Error('Transaction has no input data');
      }

      // Extract function selector
      const functionSelector = tx.input.slice(0, 10);
      console.log('Function selector:', functionSelector);

      // Try to get ABI from Etherscan
      let decodedFunction = null;
      try {
        const abi = await this.getEtherscanABI(tx.to, chainId);
        console.log('Retrieved ABI from Etherscan');
        
        // Try to decode with the ABI
        const decoded = decodeFunctionData({
          abi: abi,
          data: tx.input as `0x${string}`,
        });
        
        decodedFunction = {
          name: decoded.functionName,
          signature: `${decoded.functionName}(${decoded.args?.length || 0} args)`,
          params: decoded.args ? decoded.args.map((arg, index) => ({
            name: `param${index}`,
            type: 'unknown',
            value: typeof arg === 'bigint' ? arg.toString() : String(arg)
          })) : []
        };
        
        console.log('Successfully decoded function:', decodedFunction);
      } catch (abiError) {
        console.error('Failed to decode with ABI:', abiError);
        
        // Fallback to just the function selector
        decodedFunction = {
          name: functionSelector,
          signature: '',
          params: []
        };
      }

      const decodedData = {
        txHash,
        methodCall: decodedFunction,
        transfers: [],
        addressesMeta: {}
      };

      return {
        txHash,
        chainId,
        chainName: config.name,
        decodedData,
        success: true,
      };

    } catch (error: any) {
      console.error('Transaction decoding failed:', error);
      
      // Get chain info from provided chainId
      const config = NETWORK_CONFIGS[chainId as keyof typeof NETWORK_CONFIGS];
      const chainName = config?.name || `Chain ${chainId}`;

      return {
        txHash,
        chainId,
        chainName,
        decodedData: null,
        success: false,
        error: error.message || 'Failed to decode transaction',
      };
    }
  }

  getSupportedNetworks(): Array<{ chainId: number; name: string }> {
    return Object.entries(NETWORK_CONFIGS).map(([chainId, config]) => ({
      chainId: Number(chainId),
      name: config.name,
    }));
  }
}

const serverDecoder = new ServerTransactionDecoder();

export async function POST(request: NextRequest) {
  try {
    const { txHash, chainId } = await request.json();

    if (!txHash || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: txHash and chainId' },
        { status: 400 }
      );
    }

    const result = await serverDecoder.decodeTransactionHashForChain(txHash, chainId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supportedNetworks = serverDecoder.getSupportedNetworks();
    return NextResponse.json({ supportedNetworks });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}