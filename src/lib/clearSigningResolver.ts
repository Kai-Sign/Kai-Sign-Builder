import { ethers } from 'ethers';

export interface ParameterValue {
  name: string;
  type: string;
  value: string | number;
  valueDecoded?: any;
}

export interface ContractMethod {
  selector: string;
  name: string;
  signature: string;
  type: string;
  parameters: ParameterValue[];
}

export interface ERC20TokenInfo {
  contractAddress: string;
  ticker: string;
  decimals: number;
  chainId: number;
  signature: string;
}

export interface NFTInfo {
  contractAddress: string;
  collectionName: string;
  tokenId: string;
  signature: string;
}

export interface ExternalPlugin {
  pluginName: string;
  contractAddress: string;
  methodSelector: string;
  description: string;
  signature: string;
}

export interface DomainName {
  domain: string;
  type: string;
  address: string;
  signature: string;
}

export interface TransactionResolution {
  erc20TokenInformation: ERC20TokenInfo[];
  nftInformation: NFTInfo[];
  externalPlugin: ExternalPlugin | null;
  domainName: DomainName | null;
  contractMethod: ContractMethod | null;
}

export interface Transaction {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
}

interface MethodDefinition {
  name: string;
  signature: string;
  type: string;
  parameters: string[];
}

/**
 * Clear Signing Transaction Resolver
 * Provides metadata resolution for different transaction types using Ledger approach
 */
export class ClearSigningResolver {
  private contractMethods: Map<string, MethodDefinition>;

  constructor() {
    this.contractMethods = new Map();
    this.initializeKnownMethods();
  }

  /**
   * Initialize known contract methods for resolution
   */
  private initializeKnownMethods(): void {
    // ERC20 methods
    this.contractMethods.set('0xa9059cbb', {
      name: 'transfer',
      signature: 'transfer(address,uint256)',
      type: 'ERC20',
      parameters: ['recipient', 'amount']
    });

    this.contractMethods.set('0x095ea7b3', {
      name: 'approve',
      signature: 'approve(address,uint256)',
      type: 'ERC20',
      parameters: ['spender', 'amount']
    });

    this.contractMethods.set('0x23b872dd', {
      name: 'transferFrom',
      signature: 'transferFrom(address,address,uint256)',
      type: 'ERC20',
      parameters: ['from', 'to', 'amount']
    });

    // Safe (Gnosis Safe) methods
    this.contractMethods.set('0x6a761202', {
      name: 'execTransaction',
      signature: 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
      type: 'Safe',
      parameters: ['to', 'value', 'data', 'operation', 'safeTxGas', 'baseGas', 'gasPrice', 'gasToken', 'refundReceiver', 'signatures']
    });

    // DeleGator methods
    this.contractMethods.set('0x1cff79cd', {
      name: 'execute',
      signature: 'execute(bytes32,bytes)',
      type: 'DeleGator',
      parameters: ['mode', 'executionCalldata']
    });

    // Batch executor methods
    this.contractMethods.set('0x34fcd5be', {
      name: 'executeBatch',
      signature: 'executeBatch((address,uint256,bytes)[])',
      type: 'BatchExecutor',
      parameters: ['operations']
    });

    // Uniswap V3 methods
    this.contractMethods.set('0x414bf389', {
      name: 'exactInputSingle',
      signature: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
      type: 'UniswapV3',
      parameters: ['tokenIn', 'tokenOut', 'fee', 'recipient', 'deadline', 'amountIn', 'amountOutMinimum', 'sqrtPriceLimitX96']
    });
  }

  /**
   * Resolve transaction metadata for clear signing
   */
  async resolveTransaction(transaction: Transaction, config: any = {}): Promise<TransactionResolution> {
    const resolution: TransactionResolution = {
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
      console.warn('Transaction resolution failed:', (error as Error).message);
      return resolution;
    }
  }

  /**
   * Check if transaction is ERC20 related
   */
  private isERC20Transaction(transaction: Transaction): boolean {
    const methodSelector = transaction.data?.slice(0, 10);
    return methodSelector === '0xa9059cbb' || // transfer
           methodSelector === '0x095ea7b3' || // approve
           methodSelector === '0x23b872dd';   // transferFrom
  }

  /**
   * Check if transaction is NFT related
   */
  private isNFTTransaction(transaction: Transaction): boolean {
    const methodSelector = transaction.data?.slice(0, 10);
    return methodSelector === '0x23b872dd' || // transferFrom
           methodSelector === '0x42842e0e' || // safeTransferFrom
           methodSelector === '0xb88d4fde';   // safeTransferFrom with data
  }

  /**
   * Resolve ERC20 token metadata
   */
  private async resolveERC20Metadata(transaction: Transaction): Promise<ERC20TokenInfo[]> {
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
  private async resolveNFTMetadata(transaction: Transaction): Promise<NFTInfo[]> {
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
  private async resolveExternalPlugin(transaction: Transaction, config: any): Promise<ExternalPlugin | null> {
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
  private async resolveDomainName(address: string, domains: string[]): Promise<DomainName | null> {
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
  private decodeParameters(data: string, method: MethodDefinition): ParameterValue[] {
    try {
      const iface = new ethers.Interface([`function ${method.signature}`]);
      const decoded = iface.decodeFunctionData(method.name, data);
      
      return method.parameters.map((paramName: string, index: number) => {
        const param = decoded[index];
        const paramType = this.getParameterType(method.signature, index);
        
        let value: string | number;
        let valueDecoded: any = undefined;
        
        if (typeof param === 'bigint') {
          value = param.toString();
        } else if (paramType === 'bytes' && typeof param === 'string' && param.startsWith('0x')) {
          value = param;
          // Try to decode nested function call in bytes data
          if (param.length >= 10) {
            valueDecoded = this.decodeNestedCall(param);
          }
        } else if (typeof param === 'number') {
          value = param;
        } else if (typeof param === 'object' && param !== null) {
          try {
            value = JSON.stringify(param, (key, val) => 
              typeof val === 'bigint' ? val.toString() : val
            );
          } catch (error) {
            value = param.toString();
          }
        } else {
          value = param?.toString() || param;
        }
        
        return {
          name: paramName,
          type: paramType,
          value,
          valueDecoded
        };
      });
    } catch (error) {
      console.warn('Parameter decoding failed:', (error as Error).message);
      return [];
    }
  }

  /**
   * Extract parameter type from function signature
   */
  private getParameterType(signature: string, index: number): string {
    try {
      const match = signature.match(/\((.*?)\)/);
      if (!match) return 'unknown';
      
      const params = match[1].split(',').map(p => p.trim());
      return params[index] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Decode nested function call in bytes data
   */
  private decodeNestedCall(data: string): any {
    try {
      const selector = data.slice(0, 10);
      const method = this.contractMethods.get(selector);
      
      if (method) {
        const params = this.decodeParameters(data, method);
        return {
          name: method.name,
          signature: method.signature,
          type: 'function',
          params: params
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Nested call decoding failed:', (error as Error).message);
      return null;
    }
  }

  /**
   * Extract token ID from transaction data
   */
  private extractTokenIdFromData(data: string): string {
    if (!data || data.length < 138) return '0';
    
    // For transferFrom(address,address,uint256), tokenId is the third parameter
    const tokenIdHex = data.slice(130, 138); // Last 8 chars of the data
    return parseInt(tokenIdHex, 16).toString();
  }

  /**
   * Generate ERC20 token signature for Ledger
   */
  private generateERC20Signature(contractAddress: string, ticker: string, decimals: number): string {
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
  private generateNFTSignature(contractAddress: string, collectionName: string): string {
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
  private generatePluginSignature(pluginId: string, contractAddress: string, methodSelector: string): string {
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
  private generateDomainSignature(domain: string, address: string): string {
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
  getResolutionSummary(resolution: TransactionResolution): any {
    const summary = {
      hasERC20: resolution.erc20TokenInformation.length > 0,
      hasNFT: resolution.nftInformation.length > 0,
      hasPlugin: !!resolution.externalPlugin,
      hasDomain: !!resolution.domainName,
      hasMethod: !!resolution.contractMethod,
      description: this.generateTransactionDescription(resolution)
    };

    return summary;
  }

  /**
   * Generate human-readable transaction description
   */
  private generateTransactionDescription(resolution: TransactionResolution): string {
    if (resolution.contractMethod) {
      switch (resolution.contractMethod.type) {
        case 'ERC20':
          return `Transfer ${resolution.contractMethod.name} tokens`;
        case 'ERC721':
          return `Transfer NFT token`;
        case 'UniswapV3':
          return `Swap tokens on Uniswap V3`;
        case 'Safe':
          return `Execute Safe transaction`;
        case 'DeleGator':
          return `Execute delegated transaction`;
        case 'BatchExecutor':
          return `Execute batch transactions`;
        default:
          return `Call ${resolution.contractMethod.name} method`;
      }
    }
    
    return 'Unknown transaction';
  }
}