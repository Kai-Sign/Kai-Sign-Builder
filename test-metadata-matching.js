#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load EntryPoint metadata
const metadataPath = path.join(__dirname, 'frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

console.log('🔍 Testing signature matching...\n');

// Test signatures from the extracted function calls
const testSignatures = [
  'handleOps((tuple))',
  'executeBatch((tuple))', 
  'transfer(address,uint256)'
];

const formats = metadata.display?.formats || {};
console.log('📋 Available metadata formats:');
Object.keys(formats).forEach(format => {
  console.log(`   - ${format}`);
});

console.log('\n🔍 Testing signature matches:');
testSignatures.forEach(sig => {
  const hasExactMatch = !!formats[sig];
  console.log(`   ${sig}: ${hasExactMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
});

// Test function name matching (fallback)
console.log('\n🔍 Testing function name matches:');
testSignatures.forEach(sig => {
  const functionName = sig.split('(')[0];
  const matchingFormat = Object.keys(formats).find(formatKey => {
    return formatKey === functionName;
  });
  console.log(`   ${functionName}: ${matchingFormat ? '✅ MATCH' : '❌ NO MATCH'}`);
});

console.log('\n🎯 Expected behavior:');
console.log('   - handleOps((tuple)) should match ✅');
console.log('   - executeBatch((tuple)) should match ✅');
console.log('   - transfer(address,uint256) should NOT match (will use USDC metadata)');
console.log('   - Prioritization should show executeBatch only');