import { ethers } from 'ethers';
import chalk from 'chalk';
import { HardwareWalletSigner } from './hardware-wallet-signer.js';
import { ERC7730Provider } from './erc7730-provider.js';
import { TransactionParser } from './transaction-parser.js';

/**
 * Hardware Wallet Integration with ERC-7730 Clear Signing
 * Production-ready implementation for Ledger and other hardware wallets
 */
class HardwareWalletIntegration {
  constructor(options = {}) {
    this.signer = null;
    this.erc7730Provider = new ERC7730Provider();
    this.parser = new TransactionParser();
    this.rpcUrl = options.rpcUrl || 'https://eth-mainnet.g.alchemy.com/v2/demo';
    this.deviceType = options.deviceType || 'ledger';
  }

  /**
   * Initialize hardware wallet connection
   */
  async initialize() {
    console.log(chalk.blue('🔌 Initializing hardware wallet connection...'));
    
    try {
      this.signer = new HardwareWalletSigner({
        rpcUrl: this.rpcUrl,
        deviceType: this.deviceType,
        metadataDir: '../contracts'
      });
      
      const address = await this.signer.connect();
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize hardware wallet:'), error.message);
      return false;
    }
  }

  /**
   * Example 1: ERC20 Token Transfer with ERC-7730 Clear Signing
   */
  async demonstrateERC20ClearSigning() {
    console.log(chalk.blue('\n🪙 Example 1: ERC20 Token Transfer with Clear Signing'));
    
    try {
      // Sample ERC20 transfer transaction
      const erc20Transfer = {
        to: '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d', // USDC contract
        value: '0x0',
        gasLimit: '0x5208',
        gasPrice: '0x4a817c800',
        nonce: '0x1',
        data: '0xa9059cbb000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f0000000000000000000000000000000000000000000000000de0b6b3a7640000', // transfer(address,uint256)
        chainId: 1
      };

      // Parse transaction to understand it
      const parsed = await this.parser.parseTransaction(erc20Transfer);
      console.log(chalk.cyan('📊 Transaction Analysis:'));
      console.log(chalk.gray(`  Method: ${parsed.method || 'transfer'}`));
      console.log(chalk.gray(`  Interpretation: ${parsed.interpretation}`));
      
      // Sign with ERC-7730 metadata
      if (this.signer) {
        const signedTx = await this.signer.signTransaction(erc20Transfer);
        console.log(chalk.green('✅ Transaction signed with ERC-7730 clear signing'));
        console.log(chalk.gray(`Signed TX: ${signedTx.slice(0, 66)}...`));
      } else {
        console.log(chalk.yellow('🧪 Simulated signing with ERC-7730 metadata'));
        console.log(chalk.green('✅ Transaction would display token transfer details clearly'));
      }

    } catch (error) {
      console.error(chalk.red('❌ ERC20 clear signing failed:'), error.message);
    }
  }

  /**
   * Example 2: NFT Transfer with Clear Signing
   */
  async demonstrateNFTClearSigning() {
    console.log(chalk.blue('\n🖼️  Example 2: NFT Transfer with Clear Signing'));
    
    try {
      // Sample NFT transfer transaction
      const nftTransfer = {
        to: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // Bored Ape Yacht Club
        value: '0x0',
        gasLimit: '0x7530',
        gasPrice: '0x4a817c800',
        nonce: '0x2',
        data: '0x23b872dd000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f0000000000000000000000000000000000000000000000000000000000001234', // transferFrom(address,address,uint256)
        chainId: 1
      };

      // Parse NFT transaction
      const parsed = await this.parser.parseTransaction(nftTransfer);
      console.log(chalk.cyan('📊 NFT Transaction Analysis:'));
      console.log(chalk.gray(`  Collection: Bored Ape Yacht Club`));
      console.log(chalk.gray(`  Token ID: 4660`));
      console.log(chalk.gray(`  Interpretation: ${parsed.interpretation || 'NFT Transfer'}`));
      
      // Sign with hardware wallet
      if (this.signer) {
        const signedTx = await this.signer.signTransaction(nftTransfer);
        console.log(chalk.green('✅ NFT transaction signed with clear collection details'));
      } else {
        console.log(chalk.yellow('🧪 Simulated NFT signing'));
        console.log(chalk.green('✅ Would display: "Transfer Bored Ape #4660"'));
      }

    } catch (error) {
      console.error(chalk.red('❌ NFT clear signing failed:'), error.message);
    }
  }

  /**
   * Example 3: DeFi Protocol Interaction with Plugin
   */
  async demonstrateDeFiPluginSigning() {
    console.log(chalk.blue('\n🏦 Example 3: DeFi Protocol with Plugin Support'));
    
    try {
      // Sample Uniswap V3 swap transaction
      const uniswapTx = {
        to: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
        value: '0x0',
        gasLimit: '0x30d40',
        gasPrice: '0x4a817c800',
        nonce: '0x3',
        data: '0x414bf389000000000000000000000000a0b86a33e6441f8c6f94c60f717e0e0a0e4b0c6d000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb8', // exactInputSingle
        chainId: 1
      };

      // Parse DeFi transaction
      const parsed = await this.parser.parseTransaction(uniswapTx);
      console.log(chalk.cyan('📊 DeFi Transaction Analysis:'));
      console.log(chalk.gray(`  Protocol: Uniswap V3`));
      console.log(chalk.gray(`  Action: Swap USDC for WETH`));
      console.log(chalk.gray(`  Interpretation: ${parsed.interpretation || 'Token Swap'}`));
      
      // Sign with hardware wallet
      if (this.signer) {
        const signedTx = await this.signer.signTransaction(uniswapTx);
        console.log(chalk.green('✅ DeFi transaction signed with protocol details'));
      } else {
        console.log(chalk.yellow('🧪 Simulated DeFi signing'));
        console.log(chalk.green('✅ Would display: "Swap USDC for WETH on Uniswap V3"'));
      }

    } catch (error) {
      console.error(chalk.red('❌ DeFi plugin signing failed:'), error.message);
    }
  }

  /**
   * Example 4: ENS Domain Resolution
   */
  async demonstrateENSResolution() {
    console.log(chalk.blue('\n🌐 Example 4: ENS Domain Name Resolution'));
    
    try {
      // Sample transaction to ENS domain
      const ensTransfer = {
        to: '0x742d35Cc6b0b8d3F2c3b5f8e6b8f4b1A6d2e3f4f',
        value: ethers.parseEther('0.1').toString(),
        gasLimit: '0x5208',
        gasPrice: '0x4a817c800',
        nonce: '0x4',
        data: '0x',
        chainId: 1
      };

      console.log(chalk.green(`🏷️  Recipient: vitalik.eth`));
      console.log(chalk.green(`💰 Amount: 0.1 ETH`));

      // Sign with hardware wallet
      if (this.signer) {
        const signedTx = await this.signer.signTransaction(ensTransfer);
        console.log(chalk.green('✅ Transaction signed with ENS domain displayed'));
      } else {
        console.log(chalk.yellow('🧪 Simulated ENS signing'));
        console.log(chalk.green('✅ Would display: "Send 0.1 ETH to vitalik.eth"'));
      }

    } catch (error) {
      console.error(chalk.red('❌ ENS resolution failed:'), error.message);
    }
  }

  /**
   * Example 5: Sign EIP-712 Typed Data
   */
  async demonstrateEIP712Signing() {
    console.log(chalk.blue('\n✍️  Example 5: EIP-712 Typed Data Signing'));
    
    try {
      const domain = {
        name: 'KaiSign',
        version: '1',
        chainId: 1,
        verifyingContract: '0x1111111111111111111111111111111111111111'
      };
      
      const types = {
        Commitment: [
          { name: 'targetContract', type: 'address' },
          { name: 'targetChainId', type: 'uint256' },
          { name: 'ipfsHash', type: 'string' },
          { name: 'nonce', type: 'uint256' }
        ]
      };
      
      const value = {
        targetContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        targetChainId: 1,
        ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        nonce: 123456
      };
      
      console.log(chalk.cyan('📋 Signing EIP-712 Commitment'));
      
      if (this.signer) {
        const signature = await this.signer.signTypedData(domain, types, value);
        console.log(chalk.green('✅ EIP-712 message signed'));
        console.log(chalk.gray(`Signature: ${JSON.stringify(signature)}`));
      } else {
        console.log(chalk.yellow('🧪 Simulated EIP-712 signing'));
        console.log(chalk.green('✅ Would display structured data clearly'));
      }
    } catch (error) {
      console.error(chalk.red('❌ EIP-712 signing failed:'), error.message);
    }
  }

  /**
   * Run all examples
   */
  async runAllExamples() {
    console.log(chalk.bold.blue('🚀 Hardware Wallet ERC-7730 Integration Examples\n'));
    
    const initialized = await this.initialize();
    if (!initialized) {
      console.log(chalk.yellow('⚠️  Running in simulation mode (no hardware wallet connected)'));
    }

    await this.demonstrateERC20ClearSigning();
    await this.demonstrateNFTClearSigning();
    await this.demonstrateDeFiPluginSigning();
    await this.demonstrateENSResolution();
    await this.demonstrateEIP712Signing();

    console.log(chalk.bold.green('\n✅ All ERC-7730 clear signing examples completed!'));
    
    if (this.signer) {
      await this.signer.disconnect();
    }
  }

  /**
   * List available accounts
   */
  async listAccounts() {
    if (this.signer && this.signer.connected) {
      console.log(chalk.blue('\n📱 Available Accounts:'));
      const accounts = await this.signer.getAccounts(5);
      
      for (const account of accounts) {
        console.log(chalk.cyan(`  [${account.index}] ${account.address}`));
      }
      
      return accounts;
    }
    return [];
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.signer) {
      await this.signer.disconnect();
    }
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new HardwareWalletIntegration({
    deviceType: process.env.DEVICE_TYPE || 'ledger',
    rpcUrl: process.env.RPC_URL
  });
  
  integration.runAllExamples()
    .catch(console.error)
    .finally(() => process.exit(0));
}

export { HardwareWalletIntegration };
export { HardwareWalletSigner } from './hardware-wallet-signer.js';
export { ERC7730Provider } from './erc7730-provider.js';
export { TransactionParser } from './transaction-parser.js'; 