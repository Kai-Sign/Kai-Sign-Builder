import { ERC20MetadataProvider } from '../src/erc20-metadata.js';
import chalk from 'chalk';

/**
 * Specialized ERC20 Metadata Test Suite
 */
class ERC20MetadataTestSuite {
  constructor() {
    this.provider = new ERC20MetadataProvider();
    this.testResults = [];
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFunction) {
    console.log(chalk.blue(`\n🧪 Testing: ${testName}`));
    
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
   * Test token registry initialization
   */
  async testTokenRegistryInitialization() {
    const usdcTokens = this.provider.getTokensByChain(1);
    
    if (usdcTokens.length === 0) {
      throw new Error('No tokens found for chain 1');
    }

    const usdcToken = usdcTokens.find(t => t.ticker === 'USDC');
    if (!usdcToken) {
      throw new Error('USDC token not found in registry');
    }

    console.log(chalk.cyan(`  Found ${usdcTokens.length} tokens on chain 1`));
    console.log(chalk.cyan(`  USDC token: ${usdcToken.name} (${usdcToken.decimals} decimals)`));
  }

  /**
   * Test token search functionality
   */
  async testTokenSearch() {
    const usdcResults = this.provider.searchTokens('USDC');
    if (usdcResults.length === 0) {
      throw new Error('No results found for USDC search');
    }

    const daiResults = this.provider.searchTokens('dai');
    if (daiResults.length === 0) {
      throw new Error('No results found for dai search');
    }

    const partialResults = this.provider.searchTokens('USD');
    if (partialResults.length === 0) {
      throw new Error('No results found for partial USD search');
    }

    console.log(chalk.cyan(`  USDC search: ${usdcResults.length} results`));
    console.log(chalk.cyan(`  DAI search: ${daiResults.length} results`));
    console.log(chalk.cyan(`  USD partial search: ${partialResults.length} results`));
  }

  /**
   * Test token amount formatting edge cases
   */
  async testTokenAmountFormattingEdgeCases() {
    // Test zero amount
    const zeroAmount = this.provider.formatTokenAmount('0', 18);
    if (zeroAmount !== '0') {
      throw new Error(`Expected '0', got '${zeroAmount}'`);
    }

    // Test very small amount
    const smallAmount = this.provider.formatTokenAmount('1', 18);
    if (smallAmount !== '0.000000000000000001') {
      throw new Error(`Expected '0.000000000000000001', got '${smallAmount}'`);
    }

    // Test very large amount
    const largeAmount = this.provider.formatTokenAmount('1000000000000000000000', 18);
    if (largeAmount !== '1000') {
      throw new Error(`Expected '1000', got '${largeAmount}'`);
    }

    // Test amount with trailing zeros
    const trailingZeros = this.provider.formatTokenAmount('1500000000000000000', 18);
    if (trailingZeros !== '1.5') {
      throw new Error(`Expected '1.5', got '${trailingZeros}'`);
    }

    console.log(chalk.cyan(`  Zero amount: ${zeroAmount}`));
    console.log(chalk.cyan(`  Small amount: ${smallAmount}`));
    console.log(chalk.cyan(`  Large amount: ${largeAmount}`));
    console.log(chalk.cyan(`  Trailing zeros: ${trailingZeros}`));
  }

  /**
   * Test token amount parsing
   */
  async testTokenAmountParsing() {
    // Test parsing whole numbers
    const wholeNumber = this.provider.parseTokenAmount('100', 6);
    if (wholeNumber !== 100000000n) {
      throw new Error(`Expected 100000000n, got ${wholeNumber}`);
    }

    // Test parsing decimal numbers
    const decimalNumber = this.provider.parseTokenAmount('1.5', 6);
    if (decimalNumber !== 1500000n) {
      throw new Error(`Expected 1500000n, got ${decimalNumber}`);
    }

    // Test parsing with more decimals than token supports
    const extraDecimals = this.provider.parseTokenAmount('1.123456789', 6);
    if (extraDecimals !== 1123456n) {
      throw new Error(`Expected 1123456n, got ${extraDecimals}`);
    }

    console.log(chalk.cyan(`  Whole number parsing: ${wholeNumber}`));
    console.log(chalk.cyan(`  Decimal parsing: ${decimalNumber}`));
    console.log(chalk.cyan(`  Extra decimals parsing: ${extraDecimals}`));
  }

  /**
   * Test token validation
   */
  async testTokenValidation() {
    // Test valid token
    const validToken = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      ticker: 'TEST',
      decimals: 18,
      name: 'Test Token'
    };

    let validationPassed = false;
    try {
      this.provider.validateTokenInfo(validToken);
      validationPassed = true;
    } catch (error) {
      throw new Error(`Valid token validation failed: ${error.message}`);
    }

    // Test invalid ticker (too long)
    const invalidTicker = { ...validToken, ticker: 'VERYLONGTICKERTEST' };
    try {
      this.provider.validateTokenInfo(invalidTicker);
      throw new Error('Expected validation to fail for long ticker');
    } catch (error) {
      if (!error.message.includes('Invalid ticker')) {
        throw new Error(`Expected ticker validation error, got: ${error.message}`);
      }
    }

    // Test invalid decimals
    const invalidDecimals = { ...validToken, decimals: -1 };
    try {
      this.provider.validateTokenInfo(invalidDecimals);
      throw new Error('Expected validation to fail for negative decimals');
    } catch (error) {
      if (!error.message.includes('Invalid decimals')) {
        throw new Error(`Expected decimals validation error, got: ${error.message}`);
      }
    }

    // Test invalid address
    const invalidAddress = { ...validToken, contractAddress: 'invalid' };
    try {
      this.provider.validateTokenInfo(invalidAddress);
      throw new Error('Expected validation to fail for invalid address');
    } catch (error) {
      if (!error.message.includes('Invalid contract address')) {
        throw new Error(`Expected address validation error, got: ${error.message}`);
      }
    }

    console.log(chalk.cyan(`  Valid token validation: ${validationPassed ? 'passed' : 'failed'}`));
    console.log(chalk.cyan(`  Invalid ticker validation: correctly rejected`));
    console.log(chalk.cyan(`  Invalid decimals validation: correctly rejected`));
    console.log(chalk.cyan(`  Invalid address validation: correctly rejected`));
  }

  /**
   * Test adding and removing tokens
   */
  async testTokenManagement() {
    const initialTokenCount = this.provider.getTokensByChain(1).length;

    // Add a new token
    const newToken = {
      ticker: 'TEST',
      decimals: 18,
      chainId: 1,
      name: 'Test Token'
    };

    this.provider.addToken('0x1234567890123456789012345678901234567890', newToken);
    const afterAddCount = this.provider.getTokensByChain(1).length;

    if (afterAddCount !== initialTokenCount + 1) {
      throw new Error(`Expected ${initialTokenCount + 1} tokens, got ${afterAddCount}`);
    }

    // Verify the token was added
    const addedToken = await this.provider.getTokenInfo('0x1234567890123456789012345678901234567890');
    if (!addedToken) {
      throw new Error('Added token not found');
    }

    if (addedToken.ticker !== 'TEST') {
      throw new Error(`Expected ticker 'TEST', got '${addedToken.ticker}'`);
    }

    console.log(chalk.cyan(`  Initial tokens: ${initialTokenCount}`));
    console.log(chalk.cyan(`  After adding: ${afterAddCount}`));
    console.log(chalk.cyan(`  Added token ticker: ${addedToken.ticker}`));
  }

  /**
   * Test token data generation
   */
  async testTokenDataGeneration() {
    const contractAddress = '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d';
    const tokenInfo = await this.provider.getTokenInfo(contractAddress);

    if (!tokenInfo) {
      throw new Error('Token info not found');
    }

    if (!tokenInfo.data) {
      throw new Error('Token data not generated');
    }

    if (typeof tokenInfo.data !== 'string') {
      throw new Error('Token data should be a string');
    }

    if (tokenInfo.data.length === 0) {
      throw new Error('Token data should not be empty');
    }

    // Verify data is hex encoded
    if (!/^[0-9a-fA-F]+$/.test(tokenInfo.data)) {
      throw new Error('Token data should be hex encoded');
    }

    console.log(chalk.cyan(`  Token data length: ${tokenInfo.data.length} characters`));
    console.log(chalk.cyan(`  Token data preview: ${tokenInfo.data.slice(0, 20)}...`));
    console.log(chalk.cyan(`  Data is hex encoded: true`));
  }

  /**
   * Test token display information
   */
  async testTokenDisplayInfo() {
    const contractAddress = '0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d';
    const amount = '1000000'; // 1 USDC (6 decimals)

    const displayInfo = this.provider.getTokenDisplayInfo(contractAddress, amount);

    if (displayInfo.symbol !== 'USDC') {
      throw new Error(`Expected symbol 'USDC', got '${displayInfo.symbol}'`);
    }

    if (displayInfo.formattedAmount !== '1') {
      throw new Error(`Expected formatted amount '1', got '${displayInfo.formattedAmount}'`);
    }

    if (displayInfo.decimals !== 6) {
      throw new Error(`Expected decimals 6, got ${displayInfo.decimals}`);
    }

    // Test unknown token (use a different address)
    const unknownDisplayInfo = this.provider.getTokenDisplayInfo('0x9999999999999999999999999999999999999999', '1000');

    if (unknownDisplayInfo.symbol !== 'UNKNOWN') {
      throw new Error(`Expected symbol 'UNKNOWN', got '${unknownDisplayInfo.symbol}'`);
    }

    console.log(chalk.cyan(`  Known token symbol: ${displayInfo.symbol}`));
    console.log(chalk.cyan(`  Formatted amount: ${displayInfo.formattedAmount}`));
    console.log(chalk.cyan(`  Unknown token symbol: ${unknownDisplayInfo.symbol}`));
  }

  /**
   * Test registry export and import
   */
  async testRegistryExportImport() {
    // Export current registry
    const exportedTokens = this.provider.exportRegistry();
    
    if (!Array.isArray(exportedTokens)) {
      throw new Error('Exported tokens should be an array');
    }

    if (exportedTokens.length === 0) {
      throw new Error('Exported tokens should not be empty');
    }

    // Create a new provider and import
    const newProvider = new ERC20MetadataProvider();
    newProvider.importRegistry(exportedTokens);

    // Verify import worked
    const importedTokens = newProvider.exportRegistry();
    
    if (importedTokens.length !== exportedTokens.length) {
      throw new Error(`Expected ${exportedTokens.length} tokens, got ${importedTokens.length}`);
    }

    // Check specific token
    const originalUSDC = await this.provider.getTokenInfo('0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d');
    const importedUSDC = await newProvider.getTokenInfo('0xA0b86a33E6441F8C6f94c60f717e0e0a0e4b0c6d');

    if (originalUSDC?.ticker !== importedUSDC?.ticker) {
      throw new Error('Imported token ticker does not match original');
    }

    console.log(chalk.cyan(`  Exported tokens: ${exportedTokens.length}`));
    console.log(chalk.cyan(`  Imported tokens: ${importedTokens.length}`));
    console.log(chalk.cyan(`  Token data consistency: verified`));
  }

  /**
   * Run all ERC20 metadata tests
   */
  async runAllTests() {
    console.log(chalk.bold.blue('🚀 Starting ERC20 Metadata Test Suite\n'));

    await this.runTest('Token Registry Initialization', () => this.testTokenRegistryInitialization());
    await this.runTest('Token Search Functionality', () => this.testTokenSearch());
    await this.runTest('Token Amount Formatting Edge Cases', () => this.testTokenAmountFormattingEdgeCases());
    await this.runTest('Token Amount Parsing', () => this.testTokenAmountParsing());
    await this.runTest('Token Validation', () => this.testTokenValidation());
    await this.runTest('Token Management', () => this.testTokenManagement());
    await this.runTest('Token Data Generation', () => this.testTokenDataGeneration());
    await this.runTest('Token Display Information', () => this.testTokenDisplayInfo());
    await this.runTest('Registry Export/Import', () => this.testRegistryExportImport());

    this.printTestSummary();
  }

  /**
   * Print test results summary
   */
  printTestSummary() {
    console.log(chalk.bold.blue('\n📊 ERC20 Metadata Test Results'));
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
      console.log(chalk.bold.green('\n🎉 All ERC20 metadata tests passed!'));
    } else {
      console.log(chalk.bold.red(`\n💥 ${failed} test(s) failed.`));
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new ERC20MetadataTestSuite();
  testSuite.runAllTests().catch(console.error);
}

export { ERC20MetadataTestSuite }; 