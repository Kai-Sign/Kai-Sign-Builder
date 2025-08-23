import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

/**
 * ERC-7730 Metadata Provider for Hardware Wallets
 * Fetches and provides clear signing metadata from ERC-7730 descriptors
 */
export class ERC7730Provider {
  constructor(metadataDir = '../../contracts') {
    this.metadataDir = metadataDir;
    this.metadataCache = new Map();
    this.contractRegistry = new Map();
    
    // Initialize known contract mappings
    this.initializeRegistry();
  }

  /**
   * Initialize registry with known contract addresses
   */
  initializeRegistry() {
    // Mainnet contracts
    this.contractRegistry.set('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'usdc-erc7730.json');
    this.contractRegistry.set('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'tether-token-erc7730.json');
    this.contractRegistry.set('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', 'uniswap-v2-router-erc7730.json');
    this.contractRegistry.set('0xE592427A0AEce92De3Edee1F18E0157C05861564', 'uniswap-v3-router-erc7730.json');
    this.contractRegistry.set('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'weth-erc7730.json');
    
    // Sepolia contracts
    this.contractRegistry.set('0x1111111111111111111111111111111111111111', 'kaisign-erc7730.json');
  }

  /**
   * Load ERC-7730 metadata from file
   */
  async loadMetadata(filename) {
    try {
      if (this.metadataCache.has(filename)) {
        return this.metadataCache.get(filename);
      }

      const filePath = path.join(this.metadataDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const metadata = JSON.parse(content);
      
      // Validate ERC-7730 schema
      if (!metadata.$schema || !metadata.context || !metadata.display) {
        throw new Error('Invalid ERC-7730 metadata structure');
      }
      
      this.metadataCache.set(filename, metadata);
      return metadata;
    } catch (error) {
      console.warn(chalk.yellow(`Failed to load ERC-7730 metadata: ${filename}`), error.message);
      return null;
    }
  }

  /**
   * Get metadata for a specific contract address
   */
  async getContractMetadata(contractAddress, chainId) {
    const normalizedAddress = contractAddress.toLowerCase();
    const metadataFile = this.contractRegistry.get(normalizedAddress);
    
    if (!metadataFile) {
      console.log(chalk.yellow(`No ERC-7730 metadata found for ${contractAddress}`));
      return null;
    }
    
    const metadata = await this.loadMetadata(metadataFile);
    if (!metadata) return null;
    
    // Verify chain ID matches
    const deployment = metadata.context?.eip712?.deployments?.find(
      d => d.chainId === chainId && d.address.toLowerCase() === normalizedAddress
    );
    
    if (!deployment && metadata.context?.eip712?.deployments?.length > 0) {
      console.warn(chalk.yellow(`Chain ID ${chainId} not found in metadata for ${contractAddress}`));
    }
    
    return metadata;
  }

  /**
   * Format transaction for hardware wallet display using ERC-7730 metadata
   */
  async formatTransactionForDisplay(transaction, methodName) {
    const metadata = await this.getContractMetadata(transaction.to, transaction.chainId || 1);
    if (!metadata) return null;
    
    // Find the appropriate display format
    const format = metadata.display?.formats?.[methodName];
    if (!format) {
      console.log(chalk.yellow(`No display format found for method: ${methodName}`));
      return null;
    }
    
    // Build display fields
    const displayFields = [];
    
    // Add intent
    if (format.intent) {
      displayFields.push({
        label: 'Action',
        value: format.intent,
        type: 'intent'
      });
    }
    
    // Process each field
    for (const field of format.fields || []) {
      const displayField = await this.processDisplayField(field, transaction, metadata);
      if (displayField) {
        displayFields.push(displayField);
      }
    }
    
    return {
      metadata,
      format,
      displayFields,
      contractInfo: {
        name: metadata.metadata?.info?.name || 'Unknown',
        url: metadata.metadata?.info?.url,
        owner: metadata.metadata?.owner
      }
    };
  }

  /**
   * Process a single display field according to ERC-7730 format
   */
  async processDisplayField(field, transaction, metadata) {
    const { path, label, format, params } = field;
    
    // Handle transaction value paths
    if (path === '$tx.value') {
      return {
        label,
        value: ethers.formatEther(transaction.value),
        format,
        unit: 'ETH'
      };
    }
    
    // Handle data field paths
    if (path && transaction.data) {
      const value = this.extractValueFromData(path, transaction.data);
      if (value !== null) {
        return {
          label,
          value: this.formatValue(value, format, params, metadata),
          format
        };
      }
    }
    
    return null;
  }

  /**
   * Extract value from transaction data based on path
   */
  extractValueFromData(path, data) {
    // This is a simplified extraction - in production, use proper ABI decoding
    // Path format: parameter[index] or parameter.field
    try {
      // Remove method selector (first 10 chars)
      const params = data.slice(10);
      
      // Simple parameter extraction by position
      const paramIndex = parseInt(path.match(/\[(\d+)\]/)?.[1] || '0');
      const paramStart = paramIndex * 64;
      const paramEnd = paramStart + 64;
      
      if (params.length >= paramEnd) {
        return '0x' + params.slice(paramStart, paramEnd);
      }
    } catch (error) {
      console.warn('Failed to extract value from data:', error);
    }
    
    return null;
  }

  /**
   * Format value according to ERC-7730 format type
   */
  formatValue(value, format, params, metadata) {
    switch (format) {
      case 'hex':
        return value;
        
      case 'addressName':
        // Look up address name from registry or ENS
        return this.formatAddress(value);
        
      case 'tokenAmount':
        const token = params?.tokenPath ? metadata.metadata?.token : null;
        const decimals = token?.decimals || 18;
        const ticker = token?.ticker || 'TOKEN';
        return `${ethers.formatUnits(value, decimals)} ${ticker}`;
        
      case 'duration':
        const seconds = parseInt(value, 16);
        return this.formatDuration(seconds);
        
      case 'raw':
      default:
        return value.toString();
    }
  }

  /**
   * Format address with name lookup
   */
  formatAddress(address) {
    // In production, look up from ENS or address book
    const known = {
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'Uniswap V2',
    };
    
    const name = known[address];
    if (name) {
      return `${name} (${address.slice(0, 6)}...${address.slice(-4)})`;
    }
    
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  /**
   * Generate hardware wallet payload for clear signing
   */
  async generateHardwareWalletPayload(transaction, methodName) {
    const display = await this.formatTransactionForDisplay(transaction, methodName);
    if (!display) return null;
    
    // Build payload for hardware wallet
    const payload = {
      version: '1.0.0',
      chainId: transaction.chainId || 1,
      contract: {
        address: transaction.to,
        name: display.contractInfo.name,
        verified: true // Would check actual verification status
      },
      method: {
        name: methodName,
        intent: display.format.intent
      },
      fields: display.displayFields,
      metadata: {
        source: 'ERC-7730',
        schema: display.metadata.$schema,
        owner: display.contractInfo.owner
      }
    };
    
    return payload;
  }

  /**
   * Validate ERC-7730 metadata signature
   */
  async validateMetadataSignature(metadata, signature) {
    // In production, verify cryptographic signature of metadata
    // This ensures metadata hasn't been tampered with
    try {
      // Simplified validation - check structure
      if (!metadata.$schema || !metadata.context || !metadata.display) {
        return false;
      }
      
      // Would verify actual signature here
      return true;
    } catch (error) {
      console.error('Metadata validation failed:', error);
      return false;
    }
  }

  /**
   * Fetch metadata from IPFS or registry
   */
  async fetchFromRegistry(contractAddress, chainId) {
    // In production, fetch from:
    // 1. On-chain registry
    // 2. IPFS
    // 3. Centralized registry API
    
    console.log(chalk.blue(`Fetching ERC-7730 metadata for ${contractAddress} on chain ${chainId}`));
    
    // Simulate registry lookup
    return this.getContractMetadata(contractAddress, chainId);
  }

  /**
   * Cache metadata for offline use
   */
  async cacheMetadataForOffline(contracts) {
    const cached = [];
    
    for (const { address, chainId } of contracts) {
      const metadata = await this.fetchFromRegistry(address, chainId);
      if (metadata) {
        const filename = `${address.toLowerCase()}-${chainId}.json`;
        const filePath = path.join(this.metadataDir, 'cache', filename);
        
        try {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
          cached.push({ address, chainId, filename });
        } catch (error) {
          console.error(`Failed to cache metadata for ${address}:`, error);
        }
      }
    }
    
    return cached;
  }
}

export default ERC7730Provider;