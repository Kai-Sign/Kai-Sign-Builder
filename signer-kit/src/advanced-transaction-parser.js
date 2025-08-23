import { ethers } from 'ethers';
import chalk from 'chalk';

/**
 * Advanced Ethereum Transaction Parser
 * Handles nested transactions, ERC-4337 UserOperations, and EIP-7702 delegations
 */
export class AdvancedTransactionParser {
  constructor(rpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/1EFr4OH_BpQp-qxV_7Vv5') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Enhanced contract database
    this.knownContracts = {
      // Stablecoins
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { name: 'USDC', type: 'ERC20', decimals: 6 },
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': { name: 'USDT', type: 'ERC20', decimals: 6 },
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': { name: 'DAI', type: 'ERC20', decimals: 18 },
      '0x853d955aCEf822Db058eb8505911ED77F175b99e': { name: 'FRAX', type: 'ERC20', decimals: 18 },
      
      // WETH
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': { name: 'WETH', type: 'ERC20', decimals: 18 },
      
      // DEX Routers
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': { name: 'Uniswap V2 Router', type: 'DEX' },
      '0xE592427A0AEce92De3Edee1F18E0157C05861564': { name: 'Uniswap V3 Router', type: 'DEX' },
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45': { name: 'Uniswap Universal Router', type: 'DEX' },
      '0x1111111254EEB25477B68fb85Ed929f73A960582': { name: '1inch Router V5', type: 'DEX' },
      '0x881D40237659C251811CEC9c364ef91dC08D300C': { name: 'Metamask Swap Router', type: 'DEX' },
      
      // Account Abstraction
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789': { name: 'ERC-4337 EntryPoint v0.6', type: 'AA' },
      '0x0576a174D229E3cFA37253523E645A78A0C91B57': { name: 'ERC-4337 EntryPoint v0.7', type: 'AA' },
      
      // Safe/Multisig
      '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552': { name: 'Safe Singleton 1.3.0', type: 'Safe' },
      '0x3E5c63644E683549055b9Be8653de26E0B4CD36E': { name: 'Safe Singleton L2', type: 'Safe' },
      '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2': { name: 'Safe Factory', type: 'Safe' },
      
      // Infrastructure
      '0xcA11bde05977b3631167028862bE2a173976CA11': { name: 'Multicall3', type: 'Infrastructure' },
      '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696': { name: 'Multicall2', type: 'Infrastructure' },
      
      // Popular Smart Wallets
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789': { name: 'EntryPoint', type: 'AA' },
      '0x9406cc6185a346906296840746125a0e44976454': { name: 'Kernel Factory', type: 'AA' },
      '0x0DA6a956B9488eD4dd761E59f52FDc6c8068E6B5': { name: 'Biconomy Factory', type: 'AA' },
    };
    
    // Enhanced method signatures with nested decoding support
    this.methodSignatures = {
      // ERC20
      '0xa9059cbb': { name: 'transfer', abi: 'transfer(address,uint256)', nested: false },
      '0x095ea7b3': { name: 'approve', abi: 'approve(address,uint256)', nested: false },
      '0x23b872dd': { name: 'transferFrom', abi: 'transferFrom(address,address,uint256)', nested: false },
      
      // ERC-4337 UserOperations
      '0x1fad948c': { name: 'handleOps', abi: 'handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[],address)', nested: true },
      '0x765e827f': { name: 'handleAggregatedOps', abi: 'handleAggregatedOps(((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[],address,bytes)[],address)', nested: true },
      
      // Smart Account execution
      '0xb61d27f6': { name: 'execute', abi: 'execute(address,uint256,bytes)', nested: true },
      '0x18dfb3c7': { name: 'executeBatch', abi: 'executeBatch(address[],uint256[],bytes[])', nested: true },
      '0x47e1da2a': { name: 'executeUserOp', abi: 'executeUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32)', nested: true },
      
      // Safe transactions
      '0x6a761202': { name: 'execTransaction', abi: 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)', nested: true },
      '0xd4d9bdcd': { name: 'multiSend', abi: 'multiSend(bytes)', nested: true },
      
      // EIP-7702 Delegation
      '0x0f2c9329': { name: 'setCode', abi: 'setCode(address,bytes)', nested: false },
      '0xde8fa431': { name: 'getCode', abi: 'getCode(address)', nested: false },
      
      // Multicall
      '0x82ad56cb': { name: 'aggregate3', abi: 'aggregate3((address,bool,bytes)[])', nested: true },
      '0x252dba42': { name: 'aggregate', abi: 'aggregate((address,bytes)[])', nested: true },
    };
  }

  /**
   * Parse transaction with full nested support
   */
  async parseTransaction(txHashOrObject, depth = 0) {
    try {
      let tx, receipt;
      
      if (typeof txHashOrObject === 'string') {
        if (depth === 0) {
          console.log(chalk.blue(`\n📋 Parsing transaction ${txHashOrObject.slice(0, 10)}...`));
        }
        tx = await this.provider.getTransaction(txHashOrObject);
        receipt = await this.provider.getTransactionReceipt(txHashOrObject);
      } else {
        tx = txHashOrObject;
        receipt = null;
      }
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      const parsed = {
        hash: tx.hash || 'N/A',
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value || 0) + ' ETH',
        contract: this.knownContracts[tx.to] || null,
        
        // Main transaction
        method: null,
        decodedData: null,
        
        // Nested transactions
        nestedTransactions: [],
        
        // Account abstraction specific
        userOperations: [],
        delegations: [],
        
        // Human interpretation
        interpretation: null,
        
        // Events
        events: receipt ? this.parseEvents(receipt.logs) : []
      };
      
      // Parse main transaction
      if (tx.data && tx.data !== '0x') {
        const result = await this.parseMethodCall(tx.data, tx.to, depth);
        parsed.method = result.method;
        parsed.decodedData = result.decodedData;
        
        // Check for nested transactions
        if (result.nestedTransactions) {
          parsed.nestedTransactions = result.nestedTransactions;
        }
        
        // Check for UserOperations
        if (result.userOperations) {
          parsed.userOperations = result.userOperations;
        }
        
        // Check for delegations
        if (result.delegations) {
          parsed.delegations = result.delegations;
        }
        
        // Generate interpretation
        parsed.interpretation = this.generateInterpretation(parsed);
      } else if (tx.value && BigInt(tx.value) > 0n) {
        parsed.interpretation = `💸 ETH Transfer: ${parsed.value}`;
      }
      
      return parsed;
      
    } catch (error) {
      console.error(chalk.red(`Parse error at depth ${depth}:`), error.message);
      return { error: error.message };
    }
  }

  /**
   * Parse method call with nested transaction support
   */
  async parseMethodCall(data, to, depth = 0) {
    if (!data || data === '0x') {
      return { method: null, decodedData: null };
    }
    
    const selector = data.slice(0, 10);
    const methodInfo = this.methodSignatures[selector];
    
    if (!methodInfo) {
      return {
        method: `Unknown (${selector})`,
        decodedData: { selector, raw: data.slice(0, 66) + '...' }
      };
    }
    
    const result = {
      method: methodInfo.name,
      decodedData: null,
      nestedTransactions: [],
      userOperations: [],
      delegations: []
    };
    
    try {
      // Handle based on method type
      switch (methodInfo.name) {
        case 'handleOps':
          result.userOperations = await this.parseUserOperations(data);
          result.decodedData = {
            type: 'ERC-4337 UserOperations',
            count: result.userOperations.length
          };
          break;
          
        case 'handleAggregatedOps':
          result.userOperations = await this.parseAggregatedUserOperations(data);
          result.decodedData = {
            type: 'ERC-4337 Aggregated UserOperations',
            count: result.userOperations.length
          };
          break;
          
        case 'execute':
        case 'executeUserOp':
          result.nestedTransactions = await this.parseSmartAccountExecution(data, methodInfo.name);
          result.decodedData = {
            type: 'Smart Account Execution',
            nested: result.nestedTransactions.length
          };
          break;
          
        case 'executeBatch':
          result.nestedTransactions = await this.parseBatchExecution(data);
          result.decodedData = {
            type: 'Batch Execution',
            count: result.nestedTransactions.length
          };
          break;
          
        case 'execTransaction':
          result.nestedTransactions = await this.parseSafeTransaction(data);
          result.decodedData = {
            type: 'Safe Transaction',
            nested: result.nestedTransactions.length > 0
          };
          break;
          
        case 'multiSend':
          result.nestedTransactions = await this.parseMultiSend(data);
          result.decodedData = {
            type: 'Safe MultiSend',
            count: result.nestedTransactions.length
          };
          break;
          
        case 'aggregate3':
        case 'aggregate':
          result.nestedTransactions = await this.parseMulticall(data, methodInfo.name);
          result.decodedData = {
            type: 'Multicall',
            calls: result.nestedTransactions.length
          };
          break;
          
        case 'setCode':
          result.delegations = await this.parseEIP7702Delegation(data);
          result.decodedData = {
            type: 'EIP-7702 Delegation',
            delegations: result.delegations.length
          };
          break;
          
        default:
          // Standard decoding
          result.decodedData = await this.decodeStandardMethod(methodInfo, data, to);
      }
    } catch (error) {
      result.decodedData = {
        error: error.message,
        selector,
        raw: data.slice(0, 66) + '...'
      };
    }
    
    return result;
  }

  /**
   * Parse ERC-4337 UserOperations
   */
  async parseUserOperations(data) {
    const userOps = [];
    
    try {
      const iface = new ethers.Interface([
        'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)'
      ]);
      
      const decoded = iface.decodeFunctionData('handleOps', data);
      const ops = decoded[0];
      
      for (const op of ops) {
        const userOp = {
          sender: op[0],
          nonce: op[1].toString(),
          initCode: op[2],
          callData: op[3],
          callGasLimit: op[4].toString(),
          verificationGasLimit: op[5].toString(),
          preVerificationGas: op[6].toString(),
          maxFeePerGas: ethers.formatUnits(op[7], 'gwei') + ' gwei',
          maxPriorityFeePerGas: ethers.formatUnits(op[8], 'gwei') + ' gwei',
          paymaster: op[9] && op[9] !== '0x' ? '0x' + op[9].slice(2, 42) : null,
          
          // Decode the actual operation
          operation: null
        };
        
        // Parse the callData to understand what the UserOp is doing
        if (userOp.callData && userOp.callData !== '0x') {
          const callDataResult = await this.parseMethodCall(userOp.callData, userOp.sender, 1);
          userOp.operation = {
            method: callDataResult.method,
            data: callDataResult.decodedData,
            nested: callDataResult.nestedTransactions
          };
        }
        
        userOps.push(userOp);
      }
    } catch (error) {
      console.error('Failed to parse UserOperations:', error.message);
    }
    
    return userOps;
  }

  /**
   * Parse aggregated UserOperations
   */
  async parseAggregatedUserOperations(data) {
    const userOps = [];
    
    try {
      // Parse aggregated ops structure
      const iface = new ethers.Interface([
        'function handleAggregatedOps(tuple(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] userOps, address aggregator, bytes signature)[] opsPerAggregator, address beneficiary)'
      ]);
      
      const decoded = iface.decodeFunctionData('handleAggregatedOps', data);
      
      for (const aggregatedOps of decoded[0]) {
        const aggregator = aggregatedOps[1];
        
        for (const op of aggregatedOps[0]) {
          const userOp = {
            aggregator,
            sender: op[0],
            nonce: op[1].toString(),
            callData: op[3],
            operation: null
          };
          
          if (userOp.callData && userOp.callData !== '0x') {
            const callDataResult = await this.parseMethodCall(userOp.callData, userOp.sender, 1);
            userOp.operation = callDataResult;
          }
          
          userOps.push(userOp);
        }
      }
    } catch (error) {
      console.error('Failed to parse aggregated UserOperations:', error.message);
    }
    
    return userOps;
  }

  /**
   * Parse smart account execution
   */
  async parseSmartAccountExecution(data, methodName) {
    const nested = [];
    
    try {
      if (methodName === 'execute') {
        const iface = new ethers.Interface([
          'function execute(address target, uint256 value, bytes data)'
        ]);
        
        const decoded = iface.decodeFunctionData('execute', data);
        const [target, value, callData] = decoded;
        
        // Parse the nested call
        if (callData && callData !== '0x') {
          const nestedResult = await this.parseMethodCall(callData, target, 1);
          nested.push({
            target: this.formatAddress(target),
            value: ethers.formatEther(value),
            method: nestedResult.method,
            data: nestedResult.decodedData
          });
        }
      } else if (methodName === 'executeUserOp') {
        // Parse UserOp execution
        const iface = new ethers.Interface([
          'function executeUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash)'
        ]);
        
        const decoded = iface.decodeFunctionData('executeUserOp', data);
        const userOp = decoded[0];
        
        if (userOp[3] && userOp[3] !== '0x') {
          const nestedResult = await this.parseMethodCall(userOp[3], userOp[0], 1);
          nested.push({
            type: 'UserOp Execution',
            sender: this.formatAddress(userOp[0]),
            method: nestedResult.method,
            data: nestedResult.decodedData
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse smart account execution:', error.message);
    }
    
    return nested;
  }

  /**
   * Parse batch execution
   */
  async parseBatchExecution(data) {
    const nested = [];
    
    try {
      const iface = new ethers.Interface([
        'function executeBatch(address[] targets, uint256[] values, bytes[] datas)'
      ]);
      
      const decoded = iface.decodeFunctionData('executeBatch', data);
      const [targets, values, datas] = decoded;
      
      for (let i = 0; i < targets.length; i++) {
        if (datas[i] && datas[i] !== '0x') {
          const nestedResult = await this.parseMethodCall(datas[i], targets[i], 1);
          nested.push({
            index: i,
            target: this.formatAddress(targets[i]),
            value: ethers.formatEther(values[i]),
            method: nestedResult.method,
            data: nestedResult.decodedData
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse batch execution:', error.message);
    }
    
    return nested;
  }

  /**
   * Parse Safe transaction
   */
  async parseSafeTransaction(data) {
    const nested = [];
    
    try {
      const iface = new ethers.Interface([
        'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)'
      ]);
      
      const decoded = iface.decodeFunctionData('execTransaction', data);
      const [to, value, callData, operation] = decoded;
      
      if (callData && callData !== '0x') {
        const nestedResult = await this.parseMethodCall(callData, to, 1);
        nested.push({
          type: 'Safe Inner Transaction',
          target: this.formatAddress(to),
          value: ethers.formatEther(value),
          operation: operation === 1 ? 'DelegateCall' : 'Call',
          method: nestedResult.method,
          data: nestedResult.decodedData,
          // Handle double nesting (e.g., Safe calling another contract that does something)
          nested: nestedResult.nestedTransactions
        });
      }
    } catch (error) {
      console.error('Failed to parse Safe transaction:', error.message);
    }
    
    return nested;
  }

  /**
   * Parse Safe MultiSend
   */
  async parseMultiSend(data) {
    const nested = [];
    
    try {
      // MultiSend uses packed encoding
      let offset = 10; // Skip method selector
      const txData = data.slice(2); // Remove 0x
      
      // Read the bytes data offset
      const dataOffset = parseInt(txData.slice(offset, offset + 64), 16) * 2;
      offset = dataOffset + 8; // Move to actual data
      
      // Read data length
      const dataLength = parseInt(txData.slice(offset, offset + 64), 16) * 2;
      offset += 64;
      
      // Parse packed transactions
      const packedData = txData.slice(offset, offset + dataLength);
      let position = 0;
      
      while (position < packedData.length) {
        // Read operation (1 byte)
        const operation = parseInt(packedData.slice(position, position + 2), 16);
        position += 2;
        
        // Read to address (20 bytes)
        const to = '0x' + packedData.slice(position, position + 40);
        position += 40;
        
        // Read value (32 bytes)
        const value = '0x' + packedData.slice(position, position + 64);
        position += 64;
        
        // Read data length (32 bytes)
        const dataLen = parseInt(packedData.slice(position, position + 64), 16) * 2;
        position += 64;
        
        // Read data
        const callData = '0x' + packedData.slice(position, position + dataLen);
        position += dataLen;
        
        // Parse nested call
        if (callData && callData !== '0x') {
          const nestedResult = await this.parseMethodCall(callData, to, 1);
          nested.push({
            operation: operation === 1 ? 'DelegateCall' : 'Call',
            target: this.formatAddress(to),
            value: ethers.formatEther(value),
            method: nestedResult.method,
            data: nestedResult.decodedData
          });
        }
      }
    } catch (error) {
      console.error('Failed to parse MultiSend:', error.message);
    }
    
    return nested;
  }

  /**
   * Parse Multicall
   */
  async parseMulticall(data, methodName) {
    const nested = [];
    
    try {
      if (methodName === 'aggregate3') {
        const iface = new ethers.Interface([
          'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls)'
        ]);
        
        const decoded = iface.decodeFunctionData('aggregate3', data);
        const calls = decoded[0];
        
        for (let i = 0; i < calls.length; i++) {
          const [target, allowFailure, callData] = calls[i];
          
          if (callData && callData !== '0x') {
            const nestedResult = await this.parseMethodCall(callData, target, 1);
            nested.push({
              index: i,
              target: this.formatAddress(target),
              allowFailure,
              method: nestedResult.method,
              data: nestedResult.decodedData
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse Multicall:', error.message);
    }
    
    return nested;
  }

  /**
   * Parse EIP-7702 delegation
   */
  async parseEIP7702Delegation(data) {
    const delegations = [];
    
    try {
      const iface = new ethers.Interface([
        'function setCode(address target, bytes code)'
      ]);
      
      const decoded = iface.decodeFunctionData('setCode', data);
      const [target, code] = decoded;
      
      delegations.push({
        type: 'EIP-7702',
        target: this.formatAddress(target),
        codeSize: code.length / 2 - 1, // bytes
        codeHash: ethers.keccak256(code)
      });
    } catch (error) {
      console.error('Failed to parse EIP-7702 delegation:', error.message);
    }
    
    return delegations;
  }

  /**
   * Decode standard method
   */
  async decodeStandardMethod(methodInfo, data, to) {
    try {
      const iface = new ethers.Interface([`function ${methodInfo.abi}`]);
      const decoded = iface.decodeFunctionData(methodInfo.name, data);
      
      // Format based on method
      switch (methodInfo.name) {
        case 'transfer':
        case 'approve': {
          const contract = this.knownContracts[to];
          return {
            to: this.formatAddress(decoded[0]),
            amount: contract ? 
              ethers.formatUnits(decoded[1], contract.decimals) + ' ' + contract.name :
              decoded[1].toString()
          };
        }
        
        case 'transferFrom': {
          const contract = this.knownContracts[to];
          return {
            from: this.formatAddress(decoded[0]),
            to: this.formatAddress(decoded[1]),
            amount: contract ? 
              ethers.formatUnits(decoded[2], contract.decimals) + ' ' + contract.name :
              decoded[2].toString()
          };
        }
        
        default:
          return Object.fromEntries(decoded.map((val, i) => [`param${i}`, val.toString()]));
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse events
   */
  parseEvents(logs) {
    const events = [];
    
    for (const log of logs) {
      // Transfer event
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        const contract = this.knownContracts[log.address];
        
        if (log.topics.length === 3) {
          // ERC20 Transfer
          events.push({
            type: 'Transfer',
            token: contract ? contract.name : this.formatAddress(log.address),
            from: this.formatAddress('0x' + log.topics[1].slice(26)),
            to: this.formatAddress('0x' + log.topics[2].slice(26)),
            amount: contract && log.data !== '0x' ? 
              ethers.formatUnits(log.data, contract.decimals) + ' ' + contract.name :
              'Unknown amount'
          });
        } else if (log.topics.length === 4) {
          // ERC721 Transfer
          events.push({
            type: 'NFT Transfer',
            collection: contract ? contract.name : this.formatAddress(log.address),
            from: this.formatAddress('0x' + log.topics[1].slice(26)),
            to: this.formatAddress('0x' + log.topics[2].slice(26)),
            tokenId: BigInt(log.topics[3]).toString()
          });
        }
      }
      
      // UserOperationEvent (ERC-4337)
      if (log.topics[0] === '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f') {
        events.push({
          type: 'UserOperation',
          userOpHash: log.topics[1],
          sender: this.formatAddress('0x' + log.topics[2].slice(26)),
          paymaster: log.topics[3] !== '0x0000000000000000000000000000000000000000000000000000000000000000' ?
            this.formatAddress('0x' + log.topics[3].slice(26)) : null
        });
      }
    }
    
    return events;
  }

  /**
   * Generate human-readable interpretation
   */
  generateInterpretation(parsed) {
    const parts = [];
    
    // Main action
    if (parsed.method) {
      switch (parsed.method) {
        case 'handleOps':
          parts.push(`🤖 Processing ${parsed.userOperations.length} ERC-4337 UserOperation(s)`);
          for (const op of parsed.userOperations) {
            if (op.operation && op.operation.method) {
              parts.push(`  └─ ${this.formatAddress(op.sender)}: ${op.operation.method}`);
            }
          }
          break;
          
        case 'execute':
        case 'executeBatch':
          if (parsed.nestedTransactions.length > 0) {
            parts.push(`🔄 Smart Account executing ${parsed.nestedTransactions.length} operation(s)`);
            for (const nested of parsed.nestedTransactions) {
              parts.push(`  └─ ${nested.method} on ${nested.target}`);
            }
          }
          break;
          
        case 'execTransaction':
          if (parsed.nestedTransactions.length > 0) {
            parts.push(`🔒 Safe executing transaction`);
            for (const nested of parsed.nestedTransactions) {
              if (nested.nested && nested.nested.length > 0) {
                parts.push(`  └─ ${nested.method} → ${nested.nested.map(n => n.method).join(', ')}`);
              } else {
                parts.push(`  └─ ${nested.method} on ${nested.target}`);
              }
            }
          }
          break;
          
        case 'multiSend':
          parts.push(`📦 Safe MultiSend with ${parsed.nestedTransactions.length} transactions`);
          for (const nested of parsed.nestedTransactions) {
            parts.push(`  └─ ${nested.method} on ${nested.target}`);
          }
          break;
          
        case 'aggregate3':
          parts.push(`🔀 Multicall3 batching ${parsed.nestedTransactions.length} calls`);
          for (const nested of parsed.nestedTransactions) {
            parts.push(`  └─ ${nested.method} on ${nested.target}`);
          }
          break;
          
        case 'transfer':
          parts.push(`💸 Transfer ${parsed.decodedData.amount} to ${parsed.decodedData.to}`);
          break;
          
        case 'approve':
          parts.push(`✅ Approve ${parsed.decodedData.to} to spend ${parsed.decodedData.amount}`);
          break;
          
        default:
          parts.push(`📝 ${parsed.method} on ${parsed.contract?.name || 'contract'}`);
      }
    } else if (parsed.value !== '0 ETH') {
      parts.push(`💸 Transfer ${parsed.value}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Format address
   */
  formatAddress(address) {
    if (!address) return 'N/A';
    const contract = this.knownContracts[address];
    if (contract) return contract.name;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Display parsed transaction with full nesting
   */
  displayParsedTransaction(parsed, indent = '') {
    if (indent === '') {
      console.log(chalk.bold('\n========================================'));
      console.log(chalk.bold('     ADVANCED TRANSACTION PARSER       '));
      console.log(chalk.bold('========================================'));
    }
    
    if (parsed.error) {
      console.log(chalk.red(`${indent}❌ Error: ${parsed.error}`));
      return;
    }
    
    // Main transaction info
    if (indent === '') {
      console.log(chalk.cyan(`📍 Transaction: ${parsed.hash}`));
      console.log(chalk.cyan(`👤 From: ${this.formatAddress(parsed.from)}`));
      console.log(chalk.cyan(`📮 To: ${this.formatAddress(parsed.to)}`));
      console.log(chalk.cyan(`💰 Value: ${parsed.value}`));
      
      if (parsed.contract) {
        console.log(chalk.yellow(`📄 Contract: ${parsed.contract.name} (${parsed.contract.type})`));
      }
      
      if (parsed.method) {
        console.log(chalk.green(`🔧 Method: ${parsed.method}`));
      }
    }
    
    // UserOperations
    if (parsed.userOperations && parsed.userOperations.length > 0) {
      console.log(chalk.magenta(`\n${indent}🤖 ERC-4337 UserOperations (${parsed.userOperations.length}):`));
      for (const op of parsed.userOperations) {
        console.log(chalk.magenta(`${indent}  ├─ Sender: ${this.formatAddress(op.sender)}`));
        console.log(chalk.magenta(`${indent}  ├─ Nonce: ${op.nonce}`));
        console.log(chalk.magenta(`${indent}  ├─ Gas: ${op.callGasLimit} (max: ${op.maxFeePerGas})`));
        if (op.paymaster) {
          console.log(chalk.magenta(`${indent}  ├─ Paymaster: ${this.formatAddress(op.paymaster)}`));
        }
        if (op.operation) {
          console.log(chalk.magenta(`${indent}  └─ Operation: ${op.operation.method}`));
          if (op.operation.nested && op.operation.nested.length > 0) {
            for (const nested of op.operation.nested) {
              console.log(chalk.gray(`${indent}      └─ ${nested.method} on ${nested.target}`));
            }
          }
        }
      }
    }
    
    // Nested transactions
    if (parsed.nestedTransactions && parsed.nestedTransactions.length > 0) {
      console.log(chalk.yellow(`\n${indent}📦 Nested Transactions (${parsed.nestedTransactions.length}):`));
      for (const nested of parsed.nestedTransactions) {
        console.log(chalk.yellow(`${indent}  ├─ Target: ${nested.target}`));
        if (nested.value) {
          console.log(chalk.yellow(`${indent}  ├─ Value: ${nested.value} ETH`));
        }
        console.log(chalk.yellow(`${indent}  ├─ Method: ${nested.method}`));
        if (nested.data && !nested.data.error) {
          console.log(chalk.gray(`${indent}  ├─ Data: ${JSON.stringify(nested.data, null, 2).split('\n').join('\n' + indent + '  │  ')}`));
        }
        
        // Handle double nesting
        if (nested.nested && nested.nested.length > 0) {
          console.log(chalk.yellow(`${indent}  └─ Sub-nested (${nested.nested.length}):`));
          for (const subNested of nested.nested) {
            console.log(chalk.gray(`${indent}      └─ ${subNested.method} on ${subNested.target}`));
          }
        }
      }
    }
    
    // Delegations (EIP-7702)
    if (parsed.delegations && parsed.delegations.length > 0) {
      console.log(chalk.blue(`\n${indent}🔑 EIP-7702 Delegations (${parsed.delegations.length}):`));
      for (const delegation of parsed.delegations) {
        console.log(chalk.blue(`${indent}  ├─ Target: ${delegation.target}`));
        console.log(chalk.blue(`${indent}  ├─ Code Size: ${delegation.codeSize} bytes`));
        console.log(chalk.blue(`${indent}  └─ Code Hash: ${delegation.codeHash.slice(0, 10)}...`));
      }
    }
    
    // Events
    if (parsed.events && parsed.events.length > 0) {
      console.log(chalk.green(`\n${indent}📢 Events (${parsed.events.length}):`));
      for (const event of parsed.events) {
        if (event.type === 'Transfer') {
          console.log(chalk.green(`${indent}  ├─ ${event.type}: ${event.amount} from ${event.from} to ${event.to}`));
        } else if (event.type === 'UserOperation') {
          console.log(chalk.green(`${indent}  ├─ UserOp: ${event.sender} (hash: ${event.userOpHash.slice(0, 10)}...)`));
        } else {
          console.log(chalk.green(`${indent}  ├─ ${event.type}: ${JSON.stringify(event)}`));
        }
      }
    }
    
    // Interpretation
    if (parsed.interpretation && indent === '') {
      console.log(chalk.bold.white(`\n✨ Interpretation:\n${parsed.interpretation}`));
    }
  }
}

// Export
export default AdvancedTransactionParser;

// Demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const parser = new AdvancedTransactionParser();
  
  console.log(chalk.bold.blue('🔍 Advanced Transaction Parser - Ready for nested transactions, ERC-4337, and EIP-7702!\n'));
  
  // Example: Parse a recent transaction
  const exampleTx = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';
  
  parser.parseTransaction(exampleTx)
    .then(result => {
      parser.displayParsedTransaction(result);
      console.log(chalk.bold.green('\n✅ Advanced parser ready!'));
    })
    .catch(error => {
      console.error(chalk.red('Error:'), error);
    });
}