#!/usr/bin/env node

// Debug script to test the new batch sample data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the new batch sample data
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));

// Find the batch USDC transfer sample
const batchSample = sampleSets.sampleSets.find(set => set.id === 'batch-usdc-transfer');

if (!batchSample) {
  console.log('❌ Batch USDC transfer sample not found!');
  process.exit(1);
}

console.log('✅ Found batch USDC transfer sample');
console.log(`📋 Metadata files: ${batchSample.metadataFiles.join(', ')}`);

const transactionData = batchSample.transactionData;

// Replicate the extractAllFunctionCalls function
const extractAllFunctionCalls = (data, path = '', level = 0) => {
  const functionCalls = [];
  
  // Base case: if this looks like a function call
  if (data && typeof data === 'object' && data.name && data.params) {
    const paramTypes = Array.isArray(data.params) ? data.params.map((p) => {
      if (p.type === 'tuple' && p.components) {
        const componentTypes = p.components.map((c) => c.type).join(',');
        return `(${componentTypes})`;
      }
      return p.type;
    }).join(',') : '';
    const signature = `${data.name}(${paramTypes})`;
    
    functionCalls.push({
      name: data.name,
      params: data.params,
      signature: signature,
      path: path,
      level: level,
      context: data
    });
  }
  
  // Recursively search through all properties
  if (data && typeof data === 'object') {
    // Search in valueDecoded for nested function calls
    if (data.valueDecoded) {
      const newPath = path ? `${path}.valueDecoded` : 'valueDecoded';
      functionCalls.push(...extractAllFunctionCalls(data.valueDecoded, newPath, level + 1));
    }
    
    // Search in params array
    if (Array.isArray(data.params)) {
      data.params.forEach((param, index) => {
        const paramName = param.name || `param${index}`;
        const newPath = path ? `${path}.${paramName}` : paramName;
        functionCalls.push(...extractAllFunctionCalls(param, newPath, level + 1));
      });
    }
    
    // Search in methodCall
    if (data.methodCall) {
      const newPath = path ? `${path}.methodCall` : 'methodCall';
      functionCalls.push(...extractAllFunctionCalls(data.methodCall, newPath, level + 1));
    }
    
    // Search in components array (for tuple types)
    if (Array.isArray(data.components)) {
      data.components.forEach((component, index) => {
        const componentName = component.name || `component${index}`;
        const newPath = path ? `${path}.${componentName}` : componentName;
        functionCalls.push(...extractAllFunctionCalls(component, newPath, level + 1));
      });
    }
    
    // Search in all object properties recursively (catch-all for nested structures)
    Object.keys(data).forEach((key) => {
      if (key !== 'valueDecoded' && key !== 'params' && key !== 'methodCall' && key !== 'components') {
        const value = data[key];
        if (value && typeof value === 'object') {
          const newPath = path ? `${path}.${key}` : key;
          functionCalls.push(...extractAllFunctionCalls(value, newPath, level + 1));
        }
      }
    });
  }
  
  return functionCalls;
};

console.log('\n🔍 Extracting all function calls from batch transaction...\n');

const allFunctionCalls = extractAllFunctionCalls(transactionData);

console.log(`Found ${allFunctionCalls.length} function calls:\n`);

allFunctionCalls.forEach((call, index) => {
  console.log(`${index + 1}. Function: ${call.name}`);
  console.log(`   Signature: ${call.signature}`);
  console.log(`   Path: ${call.path}`);
  console.log(`   Level: ${call.level}`);
  console.log(`   Params: ${call.params.length}`);
  console.log('');
});

// Test metadata loading for each metadata file
console.log('📋 Testing metadata loading:');
for (const metadataFile of batchSample.metadataFiles) {
  try {
    const metadataPath = path.join(__dirname, `frontend/public/erc7730/${metadataFile}`);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    console.log(`\n✅ Loaded ${metadataFile}:`);
    const formats = metadata.display?.formats || {};
    console.log(`   Available operations: ${Object.keys(formats).join(', ')}`);
    
    // Test signature matches
    const signatures = allFunctionCalls.map(call => call.signature);
    for (const sig of signatures) {
      const hasMatch = !!formats[sig];
      console.log(`   ${sig}: ${hasMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    }
  } catch (error) {
    console.log(`❌ Failed to load ${metadataFile}: ${error.message}`);
  }
}

// Test batch operation prioritization
console.log('\n🎯 Testing batch operation prioritization:');
const batchOperations = ['handleOps', 'executeBatch', 'execTransaction'];
const isBatchOperation = (signature) => {
  return batchOperations.some(batchOp => signature.includes(batchOp));
};

const foundBatchOps = allFunctionCalls.filter(call => isBatchOperation(call.signature));
const foundIndividualOps = allFunctionCalls.filter(call => !isBatchOperation(call.signature));

console.log(`Batch operations: ${foundBatchOps.length}`);
foundBatchOps.forEach(op => console.log(`  - ${op.signature}`));

console.log(`Individual operations: ${foundIndividualOps.length}`);
foundIndividualOps.forEach(op => console.log(`  - ${op.signature}`));

if (foundBatchOps.length > 0 && foundIndividualOps.length > 0) {
  console.log('\n✅ Prioritization should show batch operations only');
} else if (foundBatchOps.length === 0) {
  console.log('\n❌ No batch operations found - this is the problem!');
} else {
  console.log('\n✅ Only batch operations found');
}