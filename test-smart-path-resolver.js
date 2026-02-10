#!/usr/bin/env node

// Test the exact SmartPathResolver logic from hardware viewer
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ITERATION 23 - TESTING SMART PATH RESOLVER LOGIC\n');

// Load sample data
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Exact SmartPathResolver logic from the hardware viewer
class SmartPathResolver {
  constructor() {
    this.pathMap = new Map();
  }
  
  analyzeTransaction(transaction) {
    this.pathMap.clear();
    if (!transaction.methodCall?.params) return;
    this.buildPathMap(transaction.methodCall.params, '', 0);
  }
  
  buildPathMap(params, parentPath, level) {
    params.forEach((param) => {
      const currentPath = parentPath ? `${parentPath}.${param.name}` : param.name;
      const fullPath = `#.${currentPath}`;
      
      this.pathMap.set(fullPath, {
        path: fullPath,
        level,
        type: param.type,
        value: param.value,
        isArray: param.type?.includes('[]'),
        isTuple: !!param.components,
        hasDecoded: !!param.valueDecoded
      });
      
      if (param.components) {
        this.buildPathMap(param.components, currentPath, level + 1);
      }
      
      if (param.valueDecoded?.params) {
        const decodedPath = `${currentPath}.valueDecoded`;
        this.buildPathMap(param.valueDecoded.params, decodedPath, level + 1);
      }
    });
  }
  
  resolveMetadataPath(transaction, metadataPath) {
    // Handle @ paths (transaction metadata) directly
    if (metadataPath.startsWith('@')) {
      const pathWithoutRoot = metadataPath.substring(2); // Remove '@.'
      const pathParts = pathWithoutRoot.split('.');
      
      let current = transaction;
      
      for (const part of pathParts) {
        if (!current) return undefined;
        
        // Handle array index access: transfers[0], addressesMeta[address]
        const indexMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (indexMatch && indexMatch.length >= 3) {
          const arrayName = indexMatch[1];
          const indexStr = indexMatch[2];
          const idx = parseInt(indexStr);
          
          if (current[arrayName] && Array.isArray(current[arrayName])) {
            current = current[arrayName][idx];
            continue;
          } else {
            return undefined;
          }
        }
        
        // Regular property access
        if (current[part] !== undefined) {
          current = current[part];
        } else {
          return undefined;
        }
      }
      
      return current;
    }
    
    // Handle # paths (methodCall parameters) - existing logic
    if (!this.pathMap.has(metadataPath)) {
      console.log(`❌ Path not in pathMap: ${metadataPath}`);
      console.log('Available paths:');
      Array.from(this.pathMap.keys()).forEach(p => console.log(`  ${p}`));
      return undefined;
    }
    
    const pathWithoutRoot = metadataPath.substring(2);
    const pathParts = pathWithoutRoot.split('.');
    
    let current = transaction.methodCall?.params;
    if (!current) return undefined;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (part === 'valueDecoded') {
        if (current && current.valueDecoded) {
          current = current.valueDecoded.params;
          continue;
        }
        return undefined;
      }
      
      if (Array.isArray(current)) {
        const param = current.find((p) => p.name === part);
        if (!param) return undefined;
        
        if (i === pathParts.length - 1) {
          return param.value;
        }
        
        if (param.components) {
          current = param.components;
        } else {
          current = param;
        }
      } else {
        if (current[part] !== undefined) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }
    
    return current?.value !== undefined ? current.value : current;
  }
}

// Get the executeBatch call context
const executeBatchCall = transactionData.methodCall.params[0].components[0].components.find(
  comp => comp.name === 'callData'
);

console.log('Testing SmartPathResolver with executeBatch context...');

// Test with the full transaction (this is how hardware viewer does it)
const resolver = new SmartPathResolver();
resolver.analyzeTransaction(transactionData);

console.log('\nPathMap contents:');
Array.from(resolver.pathMap.keys()).slice(0, 20).forEach(path => {
  const info = resolver.pathMap.get(path);
  console.log(`  ${path} (level ${info.level}, type: ${info.type})`);
});

// Test the specific paths from our metadata
const testPaths = [
  '#.calls.calls.target.value',
  '#.calls.calls.data.valueDecoded.name',
  '#.calls.calls.data.valueDecoded.params.value.value',
  '#.calls.calls.data.valueDecoded.params.to.value'
];

console.log('\nTesting metadata paths:');
testPaths.forEach(path => {
  console.log(`\nPath: ${path}`);
  const result = resolver.resolveMetadataPath(transactionData, path);
  console.log(`Result: ${result !== undefined ? '✅' : '❌'} ${result || '[unmapped]'}`);
});

console.log('\n🔍 The issue: SmartPathResolver analyzes the FULL transaction, not just executeBatch context!');
console.log('It needs to find paths that work from the TOP-LEVEL transaction methodCall.params');

// Find the correct paths from the top level
console.log('\n🎯 Finding correct paths from transaction root:');
function findCorrectPaths(transaction) {
  // From transaction.methodCall.params, find path to executeBatch
  const handleOpsParam = transaction.methodCall.params[0]; // ops parameter
  console.log('handleOps ops param name:', handleOpsParam.name);
  
  // Navigate to the callData of the first operation
  const firstOp = handleOpsParam.components[0]; // First UserOperation
  console.log('First operation components:', firstOp.components.map(c => c.name));
  
  const callDataComponent = firstOp.components.find(c => c.name === 'callData');
  console.log('callData has valueDecoded:', !!callDataComponent.valueDecoded);
  
  // The executeBatch is in callData.valueDecoded
  const executeBatch = callDataComponent.valueDecoded;
  console.log('executeBatch params:', executeBatch.params.map(p => p.name));
  
  // The calls parameter contains the batch operations
  const callsParam = executeBatch.params.find(p => p.name === 'calls');
  console.log('calls param has components:', !!callsParam.components);
  console.log('calls components names:', callsParam.components.map(c => c.name));
  
  console.log('\n✅ CORRECT PATHS FROM TRANSACTION ROOT:');
  console.log('Target: #.ops.ops.callData.valueDecoded.calls.calls.target.value');
  console.log('Operation: #.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.name');
  console.log('Amount: #.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.params.value.value');
  console.log('Recipient: #.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.params.to.value');
}

findCorrectPaths(transactionData);