#!/usr/bin/env node

// ITERATION 111 - Debug addressesMeta issue
console.log('🎯 ITERATION 111 - DEBUG ADDRESSESMETA ISSUE\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('Debugging addressesMeta...');
console.log('First Target address from path resolution: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

if (transactionData.addressesMeta) {
  console.log('\nAddressesMeta found:');
  Object.keys(transactionData.addressesMeta).forEach(address => {
    const meta = transactionData.addressesMeta[address];
    console.log(`  ${address}:`);
    console.log(`    contractName: ${meta.contractName}`);
    console.log(`    tokenSymbol: ${meta.tokenSymbol}`);
    console.log(`    tokenName: ${meta.tokenName}`);
  });
  
  const targetAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  if (transactionData.addressesMeta[targetAddress]) {
    console.log(`\nTarget address metadata:`);
    const meta = transactionData.addressesMeta[targetAddress];
    console.log(`  contractName: ${meta.contractName}`);
    console.log(`  tokenSymbol: ${meta.tokenSymbol}`);
    console.log(`  tokenName: ${meta.tokenName}`);
    
    console.log('\nCurrent addressName formatting logic would return:');
    const result = meta.contractName || `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`;
    console.log(`  Result: "${result}"`);
    
    console.log('\nPROBLEM: First Target should show address, not token name!');
    console.log('The metadata field says format: "addressName" but we\'re showing token name');
    console.log('Should show: 0x8335...2913 instead of "USD Coin"');
  }
} else {
  console.log('No addressesMeta found');
}

console.log('\n📊 DEBUG ADDRESSESMETA COMPLETE - ITERATION 111');