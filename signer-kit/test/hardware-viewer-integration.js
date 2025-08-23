import { ethers } from 'ethers';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClearSigningResolver } from '../src/clear-signing.js';
import { ERC20MetadataProvider } from '../src/erc20-metadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Hardware Viewer Integration Test
 * Generates ERC7730 metadata and transaction data for hardware viewer component
 */
class HardwareViewerIntegration {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/1EFr4OH_BpQp-qxV_7Vv5');
    this.clearSigningResolver = new ClearSigningResolver();
    this.erc20Provider = new ERC20MetadataProvider();
  }

  /**
   * Generate ERC7730 metadata for a contract
   */
  generateERC7730Metadata(contractInfo) {
    const { address, chainId, name, owner, url, operations } = contractInfo;
    
    const metadata = {
      "$schema": "https://schemas.ledger.com/erc7730/1.0.0",
      "context": {
        "contract": {
          "address": address,
          "chainId": chainId
        }
      },
      "metadata": {
        "owner": owner,
        "info": {
          "url": url,
          "legalName": owner
        }
      },
      "display": {
        "formats": {}
      }
    };
    
    // Add operations
    for (const [opName, opConfig] of Object.entries(operations)) {
      metadata.display.formats[opName] = {
        "intent": opConfig.intent,
        "fields": opConfig.fields.map(field => ({
          "path": field.path,
          "label": field.label,
          "format": field.format,
          "params": field.params || {}
        }))
      };
    }
    
    return metadata;
  }

  /**
   * Decode real mainnet transaction
   */
  async decodeMainnetTransaction(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      // Decode the transaction data
      const decoded = {
        txHash: txHash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        data: tx.data,
        methodCall: null,
        transfers: [],
        addressesMeta: {}
      };
      
      // Try to decode method call
      if (tx.data && tx.data !== '0x') {
        const selector = tx.data.slice(0, 10);
        
        // Common method selectors
        const methodSelectors = {
          '0xa9059cbb': 'transfer',
          '0x095ea7b3': 'approve',
          '0x23b872dd': 'transferFrom',
          '0xd0e30db0': 'deposit',
          '0x2e1a7d4d': 'withdraw',
          '0x414bf389': 'exactInputSingle', // Uniswap V3
          '0x12aa3caf': 'swap', // 1inch
          '0x82ad56cb': 'aggregate3', // Multicall3
          '0xb61d27f6': 'execute', // Safe
          '0x617ba037': 'supply', // Aave
          '0xa415bcad': 'borrow' // Aave
        };
        
        const methodName = methodSelectors[selector] || 'unknown';
        
        decoded.methodCall = {
          name: methodName,
          selector: selector,
          params: []
        };
        
        // Decode parameters based on method
        if (methodName === 'transfer') {
          const iface = new ethers.Interface(['function transfer(address to, uint256 value)']);
          const decodedData = iface.decodeFunctionData('transfer', tx.data);
          
          decoded.methodCall.params = [
            { name: 'to', type: 'address', value: decodedData[0] },
            { name: 'value', type: 'uint256', value: decodedData[1].toString() }
          ];
          
          // Add transfer info
          if (tx.to) {
            const tokenInfo = await this.getTokenInfo(tx.to);
            if (tokenInfo) {
              const amount = ethers.formatUnits(decodedData[1], tokenInfo.decimals);
              decoded.transfers.push({
                type: 'ERC20',
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                address: tx.to,
                amount: amount,
                to: decodedData[0],
                from: tx.from
              });
              
              decoded.addressesMeta[tx.to] = {
                contractAddress: tx.to,
                contractName: tokenInfo.name,
                tokenSymbol: tokenInfo.symbol,
                decimals: tokenInfo.decimals,
                type: 'ERC20'
              };
            }
          }
        } else if (methodName === 'approve') {
          const iface = new ethers.Interface(['function approve(address spender, uint256 value)']);
          const decodedData = iface.decodeFunctionData('approve', tx.data);
          
          decoded.methodCall.params = [
            { name: 'spender', type: 'address', value: decodedData[0] },
            { name: 'value', type: 'uint256', value: decodedData[1].toString() }
          ];
        }
      }
      
      return decoded;
      
    } catch (error) {
      console.error(chalk.red(`Failed to decode transaction ${txHash}:`, error.message));
      return null;
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(address) {
    try {
      const iface = new ethers.Interface([
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ]);
      
      const contract = new ethers.Contract(address, iface, this.provider);
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => 'UNK'),
        contract.decimals().catch(() => 18)
      ]);
      
      return { name, symbol, decimals };
    } catch (error) {
      return null;
    }
  }

  /**
   * Test Suite 1: USDC Transfer
   */
  async testUSDCTransfer() {
    console.log(chalk.blue('\n💵 Testing USDC Transfer for Hardware Viewer'));
    
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    
    // Generate ERC7730 metadata
    const metadata = this.generateERC7730Metadata({
      address: usdcAddress,
      chainId: 1,
      name: 'USD Coin',
      owner: 'Circle',
      url: 'https://circle.com',
      operations: {
        'transfer': {
          intent: 'Transfer USDC',
          fields: [
            {
              path: 'to',
              label: 'Recipient',
              format: 'addressName'
            },
            {
              path: 'value',
              label: 'Amount',
              format: 'tokenAmount',
              params: { tokenPath: '$.contract' }
            }
          ]
        },
        'approve': {
          intent: 'Approve USDC spending',
          fields: [
            {
              path: 'spender',
              label: 'Spender',
              format: 'addressName'
            },
            {
              path: 'value',
              label: 'Amount',
              format: 'tokenAmount',
              params: { tokenPath: '$.contract' }
            }
          ]
        }
      }
    });
    
    // Create sample transaction data
    const iface = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const transferData = iface.encodeFunctionData('transfer', [
      '0x1234567890123456789012345678901234567890',
      ethers.parseUnits('100', 6)
    ]);
    
    const transactionData = {
      txHash: '0x' + '0'.repeat(64),
      methodCall: {
        name: 'transfer',
        params: [
          {
            name: 'to',
            type: 'address',
            value: '0x1234567890123456789012345678901234567890'
          },
          {
            name: 'value',
            type: 'uint256',
            value: '100000000' // 100 USDC (6 decimals)
          }
        ]
      },
      transfers: [
        {
          type: 'ERC20',
          name: 'USD Coin',
          symbol: 'USDC',
          address: usdcAddress,
          amount: '100',
          to: '0x1234567890123456789012345678901234567890',
          from: '0x1234567890123456789012345678901234567890'
        }
      ],
      addressesMeta: {
        [usdcAddress]: {
          contractAddress: usdcAddress,
          contractName: 'USD Coin',
          tokenSymbol: 'USDC',
          decimals: 6,
          type: 'ERC20'
        }
      }
    };
    
    return {
      metadata,
      transactionData,
      testName: 'USDC Transfer'
    };
  }

  /**
   * Test Suite 2: Uniswap V3 Swap
   */
  async testUniswapV3Swap() {
    console.log(chalk.blue('\n🦄 Testing Uniswap V3 Swap for Hardware Viewer'));
    
    const uniswapV3Router = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    
    // Generate ERC7730 metadata
    const metadata = this.generateERC7730Metadata({
      address: uniswapV3Router,
      chainId: 1,
      name: 'Uniswap V3 Router',
      owner: 'Uniswap',
      url: 'https://uniswap.org',
      operations: {
        'exactInputSingle': {
          intent: 'Swap tokens on Uniswap V3',
          fields: [
            {
              path: 'tokenIn',
              label: 'From Token',
              format: 'addressName'
            },
            {
              path: 'tokenOut',
              label: 'To Token',
              format: 'addressName'
            },
            {
              path: 'amountIn',
              label: 'Amount In',
              format: 'tokenAmount'
            },
            {
              path: 'amountOutMinimum',
              label: 'Min Amount Out',
              format: 'tokenAmount'
            }
          ]
        }
      }
    });
    
    // Create sample transaction data
    const transactionData = {
      txHash: '0x' + '1'.repeat(64),
      methodCall: {
        name: 'exactInputSingle',
        params: [
          {
            name: 'tokenIn',
            type: 'address',
            value: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
          },
          {
            name: 'tokenOut',
            type: 'address',
            value: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
          },
          {
            name: 'fee',
            type: 'uint24',
            value: '3000'
          },
          {
            name: 'recipient',
            type: 'address',
            value: '0x1234567890123456789012345678901234567890'
          },
          {
            name: 'deadline',
            type: 'uint256',
            value: Math.floor(Date.now() / 1000) + 3600
          },
          {
            name: 'amountIn',
            type: 'uint256',
            value: '1000000000' // 1000 USDC
          },
          {
            name: 'amountOutMinimum',
            type: 'uint256',
            value: '400000000000000000' // 0.4 ETH minimum
          }
        ]
      },
      addressesMeta: {
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          contractName: 'USD Coin',
          tokenSymbol: 'USDC',
          decimals: 6,
          type: 'ERC20'
        },
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
          contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          contractName: 'Wrapped Ether',
          tokenSymbol: 'WETH',
          decimals: 18,
          type: 'ERC20'
        }
      }
    };
    
    return {
      metadata,
      transactionData,
      testName: 'Uniswap V3 Swap'
    };
  }

  /**
   * Test Suite 3: Gnosis Safe with nested USDC transfer
   */
  async testGnosisSafeWithUSDC() {
    console.log(chalk.blue('\n🔒 Testing Gnosis Safe + USDC for Hardware Viewer'));
    
    const safeAddress = '0x76E2cFc1F5Fa4F9C9AA3bB0B8e1E4Db67c93797e';
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    
    // Safe metadata
    const safeMetadata = this.generateERC7730Metadata({
      address: safeAddress,
      chainId: 1,
      name: 'Gnosis Safe',
      owner: 'Safe',
      url: 'https://safe.global',
      operations: {
        'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)': {
          intent: 'Execute Safe transaction',
          fields: [
            {
              path: '#.to',
              label: 'Target',
              format: 'addressName'
            },
            {
              path: '#.value',
              label: 'Value',
              format: 'amount'
            },
            {
              path: '#.data',
              label: 'Data',
              format: 'raw'
            },
            {
              path: '#.operation',
              label: 'Operation Type',
              format: 'raw'
            }
          ]
        }
      }
    });
    
    // USDC metadata
    const usdcMetadata = this.generateERC7730Metadata({
      address: usdcAddress,
      chainId: 1,
      name: 'USD Coin',
      owner: 'Circle',
      url: 'https://circle.com',
      operations: {
        'transfer': {
          intent: 'Transfer USDC',
          fields: [
            {
              path: 'to',
              label: 'Recipient',
              format: 'addressName'
            },
            {
              path: 'value',
              label: 'Amount',
              format: 'tokenAmount',
              params: { tokenPath: '$.contract' }
            }
          ]
        }
      }
    });
    
    // Create nested transaction data
    const iface = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const innerTransferData = iface.encodeFunctionData('transfer', [
      '0xA1371748D65baEF4509A3c067b3fe3a1b79183aE',
      ethers.parseUnits('521.419831', 6)
    ]);
    
    const transactionData = {
      txHash: '0x22a244794f155ce4a5765588353cf82dfc842c33ee3ed98e95ef488f6964f4fb',
      methodCall: {
        name: 'execTransaction',
        params: [
          {
            name: 'to',
            type: 'address',
            value: usdcAddress
          },
          {
            name: 'value',
            type: 'uint256',
            value: '0'
          },
          {
            name: 'data',
            type: 'bytes',
            value: innerTransferData,
            valueDecoded: {
              name: 'transfer',
              params: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0xA1371748D65baEF4509A3c067b3fe3a1b79183aE'
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '521419831' // 521.419831 USDC
                }
              ]
            }
          },
          {
            name: 'operation',
            type: 'uint8',
            value: '0'
          },
          {
            name: 'safeTxGas',
            type: 'uint256',
            value: '0'
          },
          {
            name: 'baseGas',
            type: 'uint256',
            value: '0'
          },
          {
            name: 'gasPrice',
            type: 'uint256',
            value: '0'
          },
          {
            name: 'gasToken',
            type: 'address',
            value: '0x0000000000000000000000000000000000000000'
          },
          {
            name: 'refundReceiver',
            type: 'address',
            value: '0x0000000000000000000000000000000000000000'
          },
          {
            name: 'signatures',
            type: 'bytes',
            value: '0x' + '0'.repeat(130)
          }
        ]
      },
      transfers: [
        {
          type: 'ERC20',
          name: 'USD Coin',
          symbol: 'USDC',
          address: usdcAddress,
          amount: '521.419831',
          to: '0xA1371748D65baEF4509A3c067b3fe3a1b79183aE',
          from: safeAddress
        }
      ],
      addressesMeta: {
        [usdcAddress]: {
          contractAddress: usdcAddress,
          contractName: 'USD Coin',
          tokenSymbol: 'USDC',
          decimals: 6,
          type: 'ERC20'
        },
        [safeAddress]: {
          contractAddress: safeAddress,
          contractName: 'Gnosis Safe',
          tokenSymbol: '',
          decimals: null,
          type: 'Safe'
        }
      }
    };
    
    return {
      metadata: [
        { id: 'safe', name: 'Safe Contract', metadata: safeMetadata },
        { id: 'usdc', name: 'USDC Token', metadata: usdcMetadata }
      ],
      transactionData,
      testName: 'Gnosis Safe with USDC Transfer'
    };
  }

  /**
   * Test Suite 4: Complex DeFi - Aave Supply
   */
  async testAaveSupply() {
    console.log(chalk.blue('\n🏛️ Testing Aave Supply for Hardware Viewer'));
    
    const aavePoolV3 = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
    
    // Generate ERC7730 metadata
    const metadata = this.generateERC7730Metadata({
      address: aavePoolV3,
      chainId: 1,
      name: 'Aave V3 Pool',
      owner: 'Aave',
      url: 'https://aave.com',
      operations: {
        'supply': {
          intent: 'Supply collateral to Aave',
          fields: [
            {
              path: 'asset',
              label: 'Asset',
              format: 'addressName'
            },
            {
              path: 'amount',
              label: 'Amount',
              format: 'tokenAmount'
            },
            {
              path: 'onBehalfOf',
              label: 'On Behalf Of',
              format: 'addressName'
            }
          ]
        },
        'borrow': {
          intent: 'Borrow from Aave',
          fields: [
            {
              path: 'asset',
              label: 'Asset',
              format: 'addressName'
            },
            {
              path: 'amount',
              label: 'Amount',
              format: 'tokenAmount'
            },
            {
              path: 'interestRateMode',
              label: 'Rate Mode',
              format: 'raw'
            }
          ]
        }
      }
    });
    
    // Create sample transaction data
    const transactionData = {
      txHash: '0x' + '2'.repeat(64),
      methodCall: {
        name: 'supply',
        params: [
          {
            name: 'asset',
            type: 'address',
            value: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
          },
          {
            name: 'amount',
            type: 'uint256',
            value: '5000000000' // 5000 USDC
          },
          {
            name: 'onBehalfOf',
            type: 'address',
            value: '0x1234567890123456789012345678901234567890'
          },
          {
            name: 'referralCode',
            type: 'uint16',
            value: '0'
          }
        ]
      },
      addressesMeta: {
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          contractName: 'USD Coin',
          tokenSymbol: 'USDC',
          decimals: 6,
          type: 'ERC20'
        }
      }
    };
    
    return {
      metadata,
      transactionData,
      testName: 'Aave V3 Supply'
    };
  }

  /**
   * Test Suite 5: ERC-4337 UserOperation
   */
  async testERC4337UserOp() {
    console.log(chalk.blue('\n🔐 Testing ERC-4337 UserOp for Hardware Viewer'));
    
    const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    
    // Generate ERC7730 metadata
    const metadata = this.generateERC7730Metadata({
      address: entryPointAddress,
      chainId: 1,
      name: 'ERC-4337 EntryPoint',
      owner: 'Ethereum Foundation',
      url: 'https://eips.ethereum.org/EIPS/eip-4337',
      operations: {
        'handleOps': {
          intent: 'Execute Account Abstraction operations',
          fields: [
            {
              path: 'sender',
              label: 'Account',
              format: 'addressName'
            },
            {
              path: 'callData',
              label: 'Operation',
              format: 'raw'
            },
            {
              path: 'callGasLimit',
              label: 'Gas Limit',
              format: 'raw'
            },
            {
              path: 'maxFeePerGas',
              label: 'Max Fee',
              format: 'amount'
            }
          ]
        }
      }
    });
    
    // Create sample transaction data for UserOperation
    const transactionData = {
      txHash: '0x' + '3'.repeat(64),
      methodCall: {
        name: 'handleOps',
        params: [
          {
            name: 'ops',
            type: 'array',
            value: [
              {
                sender: '0x1234567890123456789012345678901234567890',
                nonce: '1',
                initCode: '0x',
                callData: '0xb61d27f6000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                callGasLimit: '200000',
                verificationGasLimit: '100000',
                preVerificationGas: '50000',
                maxFeePerGas: '20000000000',
                maxPriorityFeePerGas: '1000000000',
                paymasterAndData: '0x',
                signature: '0x'
              }
            ]
          },
          {
            name: 'beneficiary',
            type: 'address',
            value: '0x1234567890123456789012345678901234567890'
          }
        ]
      },
      addressesMeta: {
        [entryPointAddress]: {
          contractAddress: entryPointAddress,
          contractName: 'ERC-4337 EntryPoint',
          tokenSymbol: '',
          decimals: null,
          type: 'EntryPoint'
        }
      }
    };
    
    return {
      metadata,
      transactionData,
      testName: 'ERC-4337 UserOperation'
    };
  }

  /**
   * Save test data for hardware viewer
   */
  async saveTestData(testResults) {
    const outputDir = path.join(__dirname, '..', 'hardware-viewer-test-data');
    await fs.mkdir(outputDir, { recursive: true });
    
    for (const result of testResults) {
      const filename = result.testName.toLowerCase().replace(/\s+/g, '-') + '.json';
      const filepath = path.join(outputDir, filename);
      
      const outputData = {
        testName: result.testName,
        timestamp: new Date().toISOString(),
        metadata: result.metadata,
        transactionData: result.transactionData,
        instructions: {
          simpleMode: "Copy the metadata object into the Hardware Viewer's Simple Mode JSON input",
          advancedMode: "For multi-metadata tests, add each metadata entry separately and paste the transactionData"
        }
      };
      
      await fs.writeFile(filepath, JSON.stringify(outputData, null, 2));
      console.log(chalk.green(`✅ Saved: ${filename}`));
    }
    
    // Create index file
    const indexPath = path.join(outputDir, 'index.json');
    const index = {
      generated: new Date().toISOString(),
      tests: testResults.map(r => ({
        name: r.testName,
        file: r.testName.toLowerCase().replace(/\s+/g, '-') + '.json',
        hasMultipleMetadata: Array.isArray(r.metadata)
      }))
    };
    
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    console.log(chalk.cyan('\n📁 All test data saved to: ' + outputDir));
  }

  /**
   * Run all hardware viewer tests
   */
  async runAllTests() {
    console.log(chalk.bold.blue('🖥️ Generating Hardware Viewer Test Data\n'));
    
    const testResults = [];
    
    try {
      // Run each test suite
      testResults.push(await this.testUSDCTransfer());
      testResults.push(await this.testUniswapV3Swap());
      testResults.push(await this.testGnosisSafeWithUSDC());
      testResults.push(await this.testAaveSupply());
      testResults.push(await this.testERC4337UserOp());
      
      // Save all test data
      await this.saveTestData(testResults);
      
      // Print usage instructions
      console.log(chalk.bold.yellow('\n📋 How to use with Hardware Viewer:'));
      console.log(chalk.white('1. Navigate to the Hardware Viewer page'));
      console.log(chalk.white('2. For simple tests (USDC, Uniswap, Aave):'));
      console.log(chalk.gray('   - Select "Simple Mode"'));
      console.log(chalk.gray('   - Copy the metadata from the generated JSON files'));
      console.log(chalk.gray('   - Select the operation to preview'));
      console.log(chalk.white('3. For complex tests (Gnosis Safe + USDC):'));
      console.log(chalk.gray('   - Select "Advanced Mode"'));
      console.log(chalk.gray('   - Add multiple metadata entries'));
      console.log(chalk.gray('   - Paste the transaction data'));
      console.log(chalk.gray('   - Select metadata and operation to preview'));
      
      console.log(chalk.bold.green('\n✅ Hardware Viewer integration data generated successfully!'));
      
      return testResults;
      
    } catch (error) {
      console.error(chalk.red('Error generating test data:'), error);
      throw error;
    }
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new HardwareViewerIntegration();
  integration.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(chalk.bold.red('Integration failed:'), error);
      process.exit(1);
    });
}

export { HardwareViewerIntegration };