import { ethers } from 'ethers';

/**
 * Clear Signing Transaction Resolver
 * Provides metadata resolution for different transaction types
 */
export class ClearSigningResolver {
  constructor() {
    this.contractMethods = new Map();
    this.initializeKnownMethods();
  }

  /**
   * Initialize known contract methods for resolution
   */
  initializeKnownMethods() {
    // ERC20 methods
    this.contractMethods.set('0xa9059cbb', {
      name: 'transfer',
      signature: 'transfer(address,uint256)',
      type: 'ERC20',
      parameters: ['recipient', 'amount']
    });

    this.contractMethods.set('0x23b872dd', {
      name: 'transferFrom',
      signature: 'transferFrom(address,address,uint256)',
      type: 'ERC721',
      parameters: ['from', 'to', 'tokenId']
    });

    // Uniswap V3 methods
    this.contractMethods.set('0x414bf389', {
      name: 'exactInputSingle',
      signature: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
      type: 'UniswapV3',
      parameters: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96']
    });

    // Add more known methods as needed
  }

  /**
   * Resolve transaction metadata for clear signing
   */
  async resolveTransaction(transaction, config = {}) {
    const resolution = {
      erc20TokenInformation: [],
      nftInformation: [],
      externalPlugin: null,
      domainName: null,
      contractMethod: null
    };

    try {
      // Extract method selector from transaction data
      const methodSelector = transaction.data?.slice(0, 10);
      
      if (methodSelector && methodSelector !== '0x') {
        const method = this.contractMethods.get(methodSelector);
        if (method) {
          resolution.contractMethod = {
            selector: methodSelector,
            name: method.name,
            signature: method.signature,
            type: method.type,
            parameters: this.decodeParameters(transaction.data, method)
          };
        }
      }

      // ERC20 token resolution
      if (config.erc20 && this.isERC20Transaction(transaction)) {
        resolution.erc20TokenInformation = await this.resolveERC20Metadata(transaction);
      }

      // NFT resolution
      if (config.nft && this.isNFTTransaction(transaction)) {
        resolution.nftInformation = await this.resolveNFTMetadata(transaction);
      }

      // External plugin resolution
      if (config.externalPlugins) {
        resolution.externalPlugin = await this.resolveExternalPlugin(transaction, config);
      }

      // Domain name resolution
      if (config.domains && config.domains.length > 0) {
        resolution.domainName = await this.resolveDomainName(transaction.to, config.domains);
      }

      return resolution;

    } catch (error) {
      console.warn('Transaction resolution failed:', error.message);
      return resolution;
    }
  }

  /**
   * Check if transaction is ERC20 related
   */
  isERC20Transaction(transaction) {
    const methodSelector = transaction.data?.slice(0, 10);
    return methodSelector === '0xa9059cbb' || // transfer
           methodSelector === '0x095ea7b3' || // approve
           methodSelector === '0x23b872dd';   // transferFrom (could be ERC20 or ERC721)
  }

  /**
   * Check if transaction is NFT related
   */
  isNFTTransaction(transaction) {
    const methodSelector = transaction.data?.slice(0, 10);
    return methodSelector === '0x23b872dd' || // transferFrom
           methodSelector === '0x42842e0e' || // safeTransferFrom
           methodSelector === '0xb88d4fde';   // safeTransferFrom with data
  }

  /**
   * Resolve ERC20 token metadata
   */
  async resolveERC20Metadata(transaction) {
    return [{
      contractAddress: transaction.to,
      ticker: 'USDC', // In real implementation, fetch from token registry
      decimals: 6,
      chainId: transaction.chainId || 1,
      signature: this.generateERC20Signature(transaction.to, 'USDC', 6)
    }];
  }

  /**
   * Resolve NFT metadata
   */
  async resolveNFTMetadata(transaction) {
    return [{
      contractAddress: transaction.to,
      collectionName: 'Bored Ape Yacht Club', // In real implementation, fetch from NFT registry
      tokenId: this.extractTokenIdFromData(transaction.data),
      signature: this.generateNFTSignature(transaction.to, 'Bored Ape Yacht Club')
    }];
  }

  /**
   * Resolve external plugin information
   */
  async resolveExternalPlugin(transaction, config) {
    const methodSelector = transaction.data?.slice(0, 10);
    
    if (config.uniswapV3 && methodSelector === '0x414bf389') {
      return {
        pluginName: 'Uniswap V3',
        contractAddress: transaction.to,
        methodSelector: methodSelector,
        description: 'Swap tokens on Uniswap V3',
        signature: this.generatePluginSignature('uniswap-v3', transaction.to, methodSelector)
      };
    }

    return null;
  }

  /**
   * Resolve domain name for address
   */
  async resolveDomainName(address, domains) {
    // Mock ENS resolution
    if (address.toLowerCase() === '0x742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f') {
      return {
        domain: 'vitalik.eth',
        type: 'ENS',
        address: address,
        signature: this.generateDomainSignature('vitalik.eth', address)
      };
    }
    
    return null;
  }

  /**
   * Decode transaction parameters based on method signature
   */
  decodeParameters(data, method) {
    try {
      const iface = new ethers.Interface([`function ${method.signature}`]);
      const decoded = iface.decodeFunctionData(method.name, data);
      
      const parameters = {};
      method.parameters.forEach((param, index) => {
        parameters[param] = decoded[index]?.toString() || decoded[index];
      });
      
      return parameters;
    } catch (error) {
      console.warn('Parameter decoding failed:', error.message);
      return {};
    }
  }

  /**
   * Extract token ID from transaction data
   */
  extractTokenIdFromData(data) {
    if (!data || data.length < 138) return '0';
    
    // For transferFrom(address,address,uint256), tokenId is the third parameter
    const tokenIdHex = data.slice(130, 138); // Last 8 chars of the data
    return parseInt(tokenIdHex, 16).toString();
  }

  /**
   * Generate ERC20 token signature for Ledger
   */
  generateERC20Signature(contractAddress, ticker, decimals) {
    // This would normally be a cryptographic signature from a trusted source
    // For demo purposes, we'll create a mock signature
    const payload = {
      contractAddress: contractAddress.toLowerCase(),
      ticker,
      decimals,
      chainId: 1
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('hex');
  }

  /**
   * Generate NFT collection signature for Ledger
   */
  generateNFTSignature(contractAddress, collectionName) {
    const payload = {
      contractAddress: contractAddress.toLowerCase(),
      collectionName,
      chainId: 1
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('hex');
  }

  /**
   * Generate plugin signature for Ledger
   */
  generatePluginSignature(pluginId, contractAddress, methodSelector) {
    const payload = {
      pluginId,
      contractAddress: contractAddress.toLowerCase(),
      methodSelector,
      chainId: 1
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('hex');
  }

  /**
   * Generate domain name signature for Ledger
   */
  generateDomainSignature(domain, address) {
    const payload = {
      domain,
      address: address.toLowerCase(),
      type: 'ENS',
      chainId: 1
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('hex');
  }

  /**
   * Get resolution summary for display
   */
  getResolutionSummary(resolution) {
    const summary = {
      hasERC20: resolution.erc20TokenInformation.length > 0,
      hasNFT: resolution.nftInformation.length > 0,
      hasPlugin: !!resolution.externalPlugin,
      hasDomain: !!resolution.domainName,
      hasMethod: !!resolution.contractMethod
    };

    summary.description = this.generateTransactionDescription(resolution);
    return summary;
  }

  /**
   * Generate human-readable transaction description
   */
  generateTransactionDescription(resolution) {
    if (resolution.contractMethod) {
      switch (resolution.contractMethod.type) {
        case 'ERC20':
          return `Transfer ${resolution.contractMethod.name} tokens`;
        case 'ERC721':
          return `Transfer NFT token`;
        case 'UniswapV3':
          return `Swap tokens on Uniswap V3`;
        default:
          return `Call ${resolution.contractMethod.name} method`;
      }
    }
    
    return 'Unknown transaction';
  }
} 