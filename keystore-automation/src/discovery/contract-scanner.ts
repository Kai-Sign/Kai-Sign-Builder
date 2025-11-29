import axios from 'axios';
import { ethers } from 'ethers';
import { ChainConfig, getChainConfig } from '../config/chains.js';
import { logger, botLogger, PerformanceTimer } from '../utils/logger.js';

export interface ContractInfo {
  address: string;
  chainId: number;
  name?: string;
  symbol?: string;
  isVerified: boolean;
  txCount: number;
  balance: string;
  contractType: 'erc20' | 'erc721' | 'erc1155' | 'defi' | 'governance' | 'other';
  priority: number; // 1-10, higher = more important
  lastActivity: Date;
  tvl?: string; // Total Value Locked (for DeFi contracts)
  hasErc7730: boolean;
  discoveredAt: Date;
}

export interface ScanResult {
  contracts: ContractInfo[];
  totalScanned: number;
  chainId: number;
  scanDuration: number;
  errors: string[];
}

export class ContractScanner {
  private apiKeys: Map<number, string> = new Map();
  private providers: Map<number, ethers.Provider> = new Map();
  private knownDefiProtocols: Map<string, { name: string; type: string }> = new Map();

  constructor() {
    this.initializeKnownProtocols();
  }

  async initialize(chains: ChainConfig[]): Promise<void> {
    for (const chain of chains) {
      if (chain.enabled && chain.rpc) {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        this.providers.set(chain.id, provider);

        // Store API key
        if (chain.apiKey) {
          this.apiKeys.set(chain.id, chain.apiKey);
        }

        logger.info(`Initialized scanner for ${chain.name} (${chain.id})`);
      }
    }
  }

  /**
   * Scan a specific chain for contracts
   */
  async scanChain(
    chainId: number,
    options: {
      maxContracts?: number;
      minTxCount?: number;
      skipVerifiedOnly?: boolean;
      startBlock?: number;
      endBlock?: number;
    } = {}
  ): Promise<ScanResult> {
    const timer = new PerformanceTimer(`Chain scan ${chainId}`);
    const errors: string[] = [];
    const contracts: ContractInfo[] = [];

    try {
      const chain = getChainConfig(chainId);
      botLogger.discovery(`Starting chain scan for ${chain.name}`, { chainId, options });

      // Get popular contracts from block explorer
      const explorerContracts = await this.getPopularContractsFromExplorer(chainId, options);
      contracts.push(...explorerContracts);

      // Get recent contract deployments
      const recentContracts = await this.getRecentContracts(chainId, options);
      contracts.push(...recentContracts);

      // Get DeFi protocol contracts if known
      const defiContracts = await this.getDefiProtocolContracts(chainId);
      contracts.push(...defiContracts);

      // Remove duplicates and sort by priority
      const uniqueContracts = this.deduplicateAndSort(contracts);

      // Limit results
      const maxContracts = options.maxContracts || 100;
      const finalContracts = uniqueContracts.slice(0, maxContracts);

      const duration = timer.end({
        chainId,
        contractsFound: finalContracts.length,
        errors: errors.length
      });

      return {
        contracts: finalContracts,
        totalScanned: contracts.length,
        chainId,
        scanDuration: duration,
        errors
      };

    } catch (error) {
      const errorMsg = `Failed to scan chain ${chainId}: ${error}`;
      errors.push(errorMsg);
      botLogger.error(errorMsg, error);

      return {
        contracts: [],
        totalScanned: 0,
        chainId,
        scanDuration: timer.end(),
        errors
      };
    }
  }

  /**
   * Get detailed information about a specific contract
   */
  async getContractDetails(address: string, chainId: number): Promise<ContractInfo | null> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`No provider for chain ${chainId}`);
      }

      const code = await provider.getCode(address);
      if (code === '0x') {
        return null; // Not a contract
      }

      const [balance, txCount] = await Promise.all([
        provider.getBalance(address),
        this.getTransactionCount(address, chainId)
      ]);

      const contractInfo: ContractInfo = {
        address: address.toLowerCase(),
        chainId,
        isVerified: await this.isContractVerified(address, chainId),
        txCount,
        balance: ethers.formatEther(balance),
        contractType: await this.detectContractType(address, chainId),
        priority: 5, // Default priority
        lastActivity: new Date(),
        hasErc7730: false, // TODO: Check if ERC7730 spec exists
        discoveredAt: new Date()
      };

      // Enhanced detection for specific contract types
      await this.enhanceContractInfo(contractInfo);

      return contractInfo;

    } catch (error) {
      botLogger.error(`Failed to get contract details for ${address}:`, error);
      return null;
    }
  }

  /**
   * Check if a contract already has an ERC7730 specification
   */
  async checkErc7730Existence(address: string, chainId: number): Promise<boolean> {
    try {
      // TODO: Query KaiSign contract to see if spec exists
      // For now, return false to indicate no spec exists
      return false;
    } catch (error) {
      botLogger.error(`Failed to check ERC7730 existence for ${address}:`, error);
      return false; // Assume no spec exists on error
    }
  }

  private async getPopularContractsFromExplorer(
    chainId: number,
    options: any
  ): Promise<ContractInfo[]> {
    const chain = getChainConfig(chainId);
    const apiKey = this.apiKeys.get(chainId);
    
    if (!chain.apiUrl || !apiKey) {
      botLogger.discovery(`No API configuration for chain ${chainId}`);
      return [];
    }

    try {
      // Get top contracts by transaction count
      const response = await axios.get(chain.apiUrl, {
        params: {
          module: 'stats',
          action: 'topcontractcount',
          apikey: apiKey,
          page: 1,
          offset: 50
        },
        timeout: 30000
      });

      if (response.data.status !== '1') {
        throw new Error(`API error: ${response.data.message}`);
      }

      const contracts: ContractInfo[] = [];

      for (const item of response.data.result || []) {
        try {
          const contractInfo = await this.getContractDetails(item.contractaddress, chainId);
          if (contractInfo && contractInfo.txCount >= (options.minTxCount || 100)) {
            contractInfo.priority = Math.min(10, Math.floor(contractInfo.txCount / 10000) + 5);
            contracts.push(contractInfo);
          }
        } catch (error) {
          botLogger.error(`Error processing contract ${item.contractaddress}:`, error);
        }
      }

      return contracts;

    } catch (error) {
      botLogger.error(`Failed to get popular contracts from explorer for chain ${chainId}:`, error);
      return [];
    }
  }

  private async getRecentContracts(chainId: number, options: any): Promise<ContractInfo[]> {
    const provider = this.providers.get(chainId);
    if (!provider) return [];

    try {
      const currentBlock = await provider.getBlockNumber();
      const startBlock = options.startBlock || (currentBlock - 1000); // Last ~1000 blocks
      const endBlock = options.endBlock || currentBlock;

      const contracts: ContractInfo[] = [];

      // Sample recent blocks for contract deployments
      const blockSampleSize = Math.min(100, endBlock - startBlock);
      const blockStep = Math.floor((endBlock - startBlock) / blockSampleSize);

      for (let i = 0; i < blockSampleSize; i++) {
        const blockNumber = startBlock + (i * blockStep);
        
        try {
          const block = await provider.getBlock(blockNumber, true);
          if (!block || !block.transactions) continue;

          for (const tx of block.transactions) {
            if (typeof tx === 'string') continue;
            
            // Check for contract creation (to field is null)
            if (tx.to === null && tx.creates) {
              const contractInfo = await this.getContractDetails(tx.creates, chainId);
              if (contractInfo) {
                contractInfo.priority = 3; // Lower priority for recent deployments
                contracts.push(contractInfo);
              }
            }
          }
        } catch (error) {
          // Skip problematic blocks
          continue;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return contracts;

    } catch (error) {
      botLogger.error(`Failed to get recent contracts for chain ${chainId}:`, error);
      return [];
    }
  }

  private async getDefiProtocolContracts(chainId: number): Promise<ContractInfo[]> {
    const contracts: ContractInfo[] = [];

    // Known DeFi protocol addresses by chain
    const defiAddresses = this.getKnownDefiAddresses(chainId);

    for (const [address, protocol] of defiAddresses) {
      try {
        const contractInfo = await this.getContractDetails(address, chainId);
        if (contractInfo) {
          contractInfo.name = protocol.name;
          contractInfo.contractType = 'defi';
          contractInfo.priority = 8; // High priority for known DeFi protocols
          contracts.push(contractInfo);
        }
      } catch (error) {
        botLogger.error(`Error processing DeFi contract ${address}:`, error);
      }
    }

    return contracts;
  }

  private async isContractVerified(address: string, chainId: number): Promise<boolean> {
    const chain = getChainConfig(chainId);
    const apiKey = this.apiKeys.get(chainId);

    if (!chain.apiUrl || !apiKey) return false;

    try {
      const response = await axios.get(chain.apiUrl, {
        params: {
          module: 'contract',
          action: 'getsourcecode',
          address,
          apikey: apiKey
        },
        timeout: 10000
      });

      return response.data.status === '1' && response.data.result[0]?.SourceCode !== '';
    } catch (error) {
      return false;
    }
  }

  private async detectContractType(address: string, chainId: number): Promise<string> {
    const provider = this.providers.get(chainId);
    if (!provider) return 'other';

    try {
      // Check for ERC20
      try {
        const contract = new ethers.Contract(address, [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ], provider);

        await contract.name();
        await contract.symbol();
        return 'erc20';
      } catch {}

      // Check for ERC721
      try {
        const contract = new ethers.Contract(address, [
          'function supportsInterface(bytes4) view returns (bool)'
        ], provider);

        const erc721InterfaceId = '0x80ac58cd';
        if (await contract.supportsInterface(erc721InterfaceId)) {
          return 'erc721';
        }
      } catch {}

      // Check for common DeFi patterns
      const code = await provider.getCode(address);
      const codeString = code.toLowerCase();

      if (codeString.includes('swap') || codeString.includes('liquidity') || codeString.includes('pool')) {
        return 'defi';
      }

      if (codeString.includes('governance') || codeString.includes('voting')) {
        return 'governance';
      }

      return 'other';

    } catch (error) {
      return 'other';
    }
  }

  private async enhanceContractInfo(contractInfo: ContractInfo): Promise<void> {
    // Add priority scoring based on various factors
    let priority = 5;

    // Transaction volume factor
    if (contractInfo.txCount > 100000) priority += 3;
    else if (contractInfo.txCount > 10000) priority += 2;
    else if (contractInfo.txCount > 1000) priority += 1;

    // Contract type factor
    switch (contractInfo.contractType) {
      case 'defi':
        priority += 2;
        break;
      case 'erc20':
        priority += 1;
        break;
      case 'governance':
        priority += 1;
        break;
    }

    // Verification factor
    if (contractInfo.isVerified) priority += 1;

    contractInfo.priority = Math.min(10, priority);
  }

  private async getTransactionCount(address: string, chainId: number): Promise<number> {
    const chain = getChainConfig(chainId);
    const apiKey = this.apiKeys.get(chainId);

    if (!chain.apiUrl || !apiKey) return 0;

    try {
      const response = await axios.get(chain.apiUrl, {
        params: {
          module: 'proxy',
          action: 'eth_getTransactionCount',
          address,
          tag: 'latest',
          apikey: apiKey
        },
        timeout: 10000
      });

      return parseInt(response.data.result || '0', 16);
    } catch (error) {
      return 0;
    }
  }

  private deduplicateAndSort(contracts: ContractInfo[]): ContractInfo[] {
    const seen = new Set<string>();
    const unique: ContractInfo[] = [];

    for (const contract of contracts) {
      const key = `${contract.address}-${contract.chainId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(contract);
      }
    }

    // Sort by priority (descending) and then by transaction count
    return unique.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.txCount - a.txCount;
    });
  }

  private initializeKnownProtocols(): void {
    // Add known DeFi protocols
    this.knownDefiProtocols.set('uniswap-v3', { name: 'Uniswap V3', type: 'dex' });
    this.knownDefiProtocols.set('aave-v3', { name: 'Aave V3', type: 'lending' });
    this.knownDefiProtocols.set('compound', { name: 'Compound', type: 'lending' });
    this.knownDefiProtocols.set('makerdao', { name: 'MakerDAO', type: 'stablecoin' });
  }

  private getKnownDefiAddresses(chainId: number): Map<string, { name: string; type: string }> {
    const addresses = new Map<string, { name: string; type: string }>();

    switch (chainId) {
      case 1: // Ethereum Mainnet
        addresses.set('0x1f98431c8ad98523631ae4a59f267346ea31f984', { name: 'Uniswap V3 Factory', type: 'dex' });
        addresses.set('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', { name: 'Aave Lending Pool', type: 'lending' });
        addresses.set('0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', { name: 'Compound cETH', type: 'lending' });
        break;
      case 137: // Polygon
        addresses.set('0x1f98431c8ad98523631ae4a59f267346ea31f984', { name: 'Uniswap V3 Factory', type: 'dex' });
        addresses.set('0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf', { name: 'Aave Lending Pool', type: 'lending' });
        break;
      case 42161: // Arbitrum
        addresses.set('0x1f98431c8ad98523631ae4a59f267346ea31f984', { name: 'Uniswap V3 Factory', type: 'dex' });
        break;
    }

    return addresses;
  }
}