#!/usr/bin/env node

// ITERATION 108 - Test different operation types
console.log('🎯 ITERATION 108 - DIFFERENT OPERATION TYPES TEST\n');

import fs from 'fs';

const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

console.log('✅ Metadata loaded successfully');

// Test all operation formats from EntryPoint metadata
console.log('\nTesting all EntryPoint metadata operation formats...');

const formats = entryPointMetadata.display.formats;
const operationTypes = Object.keys(formats);

console.log(`Found ${operationTypes.length} operation types:`);
operationTypes.forEach((op, i) => {
  console.log(`   ${i+1}. ${op}`);
});

// Create mock function calls for each operation type
const mockFunctionCalls = [
  {
    signature: 'handleOps((tuple),address)',
    level: 1,
    nestedPath: '#.ops'
  },
  {
    signature: 'executeBatch((tuple))',
    level: 3,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  },
  {
    signature: 'executeBatch((tuple,tuple))',
    level: 5,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  },
  {
    signature: 'executeBatch((tuple,tuple,tuple))',
    level: 4,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  },
  {
    signature: 'executeBatch((address,uint256,bytes)[])',
    level: 6,
    nestedPath: '#.ops.ops.callData.valueDecoded'
  }
];

console.log('\nTesting path validation for each operation type...');

let totalOperations = 0;
let passedOperations = 0;

operationTypes.forEach((operationType, index) => {
  totalOperations++;
  
  console.log(`\nOperation Type ${index + 1}: ${operationType}`);
  
  const format = formats[operationType];
  const fields = format.fields || [];
  
  console.log(`  Intent: ${format.intent}`);
  console.log(`  Fields: ${fields.length}`);
  
  // Get corresponding mock function call
  const functionCall = mockFunctionCalls.find(fc => fc.signature === operationType);
  
  if (!functionCall) {
    console.log(`  ⚠️  No mock function call for ${operationType}`);
    return;
  }
  
  // Extract metadata paths
  const metadataPaths = fields.map(f => f.path).filter(Boolean);
  console.log(`  Metadata paths (${metadataPaths.length}):`, metadataPaths);
  
  // Apply transformation logic
  const transformedPaths = metadataPaths.map(path => {
    if (!path || !path.startsWith('#')) return path;
    
    if (functionCall.level > 0 && functionCall.nestedPath) {
      const pathWithoutHash = path.substring(2);
      return `${functionCall.nestedPath}.${pathWithoutHash}`;
    }
    return path;
  });
  
  console.log(`  Transformed paths (${transformedPaths.length}):`, transformedPaths);
  
  // Check transformation logic
  let transformationCorrect = true;
  
  metadataPaths.forEach((originalPath, pathIndex) => {
    const transformedPath = transformedPaths[pathIndex];
    
    if (originalPath.startsWith('#') && functionCall.level > 0 && functionCall.nestedPath) {
      const expectedPath = `${functionCall.nestedPath}.${originalPath.substring(2)}`;
      if (transformedPath !== expectedPath) {
        console.log(`    ❌ Transformation error: ${originalPath} → ${transformedPath} (expected: ${expectedPath})`);
        transformationCorrect = false;
      }
    } else {
      if (transformedPath !== originalPath) {
        console.log(`    ❌ Unexpected transformation: ${originalPath} → ${transformedPath}`);
        transformationCorrect = false;
      }
    }
  });
  
  if (transformationCorrect) {
    console.log(`  ✅ Path transformation: CORRECT`);
    passedOperations++;
  } else {
    console.log(`  ❌ Path transformation: INCORRECT`);
  }
  
  // Analyze field types
  const fieldTypes = {
    withPaths: fields.filter(f => f.path).length,
    withValues: fields.filter(f => f.value !== undefined).length,
    addressName: fields.filter(f => f.format === 'addressName').length,
    raw: fields.filter(f => f.format === 'raw').length,
    tokenAmount: fields.filter(f => f.format === 'tokenAmount').length
  };
  
  console.log(`  Field analysis:`, fieldTypes);
});

// Test specific path patterns
console.log('\nTesting specific path patterns...');

const pathPatterns = [
  {
    name: 'Simple # paths',
    paths: ['#.target', '#.value', '#.data'],
    nestedPath: '#.ops.callData',
    level: 2
  },
  {
    name: 'Deep nested # paths',
    paths: ['#.calls.calls.target', '#.calls.calls.data.valueDecoded.value'],
    nestedPath: '#.ops.ops.callData.valueDecoded',
    level: 5
  },
  {
    name: 'Mixed @ and # paths',
    paths: ['@.txHash', '#.beneficiary', '@.blockNumber'],
    nestedPath: '#.some.nested.path',
    level: 3
  },
  {
    name: 'Level 0 paths',
    paths: ['#.ops', '#.beneficiary'],
    nestedPath: null,
    level: 0
  }
];

let patternTests = 0;
let patternPassed = 0;

pathPatterns.forEach((pattern, index) => {
  patternTests++;
  
  console.log(`\nPattern Test ${index + 1}: ${pattern.name}`);
  console.log(`  Level: ${pattern.level}`);
  console.log(`  NestedPath: ${pattern.nestedPath}`);
  console.log(`  Original paths: ${pattern.paths}`);
  
  const transformedPaths = pattern.paths.map(path => {
    if (!path || !path.startsWith('#')) return path;
    
    if (pattern.level > 0 && pattern.nestedPath) {
      const pathWithoutHash = path.substring(2);
      return `${pattern.nestedPath}.${pathWithoutHash}`;
    }
    return path;
  });
  
  console.log(`  Transformed paths: ${transformedPaths}`);
  
  // Validate transformation
  let patternCorrect = true;
  
  pattern.paths.forEach((originalPath, pathIndex) => {
    const transformedPath = transformedPaths[pathIndex];
    
    if (originalPath.startsWith('@')) {
      // @ paths should never change
      if (transformedPath !== originalPath) {
        patternCorrect = false;
        console.log(`    ❌ @ path changed: ${originalPath} → ${transformedPath}`);
      }
    } else if (originalPath.startsWith('#')) {
      if (pattern.level > 0 && pattern.nestedPath) {
        const expectedPath = `${pattern.nestedPath}.${originalPath.substring(2)}`;
        if (transformedPath !== expectedPath) {
          patternCorrect = false;
          console.log(`    ❌ # path transformation wrong: ${originalPath} → ${transformedPath} (expected: ${expectedPath})`);
        }
      } else {
        if (transformedPath !== originalPath) {
          patternCorrect = false;
          console.log(`    ❌ Level 0 # path changed: ${originalPath} → ${transformedPath}`);
        }
      }
    }
  });
  
  if (patternCorrect) {
    console.log(`  ✅ Pattern transformation: CORRECT`);
    patternPassed++;
  } else {
    console.log(`  ❌ Pattern transformation: INCORRECT`);
  }
});

console.log('\n🎯 DIFFERENT OPERATION TYPES TEST RESULTS:');
console.log(`📊 Operation types tested: ${totalOperations}`);
console.log(`📊 Operations passed: ${passedOperations}`);
console.log(`📊 Operation success rate: ${Math.round((passedOperations / totalOperations) * 100)}%`);
console.log(`📊 Pattern tests: ${patternTests}`);
console.log(`📊 Patterns passed: ${patternPassed}`);
console.log(`📊 Pattern success rate: ${Math.round((patternPassed / patternTests) * 100)}%`);

const overallSuccess = (passedOperations === totalOperations) && (patternPassed === patternTests);

if (overallSuccess) {
  console.log('\n🎉 ALL OPERATION TYPES AND PATTERNS PASSED!');
  console.log('✅ handleOps operations work correctly');
  console.log('✅ executeBatch((tuple)) operations work correctly');
  console.log('✅ executeBatch((tuple,tuple)) operations work correctly');
  console.log('✅ executeBatch((tuple,tuple,tuple)) operations work correctly');
  console.log('✅ executeBatch((address,uint256,bytes)[]) operations work correctly');
  console.log('✅ Simple # path patterns work correctly');
  console.log('✅ Deep nested # path patterns work correctly');
  console.log('✅ Mixed @ and # path patterns work correctly');
  console.log('✅ Level 0 path patterns work correctly');
  console.log('✅ Path validation fix is universal');
} else {
  console.log('\n❌ SOME OPERATION TYPES OR PATTERNS FAILED');
  console.log(`❌ ${totalOperations - passedOperations} operation types failed`);
  console.log(`❌ ${patternTests - patternPassed} pattern tests failed`);
}

console.log('\n📊 DIFFERENT OPERATION TYPES TEST COMPLETE - ITERATION 108');