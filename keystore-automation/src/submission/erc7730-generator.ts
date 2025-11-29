import { ethers } from 'ethers';
import axios from 'axios';
import { getChainConfig } from '../config/chains.js';
import { botLogger } from '../utils/logger.js';

export interface ERC7730Context {
  contract: {
    deployedOn: number;
    deploymentAddress: string;
  };
}

export interface ERC7730Display {
  formats: Record<string, {
    intent: string;
    fields: Array<{
      path: string;
      label: string;
      format: string;
      params?: any;
    }>;
  }>;
}

export interface ERC7730Spec {
  context: ERC7730Context;
  metadata: {
    constants: Record<string, any>;
    enums: Record<string, Record<string, string>>;
  };
  display: ERC7730Display;
}

interface ContractFunction {
  name: string;
  inputs: Array<{
    name: string;
    type: string;
    internalType?: string;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
  }>;
  stateMutability: string;
}

export class ERC7730Generator {
  private abiCache: Map<string, any[]> = new Map();
  private commonTokens: Map<number, Map<string, { symbol: string; decimals: number }>> = new Map();

  async initialize(): Promise<void> {
    // Load common token data for major chains
    await this.loadCommonTokens();
    botLogger.submission('ERC7730 generator initialized');
  }

  /**
   * Generate ERC7730 specification for a contract
   */
  async generateForContract(contractAddress: string, chainId: number): Promise<ERC7730Spec> {
    try {
      botLogger.submission(`Generating ERC7730 for ${contractAddress} on chain ${chainId}`);

      // Get contract ABI
      const abi = await this.getContractABI(contractAddress, chainId);
      if (!abi || abi.length === 0) {
        throw new Error('Could not retrieve contract ABI');
      }

      // Analyze contract functions
      const functions = this.extractFunctions(abi);
      
      // Generate context
      const context: ERC7730Context = {
        contract: {
          deployedOn: chainId,
          deploymentAddress: contractAddress.toLowerCase()
        }
      };

      // Generate metadata (constants and enums)
      const metadata = await this.generateMetadata(contractAddress, chainId, functions);

      // Generate display formats
      const display = await this.generateDisplay(contractAddress, chainId, functions);

      const spec: ERC7730Spec = {
        context,
        metadata,
        display
      };

      botLogger.submission(`Generated ERC7730 with ${Object.keys(display.formats).length} formats`, {
        contractAddress,
        chainId
      });

      return spec;

    } catch (error) {
      botLogger.error(`Failed to generate ERC7730 for ${contractAddress}`, error);
      throw error;
    }
  }

  private async getContractABI(contractAddress: string, chainId: number): Promise<any[]> {
    const cacheKey = `${chainId}-${contractAddress.toLowerCase()}`;
    
    if (this.abiCache.has(cacheKey)) {
      return this.abiCache.get(cacheKey)!;
    }

    try {
      const chain = getChainConfig(chainId);
      
      if (!chain.apiUrl || !chain.apiKey) {
        throw new Error(`No API configuration for chain ${chainId}`);
      }

      const response = await axios.get(chain.apiUrl, {
        params: {
          module: 'contract',
          action: 'getabi',
          address: contractAddress,
          apikey: chain.apiKey
        },
        timeout: 30000
      });

      if (response.data.status !== '1') {
        throw new Error(`API error: ${response.data.message}`);
      }

      const abi = JSON.parse(response.data.result);
      this.abiCache.set(cacheKey, abi);
      
      return abi;

    } catch (error) {
      botLogger.error(`Failed to get ABI for ${contractAddress}`, error);
      
      // Fallback to common ERC20 ABI for token contracts
      return this.getCommonTokenABI();
    }
  }

  private extractFunctions(abi: any[]): ContractFunction[] {
    return abi
      .filter(item => item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure')
      .map(item => ({
        name: item.name,
        inputs: item.inputs || [],
        outputs: item.outputs || [],
        stateMutability: item.stateMutability
      }));
  }

  private async generateMetadata(
    contractAddress: string,
    chainId: number,
    functions: ContractFunction[]
  ): Promise<{ constants: Record<string, any>; enums: Record<string, Record<string, string>> }> {
    const constants: Record<string, any> = {};
    const enums: Record<string, Record<string, string>> = {};

    // Add common token addresses for this chain
    const tokenMap = this.commonTokens.get(chainId);
    if (tokenMap) {
      for (const [address, token] of tokenMap) {
        constants[`${token.symbol}_ADDRESS`] = address;
      }
    }

    // Add common enum definitions
    enums.BOOLEAN = {
      "0": "false",
      "1": "true"
    };

    // Add function selector constants
    for (const func of functions) {
      const signature = this.getFunctionSignature(func);
      const selector = ethers.id(signature).substring(0, 10);
      constants[`${func.name.toUpperCase()}_SELECTOR`] = selector;
    }

    return { constants, enums };
  }

  private async generateDisplay(
    contractAddress: string,
    chainId: number,
    functions: ContractFunction[]
  ): Promise<ERC7730Display> {
    const formats: Record<string, any> = {};

    for (const func of functions) {
      const formatKey = this.getFunctionSignature(func);
      
      const fields = this.generateFieldsForFunction(func, chainId);
      
      if (fields.length > 0) {
        formats[formatKey] = {
          intent: this.generateFunctionIntent(func),
          fields
        };
      }
    }

    return { formats };
  }

  private generateFieldsForFunction(func: ContractFunction, chainId: number): any[] {
    const fields: any[] = [];

    // Add operation label
    fields.push({
      path: "@.to",
      label: "To",
      format: "addressName"
    });

    // Add function-specific fields based on common patterns
    for (let i = 0; i < func.inputs.length; i++) {
      const input = func.inputs[i];
      const field = this.generateFieldForInput(input, i, func, chainId);
      
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  private generateFieldForInput(
    input: { name: string; type: string; internalType?: string },
    index: number,
    func: ContractFunction,
    chainId: number
  ): any | null {
    const basePath = `@.transaction.data.[4 + 32 * ${index}:4 + 32 * ${index + 1}]`;

    // Handle common parameter types
    switch (input.type) {
      case 'address':
        return {
          path: basePath,
          label: this.formatLabel(input.name || `Parameter ${index + 1}`),
          format: this.isTokenAddress(input.name) ? 'tokenAddress' : 'addressName'
        };

      case 'uint256':
        if (this.isAmountParameter(input.name, func.name)) {
          return {
            path: basePath,
            label: this.formatLabel(input.name || 'Amount'),
            format: 'amount',
            params: {
              tokenPath: this.findTokenAddressPath(func, index)
            }
          };
        }
        return {
          path: basePath,
          label: this.formatLabel(input.name || `Value ${index + 1}`),
          format: 'raw'
        };

      case 'bool':
        return {
          path: basePath,
          label: this.formatLabel(input.name || `Option ${index + 1}`),
          format: 'enum',
          params: {
            $ref: "#/metadata/enums/BOOLEAN"
          }
        };

      case 'bytes':
      case 'bytes32':
        return {
          path: basePath,
          label: this.formatLabel(input.name || `Data ${index + 1}`),
          format: 'raw'
        };

      default:
        if (input.type.startsWith('uint') || input.type.startsWith('int')) {
          return {
            path: basePath,
            label: this.formatLabel(input.name || `Number ${index + 1}`),
            format: 'raw'
          };
        }
        return null;
    }
  }

  private generateFunctionIntent(func: ContractFunction): string {
    const name = func.name.toLowerCase();

    // Common DeFi function intents
    if (name.includes('swap')) return 'Swap tokens';
    if (name.includes('transfer')) return 'Transfer tokens';
    if (name.includes('approve')) return 'Approve token spending';
    if (name.includes('deposit')) return 'Deposit funds';
    if (name.includes('withdraw')) return 'Withdraw funds';
    if (name.includes('stake')) return 'Stake tokens';
    if (name.includes('unstake')) return 'Unstake tokens';
    if (name.includes('claim')) return 'Claim rewards';
    if (name.includes('borrow')) return 'Borrow assets';
    if (name.includes('repay')) return 'Repay debt';
    if (name.includes('liquidate')) return 'Liquidate position';
    if (name.includes('vote')) return 'Cast vote';

    // Default intent
    return `Call ${func.name}`;
  }

  private getFunctionSignature(func: ContractFunction): string {
    const inputs = func.inputs.map(input => input.type).join(',');
    return `${func.name}(${inputs})`;
  }

  private formatLabel(name: string): string {
    // Convert camelCase or snake_case to Title Case
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private isTokenAddress(paramName: string): boolean {
    const name = paramName.toLowerCase();
    return name.includes('token') || 
           name.includes('asset') || 
           name.includes('currency') ||
           name === 'tokenA' ||
           name === 'tokenB';
  }

  private isAmountParameter(paramName: string, funcName: string): boolean {
    const name = paramName.toLowerCase();
    const func = funcName.toLowerCase();
    
    return name.includes('amount') || 
           name.includes('value') || 
           name.includes('qty') ||
           name.includes('quantity') ||
           (func.includes('transfer') && name.includes('amount'));
  }

  private findTokenAddressPath(func: ContractFunction, currentIndex: number): string {
    // Look for token address parameter before the amount
    for (let i = 0; i < currentIndex; i++) {
      const input = func.inputs[i];
      if (input.type === 'address' && this.isTokenAddress(input.name)) {
        return `@.transaction.data.[4 + 32 * ${i}:4 + 32 * ${i + 1}]`;
      }
    }

    // Default to contract address if no token address found
    return "@.to";
  }

  private async loadCommonTokens(): Promise<void> {
    // Ethereum mainnet tokens
    const ethTokens = new Map<string, { symbol: string; decimals: number }>();
    ethTokens.set('0xa0b86a33e6ba6c7c03d5c5e7b0b31f4c0f9c0b4c', { symbol: 'USDC', decimals: 6 });
    ethTokens.set('0xdac17f958d2ee523a2206206994597c13d831ec7', { symbol: 'USDT', decimals: 6 });
    ethTokens.set('0x6b175474e89094c44da98b954eedeac495271d0f', { symbol: 'DAI', decimals: 18 });
    ethTokens.set('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', { symbol: 'WBTC', decimals: 8 });
    ethTokens.set('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', { symbol: 'WETH', decimals: 18 });
    
    this.commonTokens.set(1, ethTokens);

    // Polygon tokens
    const polygonTokens = new Map<string, { symbol: string; decimals: number }>();
    polygonTokens.set('0x2791bca1f2de4661ed88a30c99a7a9449aa84174', { symbol: 'USDC', decimals: 6 });
    polygonTokens.set('0xc2132d05d31c914a87c6611c10748aeb04b58e8f', { symbol: 'USDT', decimals: 6 });
    polygonTokens.set('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', { symbol: 'DAI', decimals: 18 });
    
    this.commonTokens.set(137, polygonTokens);

    botLogger.submission('Loaded common token definitions');
  }

  private getCommonTokenABI(): any[] {
    return [
      {
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
          {"name": "to", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ]
      },
      {
        "name": "approve",
        "type": "function", 
        "stateMutability": "nonpayable",
        "inputs": [
          {"name": "spender", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ]
      },
      {
        "name": "transferFrom",
        "type": "function",
        "stateMutability": "nonpayable", 
        "inputs": [
          {"name": "from", "type": "address"},
          {"name": "to", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ]
      }
    ];
  }
}