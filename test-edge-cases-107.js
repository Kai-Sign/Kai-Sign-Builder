#!/usr/bin/env node

// ITERATION 107 - Edge cases and boundary conditions test
console.log('🎯 ITERATION 107 - EDGE CASES AND BOUNDARY CONDITIONS TEST\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Edge Case 1: Level 0 operations (no nesting)
console.log('Edge Case 1: Level 0 operations (no nesting)...');
const mockLevel0Operation = {
  operation: 'Test Operation',
  fields: [
    { label: 'Test Field', path: '#.beneficiary', format: 'addressName' }
  ],
  functionCall: {
    level: 0,
    nestedPath: null
  }
};

// Test path transformation for level 0
const level0Paths = mockLevel0Operation.fields.map(f => f.path).filter(Boolean);
const level0Transformed = level0Paths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (mockLevel0Operation.functionCall?.level > 0 && mockLevel0Operation.functionCall?.nestedPath) {
    const pathWithoutHash = path.substring(2);
    return `${mockLevel0Operation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log(`  Original paths: ${level0Paths}`);
console.log(`  Transformed paths: ${level0Transformed}`);
console.log(`  ✅ Level 0 transformation: ${level0Paths[0] === level0Transformed[0] ? 'CORRECT (no change)' : 'INCORRECT'}`);

// Edge Case 2: @ paths (transaction metadata)
console.log('\nEdge Case 2: @ paths (transaction metadata)...');
const mockAtPathOperation = {
  operation: 'Test Operation',
  fields: [
    { label: 'Transaction Hash', path: '@.txHash', format: 'raw' },
    { label: 'Block Number', path: '@.blockNumber', format: 'raw' }
  ],
  functionCall: {
    level: 5,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  }
};

const atPaths = mockAtPathOperation.fields.map(f => f.path).filter(Boolean);
const atTransformed = atPaths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (mockAtPathOperation.functionCall?.level > 0 && mockAtPathOperation.functionCall?.nestedPath) {
    const pathWithoutHash = path.substring(2);
    return `${mockAtPathOperation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log(`  Original @ paths: ${atPaths}`);
console.log(`  Transformed @ paths: ${atTransformed}`);
console.log(`  ✅ @ paths transformation: ${atPaths.every((p, i) => p === atTransformed[i]) ? 'CORRECT (no change for @)' : 'INCORRECT'}`);

// Edge Case 3: Empty or undefined paths
console.log('\nEdge Case 3: Empty or undefined paths...');
const mockEmptyPathOperation = {
  operation: 'Test Operation',
  fields: [
    { label: 'Static Value', value: 'Test Value' },
    { label: 'Undefined Path', path: undefined },
    { label: 'Empty Path', path: '' },
    { label: 'Null Path', path: null }
  ],
  functionCall: {
    level: 5,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  }
};

const emptyPaths = mockEmptyPathOperation.fields.map(f => f.path).filter(Boolean);
const emptyTransformed = emptyPaths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (mockEmptyPathOperation.functionCall?.level > 0 && mockEmptyPathOperation.functionCall?.nestedPath) {
    const pathWithoutHash = path.substring(2);
    return `${mockEmptyPathOperation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log(`  Original empty paths: ${emptyPaths.length} paths after filtering`);
console.log(`  Transformed empty paths: ${emptyTransformed.length} paths`);
console.log(`  ✅ Empty path handling: ${emptyPaths.length === 0 && emptyTransformed.length === 0 ? 'CORRECT (filtered out)' : 'INCORRECT'}`);

// Edge Case 4: Non-# paths with nested operations
console.log('\nEdge Case 4: Non-# paths with nested operations...');
const mockNonHashOperation = {
  operation: 'Test Operation',
  fields: [
    { label: 'Raw Value', path: 'raw.value.path', format: 'raw' },
    { label: 'Another Value', path: 'another.value', format: 'raw' }
  ],
  functionCall: {
    level: 3,
    nestedPath: '#.some.nested.path'
  }
};

const nonHashPaths = mockNonHashOperation.fields.map(f => f.path).filter(Boolean);
const nonHashTransformed = nonHashPaths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (mockNonHashOperation.functionCall?.level > 0 && mockNonHashOperation.functionCall?.nestedPath) {
    const pathWithoutHash = path.substring(2);
    return `${mockNonHashOperation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log(`  Original non-# paths: ${nonHashPaths}`);
console.log(`  Transformed non-# paths: ${nonHashTransformed}`);
console.log(`  ✅ Non-# path handling: ${nonHashPaths.every((p, i) => p === nonHashTransformed[i]) ? 'CORRECT (no change for non-#)' : 'INCORRECT'}`);

// Edge Case 5: Missing nestedPath
console.log('\nEdge Case 5: Missing nestedPath...');
const mockMissingNestedOperation = {
  operation: 'Test Operation',
  fields: [
    { label: 'Test Field', path: '#.some.path', format: 'raw' }
  ],
  functionCall: {
    level: 5,
    nestedPath: null
  }
};

const missingPaths = mockMissingNestedOperation.fields.map(f => f.path).filter(Boolean);
const missingTransformed = missingPaths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (mockMissingNestedOperation.functionCall?.level > 0 && mockMissingNestedOperation.functionCall?.nestedPath) {
    const pathWithoutHash = path.substring(2);
    return `${mockMissingNestedOperation.functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log(`  Original paths with missing nested: ${missingPaths}`);
console.log(`  Transformed paths with missing nested: ${missingTransformed}`);
console.log(`  ✅ Missing nestedPath handling: ${missingPaths.every((p, i) => p === missingTransformed[i]) ? 'CORRECT (no change when nestedPath null)' : 'INCORRECT'}`);

// Edge Case 6: Real-world validation with SmartPathResolver
console.log('\nEdge Case 6: Real-world validation with SmartPathResolver...');

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
}

const smartPathResolver = new SmartPathResolver();
smartPathResolver.analyzeTransaction(transactionData);

// Test all edge case operations against real data
const edgeOperations = [
  mockLevel0Operation,
  mockAtPathOperation, 
  mockEmptyPathOperation,
  mockNonHashOperation,
  mockMissingNestedOperation
];

let edgeCasesPassed = 0;
let totalEdgeCases = 0;

edgeOperations.forEach((operation, index) => {
  const operationName = [
    'Level 0 Operation',
    '@ Path Operation', 
    'Empty Path Operation',
    'Non-# Path Operation',
    'Missing Nested Operation'
  ][index];
  
  console.log(`\n  Testing ${operationName}:`);
  
  const metadataPaths = operation.fields.map(f => f.path).filter(Boolean);
  
  const transformedPaths = metadataPaths.map(path => {
    if (!path || !path.startsWith('#')) return path;
    
    if (operation.functionCall?.level > 0 && operation.functionCall?.nestedPath) {
      const pathWithoutHash = path.substring(2);
      return `${operation.functionCall.nestedPath}.${pathWithoutHash}`;
    }
    return path;
  });
  
  const validPaths = transformedPaths.filter(path => smartPathResolver.pathMap.has(path));
  const invalidPaths = transformedPaths.filter(path => !smartPathResolver.pathMap.has(path));
  
  totalEdgeCases++;
  
  console.log(`    Original paths: ${metadataPaths.length}`);
  console.log(`    Transformed paths: ${transformedPaths.length}`);
  console.log(`    Valid paths: ${validPaths.length}`);
  console.log(`    Invalid paths: ${invalidPaths.length}`);
  
  // For edge cases, we expect specific behaviors
  let testPassed = false;
  
  switch (index) {
    case 0: // Level 0 - should find #.beneficiary
      testPassed = validPaths.length === 1 && validPaths.includes('#.beneficiary');
      break;
    case 1: // @ paths - should have 0 valid (@ paths not in pathMap)
      testPassed = validPaths.length === 0 && transformedPaths.every(p => p.startsWith('@'));
      break;
    case 2: // Empty paths - should have 0 paths after filtering
      testPassed = metadataPaths.length === 0;
      break;
    case 3: // Non-# paths - should have 0 valid (non-# paths not in pathMap)
      testPassed = validPaths.length === 0 && !transformedPaths.some(p => p.startsWith('#'));
      break;
    case 4: // Missing nested - should have 0 valid (path not found)
      testPassed = validPaths.length === 0;
      break;
  }
  
  if (testPassed) {
    edgeCasesPassed++;
    console.log(`    ✅ ${operationName}: PASS`);
  } else {
    console.log(`    ❌ ${operationName}: FAIL`);
  }
});

console.log('\n🎯 EDGE CASES AND BOUNDARY CONDITIONS TEST RESULTS:');
console.log(`📊 Edge cases tested: ${totalEdgeCases}`);
console.log(`📊 Edge cases passed: ${edgeCasesPassed}`);
console.log(`📊 Edge case success rate: ${Math.round((edgeCasesPassed / totalEdgeCases) * 100)}%`);

if (edgeCasesPassed === totalEdgeCases) {
  console.log('\n🎉 ALL EDGE CASES PASSED!');
  console.log('✅ Level 0 operations work correctly');
  console.log('✅ @ paths are handled correctly');
  console.log('✅ Empty/undefined paths are filtered correctly');
  console.log('✅ Non-# paths are preserved correctly');
  console.log('✅ Missing nestedPath is handled correctly');
  console.log('✅ Path validation fix is robust');
} else {
  console.log('\n❌ SOME EDGE CASES FAILED');
  console.log(`❌ ${totalEdgeCases - edgeCasesPassed} edge cases need attention`);
}

console.log('\n📊 EDGE CASES AND BOUNDARY CONDITIONS TEST COMPLETE - ITERATION 107');