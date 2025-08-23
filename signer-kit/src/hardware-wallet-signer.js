import { ethers } from 'ethers';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';
import chalk from 'chalk';
import { ERC7730Provider } from './erc7730-provider.js';

/**
 * Hardware Wallet Signer with ERC-7730 Clear Signing Support
 * Supports Ledger, Trezor, and other hardware wallets
 */
export class HardwareWalletSigner {
  constructor(options = {}) {
    this.provider = options.provider || new ethers.JsonRpcProvider(options.rpcUrl);
    this.erc7730Provider = new ERC7730Provider(options.metadataDir);
    this.transport = null;
    this.eth = null;
    this.deviceType = options.deviceType || 'ledger';
    this.derivationPath = options.derivationPath || "44'/60'/0'/0/0";
    this.connected = false;
    this.address = null;
  }

  /**
   * Connect to hardware wallet
   */
  async connect(transportType = 'hid') {
    try {
      console.log(chalk.blue('🔌 Connecting to hardware wallet...'));
      
      switch (this.deviceType.toLowerCase()) {
        case 'ledger':
          await this.connectLedger(transportType);
          break;
        case 'trezor':
          await this.connectTrezor();
          break;
        default:
          throw new Error(`Unsupported device type: ${this.deviceType}`);
      }
      
      this.connected = true;
      console.log(chalk.green(`✅ Connected to ${this.deviceType}`));
      console.log(chalk.cyan(`📍 Address: ${this.address}`));
      
      return this.address;
    } catch (error) {
      console.error(chalk.red('❌ Connection failed:'), error.message);
      throw error;
    }
  }

  /**
   * Connect to Ledger device
   */
  async connectLedger(transportType) {
    // Create transport based on environment
    if (transportType === 'webusb' && typeof window !== 'undefined') {
      this.transport = await TransportWebUSB.create();
    } else {
      this.transport = await TransportNodeHid.create();
    }
    
    this.eth = new Eth(this.transport);
    
    // Get address from device
    const result = await this.eth.getAddress(this.derivationPath, false, true);
    this.address = result.address;
    
    // Verify Ethereum app is open
    const appConfig = await this.eth.getAppConfiguration();
    console.log(chalk.gray(`Ledger Ethereum App v${appConfig.version}`));
  }

  /**
   * Connect to Trezor device (placeholder - requires trezor-connect)
   */
  async connectTrezor() {
    // In production, use @trezor/connect
    throw new Error('Trezor support requires @trezor/connect library');
  }

  /**
   * Sign transaction with clear signing
   */
  async signTransaction(transaction) {
    if (!this.connected) {
      throw new Error('Hardware wallet not connected');
    }
    
    console.log(chalk.blue('\n📝 Preparing transaction for signing...'));
    
    // Normalize transaction
    const tx = await this.prepareTransaction(transaction);
    
    // Get ERC-7730 metadata
    const metadata = await this.prepareMetadata(tx);
    
    // Provide metadata to device
    if (metadata) {
      await this.provideMetadataToDevice(metadata, tx);
    }
    
    // Sign transaction
    console.log(chalk.yellow('⏳ Please review and confirm on your hardware wallet...'));
    const signature = await this.performSigning(tx);
    
    console.log(chalk.green('✅ Transaction signed successfully'));
    
    return signature;
  }

  /**
   * Prepare transaction for signing
   */
  async prepareTransaction(transaction) {
    // Get nonce if not provided
    if (transaction.nonce === undefined) {
      transaction.nonce = await this.provider.getTransactionCount(this.address);
    }
    
    // Get gas price if not provided
    if (!transaction.gasPrice && !transaction.maxFeePerGas) {
      const feeData = await this.provider.getFeeData();
      if (feeData.maxFeePerGas) {
        transaction.maxFeePerGas = feeData.maxFeePerGas;
        transaction.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else {
        transaction.gasPrice = feeData.gasPrice;
      }
    }
    
    // Estimate gas if not provided
    if (!transaction.gasLimit) {
      transaction.gasLimit = await this.provider.estimateGas({
        from: this.address,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value
      });
    }
    
    // Get chain ID
    if (!transaction.chainId) {
      const network = await this.provider.getNetwork();
      transaction.chainId = Number(network.chainId);
    }
    
    return transaction;
  }

  /**
   * Prepare ERC-7730 metadata for transaction
   */
  async prepareMetadata(transaction) {
    if (!transaction.to || !transaction.data || transaction.data === '0x') {
      return null;
    }
    
    // Extract method selector
    const selector = transaction.data.slice(0, 10);
    const methodName = this.getMethodName(selector);
    
    if (!methodName) {
      console.log(chalk.yellow('⚠️ Unknown method, no metadata available'));
      return null;
    }
    
    // Get ERC-7730 metadata
    const payload = await this.erc7730Provider.generateHardwareWalletPayload(
      transaction,
      methodName
    );
    
    if (payload) {
      console.log(chalk.green('✅ ERC-7730 metadata loaded'));
      this.displayTransactionSummary(payload);
    }
    
    return payload;
  }

  /**
   * Provide metadata to hardware device
   */
  async provideMetadataToDevice(metadata, transaction) {
    if (this.deviceType !== 'ledger' || !this.eth) {
      return;
    }
    
    try {
      // Provide contract information
      if (metadata.contract) {
        const contractInfo = {
          address: metadata.contract.address,
          name: metadata.contract.name,
          chainId: metadata.chainId
        };
        
        // Check if we need to provide ERC20 token info
        if (this.isERC20Transaction(transaction.data)) {
          await this.provideERC20Info(contractInfo);
        }
        
        // Check if we need to provide NFT info
        if (this.isNFTTransaction(transaction.data)) {
          await this.provideNFTInfo(contractInfo);
        }
        
        // Provide domain name if available
        if (metadata.contract.ens) {
          await this.provideDomainName(metadata.contract);
        }
      }
      
      console.log(chalk.gray('📤 Metadata provided to device'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not provide full metadata:'), error.message);
    }
  }

  /**
   * Provide ERC20 token information to Ledger
   */
  async provideERC20Info(contractInfo) {
    const tokenInfo = {
      address: contractInfo.address,
      ticker: contractInfo.name || 'TOKEN',
      decimals: 18, // Would fetch from contract
      chainId: contractInfo.chainId
    };
    
    const data = Buffer.concat([
      Buffer.from(tokenInfo.address.slice(2), 'hex'),
      Buffer.from(tokenInfo.ticker.padEnd(20, '\0')),
      Buffer.from([tokenInfo.decimals]),
      Buffer.from([tokenInfo.chainId])
    ]);
    
    await this.eth.provideERC20TokenInformation(data);
  }

  /**
   * Provide NFT information to Ledger
   */
  async provideNFTInfo(contractInfo) {
    const nftInfo = {
      address: contractInfo.address,
      collectionName: contractInfo.name || 'NFT Collection',
      chainId: contractInfo.chainId
    };
    
    const data = Buffer.concat([
      Buffer.from(nftInfo.address.slice(2), 'hex'),
      Buffer.from(nftInfo.collectionName.padEnd(32, '\0')),
      Buffer.from([nftInfo.chainId])
    ]);
    
    await this.eth.provideNFTInformation(data);
  }

  /**
   * Provide domain name to Ledger
   */
  async provideDomainName(contractInfo) {
    const domainData = {
      address: contractInfo.address,
      domain: contractInfo.ens,
      type: 'ENS'
    };
    
    const data = Buffer.concat([
      Buffer.from(domainData.address.slice(2), 'hex'),
      Buffer.from(domainData.domain.padEnd(32, '\0')),
      Buffer.from(domainData.type.padEnd(8, '\0'))
    ]);
    
    await this.eth.provideDomainName(data);
  }

  /**
   * Perform the actual signing
   */
  async performSigning(transaction) {
    if (this.deviceType === 'ledger' && this.eth) {
      // Serialize transaction for Ledger
      const tx = ethers.Transaction.from(transaction);
      const serialized = tx.unsignedSerialized.slice(2);
      
      // Sign with Ledger
      const sig = await this.eth.signTransaction(
        this.derivationPath,
        serialized,
        null // Resolution is handled by provided metadata
      );
      
      // Combine signature with transaction
      tx.signature = {
        r: '0x' + sig.r,
        s: '0x' + sig.s,
        v: parseInt(sig.v, 16)
      };
      
      return tx.serialized;
    }
    
    throw new Error(`Signing not implemented for ${this.deviceType}`);
  }

  /**
   * Sign a typed data message (EIP-712)
   */
  async signTypedData(domain, types, value) {
    if (!this.connected) {
      throw new Error('Hardware wallet not connected');
    }
    
    console.log(chalk.blue('\n📝 Preparing EIP-712 message for signing...'));
    
    if (this.deviceType === 'ledger' && this.eth) {
      // Prepare EIP-712 hash
      const hash = ethers.TypedDataEncoder.hash(domain, types, value);
      
      // For Ledger, we need to use signEIP712Message
      const domainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
      const hashStruct = ethers.TypedDataEncoder.hashStruct('', types, value);
      
      console.log(chalk.yellow('⏳ Please review and confirm on your hardware wallet...'));
      
      const sig = await this.eth.signEIP712Message(
        this.derivationPath,
        domainSeparator.slice(2),
        hashStruct.slice(2)
      );
      
      console.log(chalk.green('✅ Message signed successfully'));
      
      return {
        r: '0x' + sig.r,
        s: '0x' + sig.s,
        v: parseInt(sig.v, 16)
      };
    }
    
    throw new Error(`EIP-712 signing not implemented for ${this.deviceType}`);
  }

  /**
   * Sign a personal message
   */
  async signMessage(message) {
    if (!this.connected) {
      throw new Error('Hardware wallet not connected');
    }
    
    console.log(chalk.blue('\n📝 Preparing message for signing...'));
    
    if (this.deviceType === 'ledger' && this.eth) {
      const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message));
      
      console.log(chalk.yellow('⏳ Please review and confirm on your hardware wallet...'));
      
      const sig = await this.eth.signPersonalMessage(
        this.derivationPath,
        messageHex.slice(2)
      );
      
      console.log(chalk.green('✅ Message signed successfully'));
      
      return ethers.Signature.from({
        r: '0x' + sig.r,
        s: '0x' + sig.s,
        v: parseInt(sig.v, 16)
      }).serialized;
    }
    
    throw new Error(`Message signing not implemented for ${this.deviceType}`);
  }

  /**
   * Display transaction summary
   */
  displayTransactionSummary(metadata) {
    console.log(chalk.bold.cyan('\n📋 Transaction Summary:'));
    console.log(chalk.cyan('━'.repeat(50)));
    
    if (metadata.method?.intent) {
      console.log(chalk.white(`🎯 Intent: ${metadata.method.intent}`));
    }
    
    if (metadata.contract?.name) {
      console.log(chalk.white(`📄 Contract: ${metadata.contract.name}`));
    }
    
    if (metadata.fields?.length > 0) {
      console.log(chalk.white('\n📊 Details:'));
      for (const field of metadata.fields) {
        if (field.type !== 'intent') {
          console.log(chalk.gray(`  ${field.label}: ${field.value} ${field.unit || ''}`));
        }
      }
    }
    
    console.log(chalk.cyan('━'.repeat(50)));
  }

  /**
   * Check if transaction is ERC20 related
   */
  isERC20Transaction(data) {
    if (!data || data === '0x') return false;
    const selector = data.slice(0, 10);
    return ['0xa9059cbb', '0x095ea7b3', '0x23b872dd'].includes(selector);
  }

  /**
   * Check if transaction is NFT related
   */
  isNFTTransaction(data) {
    if (!data || data === '0x') return false;
    const selector = data.slice(0, 10);
    return ['0x42842e0e', '0xb88d4fde', '0xf242432a'].includes(selector);
  }

  /**
   * Get method name from selector
   */
  getMethodName(selector) {
    const methods = {
      '0xa9059cbb': 'transfer',
      '0x095ea7b3': 'approve',
      '0x23b872dd': 'transferFrom',
      '0x42842e0e': 'safeTransferFrom',
      '0xd0e30db0': 'deposit',
      '0x2e1a7d4d': 'withdraw',
      // Add more as needed
    };
    
    return methods[selector];
  }

  /**
   * Disconnect from hardware wallet
   */
  async disconnect() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.eth = null;
      this.connected = false;
      this.address = null;
      console.log(chalk.gray('🔌 Disconnected from hardware wallet'));
    }
  }

  /**
   * Get list of available accounts
   */
  async getAccounts(count = 5) {
    if (!this.connected) {
      throw new Error('Hardware wallet not connected');
    }
    
    const accounts = [];
    
    for (let i = 0; i < count; i++) {
      const path = `44'/60'/0'/0/${i}`;
      const result = await this.eth.getAddress(path, false, false);
      accounts.push({
        path,
        address: result.address,
        index: i
      });
    }
    
    return accounts;
  }

  /**
   * Switch to a different account
   */
  async switchAccount(accountIndex) {
    this.derivationPath = `44'/60'/0'/0/${accountIndex}`;
    const result = await this.eth.getAddress(this.derivationPath, false, true);
    this.address = result.address;
    console.log(chalk.cyan(`📍 Switched to address: ${this.address}`));
    return this.address;
  }
}

export default HardwareWalletSigner;