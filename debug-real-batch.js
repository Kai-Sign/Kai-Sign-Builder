#!/usr/bin/env node

// Debug script for the real batch transaction
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the real batch sample
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
if (!realBatchSample) {
  console.log('❌ Real batch sample not found!');
  process.exit(1);
}

const transactionData = realBatchSample.transactionData;

console.log('🔍 Debugging real batch transaction...\n');

// Function extraction logic from hardware viewer
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

const allFunctionCalls = extractAllFunctionCalls(transactionData);

console.log(`Found ${allFunctionCalls.length} function calls:\n`);

allFunctionCalls.forEach((call, index) => {
  console.log(`${index + 1}. Function: ${call.name}`);
  console.log(`   Signature: ${call.signature}`);
  console.log(`   Path: ${call.path}`);
  console.log(`   Level: ${call.level}`);
  console.log('');
});

// Check for executeBatch specifically
const executeBatchCalls = allFunctionCalls.filter(call => call.name === 'executeBatch');
console.log(`\n🔍 executeBatch calls found: ${executeBatchCalls.length}`);
executeBatchCalls.forEach(call => {
  console.log(`   Signature: ${call.signature}`);
  console.log(`   Path: ${call.path}`);
  console.log(`   Level: ${call.level}`);
});

// Check metadata matching
console.log('\n📋 Loading EntryPoint metadata...');
const metadataPath = path.join(__dirname, 'frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const formats = metadata.display?.formats || {};
console.log('Available metadata formats:');
Object.keys(formats).forEach(format => {
  console.log(`   - ${format}`);
});

console.log('\n🔍 Testing signature matches:');
const signatures = allFunctionCalls.map(call => call.signature);
const uniqueSignatures = [...new Set(signatures)];

uniqueSignatures.forEach(sig => {
  const hasMatch = !!formats[sig];
  console.log(`   ${sig}: ${hasMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
});

// Test specific executeBatch signature
const executeBatchSig = 'executeBatch((address,uint256,bytes)[])';
console.log(`\n🎯 Looking for exact signature: ${executeBatchSig}`);
console.log(`   In metadata: ${!!formats[executeBatchSig] ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`   In transaction: ${signatures.includes(executeBatchSig) ? '✅ FOUND' : '❌ NOT FOUND'}`);

// Analyze the actual signature found
if (executeBatchCalls.length > 0) {
  const actualSig = executeBatchCalls[0].signature;
  console.log(`   Actual signature found: ${actualSig}`);
  console.log(`   Metadata has this signature: ${!!formats[actualSig] ? '✅ YES' : '❌ NO'}`);
}