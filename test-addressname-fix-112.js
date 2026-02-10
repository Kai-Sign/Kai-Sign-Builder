#!/usr/bin/env node

// ITERATION 112 - Test addressName formatting fix
console.log('🎯 ITERATION 112 - TEST ADDRESSNAME FORMATTING FIX\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('✅ Data loaded successfully');

// Simulate the FIXED addressName formatting logic
function formatAddressName(value, transactionData) {
  const addressValue = value.toString();
  if (addressValue.startsWith('0x') && addressValue.length === 42) {
    // Always format addresses as shortened form, regardless of metadata
    return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
  }
  return addressValue;
}

console.log('\nTesting addressName formatting fix...');

// Test addresses from the transaction
const testAddresses = [
  {
    name: 'First Target (USDC Contract)',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    expectation: '0x8335...2913'
  },
  {
    name: 'First Recipient', 
    address: '0xb0E6531042FC9fbf72b063dD29a388C62fF1437b',
    expectation: '0xb0E6...437b'
  },
  {
    name: 'Beneficiary',
    address: '0x1234567890123456789012345678901234567890',
    expectation: '0x1234...7890'
  }
];

console.log('Before fix behavior (using metadata):');
testAddresses.forEach((test, i) => {
  console.log(`  ${i+1}. ${test.name}:`);
  console.log(`     Address: ${test.address}`);
  
  // OLD logic (what was happening before)
  let oldResult = test.address;
  if (transactionData?.addressesMeta && transactionData.addressesMeta[test.address]) {
    const addressMeta = transactionData.addressesMeta[test.address];
    oldResult = addressMeta.contractName || `${test.address.slice(0, 6)}...${test.address.slice(-4)}`;
  } else {
    oldResult = `${test.address.slice(0, 6)}...${test.address.slice(-4)}`;
  }
  console.log(`     OLD result: "${oldResult}"`);
  
  // NEW logic (fixed)
  const newResult = formatAddressName(test.address, transactionData);
  console.log(`     NEW result: "${newResult}"`);
  console.log(`     Expected: "${test.expectation}"`);
  console.log(`     ✅ Fixed: ${newResult === test.expectation ? 'YES' : 'NO'}`);
  console.log('');
});

// Test the complete operation with fixed formatting
console.log('Testing complete operation with fixed addressName formatting...');

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
        value: param.value
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
    if (!this.pathMap.has(metadataPath)) return undefined;
    
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

const smartPathResolver = new SmartPathResolver();
smartPathResolver.analyzeTransaction(transactionData);

// Get the executeBatch operation from metadata
const executeBatchFormat = entryPointMetadata.display.formats['executeBatch((tuple,tuple))'];
const operation = {
  operation: executeBatchFormat.intent,
  fields: executeBatchFormat.fields,
  functionCall: {
    level: 5,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  }
};

function getFieldValueFromTransaction(path, format, field, operation) {
  if (field && 'value' in field && field.value !== undefined) {
    return field.value.toString();
  }
  
  let resolvedPath = path;
  
  if (operation.functionCall?.level > 0 && operation.functionCall?.nestedPath && path.startsWith('#')) {
    const pathWithoutHash = path.substring(2);
    resolvedPath = `${operation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  
  const value = smartPathResolver.resolveMetadataPath(transactionData, resolvedPath);
  
  if (value === undefined) {
    return "[unmapped]";
  }
  
  // Apply FIXED formatting logic
  switch (format) {
    case "addressName":
      return formatAddressName(value, transactionData);
    case "raw":
      return value.toString();
    default:
      return value.toString();
  }
}

console.log('\nFinal operation result with FIXED addressName formatting:');

operation.fields.forEach((field, fieldIndex) => {
  const label = field.label;
  const format = field.format || "raw";
  const path = field.path || "";
  
  const displayValue = getFieldValueFromTransaction(path, format, field, operation);
  
  console.log(`   ${fieldIndex + 1}. ${label}: ${displayValue}`);
});

console.log('\n🎯 EXPECTED RESULT:');
console.log('Batch Type: Multiple Operations');
console.log('First Target: 0x8335...2913  ← FIXED (was "USD Coin")');
console.log('First Operation: Token Operation');
console.log('First Amount: 41780000');
console.log('First Recipient: 0xb0E6...437b  ← FIXED (was showing address name)');
console.log('Total Operations: 2');

console.log('\n📊 ADDRESSNAME FORMATTING FIX TEST COMPLETE - ITERATION 112');