#!/usr/bin/env node

// Check what paths are actually available in the smart path resolver
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the real batch sample
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('🔍 Available paths in transaction structure:\n');

// From the logs, these are the available paths:
const availablePaths = [
  '#.ops', 
  '#.ops.ops', 
  '#.ops.ops.sender', 
  '#.ops.ops.nonce', 
  '#.ops.ops.initCode', 
  '#.ops.ops.callData', 
  '#.ops.ops.callData.valueDecoded.calls', 
  '#.ops.ops.callData.valueDecoded.calls.calls', 
  '#.ops.ops.callData.valueDecoded.calls.calls.target', 
  '#.ops.ops.callData.valueDecoded.calls.calls.value', 
  '#.ops.ops.callData.valueDecoded.calls.calls.data', 
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.to', 
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.value', 
  '#.ops.ops.accountGasLimits', 
  '#.ops.ops.preVerificationGas', 
  '#.ops.ops.gasFees', 
  '#.ops.ops.paymasterAndData', 
  '#.ops.ops.signature', 
  '#.beneficiary'
];

console.log('Available paths:');
availablePaths.forEach(path => console.log(`  ${path}`));

console.log('\n🔍 Looking for paths with multiple operations...');

// Check if there are indexed paths available
const indexedPaths = availablePaths.filter(path => path.includes('[') || path.includes('0') || path.includes('1'));
console.log('Indexed paths found:', indexedPaths);

console.log('\n🔍 The issue: We only see these calls-related paths:');
const callsPaths = availablePaths.filter(path => path.includes('calls'));
callsPaths.forEach(path => console.log(`  ${path}`));

console.log('\n❌ Missing paths we need:');
console.log('  #.ops.ops.callData.valueDecoded.calls.calls[0].target');
console.log('  #.ops.ops.callData.valueDecoded.calls.calls[1].target');
console.log('  #.ops.ops.callData.valueDecoded.calls.calls[0].data.valueDecoded.value');
console.log('  #.ops.ops.callData.valueDecoded.calls.calls[1].data.valueDecoded.value');

console.log('\n💡 The problem: The path resolver only shows the FIRST element of arrays, not indexed access!');
console.log('Available: #.ops.ops.callData.valueDecoded.calls.calls.target (only first)');
console.log('Missing:   #.ops.ops.callData.valueDecoded.calls.calls[1].target (second)');

console.log('\n🎯 Solution: Use the non-indexed paths for the first operation only:');
console.log('  First Target: #.calls.calls.target');
console.log('  First Amount: #.calls.calls.data.valueDecoded.value'); 
console.log('  First Recipient: #.calls.calls.data.valueDecoded.to');
console.log('  + Show operation count instead of trying to access second operation');