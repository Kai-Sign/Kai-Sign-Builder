#!/usr/bin/env node

// Test script to verify EntryPoint metadata works with the hardware viewer
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the EntryPoint metadata
const metadataPath = path.join(__dirname, 'frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json');
const transactionPath = path.join(__dirname, 'test-entrypoint-transaction.json');

console.log('🔧 Testing EntryPoint ERC7730 Metadata');
console.log('====================================\n');

try {
  // Load metadata
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  console.log('✅ Metadata loaded successfully');
  console.log(`   Contract: ${metadata.context.contract.deployments[0].address}`);
  console.log(`   Chain ID: ${metadata.context.contract.deployments[0].chainId}`);
  console.log(`   Functions: ${Object.keys(metadata.display.formats).length}`);
  
  // Load transaction data
  const transaction = JSON.parse(fs.readFileSync(transactionPath, 'utf8'));
  console.log('\n✅ Transaction data loaded successfully');
  console.log(`   TX Hash: ${transaction.txHash}`);
  console.log(`   Function: ${transaction.methodCall.name}`);
  console.log(`   Signature: ${transaction.methodCall.signature}`);
  
  // Check if the function signature matches metadata
  const functionSignature = transaction.methodCall.signature;
  const metadataFormats = Object.keys(metadata.display.formats);
  
  console.log('\n🔍 Function Signature Matching:');
  console.log(`   Transaction signature: ${functionSignature}`);
  console.log(`   Metadata formats: ${metadataFormats.join(', ')}`);
  
  const exactMatch = metadataFormats.includes(functionSignature);
  console.log(`   Exact match: ${exactMatch ? '✅ YES' : '❌ NO'}`);
  
  if (exactMatch) {
    const operation = metadata.display.formats[functionSignature];
    console.log('\n🎯 Matched Operation Details:');
    console.log(`   Intent: ${operation.intent}`);
    console.log(`   Fields: ${operation.fields.length}`);
    
    operation.fields.forEach((field, index) => {
      console.log(`   Field ${index + 1}: ${field.label} (${field.format}) -> ${field.path}`);
    });
  }
  
  // Test path resolution (simplified check)
  console.log('\n🛤️  Path Resolution Test:');
  const testPaths = metadata.display.formats[functionSignature]?.fields.map(f => f.path) || [];
  
  testPaths.forEach(path => {
    console.log(`   Testing path: ${path}`);
    // This is a simplified check - the actual hardware viewer does more complex resolution
    if (path.startsWith('#.ops[0].')) {
      console.log(`     ✅ Should resolve to transaction parameter data`);
    } else if (path === '#.beneficiary') {
      console.log(`     ✅ Should resolve to beneficiary address`);
    } else {
      console.log(`     ⚠️  Custom path - check resolution logic`);
    }
  });
  
  console.log('\n🏁 Test Summary:');
  console.log(`   ✅ Metadata file valid: YES`);
  console.log(`   ✅ Transaction data valid: YES`);
  console.log(`   ✅ Function signature match: ${exactMatch ? 'YES' : 'NO'}`);
  console.log(`   ✅ Fields defined: ${metadata.display.formats[functionSignature]?.fields.length || 0}`);
  
  if (exactMatch) {
    console.log('\n🎉 SUCCESS: The EntryPoint metadata should work with the hardware viewer!');
    console.log('\nNext steps:');
    console.log('1. Open the hardware viewer in your browser');
    console.log('2. Switch to Advanced Mode');
    console.log('3. Load the EntryPoint metadata file');
    console.log('4. Paste the transaction data');
    console.log('5. Select the matching operation');
  } else {
    console.log('\n⚠️  WARNING: Function signature mismatch - check the metadata format keys');
  }
  
} catch (error) {
  console.error('❌ Error during testing:', error.message);
  process.exit(1);
}