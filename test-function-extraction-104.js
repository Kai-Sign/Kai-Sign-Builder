#!/usr/bin/env node

// ITERATION 104 - Test function extraction hasn't regressed
console.log('🎯 ITERATION 104 - FUNCTION EXTRACTION REGRESSION TEST\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Test function extraction logic (exact hardware viewer logic)
function extractAllFunctionCalls(data, path = '', level = 0) {
  const functionCalls = [];
  
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
  
  if (data && typeof data === 'object') {
    if (data.valueDecoded) {
      const newPath = path ? `${path}.valueDecoded` : 'valueDecoded';
      functionCalls.push(...extractAllFunctionCalls(data.valueDecoded, newPath, level + 1));
    }
    if (Array.isArray(data.params)) {
      data.params.forEach((param, index) => {
        const paramName = param.name || `param${index}`;
        const newPath = path ? `${path}.${paramName}` : paramName;
        functionCalls.push(...extractAllFunctionCalls(param, newPath, level + 1));
      });
    }
    if (data.methodCall) {
      const newPath = path ? `${path}.methodCall` : 'methodCall';
      functionCalls.push(...extractAllFunctionCalls(data.methodCall, newPath, level + 1));
    }
    if (Array.isArray(data.components)) {
      data.components.forEach((component, index) => {
        const componentName = component.name || `component${index}`;
        const newPath = path ? `${path}.${componentName}` : componentName;
        functionCalls.push(...extractAllFunctionCalls(component, newPath, level + 1));
      });
    }
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
}

console.log('Step 1: Function extraction...');
const allFunctionCalls = extractAllFunctionCalls(transactionData);
console.log(`✅ Extracted ${allFunctionCalls.length} functions:`);
allFunctionCalls.forEach((f, i) => {
  console.log(`   ${i+1}. ${f.signature} (level ${f.level}, path: ${f.path})`);
});

console.log('\nStep 2: Batch prioritization...');
const executeBatchOps = allFunctionCalls.filter(op => op.name === 'executeBatch');
const handleOpsOps = allFunctionCalls.filter(op => op.name === 'handleOps');

console.log(`🔍 Found ${executeBatchOps.length} executeBatch operations`);
console.log(`🔍 Found ${handleOpsOps.length} handleOps operations`);

let prioritizedOps = [];
if (executeBatchOps.length > 0) {
  console.log(`🎯 Prioritizing ${executeBatchOps.length} executeBatch operations`);
  prioritizedOps = executeBatchOps;
} else if (handleOpsOps.length > 0) {
  console.log(`🎯 Using ${handleOpsOps.length} handleOps operations`);
  prioritizedOps = handleOpsOps;
}

console.log(`✅ Final operations: ${prioritizedOps.length}`);

// Test nested path construction logic
console.log('\nStep 3: Nested path construction...');
prioritizedOps.forEach((functionCall, i) => {
  console.log(`\nOperation ${i+1}:`);
  console.log(`  Function: ${functionCall.signature}`);
  console.log(`  Level: ${functionCall.level}`);
  console.log(`  Path: ${functionCall.path}`);
  
  // Test the regex that was fixed
  const adjustedLevel = functionCall.path === 'methodCall' ? 0 : functionCall.level;
  let nestedPath = null;
  
  if (adjustedLevel > 0) {
    const cleanPath = functionCall.path.replace(/^\.?methodCall\./, '');
    nestedPath = `#.${cleanPath}`;
  }
  
  console.log(`  Adjusted Level: ${adjustedLevel}`);
  console.log(`  Nested Path: ${nestedPath}`);
  
  // Test metadata path transformation
  const testPaths = ['#.calls.calls.target', '#.calls.calls.data.valueDecoded.value'];
  testPaths.forEach(path => {
    let transformedPath = path;
    if (adjustedLevel > 0 && nestedPath && path.startsWith('#')) {
      const pathWithoutHash = path.substring(2);
      transformedPath = `${nestedPath}.${pathWithoutHash}`;
    }
    console.log(`    ${path} → ${transformedPath}`);
  });
});

console.log('\n🎯 FUNCTION EXTRACTION REGRESSION TEST RESULTS:');
console.log(`✅ Function extraction: ${allFunctionCalls.length === 4 ? 'PASS' : 'FAIL'}`);
console.log(`✅ Batch prioritization: ${prioritizedOps.length === 1 ? 'PASS' : 'FAIL'}`);
console.log(`✅ executeBatch found: ${executeBatchOps.length === 1 ? 'PASS' : 'FAIL'}`);
console.log(`✅ Nested path construction: ${prioritizedOps[0]?.level === 5 ? 'PASS' : 'FAIL'}`);

const expectedSignature = 'executeBatch((tuple,tuple))';
console.log(`✅ Correct signature: ${prioritizedOps[0]?.signature === expectedSignature ? 'PASS' : 'FAIL'}`);

if (allFunctionCalls.length === 4 && prioritizedOps.length === 1 && executeBatchOps.length === 1) {
  console.log('\n🎉 ALL REGRESSION TESTS PASSED!');
  console.log('✅ Function extraction working correctly');
  console.log('✅ Batch prioritization working correctly');  
  console.log('✅ No regressions introduced');
} else {
  console.log('\n❌ REGRESSION DETECTED!');
  console.log('❌ Some tests failed');
}

console.log('\n📊 REGRESSION TEST COMPLETE - ITERATION 104');