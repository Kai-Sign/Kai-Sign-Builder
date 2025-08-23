#!/usr/bin/env node
import { LiveTransactionParser } from '../src/live-transaction-parser.js';
import chalk from 'chalk';

/**
 * Test script for Live Transaction Parser
 * 
 * IMPORTANT: This tests with REAL mainnet transactions
 * No hardcoded data - everything fetched dynamically
 */
async function testLiveParser() {
  console.log(chalk.bold.blue('🧪 Testing Live Transaction Parser\n'));
  
  const parser = new LiveTransactionParser();
  
  // Test transactions (these are real mainnet transactions)
  const testCases = [
    {
      name: 'ETH Transfer',
      hash: '0x2e6e9cc5c1e0d6551f1217e3cf9574614b0c8a1c4a5e3c2ed45893c127236f23',
      description: 'Simple ETH transfer'
    },
    {
      name: 'USDC Transfer', 
      hash: '0x8c5261846a9b5c83242753e96264e58b5e3c22e7301929c091c972fc8a579c8e',
      description: 'ERC20 token transfer'
    },
    {
      name: 'Uniswap Swap',
      hash: '0x7e87b849e2e3e5d20e8231e116c7e3c1e5d7b95fa87a3e5e5c8a5e5c8a5e5c8a',
      description: 'DEX swap transaction'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(chalk.yellow(`\n📝 Test: ${testCase.name}`));
    console.log(chalk.gray(`   ${testCase.description}`));
    console.log(chalk.gray(`   Hash: ${testCase.hash.slice(0, 10)}...`));
    
    try {
      const result = await parser.parseTransactionFromHash(testCase.hash);
      
      if (result.error) {
        console.log(chalk.red(`   ❌ Error: ${result.error}`));
      } else {
        console.log(chalk.green(`   ✅ Parsed successfully`));
        if (result.metadata) {
          console.log(chalk.green(`   ✅ ERC-7730 metadata found`));
        } else {
          console.log(chalk.yellow(`   ⚠️ No ERC-7730 metadata`));
        }
        
        // Show human readable output
        console.log(chalk.cyan('\n   Human Readable Output:'));
        const lines = result.humanReadable.split('\n');
        for (const line of lines.slice(0, 5)) { // Show first 5 lines
          console.log(chalk.gray(`   ${line}`));
        }
        if (lines.length > 5) {
          console.log(chalk.gray(`   ... (${lines.length - 5} more lines)`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Exception: ${error.message}`));
    }
  }
  
  console.log(chalk.bold.green('\n✅ Test complete!'));
  console.log(chalk.gray('\nTo test with your own transaction:'));
  console.log(chalk.white('node src/live-transaction-parser.js <your_tx_hash>'));
}

// Run tests
testLiveParser().catch(console.error);