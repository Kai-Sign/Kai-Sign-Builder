/**
 * ERC20 Metadata Provider for Clear Signing
 * Provides token information for Ledger clear signing display
 */
export class ERC20MetadataProvider {
  constructor() {
    this.tokenRegistry = new Map();
    this.initializeKnownTokens();
  }

  /**
   * Initialize known ERC20 tokens
   */
  initializeKnownTokens() {
    // Mainnet tokens
    this.tokenRegistry.set('0xa0b86a33e6441f8c6f94c60f717e0e0a0e4b0c6d', {
      ticker: 'USDC',
      decimals: 6,
      chainId: 1,
      name: 'USD Coin'
    });

    this.tokenRegistry.set('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', {
      ticker: 'WETH',
      decimals: 18,
      chainId: 1,
      name: 'Wrapped Ether'
    });

    this.tokenRegistry.set('0xdac17f958d2ee523a2206206994597c13d831ec7', {
      ticker: 'USDT',
      decimals: 6,
      chainId: 1,
      name: 'Tether USD'
    });

    this.tokenRegistry.set('0x6b175474e89094c44da98b954eedeac495271d0f', {
      ticker: 'DAI',
      decimals: 18,
      chainId: 1,
      name: 'Dai Stablecoin'
    });

    this.tokenRegistry.set('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', {
      ticker: 'UNI',
      decimals: 18,
      chainId: 1,
      name: 'Uniswap'
    });

    // Add more tokens as needed
  }

  /**
   * Get token information by contract address
   */
  async getTokenInfo(contractAddress) {
    const normalizedAddress = contractAddress.toLowerCase();
    const tokenInfo = this.tokenRegistry.get(normalizedAddress);
    
    if (!tokenInfo) {
      console.warn(`Token not found in registry: ${contractAddress}`);
      return null;
    }

    // Generate the data payload for Ledger
    const data = this.generateTokenData(contractAddress, tokenInfo);
    
    return {
      ...tokenInfo,
      contractAddress,
      data
    };
  }

  /**
   * Generate token data payload for Ledger device
   */
  generateTokenData(contractAddress, tokenInfo) {
    // Create the ERC20 token information payload
    // This follows the Ledger format for provideERC20TokenInformation
    
    const payload = {
      contractAddress: contractAddress.toLowerCase(),
      ticker: tokenInfo.ticker,
      decimals: tokenInfo.decimals,
      chainId: tokenInfo.chainId,
      name: tokenInfo.name
    };

    // In a real implementation, this would be signed by a trusted authority
    // For demo purposes, we'll create a mock signed payload
    const dataBuffer = Buffer.concat([
      Buffer.from(contractAddress.slice(2), 'hex'), // Contract address (20 bytes)
      Buffer.from(tokenInfo.ticker.padEnd(12, '\0'), 'utf8'), // Ticker (12 bytes max)
      Buffer.from([tokenInfo.decimals]), // Decimals (1 byte)
      Buffer.from(tokenInfo.chainId.toString(16).padStart(8, '0'), 'hex') // Chain ID (4 bytes)
    ]);

    return dataBuffer.toString('hex');
  }

  /**
   * Validate ERC20 token information
   */
  validateTokenInfo(tokenInfo) {
    if (!tokenInfo.ticker || tokenInfo.ticker.length > 12) {
      throw new Error('Invalid ticker: must be 1-12 characters');
    }

    if (typeof tokenInfo.decimals !== 'number' || tokenInfo.decimals < 0 || tokenInfo.decimals > 255) {
      throw new Error('Invalid decimals: must be between 0 and 255');
    }

    if (!tokenInfo.contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenInfo.contractAddress)) {
      throw new Error('Invalid contract address');
    }

    return true;
  }

  /**
   * Add new token to registry
   */
  addToken(contractAddress, tokenInfo) {
    this.validateTokenInfo({ ...tokenInfo, contractAddress });
    this.tokenRegistry.set(contractAddress.toLowerCase(), tokenInfo);
  }

  /**
   * Get all registered tokens for a specific chain
   */
  getTokensByChain(chainId) {
    const tokens = [];
    for (const [address, info] of this.tokenRegistry.entries()) {
      if (info.chainId === chainId) {
        tokens.push({ contractAddress: address, ...info });
      }
    }
    return tokens;
  }

  /**
   * Search tokens by ticker or name
   */
  searchTokens(query) {
    const results = [];
    const searchQuery = query.toLowerCase();
    
    for (const [address, info] of this.tokenRegistry.entries()) {
      if (info.ticker.toLowerCase().includes(searchQuery) || 
          info.name.toLowerCase().includes(searchQuery)) {
        results.push({ contractAddress: address, ...info });
      }
    }
    
    return results;
  }

  /**
   * Format token amount for display
   */
  formatTokenAmount(amount, decimals) {
    const divisor = BigInt(10 ** decimals);
    const wholePart = BigInt(amount) / divisor;
    const fractionalPart = BigInt(amount) % divisor;
    
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Parse token amount from string
   */
  parseTokenAmount(amountStr, decimals) {
    const [wholePart, fractionalPart = '0'] = amountStr.split('.');
    const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(wholePart) * BigInt(10 ** decimals) + BigInt(paddedFractional);
  }

  /**
   * Get token display information
   */
  getTokenDisplayInfo(contractAddress, amount) {
    const tokenInfo = this.tokenRegistry.get(contractAddress.toLowerCase());
    if (!tokenInfo) {
      return {
        amount: amount,
        symbol: 'UNKNOWN',
        formattedAmount: amount
      };
    }

    const formattedAmount = this.formatTokenAmount(amount, tokenInfo.decimals);
    return {
      amount: amount,
      symbol: tokenInfo.ticker,
      formattedAmount: formattedAmount,
      name: tokenInfo.name,
      decimals: tokenInfo.decimals
    };
  }

  /**
   * Create ERC20 clear signing payload
   */
  createClearSigningPayload(contractAddress, amount, recipient) {
    const tokenInfo = this.tokenRegistry.get(contractAddress.toLowerCase());
    if (!tokenInfo) {
      throw new Error(`Unknown token: ${contractAddress}`);
    }

    const displayInfo = this.getTokenDisplayInfo(contractAddress, amount);
    
    return {
      type: 'ERC20_TRANSFER',
      token: {
        contractAddress,
        ticker: tokenInfo.ticker,
        decimals: tokenInfo.decimals,
        name: tokenInfo.name
      },
      amount: {
        raw: amount,
        formatted: displayInfo.formattedAmount
      },
      recipient,
      displayText: `Send ${displayInfo.formattedAmount} ${tokenInfo.ticker} to ${recipient}`
    };
  }

  /**
   * Export token registry for backup
   */
  exportRegistry() {
    const tokens = [];
    for (const [address, info] of this.tokenRegistry.entries()) {
      tokens.push({ contractAddress: address, ...info });
    }
    return tokens;
  }

  /**
   * Import token registry from backup
   */
  importRegistry(tokens) {
    this.tokenRegistry.clear();
    for (const token of tokens) {
      const { contractAddress, ...info } = token;
      this.validateTokenInfo(token);
      this.tokenRegistry.set(contractAddress.toLowerCase(), info);
    }
  }
} 