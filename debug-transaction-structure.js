#!/usr/bin/env node

// Debug the actual transaction structure to find where the second operation is
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

console.log('🔍 Analyzing transaction structure for multiple operations...\n');

// Navigate to the executeBatch call
const executeBatchCall = transactionData.methodCall.params[0].components[0].components.find(
  comp => comp.name === 'callData'
);

console.log('📋 ExecuteBatch call structure:');
console.log('executeBatchCall.valueDecoded:', JSON.stringify(executeBatchCall.valueDecoded, null, 2));

console.log('\n🔍 Looking for multiple calls in the structure...');

// Check if there are multiple calls in the structure
if (executeBatchCall.valueDecoded && executeBatchCall.valueDecoded.params) {
  const calls = executeBatchCall.valueDecoded.params[0];
  console.log('calls parameter:', JSON.stringify(calls, null, 2));
  
  if (calls.components) {
    console.log(`\n📊 Found ${calls.components.length} operations in the batch:`);
    calls.components.forEach((call, index) => {
      console.log(`\nOperation ${index + 1}:`);
      console.log(`  Target: ${call.components?.find(c => c.name === 'target')?.value || 'Unknown'}`);
      console.log(`  Value: ${call.components?.find(c => c.name === 'value')?.value || 'Unknown'}`);
      
      const dataComponent = call.components?.find(c => c.name === 'data');
      if (dataComponent?.valueDecoded) {
        console.log(`  Function: ${dataComponent.valueDecoded.name}`);
        console.log(`  Params: ${JSON.stringify(dataComponent.valueDecoded.params?.map(p => `${p.name}:${p.value}`) || [])}`);
      }
    });
  }
}

console.log('\n🎯 Path structure for accessing operations:');
console.log('First operation target: #.calls.calls[0].target');
console.log('Second operation target: #.calls.calls[1].target');
console.log('First operation function: #.calls.calls[0].data.valueDecoded.name');
console.log('Second operation function: #.calls.calls[1].data.valueDecoded.name');