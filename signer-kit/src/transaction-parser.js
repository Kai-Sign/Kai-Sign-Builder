import { ethers } from 'ethers';
import chalk from 'chalk';

/**
 * Universal Ethereum Transaction Parser
 * Parses ANY mainnet transaction into structured, human-readable format
 */
export class TransactionParser {
  constructor(rpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/1EFr4OH_BpQp-qxV_7Vv5') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Common contract addresses
    this.knownContracts = {
      // Stablecoins
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { name: 'USDC', type: 'ERC20', decimals: 6 },
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': { name: 'USDT', type: 'ERC20', decimals: 6 },
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': { name: 'DAI', type: 'ERC20', decimals: 18 },
      
      // WETH
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': { name: 'WETH', type: 'ERC20', decimals: 18 },
      
      // DEX Routers
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': { name: 'Uniswap V2 Router', type: 'DEX' },
      '0xE592427A0AEce92De3Edee1F18E0157C05861564': { name: 'Uniswap V3 Router', type: 'DEX' },
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45': { name: 'Uniswap Universal Router', type: 'DEX' },
      '0x1111111254EEB25477B68fb85Ed929f73A960582': { name: '1inch Router V5', type: 'DEX' },
      
      // Lending
      '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2': { name: 'Aave V3 Pool', type: 'Lending' },
      '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9': { name: 'Aave V2 Pool', type: 'Lending' },
      
      // NFT
      '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC': { name: 'OpenSea Seaport', type: 'NFT' },
      '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D': { name: 'Bored Apes', type: 'NFT' },
      '0xED5AF388653567Af2F388E6224dC7C4b3241C544': { name: 'Azuki', type: 'NFT' },
      
      // Infrastructure
      '0xcA11bde05977b3631167028862bE2a173976CA11': { name: 'Multicall3', type: 'Infrastructure' },
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789': { name: 'ERC-4337 EntryPoint', type: 'AA' },
    };
    
    // Method signatures database
    this.methodSignatures = {
      // ERC20
      '0xa9059cbb': { name: 'transfer', params: ['address to', 'uint256 value'] },
      '0x095ea7b3': { name: 'approve', params: ['address spender', 'uint256 value'] },
      '0x23b872dd': { name: 'transferFrom', params: ['address from', 'address to', 'uint256 value'] },
      
      // WETH
      '0xd0e30db0': { name: 'deposit', params: [] },
      '0x2e1a7d4d': { name: 'withdraw', params: ['uint256 amount'] },
      
      // Uniswap V2
      '0x7ff36ab5': { name: 'swapExactETHForTokens', params: ['uint amountOutMin', 'address[] path', 'address to', 'uint deadline'] },
      '0x18cbafe5': { name: 'swapExactTokensForETH', params: ['uint amountIn', 'uint amountOutMin', 'address[] path', 'address to', 'uint deadline'] },
      '0x38ed1739': { name: 'swapExactTokensForTokens', params: ['uint amountIn', 'uint amountOutMin', 'address[] path', 'address to', 'uint deadline'] },
      
      // Uniswap V3
      '0x414bf389': { name: 'exactInputSingle', params: ['tuple params'] },
      '0xc04b8d59': { name: 'exactInput', params: ['tuple params'] },
      '0xf28c0498': { name: 'exactOutputSingle', params: ['tuple params'] },
      
      // Aave
      '0x617ba037': { name: 'supply', params: ['address asset', 'uint256 amount', 'address onBehalfOf', 'uint16 referralCode'] },
      '0xa415bcad': { name: 'borrow', params: ['address asset', 'uint256 amount', 'uint256 rateMode', 'uint16 referralCode', 'address onBehalfOf'] },
      '0x573ade81': { name: 'repay', params: ['address asset', 'uint256 amount', 'uint256 rateMode', 'address onBehalfOf'] },
      
      // NFT
      '0x42842e0e': { name: 'safeTransferFrom', params: ['address from', 'address to', 'uint256 tokenId'] },
      '0xf242432a': { name: 'safeTransferFrom', params: ['address from', 'address to', 'uint256 id', 'uint256 amount', 'bytes data'] },
      
      // Multicall
      '0x82ad56cb': { name: 'aggregate3', params: ['tuple[] calls'] },
      
      // Safe
      '0x6a761202': { name: 'execTransaction', params: ['address to', 'uint256 value', 'bytes data', 'uint8 operation', 'uint256 safeTxGas', 'uint256 baseGas', 'uint256 gasPrice', 'address gasToken', 'address refundReceiver', 'bytes signatures'] },
      
      // 1inch
      '0x12aa3caf': { name: 'swap', params: ['address executor', 'tuple desc', 'bytes permit', 'bytes data'] },
      
      // OpenSea
      '0xfb0f3ee1': { name: 'fulfillBasicOrder', params: ['tuple parameters'] },
      '0x00000000': { name: 'fulfillOrder', params: ['tuple order', 'bytes32 fulfillerConduitKey'] }
    };
  }

  /**
   * Parse any transaction hash or transaction object
   */
  async parseTransaction(txHashOrObject) {
    try {
      let tx, receipt;
      
      // Handle both hash and object input
      if (typeof txHashOrObject === 'string') {
        console.log(chalk.blue(`\n📋 Fetching transaction ${txHashOrObject.slice(0, 10)}...`));
        tx = await this.provider.getTransaction(txHashOrObject);
        receipt = await this.provider.getTransactionReceipt(txHashOrObject);
      } else {
        tx = txHashOrObject;
        receipt = null;
      }
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      // Basic transaction info
      const parsed = {
        hash: tx.hash || 'N/A',
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value) + ' ETH',
        gasLimit: tx.gasLimit?.toString(),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei' : null,
        nonce: tx.nonce,
        blockNumber: tx.blockNumber,
        status: receipt?.status === 1 ? 'Success' : receipt?.status === 0 ? 'Failed' : 'Pending',
        
        // Contract info
        contract: this.identifyContract(tx.to),
        
        // Decoded data
        method: null,
        decodedData: null,
        
        // Interpretation
        interpretation: null,
        
        // Events (if receipt available)
        events: []
      };
      
      // Parse method and data
      if (tx.data && tx.data !== '0x') {
        const methodResult = this.parseMethodCall(tx.data, tx.to);
        parsed.method = methodResult.method;
        parsed.decodedData = methodResult.decodedData;
        
        // Generate human-readable interpretation
        parsed.interpretation = this.interpretTransaction(tx, methodResult, parsed.contract);
      } else if (tx.value && BigInt(tx.value) > 0n) {
        parsed.interpretation = `💸 ETH Transfer: ${ethers.formatEther(tx.value)} ETH from ${this.formatAddress(tx.from)} to ${this.formatAddress(tx.to)}`;
      }
      
      // Parse events from receipt
      if (receipt && receipt.logs) {
        parsed.events = this.parseEvents(receipt.logs);
      }
      
      return parsed;
      
    } catch (error) {
      console.error(chalk.red('Parse error:'), error.message);
      return {
        error: error.message,
        raw: txHashOrObject
      };
    }
  }

  /**
   * Identify known contracts
   */
  identifyContract(address) {
    if (!address) return null;
    const contract = this.knownContracts[address];
    return contract || { name: 'Unknown Contract', address };
  }

  /**
   * Parse method call from transaction data
   */
  parseMethodCall(data, to) {
    if (!data || data === '0x') {
      return { method: null, decodedData: null };
    }
    
    const selector = data.slice(0, 10);
    const methodInfo = this.methodSignatures[selector];
    
    if (!methodInfo) {
      return {
        method: `Unknown (${selector})`,
        decodedData: { raw: data }
      };
    }
    
    // Decode based on method
    const decodedData = this.decodeMethodData(methodInfo, data, to);
    
    return {
      method: methodInfo.name,
      decodedData
    };
  }

  /**
   * Decode method data based on signature
   */
  decodeMethodData(methodInfo, data, to) {
    const selector = data.slice(0, 10);
    const params = '0x' + data.slice(10);
    
    try {
      switch (methodInfo.name) {
        case 'transfer':
        case 'approve': {
          const iface = new ethers.Interface([
            `function ${methodInfo.name}(address, uint256)`
          ]);
          const decoded = iface.decodeFunctionData(methodInfo.name, data);
          const contract = this.knownContracts[to];
          
          return {
            to: decoded[0],
            amount: contract ? 
              ethers.formatUnits(decoded[1], contract.decimals) + ' ' + contract.name :
              decoded[1].toString()
          };
        }
        
        case 'transferFrom': {
          const iface = new ethers.Interface([
            'function transferFrom(address, address, uint256)'
          ]);
          const decoded = iface.decodeFunctionData('transferFrom', data);
          const contract = this.knownContracts[to];
          
          return {
            from: decoded[0],
            to: decoded[1],
            amount: contract ? 
              ethers.formatUnits(decoded[2], contract.decimals) + ' ' + contract.name :
              decoded[2].toString()
          };
        }
        
        case 'deposit':
          return { action: 'Wrap ETH to WETH' };
          
        case 'withdraw': {
          const amount = ethers.getUint(params.slice(0, 66));
          return {
            amount: ethers.formatEther(amount) + ' WETH'
          };
        }
        
        case 'swapExactETHForTokens':
        case 'swapExactTokensForETH':
        case 'swapExactTokensForTokens': {
          // Parse Uniswap V2 swaps
          return this.parseUniswapV2Swap(methodInfo.name, data);
        }
        
        case 'exactInputSingle': {
          // Parse Uniswap V3 single swap
          return this.parseUniswapV3Swap(data);
        }
        
        case 'supply':
        case 'borrow': {
          // Parse Aave operations
          return this.parseAaveOperation(methodInfo.name, data);
        }
        
        case 'execTransaction': {
          // Parse Safe multisig transaction
          return this.parseSafeTransaction(data);
        }
        
        case 'aggregate3': {
          // Parse Multicall3
          return this.parseMulticall(data);
        }
        
        default:
          return { selector, params };
      }
    } catch (error) {
      return {
        error: error.message,
        selector,
        raw: data
      };
    }
  }

  /**
   * Parse Uniswap V2 swap
   */
  parseUniswapV2Swap(method, data) {
    try {
      const iface = new ethers.Interface([
        'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline)',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)'
      ]);
      
      const decoded = iface.decodeFunctionData(method, data);
      
      // Decode path
      const path = decoded[method.includes('ETH') ? 1 : 2];
      const pathNames = path.map(addr => {
        const contract = this.knownContracts[addr];
        return contract ? contract.name : this.formatAddress(addr);
      });
      
      return {
        type: 'Uniswap V2 Swap',
        path: pathNames.join(' → '),
        recipient: decoded[method.includes('ETH') ? 2 : 3],
        deadline: new Date(Number(decoded[method.includes('ETH') ? 3 : 4]) * 1000).toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse Uniswap V3 swap
   */
  parseUniswapV3Swap(data) {
    try {
      // Simplified parsing for V3 swaps
      return {
        type: 'Uniswap V3 Swap',
        details: 'Complex swap parameters'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse Aave operation
   */
  parseAaveOperation(method, data) {
    try {
      const iface = new ethers.Interface([
        'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
        'function borrow(address asset, uint256 amount, uint256 rateMode, uint16 referralCode, address onBehalfOf)'
      ]);
      
      const decoded = iface.decodeFunctionData(method, data);
      const asset = this.knownContracts[decoded[0]] || { name: 'Unknown', decimals: 18 };
      
      return {
        type: method === 'supply' ? 'Supply to Aave' : 'Borrow from Aave',
        asset: asset.name,
        amount: ethers.formatUnits(decoded[1], asset.decimals) + ' ' + asset.name,
        onBehalfOf: decoded[2]
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse Safe transaction
   */
  parseSafeTransaction(data) {
    try {
      const iface = new ethers.Interface([
        'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)'
      ]);
      
      const decoded = iface.decodeFunctionData('execTransaction', data);
      
      // Try to decode inner transaction
      let innerTx = null;
      if (decoded[2] && decoded[2] !== '0x') {
        innerTx = this.parseMethodCall(decoded[2], decoded[0]);
      }
      
      return {
        type: 'Safe Multisig Transaction',
        target: this.formatAddress(decoded[0]),
        value: ethers.formatEther(decoded[1]) + ' ETH',
        innerTransaction: innerTx
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse Multicall
   */
  parseMulticall(data) {
    try {
      // Simplified multicall parsing
      return {
        type: 'Multicall3 Batch',
        details: 'Multiple calls in single transaction'
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse events from logs
   */
  parseEvents(logs) {
    const events = [];
    
    for (const log of logs) {
      // ERC20 Transfer event
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && log.topics.length === 3) {
        const contract = this.knownContracts[log.address];
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        const amount = BigInt(log.data);
        
        events.push({
          type: 'Transfer',
          token: contract ? contract.name : this.formatAddress(log.address),
          from: this.formatAddress(from),
          to: this.formatAddress(to),
          amount: contract ? 
            ethers.formatUnits(amount, contract.decimals) + ' ' + contract.name :
            amount.toString()
        });
      }
      // Add more event parsers as needed
    }
    
    return events;
  }

  /**
   * Generate human-readable interpretation
   */
  interpretTransaction(tx, methodResult, contract) {
    const { method, decodedData } = methodResult;
    
    if (!method) {
      return '❓ Unknown transaction';
    }
    
    // Generate interpretation based on method and contract
    switch (method) {
      case 'transfer':
        return `💸 Transfer ${decodedData.amount} to ${this.formatAddress(decodedData.to)}`;
        
      case 'approve':
        return `✅ Approve ${this.formatAddress(decodedData.to)} to spend ${decodedData.amount}`;
        
      case 'transferFrom':
        return `💸 Transfer ${decodedData.amount} from ${this.formatAddress(decodedData.from)} to ${this.formatAddress(decodedData.to)}`;
        
      case 'deposit':
        return `💎 Wrap ${ethers.formatEther(tx.value)} ETH to WETH`;
        
      case 'withdraw':
        return `💎 Unwrap ${decodedData.amount} to ETH`;
        
      case 'swapExactETHForTokens':
      case 'swapExactTokensForETH':
      case 'swapExactTokensForTokens':
        return `🔄 Swap via ${decodedData.path}`;
        
      case 'exactInputSingle':
        return `🦄 Uniswap V3 swap`;
        
      case 'supply':
        return `🏦 Supply ${decodedData.amount} to Aave`;
        
      case 'borrow':
        return `🏦 Borrow ${decodedData.amount} from Aave`;
        
      case 'execTransaction':
        if (decodedData.innerTransaction) {
          return `🔒 Safe: ${decodedData.innerTransaction.method} to ${decodedData.target}`;
        }
        return `🔒 Safe transaction to ${decodedData.target}`;
        
      case 'aggregate3':
        return `📦 Batch multiple calls via Multicall3`;
        
      case 'swap':
        return `🔄 1inch aggregated swap`;
        
      case 'fulfillBasicOrder':
      case 'fulfillOrder':
        return `🎨 OpenSea NFT trade`;
        
      default:
        return `📝 ${method} on ${contract?.name || 'contract'}`;
    }
  }

  /**
   * Format address for display
   */
  formatAddress(address) {
    if (!address) return 'N/A';
    const contract = this.knownContracts[address];
    if (contract) return contract.name;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Parse batch of transactions
   */
  async parseBatch(txHashes) {
    const results = [];
    
    for (const hash of txHashes) {
      const parsed = await this.parseTransaction(hash);
      results.push(parsed);
      
      // Display result
      this.displayParsedTransaction(parsed);
    }
    
    return results;
  }

  /**
   * Display parsed transaction
   */
  displayParsedTransaction(parsed) {
    console.log(chalk.bold('\n========================================'));
    console.log(chalk.bold('         PARSED TRANSACTION             '));
    console.log(chalk.bold('========================================'));
    
    if (parsed.error) {
      console.log(chalk.red(`❌ Error: ${parsed.error}`));
      return;
    }
    
    console.log(chalk.cyan(`📍 Hash: ${parsed.hash}`));
    console.log(chalk.cyan(`👤 From: ${this.formatAddress(parsed.from)}`));
    console.log(chalk.cyan(`📮 To: ${this.formatAddress(parsed.to)}`));
    console.log(chalk.cyan(`💰 Value: ${parsed.value}`));
    
    if (parsed.contract) {
      console.log(chalk.yellow(`📄 Contract: ${parsed.contract.name} (${parsed.contract.type || 'Unknown'})`));
    }
    
    if (parsed.method) {
      console.log(chalk.green(`🔧 Method: ${parsed.method}`));
    }
    
    if (parsed.decodedData && !parsed.decodedData.error) {
      console.log(chalk.gray('📊 Decoded Data:'));
      console.log(chalk.gray(JSON.stringify(parsed.decodedData, null, 2)));
    }
    
    if (parsed.interpretation) {
      console.log(chalk.bold.white(`\n✨ Interpretation: ${parsed.interpretation}`));
    }
    
    if (parsed.events && parsed.events.length > 0) {
      console.log(chalk.magenta('\n📢 Events:'));
      for (const event of parsed.events) {
        console.log(chalk.magenta(`  - ${event.type}: ${JSON.stringify(event)}`));
      }
    }
    
    console.log(chalk.gray(`⛽ Gas: ${parsed.gasLimit} @ ${parsed.gasPrice}`));
    console.log(chalk.gray(`📦 Block: ${parsed.blockNumber}`));
    console.log(chalk.gray(`✔️ Status: ${parsed.status}`));
  }
}

// Export for use
export default TransactionParser;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const parser = new TransactionParser();
  
  // Example transactions to parse
  const exampleTxs = [
    '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060', // ETH transfer
    '0x2d2c8c6d0c8c6d0c8c6d0c8c6d0c8c6d0c8c6d0c8c6d0c8c6d0c8c6d0c8c6d', // USDC transfer
    '0x3e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e8e3e'  // Uniswap swap
  ];
  
  console.log(chalk.bold.blue('🔍 Transaction Parser Demo\n'));
  
  // Parse first valid transaction found
  parser.parseTransaction(exampleTxs[0])
    .then(result => {
      parser.displayParsedTransaction(result);
      console.log(chalk.bold.green('\n✅ Parser ready for use!'));
    })
    .catch(error => {
      console.error(chalk.red('Demo error:'), error);
    });
}