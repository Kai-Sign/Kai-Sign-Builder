#!/usr/bin/env node

// Test exact path resolution with the SmartPathResolver
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ITERATION 37 - EXACT PATH RESOLUTION TEST\n');

// Load sample data
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// SmartPathResolver logic (copied exactly from hardware viewer)
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
    // Handle # paths (methodCall parameters)
    if (!this.pathMap.has(metadataPath)) {
      console.log(`❌ Path not in pathMap: ${metadataPath}`);
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

const resolver = new SmartPathResolver();
resolver.analyzeTransaction(transactionData);

// Test the exact paths that should result from nested path mapping
const finalPaths = [
  '#.ops.ops.callData.valueDecoded.calls.calls.target.value',
  '#.ops.ops.callData.valueDecoded.calls.calls.target',
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.name',
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.params.value.value',
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.value',
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.to',
  '#.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.params.to.value'
];

console.log('Testing final combined paths:');
finalPaths.forEach(path => {
  const inPathMap = resolver.pathMap.has(path);
  const resolvedValue = resolver.resolveMetadataPath(transactionData, path);
  console.log(`${path}`);
  console.log(`  In PathMap: ${inPathMap ? '✅' : '❌'}`);
  console.log(`  Resolves to: ${resolvedValue !== undefined ? '✅' : '❌'} ${resolvedValue || '[undefined]'}`);
  console.log('');
});

console.log('🎯 PATHMAP ANALYSIS - Looking for patterns...');
console.log('Paths ending with .target:');
Array.from(resolver.pathMap.keys()).filter(p => p.includes('.target')).forEach(p => {
  const info = resolver.pathMap.get(p);
  console.log(`  ${p} → value: ${info.value}`);
});

console.log('\\nPaths containing .data.valueDecoded:');
Array.from(resolver.pathMap.keys()).filter(p => p.includes('.data.valueDecoded')).forEach(p => {
  const info = resolver.pathMap.get(p);
  console.log(`  ${p} → type: ${info.type}, hasDecoded: ${info.hasDecoded}`);
});

console.log('\\n🔍 ISSUE ANALYSIS:');
console.log('The pathMap contains paths without the final .value because:');
console.log('- .value is the property of the component object, not a separate parameter');
console.log('- The resolver should automatically extract .value when resolving');
console.log('\\nCorrect metadata paths should be:');
console.log('- #.ops.ops.callData.valueDecoded.calls.calls.target (resolver extracts .value)');
console.log('- #.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.to (resolver extracts .value)');
console.log('- #.ops.ops.callData.valueDecoded.calls.calls.data.valueDecoded.value (value is the param name)');