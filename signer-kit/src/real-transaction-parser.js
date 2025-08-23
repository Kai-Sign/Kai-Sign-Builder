import { ethers } from 'ethers';
import chalk from 'chalk';
import fetch from 'node-fetch';

/**
 * Real Transaction Parser - Shows ACTUAL transaction data
 * No fake data, no placeholders - real blockchain data only
 */
export class RealTransactionParser {
  constructor(rpcUrl = 'https://ethereum-rpc.publicnode.com') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.graphUrl = 'https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest';
    this.ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';
    
    // Common ABIs for decoding
    this.abis = {
      erc20: [
        'function transfer(address to, uint256 value) returns (bool)',
        'function approve(address spender, uint256 value) returns (bool)',
        'function transferFrom(address from, address to, uint256 value) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)'
      ],
      uniswapV2: [
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)'
      ],
      safe: [
        'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes calldata signatures) payable returns (bool)',
        'function multiSend(bytes calldata transactions)'
      ],
      weth: [
        'function deposit() payable',
        'function withdraw(uint wad)'
      ]
    };
  }

  /**
   * Parse any mainnet transaction and show REAL data
   */
  async parseTransaction(txHash) {
    try {
      console.log(chalk.blue(`\n🔍 Fetching REAL transaction ${txHash}...\n`));
      
      // Fetch the actual transaction
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      // Get block timestamp
      const block = await this.provider.getBlock(tx.blockNumber);
      
      // Build the real transaction data
      const result = {
        // Basic info - REAL VALUES
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        data: tx.data,  // RAW CALLDATA BYTECODE
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString() || tx.maxFeePerGas?.toString(),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        status: receipt.status === 1 ? 'Success' : 'Failed',
        
        // Decoded data
        decoded: null,
        
        // Token transfers from logs
        tokenTransfers: [],
        
        // All events
        events: []
      };
      
      // Decode the method call
      if (tx.data && tx.data !== '0x') {
        result.decoded = await this.decodeMethodCall(tx);
      }
      
      // Parse all logs for token transfers and events
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          const event = await this.parseLog(log);
          if (event) {
            result.events.push(event);
            if (event.name === 'Transfer' && event.tokenInfo) {
              result.tokenTransfers.push(event);
            }
          }
        }
      }
      
      // Try to fetch ERC7730 metadata
      const metadata = await this.fetchERC7730Metadata(tx.to);
      
      // Display the REAL transaction
      this.displayRealTransaction(result, metadata);
      
      return result;
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      return { error: error.message };
    }
  }

  /**
   * Decode method call with REAL parameters
   */
  async decodeMethodCall(tx) {
    const selector = tx.data.slice(0, 10);
    
    // Try each ABI to decode
    for (const [protocol, abi] of Object.entries(this.abis)) {
      try {
        const iface = new ethers.Interface(abi);
        const decoded = iface.parseTransaction({ data: tx.data });
        
        if (decoded) {
          // Get token info if it's a token transaction
          let tokenInfo = null;
          if (protocol === 'erc20' && tx.to) {
            tokenInfo = await this.getTokenInfo(tx.to);
          }
          
          // Build decoded result with REAL values
          const result = {
            function: decoded.name,
            signature: decoded.signature,
            selector: selector,
            args: {}
          };
          
          // Map arguments with their actual values
          decoded.fragment.inputs.forEach((input, i) => {
            const value = decoded.args[i];
            
            // Format based on type
            if (input.type === 'address') {
              result.args[input.name] = value;
            } else if (input.type === 'uint256') {
              // Check if this is a token amount
              if (tokenInfo && (input.name === 'value' || input.name === 'amount')) {
                result.args[input.name] = {
                  raw: value.toString(),
                  formatted: ethers.formatUnits(value, tokenInfo.decimals),
                  token: tokenInfo.symbol
                };
              } else {
                result.args[input.name] = value.toString();
              }
            } else if (input.type === 'address[]') {
              result.args[input.name] = value;
            } else if (input.type === 'bytes') {
              result.args[input.name] = value.slice(0, 66) + (value.length > 66 ? '...' : '');
            } else {
              result.args[input.name] = value.toString();
            }
          });
          
          // Add token info if available
          if (tokenInfo) {
            result.tokenInfo = tokenInfo;
          }
          
          // Decode nested call if it's a Safe transaction
          if (decoded.name === 'execTransaction' && decoded.args[2]) {
            result.nestedCall = await this.decodeNestedCall(decoded.args[0], decoded.args[2]);
          }
          
          return result;
        }
      } catch (e) {
        // Try next ABI
        continue;
      }
    }
    
    // Couldn't decode - return raw
    return {
      selector: selector,
      raw: tx.data.slice(0, 138) + (tx.data.length > 138 ? '...' : '')
    };
  }

  /**
   * Decode nested call in Safe transaction
   */
  async decodeNestedCall(to, data) {
    try {
      // Try to decode as ERC20
      const iface = new ethers.Interface(this.abis.erc20);
      const decoded = iface.parseTransaction({ data });
      
      if (decoded) {
        const tokenInfo = await this.getTokenInfo(to);
        
        const result = {
          to: to,
          function: decoded.name,
          args: {}
        };
        
        decoded.fragment.inputs.forEach((input, i) => {
          const value = decoded.args[i];
          if (input.type === 'address') {
            result.args[input.name] = value;
          } else if (input.type === 'uint256' && tokenInfo) {
            result.args[input.name] = {
              raw: value.toString(),
              formatted: ethers.formatUnits(value, tokenInfo.decimals),
              token: tokenInfo.symbol
            };
          } else {
            result.args[input.name] = value.toString();
          }
        });
        
        if (tokenInfo) {
          result.tokenInfo = tokenInfo;
        }
        
        return result;
      }
    } catch (e) {
      // Couldn't decode nested
    }
    
    return null;
  }

  /**
   * Parse log to get REAL event data
   */
  async parseLog(log) {
    try {
      // Transfer event
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        
        // Get token info
        const tokenInfo = await this.getTokenInfo(log.address);
        
        if (log.topics.length === 3 && log.data !== '0x') {
          // ERC20 Transfer
          const amount = BigInt(log.data);
          
          return {
            name: 'Transfer',
            address: log.address,
            from: from,
            to: to,
            value: {
              raw: amount.toString(),
              formatted: tokenInfo ? ethers.formatUnits(amount, tokenInfo.decimals) : amount.toString()
            },
            tokenInfo: tokenInfo
          };
        } else if (log.topics.length === 4) {
          // ERC721 Transfer
          const tokenId = BigInt(log.topics[3]);
          
          return {
            name: 'Transfer',
            type: 'NFT',
            address: log.address,
            from: from,
            to: to,
            tokenId: tokenId.toString()
          };
        }
      }
      
      // Approval event
      if (log.topics[0] === '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925') {
        const owner = '0x' + log.topics[1].slice(26);
        const spender = '0x' + log.topics[2].slice(26);
        const amount = BigInt(log.data);
        
        const tokenInfo = await this.getTokenInfo(log.address);
        
        return {
          name: 'Approval',
          address: log.address,
          owner: owner,
          spender: spender,
          value: {
            raw: amount.toString(),
            formatted: tokenInfo ? ethers.formatUnits(amount, tokenInfo.decimals) : amount.toString()
          },
          tokenInfo: tokenInfo
        };
      }
      
    } catch (e) {
      // Couldn't parse log
    }
    
    return null;
  }

  /**
   * Get token information
   */
  async getTokenInfo(address) {
    try {
      const contract = new ethers.Contract(
        address,
        ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'],
        this.provider
      );
      
      const [decimals, symbol, name] = await Promise.all([
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Unknown Token')
      ]);
      
      return { decimals, symbol, name, address };
    } catch (e) {
      return null;
    }
  }

  /**
   * Fetch ERC7730 metadata from The Graph
   */
  async fetchERC7730Metadata(address) {
    if (!address) return null;
    
    try {
      const query = {
        query: `{ specs(where: {targetContract: "${address.toLowerCase()}"}) { ipfs targetContract status } }`
      };
      
      const response = await fetch(this.graphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });
      
      const result = await response.json();
      
      if (result.data?.specs?.[0]?.ipfs) {
        const ipfsResponse = await fetch(`${this.ipfsGateway}${result.data.specs[0].ipfs}`);
        return await ipfsResponse.json();
      }
    } catch (e) {
      // No metadata
    }
    
    return null;
  }

  /**
   * Display REAL transaction data
   */
  displayRealTransaction(tx, metadata) {
    console.log(chalk.bold('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.white('                    TRANSACTION DETAILS                        '));
    console.log(chalk.bold('═══════════════════════════════════════════════════════════════\n'));
    
    // Basic info
    console.log(chalk.cyan('Transaction Hash:'), tx.hash);
    console.log(chalk.cyan('Block Number:'), tx.blockNumber);
    console.log(chalk.cyan('Timestamp:'), tx.timestamp);
    console.log(chalk.cyan('Status:'), tx.status === 'Success' ? chalk.green('✓ Success') : chalk.red('✗ Failed'));
    
    console.log();
    console.log(chalk.cyan('From:'), tx.from);
    console.log(chalk.cyan('To:'), tx.to || chalk.gray('Contract Creation'));
    
    if (tx.value !== '0') {
      console.log(chalk.cyan('Value:'), chalk.yellow(ethers.formatEther(tx.value) + ' ETH'));
    }
    
    // RAW CALLDATA
    if (tx.data && tx.data !== '0x') {
      console.log();
      console.log(chalk.bold.red('━━━ CALLDATA (Raw Bytecode) ━━━'));
      if (tx.data.length > 200) {
        console.log(chalk.gray(tx.data.slice(0, 200) + '...'));
        console.log(chalk.gray(`[${tx.data.length} bytes total]`));
      } else {
        console.log(chalk.gray(tx.data));
      }
    }
    
    // Gas info
    console.log();
    console.log(chalk.cyan('Gas Used:'), tx.gasUsed);
    console.log(chalk.cyan('Gas Price:'), ethers.formatUnits(tx.effectiveGasPrice || tx.gasPrice, 'gwei') + ' gwei');
    const txFee = BigInt(tx.gasUsed) * BigInt(tx.effectiveGasPrice || tx.gasPrice);
    console.log(chalk.cyan('Transaction Fee:'), ethers.formatEther(txFee) + ' ETH');
    
    // Method call
    if (tx.decoded) {
      console.log(chalk.bold.yellow('\n━━━ Method Call ━━━'));
      
      if (tx.decoded.function) {
        console.log(chalk.green('Function:'), tx.decoded.function);
        
        if (tx.decoded.tokenInfo) {
          console.log(chalk.green('Token:'), `${tx.decoded.tokenInfo.name} (${tx.decoded.tokenInfo.symbol})`);
        }
        
        if (Object.keys(tx.decoded.args).length > 0) {
          console.log(chalk.green('Parameters:'));
          for (const [key, value] of Object.entries(tx.decoded.args)) {
            if (typeof value === 'object' && value.formatted) {
              console.log(`  ${key}:`, `${value.formatted} ${value.token || ''}`);
            } else if (Array.isArray(value)) {
              console.log(`  ${key}:`, value.map(v => v.slice ? `${v.slice(0, 10)}...` : v).join(' → '));
            } else {
              console.log(`  ${key}:`, value);
            }
          }
        }
        
        // Nested call (Safe)
        if (tx.decoded.nestedCall) {
          console.log(chalk.green('\nNested Transaction:'));
          console.log('  Function:', tx.decoded.nestedCall.function);
          if (tx.decoded.nestedCall.tokenInfo) {
            console.log('  Token:', `${tx.decoded.nestedCall.tokenInfo.name} (${tx.decoded.nestedCall.tokenInfo.symbol})`);
          }
          for (const [key, value] of Object.entries(tx.decoded.nestedCall.args)) {
            if (typeof value === 'object' && value.formatted) {
              console.log(`  ${key}:`, `${value.formatted} ${value.token || ''}`);
            } else {
              console.log(`  ${key}:`, value);
            }
          }
        }
      } else {
        console.log(chalk.yellow('Unknown Method:'), tx.decoded.selector);
      }
    }
    
    // Token transfers
    if (tx.tokenTransfers.length > 0) {
      console.log(chalk.bold.yellow('\n━━━ Token Transfers ━━━'));
      
      for (const transfer of tx.tokenTransfers) {
        const token = transfer.tokenInfo;
        console.log(chalk.green(`${token.symbol} Transfer:`));
        console.log('  From:', transfer.from);
        console.log('  To:', transfer.to);
        console.log('  Amount:', `${transfer.value.formatted} ${token.symbol}`);
      }
    }
    
    // Events
    if (tx.events.length > 0 && tx.events.length !== tx.tokenTransfers.length) {
      console.log(chalk.bold.yellow('\n━━━ Events ━━━'));
      
      for (const event of tx.events) {
        if (event.name === 'Approval') {
          console.log(chalk.green('Approval:'));
          console.log('  Token:', event.tokenInfo?.symbol || event.address);
          console.log('  Owner:', event.owner);
          console.log('  Spender:', event.spender);
          console.log('  Amount:', event.value.formatted + ' ' + (event.tokenInfo?.symbol || ''));
        }
      }
    }
    
    // ERC7730 metadata
    if (metadata) {
      console.log(chalk.bold.green('\n✓ ERC-7730 Metadata Available'));
      if (metadata.metadata?.owner) {
        console.log('  Owner:', metadata.metadata.owner);
      }
    }
    
    console.log(chalk.bold('\n═══════════════════════════════════════════════════════════════\n'));
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const parser = new RealTransactionParser();
  
  const txHash = process.argv[2];
  
  if (!txHash) {
    console.log(chalk.yellow('Usage: node real-transaction-parser.js <transaction_hash>'));
    console.log(chalk.gray('\nExample transactions to try:'));
    console.log(chalk.gray('  ETH transfer: 0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060'));
    process.exit(1);
  }
  
  parser.parseTransaction(txHash).catch(console.error);
}