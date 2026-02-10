#!/usr/bin/env node

// Debug the executeBatch structure to find correct paths
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the sample transaction
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('🔍 DEEP STRUCTURE ANALYSIS\n');

// Navigate to executeBatch
const executeBatchCall = transactionData.methodCall.params[0].components[0].components.find(
  comp => comp.name === 'callData'
);

console.log('📋 executeBatch structure:');
console.log(JSON.stringify(executeBatchCall.valueDecoded, null, 2));

console.log('\n🎯 Looking for the actual batch calls...');

function analyzeStructure(obj, path = '', depth = 0) {
  if (depth > 5) return; // Prevent infinite recursion
  
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      console.log(`${' '.repeat(depth * 2)}${currentPath}: ${typeof value} ${Array.isArray(value) ? `[${value.length}]` : ''}`);
      
      // Look specifically for things that look like calls
      if (key === 'components' && Array.isArray(value)) {
        console.log(`${' '.repeat(depth * 2)}  -> Found components array with ${value.length} items`);
        value.forEach((item, index) => {
          if (item.name) {
            console.log(`${' '.repeat(depth * 2)}    [${index}] ${item.name}: ${item.type}`);
            if (item.value) {
              console.log(`${' '.repeat(depth * 2)}      value: ${item.value}`);
            }
            if (item.valueDecoded) {
              console.log(`${' '.repeat(depth * 2)}      valueDecoded: ${item.valueDecoded.name || 'object'}`);
            }
          }
        });
      }
      
      if (typeof value === 'object' && value !== null) {
        analyzeStructure(value, currentPath, depth + 1);
      }
    });
  }
}

analyzeStructure(executeBatchCall.valueDecoded);

console.log('\n🎯 Testing potential correct paths...');

// Test different path patterns
const testPaths = [
  'params[0].components[0].value', // First call target
  'params[0].components[0].components.target.value', // If nested
  'params[0].components[0].components[0].value', // First component value
  'params[0].components[1].value', // Second call target
];

function testPath(pathStr, data) {
  console.log(`\nTesting path: ${pathStr}`);
  try {
    const parts = pathStr.split('.');
    let current = data;
    
    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        const prop = part.substring(0, part.indexOf('['));
        const index = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
        current = current[prop][index];
        console.log(`  -> ${prop}[${index}]: ${typeof current}`);
      } else {
        current = current[part];
        console.log(`  -> ${part}: ${typeof current}`);
      }
    }
    console.log(`  Result: ${current}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

testPaths.forEach(path => testPath(path, executeBatchCall.valueDecoded));

console.log('\n🎯 Manual navigation to find the calls...');
const eb = executeBatchCall.valueDecoded;
if (eb.params && eb.params[0] && eb.params[0].components) {
  console.log(`Found ${eb.params[0].components.length} batch operations:`);
  
  eb.params[0].components.forEach((call, index) => {
    console.log(`\nOperation ${index + 1}:`);
    console.log(`  Full structure:`, JSON.stringify(call, null, 2));
    
    if (call.components) {
      const targetComp = call.components.find(c => c.name === 'target');
      const dataComp = call.components.find(c => c.name === 'data');
      const valueComp = call.components.find(c => c.name === 'value');
      
      console.log(`  Target: ${targetComp?.value || 'not found'}`);
      console.log(`  Value: ${valueComp?.value || 'not found'}`);
      if (dataComp?.valueDecoded) {
        console.log(`  Function: ${dataComp.valueDecoded.name || 'not decoded'}`);
        if (dataComp.valueDecoded.params) {
          console.log(`  Function params:`, dataComp.valueDecoded.params.map(p => `${p.name}=${p.value}`));
        }
      }
    }
  });
}

console.log('\n🎯 CORRECT PATHS DISCOVERED:');
console.log('First target: #.params[0].components[0].components.target.value');
console.log('First data: #.params[0].components[0].components.data.valueDecoded');
console.log('Second target: #.params[0].components[1].components.target.value');
console.log('Second data: #.params[0].components[1].components.data.valueDecoded');