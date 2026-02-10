#!/usr/bin/env node

// Test how nestedPath is constructed for executeBatch
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ITERATION 35 - TESTING NESTED PATH CONSTRUCTION\n');

// Load sample data
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Function extraction logic from hardware viewer (simplified)
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

const allFunctionCalls = extractAllFunctionCalls(transactionData);

console.log('All function calls with paths:');
allFunctionCalls.forEach((call, index) => {
  console.log(`${index + 1}. ${call.signature}`);
  console.log(`   Path: ${call.path}`);
  console.log(`   Level: ${call.level}`);
  console.log('');
});

// Find executeBatch specifically  
const executeBatchCalls = allFunctionCalls.filter(call => call.name === 'executeBatch');
console.log(`\n🎯 ExecuteBatch operations: ${executeBatchCalls.length}`);

executeBatchCalls.forEach((call, index) => {
  console.log(`\nExecuteBatch ${index + 1}:`);
  console.log(`  Signature: ${call.signature}`);
  console.log(`  Path: ${call.path}`);
  console.log(`  Level: ${call.level}`);
  
  // Simulate nestedPath construction from hardware viewer
  const adjustedLevel = call.path === 'methodCall' ? 0 : call.level;
  let nestedPath = null;
  
  if (adjustedLevel > 0) {
    // Remove 'methodCall.' prefix and construct proper path
    const cleanPath = call.path.replace(/^methodCall\./, '');
    nestedPath = `#.${cleanPath}`;
  }
  
  console.log(`  Adjusted Level: ${adjustedLevel}`);
  console.log(`  Nested Path: ${nestedPath}`);
  
  // Test path mapping
  const testPath = '#.calls.calls.target.value';
  if (nestedPath) {
    const pathWithoutHash = testPath.substring(2);
    const resolvedPath = `${nestedPath}.${pathWithoutHash}`;
    console.log(`  Path Mapping: ${testPath} → ${resolvedPath}`);
  }
});

console.log('\n🔍 Expected executeBatch nestedPath should be:');
console.log('#.ops.ops.callData.valueDecoded');
console.log('So that #.calls.calls.target.value becomes:');
console.log('#.ops.ops.callData.valueDecoded.calls.calls.target.value');