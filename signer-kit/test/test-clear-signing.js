import { LedgerClearSigningExample } from '../src/index.js';
import { ClearSigningResolver } from '../src/clear-signing.js';
import { ERC20MetadataProvider } from '../src/erc20-metadata.js';
import chalk from 'chalk';

/**
 * Test Suite for Ledger Clear Signing Metadata
 */
class ClearSigningTestSuite {
  constructor() {
    this.testResults = [];
    this.resolver = new ClearSigningResolver();
    this.erc20Provider = new ERC20MetadataProvider();
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFunction) {
    console.log(chalk.blue(`\n🧪 Running test: ${testName}`));
    
    try {
      const startTime = Date.now();
      await testFunction();
      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`✅ ${testName} passed (${duration}ms)`));
      this.testResults.push({ name: testName, status: 'PASSED', duration });
    } catch (error) {
      console.error(chalk.red(`❌ ${testName} failed:`), error.message);
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  /**
   * Test ERC20 metadata resolution
   */
  async testERC20Metadata() {
    // Test known token
    const usdcInfo = await this.erc20Provider.getTokenInfo('0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d');
    
    if (!usdcInfo) {
      throw new Error('USDC token info not found');
    }
    
    if (usdcInfo.ticker !== 'USDC') {
      throw new Error(`Expected ticker 'USDC', got '${usdcInfo.ticker}'`);
    }
    
    if (usdcInfo.decimals !== 6) {
      throw new Error(`Expected decimals 6, got ${usdcInfo.decimals}`);
    }
    
    console.log(chalk.cyan(`  Token: ${usdcInfo.name} (${usdcInfo.ticker})`));
    console.log(chalk.cyan(`  Decimals: ${usdcInfo.decimals}`));
    console.log(chalk.cyan(`  Data length: ${usdcInfo.data.length} chars`));
  }

  /**
   * Test ERC20 transaction resolution
   */
  async testERC20TransactionResolution() {
    const erc20Transaction = {
      to: '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d',
      data: '0xa9059cbb000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      chainId: 1
    };

    const resolution = await this.resolver.resolveTransaction(erc20Transaction, {
      erc20: true,
      externalPlugins: false,
      nft: false
    });

    if (!resolution.contractMethod) {
      throw new Error('Contract method not resolved');
    }

    if (resolution.contractMethod.name !== 'transfer') {
      throw new Error(`Expected method 'transfer', got '${resolution.contractMethod.name}'`);
    }

    if (resolution.erc20TokenInformation.length === 0) {
      throw new Error('ERC20 token information not resolved');
    }

    console.log(chalk.cyan(`  Method: ${resolution.contractMethod.name}`));
    console.log(chalk.cyan(`  Token: ${resolution.erc20TokenInformation[0].ticker}`));
    console.log(chalk.cyan(`  Parameters: ${Object.keys(resolution.contractMethod.parameters).length}`));
  }

  /**
   * Test NFT transaction resolution
   */
  async testNFTTransactionResolution() {
    const nftTransaction = {
      to: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
      data: '0x23b872dd000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f0000000000000000000000000000000000000000000000000000000000001234',
      chainId: 1
    };

    const resolution = await this.resolver.resolveTransaction(nftTransaction, {
      erc20: false,
      externalPlugins: false,
      nft: true
    });

    if (!resolution.contractMethod) {
      throw new Error('Contract method not resolved');
    }

    if (resolution.contractMethod.name !== 'transferFrom') {
      throw new Error(`Expected method 'transferFrom', got '${resolution.contractMethod.name}'`);
    }

    if (resolution.nftInformation.length === 0) {
      throw new Error('NFT information not resolved');
    }

    console.log(chalk.cyan(`  Method: ${resolution.contractMethod.name}`));
    console.log(chalk.cyan(`  Collection: ${resolution.nftInformation[0].collectionName}`));
    console.log(chalk.cyan(`  Token ID: ${resolution.nftInformation[0].tokenId}`));
  }

  /**
   * Test Uniswap V3 plugin resolution
   */
  async testUniswapV3PluginResolution() {
    const uniswapTransaction = {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf389000000000000000000000000a0b86a33e6441f8c6f94c60f717e0e0a0e4b0c6d000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb8',
      chainId: 1
    };

    const resolution = await this.resolver.resolveTransaction(uniswapTransaction, {
      erc20: true,
      externalPlugins: true,
      nft: false,
      uniswapV3: true
    });

    if (!resolution.contractMethod) {
      throw new Error('Contract method not resolved');
    }

    if (resolution.contractMethod.name !== 'exactInputSingle') {
      throw new Error(`Expected method 'exactInputSingle', got '${resolution.contractMethod.name}'`);
    }

    if (!resolution.externalPlugin) {
      throw new Error('External plugin not resolved');
    }

    if (resolution.externalPlugin.pluginName !== 'Uniswap V3') {
      throw new Error(`Expected plugin 'Uniswap V3', got '${resolution.externalPlugin.pluginName}'`);
    }

    console.log(chalk.cyan(`  Method: ${resolution.contractMethod.name}`));
    console.log(chalk.cyan(`  Plugin: ${resolution.externalPlugin.pluginName}`));
    console.log(chalk.cyan(`  Description: ${resolution.externalPlugin.description}`));
  }

  /**
   * Test ENS domain resolution
   */
  async testENSResolution() {
    const domains = [{ type: 'ENS', registry: '0x314159265dd8dbb310642f98f50c066173c1259b' }];
    const domainName = await this.resolver.resolveDomainName('0x742d35Cc6b0b8d3F2c3b5f8e6b8f4b1A6d2e3f4f', domains);

    if (!domainName) {
      throw new Error('Domain name not resolved');
    }

    if (domainName.domain !== 'vitalik.eth') {
      throw new Error(`Expected domain 'vitalik.eth', got '${domainName.domain}'`);
    }

    if (domainName.type !== 'ENS') {
      throw new Error(`Expected type 'ENS', got '${domainName.type}'`);
    }

    console.log(chalk.cyan(`  Domain: ${domainName.domain}`));
    console.log(chalk.cyan(`  Type: ${domainName.type}`));
    console.log(chalk.cyan(`  Address: ${domainName.address}`));
  }

  /**
   * Test token amount formatting
   */
  async testTokenAmountFormatting() {
    // Test USDC (6 decimals)
    const usdcAmount = this.erc20Provider.formatTokenAmount('1000000', 6);
    if (usdcAmount !== '1') {
      throw new Error(`Expected '1', got '${usdcAmount}'`);
    }

    const usdcAmountWithDecimals = this.erc20Provider.formatTokenAmount('1500000', 6);
    if (usdcAmountWithDecimals !== '1.5') {
      throw new Error(`Expected '1.5', got '${usdcAmountWithDecimals}'`);
    }

    // Test WETH (18 decimals)
    const wethAmount = this.erc20Provider.formatTokenAmount('1000000000000000000', 18);
    if (wethAmount !== '1') {
      throw new Error(`Expected '1', got '${wethAmount}'`);
    }

    console.log(chalk.cyan(`  USDC formatting: 1000000 -> ${usdcAmount}`));
    console.log(chalk.cyan(`  USDC formatting: 1500000 -> ${usdcAmountWithDecimals}`));
    console.log(chalk.cyan(`  WETH formatting: 1000000000000000000 -> ${wethAmount}`));
  }

  /**
   * Test clear signing payload creation
   */
  async testClearSigningPayloadCreation() {
    const contractAddress = '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d';
    const amount = '1000000'; // 1 USDC
    const recipient = '0x742d35Cc6b0b8d3F2c3b5f8e6b8f4b1A6d2e3f4f';

    const payload = this.erc20Provider.createClearSigningPayload(contractAddress, amount, recipient);

    if (payload.type !== 'ERC20_TRANSFER') {
      throw new Error(`Expected type 'ERC20_TRANSFER', got '${payload.type}'`);
    }

    if (payload.token.ticker !== 'USDC') {
      throw new Error(`Expected ticker 'USDC', got '${payload.token.ticker}'`);
    }

    if (payload.amount.formatted !== '1') {
      throw new Error(`Expected formatted amount '1', got '${payload.amount.formatted}'`);
    }

    console.log(chalk.cyan(`  Type: ${payload.type}`));
    console.log(chalk.cyan(`  Token: ${payload.token.ticker}`));
    console.log(chalk.cyan(`  Amount: ${payload.amount.formatted}`));
    console.log(chalk.cyan(`  Display: ${payload.displayText}`));
  }

  /**
   * Test transaction resolution summary
   */
  async testResolutionSummary() {
    const erc20Transaction = {
      to: '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d',
      data: '0xa9059cbb000000000000000000000000742d35cc6b0b8d3f2c3b5f8e6b8f4b1a6d2e3f4f0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      chainId: 1
    };

    const resolution = await this.resolver.resolveTransaction(erc20Transaction, {
      erc20: true,
      externalPlugins: false,
      nft: false
    });

    const summary = this.resolver.getResolutionSummary(resolution);

    if (!summary.hasERC20) {
      throw new Error('Expected hasERC20 to be true');
    }

    if (!summary.hasMethod) {
      throw new Error('Expected hasMethod to be true');
    }

    if (summary.hasNFT) {
      throw new Error('Expected hasNFT to be false');
    }

    console.log(chalk.cyan(`  Has ERC20: ${summary.hasERC20}`));
    console.log(chalk.cyan(`  Has Method: ${summary.hasMethod}`));
    console.log(chalk.cyan(`  Has NFT: ${summary.hasNFT}`));
    console.log(chalk.cyan(`  Description: ${summary.description}`));
  }

  /**
   * Test full example with mock transport
   */
  async testFullExampleWithMockTransport() {
    const example = new LedgerClearSigningExample(true); // Use mock transport
    
    // This should run without throwing errors
    await example.initialize();
    await example.demonstrateERC20ClearSigning();
    await example.cleanup();

    console.log(chalk.cyan('  Full example completed successfully with mock transport'));
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log(chalk.bold.blue('🚀 Starting Clear Signing Metadata Test Suite\n'));

    await this.runTest('ERC20 Metadata', () => this.testERC20Metadata());
    await this.runTest('ERC20 Transaction Resolution', () => this.testERC20TransactionResolution());
    await this.runTest('NFT Transaction Resolution', () => this.testNFTTransactionResolution());
    await this.runTest('Uniswap V3 Plugin Resolution', () => this.testUniswapV3PluginResolution());
    await this.runTest('ENS Domain Resolution', () => this.testENSResolution());
    await this.runTest('Token Amount Formatting', () => this.testTokenAmountFormatting());
    await this.runTest('Clear Signing Payload Creation', () => this.testClearSigningPayloadCreation());
    await this.runTest('Resolution Summary', () => this.testResolutionSummary());
    await this.runTest('Full Example with Mock Transport', () => this.testFullExampleWithMockTransport());

    this.printTestSummary();
  }

  /**
   * Print test results summary
   */
  printTestSummary() {
    console.log(chalk.bold.blue('\n📊 Test Results Summary'));
    console.log('═'.repeat(50));

    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const total = this.testResults.length;

    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.blue(`📋 Total: ${total}`));

    if (failed > 0) {
      console.log(chalk.red('\nFailed tests:'));
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(chalk.red(`  - ${r.name}: ${r.error}`)));
    }

    const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);
    console.log(chalk.gray(`\n⏱️  Total duration: ${totalDuration}ms`));

    if (failed === 0) {
      console.log(chalk.bold.green('\n🎉 All tests passed! Clear signing metadata is working correctly.'));
    } else {
      console.log(chalk.bold.red(`\n💥 ${failed} test(s) failed. Please check the implementation.`));
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new ClearSigningTestSuite();
  testSuite.runAllTests().catch(console.error);
}

export { ClearSigningTestSuite }; 