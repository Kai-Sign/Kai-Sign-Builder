// Test contract address extraction from real batch transaction

const extractContractAddresses = (data) => {
  const addresses = [];
  
  const traverse = (obj, depth = 0, path = '') => {
    if (obj && typeof obj === 'object' && depth < 20) {
      // Look for target addresses
      if (obj.target && typeof obj.target === 'string' && obj.target.startsWith('0x')) {
        console.log(`📍 Found contract address at depth ${depth} (${path}): ${obj.target}`);
        addresses.push(obj.target.toLowerCase());
      }
      
      // Look for specific patterns to debug
      if (obj.name === 'target' && obj.value && typeof obj.value === 'string' && obj.value.startsWith('0x')) {
        console.log(`📍 Found target param at depth ${depth} (${path}): ${obj.value}`);
        addresses.push(obj.value.toLowerCase());
      }
      
      // Recursively traverse all properties
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => traverse(item, depth + 1, `${path}[${index}]`));
      } else {
        Object.entries(obj).forEach(([key, value]) => traverse(value, depth + 1, `${path}.${key}`));
      }
    }
  };
  
  traverse(data);
  const uniqueAddresses = [...new Set(addresses)];
  console.log(`🎯 Extracted ${uniqueAddresses.length} unique contract addresses: ${uniqueAddresses.join(', ')}`);
  return uniqueAddresses;
};

// Load the real batch transaction data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
  const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
  
  const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
  
  if (realBatchSample) {
    console.log('🧪 Testing contract address extraction on real batch USDC transfer');
    console.log('===============================================');
    
    const contractAddresses = extractContractAddresses(realBatchSample.transactionData);
    
    console.log('\\n✅ Test Results:');
    console.log(`Found ${contractAddresses.length} contract addresses:`);
    contractAddresses.forEach(addr => {
      console.log(`  - ${addr}`);
    });
    
    // Expected: 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 (USDC on Base)
    const expectedUSDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    if (contractAddresses.includes(expectedUSDC.toLowerCase())) {
      console.log('\\n🎉 SUCCESS: USDC contract address correctly extracted!');
    } else {
      console.log('\\n❌ FAILED: Expected USDC address not found');
    }
    
  } else {
    console.log('❌ real-batch-usdc-transfer sample not found');
  }
  
} catch (error) {
  console.error('❌ Error loading sample data:', error.message);
}