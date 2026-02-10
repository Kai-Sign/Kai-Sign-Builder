#!/usr/bin/env node

// ITERATION 66 - Test with FIXED nestedPath construction
console.log('ITERATION 66 - Testing with FIXED nestedPath construction');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Extract executeBatch operation
function extractFunctions(data, path = '', level = 0) {
  const functions = [];
  if (data?.name && data?.params) {
    const paramTypes = Array.isArray(data.params) ? data.params.map((p) => {
      if (p.type === 'tuple' && p.components) {
        return `(${p.components.map((c) => c.type).join(',')})`;
      }
      return p.type;
    }).join(',') : '';
    const signature = `${data.name}(${paramTypes})`;
    
    functions.push({ name: data.name, signature, path, level, context: data });
  }
  
  if (data?.valueDecoded) {
    functions.push(...extractFunctions(data.valueDecoded, `${path}.valueDecoded`, level + 1));
  }
  if (data?.methodCall) {
    functions.push(...extractFunctions(data.methodCall, `${path}.methodCall`, level + 1));
  }
  if (Array.isArray(data?.params)) {
    data.params.forEach((param, i) => {
      const paramName = param.name || `param${i}`;
      functions.push(...extractFunctions(param, `${path}.${paramName}`, level + 1));
    });
  }
  if (Array.isArray(data?.components)) {
    data.components.forEach((comp, i) => {
      const compName = comp.name || `component${i}`;
      functions.push(...extractFunctions(comp, `${path}.${compName}`, level + 1));
    });
  }
  
  return functions;
}

const allFunctions = extractFunctions(transactionData);
const executeBatchOp = allFunctions.find(f => f.name === 'executeBatch');

console.log('ExecuteBatch operation found:');
console.log('  Path:', executeBatchOp.path);
console.log('  Level:', executeBatchOp.level);

// FIXED nestedPath construction
const adjustedLevel = executeBatchOp.path === 'methodCall' ? 0 : executeBatchOp.level;
let nestedPath = null;

if (adjustedLevel > 0) {
  // CORRECT: Remove 'methodCall.' prefix completely
  const cleanPath = executeBatchOp.path.replace(/^methodCall\\./, '');
  nestedPath = `#.${cleanPath}`;
}

console.log('  Adjusted Level:', adjustedLevel);
console.log('  FIXED NestedPath:', nestedPath);

// SmartPathResolver
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
      this.pathMap.set(fullPath, { path: fullPath, level, type: param.type, value: param.value });
      
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
    
    const pathParts = metadataPath.substring(2).split('.');
    let current = transaction.methodCall?.params;
    if (!current) return undefined;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (part === 'valueDecoded') {
        if (current?.valueDecoded) {
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
        
        current = param.components || param;
      } else if (current[part] !== undefined) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current?.value !== undefined ? current.value : current;
  }
}

const resolver = new SmartPathResolver();
resolver.analyzeTransaction(transactionData);

console.log(`\\nSmartPathResolver has ${resolver.pathMap.size} paths`);

// Test the FIXED paths
const metadataPaths = [
  '#.calls.calls.target',
  '#.calls.calls.data.valueDecoded.value',
  '#.calls.calls.data.valueDecoded.to'
];

console.log('\\nTesting FIXED nested path mapping:');
metadataPaths.forEach(path => {
  const pathWithoutHash = path.substring(2);
  const resolvedPath = `${nestedPath}.${pathWithoutHash}`;
  
  console.log(`${path} → ${resolvedPath}`);
  
  const inPathMap = resolver.pathMap.has(resolvedPath);
  const resolvedValue = resolver.resolveMetadataPath(transactionData, resolvedPath);
  
  console.log(`  In PathMap: ${inPathMap ? '✅' : '❌'}`);
  console.log(`  Resolves: ${resolvedValue !== undefined ? '✅' : '❌'} ${resolvedValue || '[undefined]'}`);
  console.log('');
});

// Test the format from metadata
const format = metadata.display.formats['executeBatch((tuple,tuple))'];
console.log('📱 Testing complete metadata format:');

let workingFields = 0;
format.fields.forEach((field, i) => {
  if (field.value) {
    console.log(`${i+1}. ${field.label}: "${field.value}" ✅`);
    workingFields++;
  } else if (field.path) {
    const pathWithoutHash = field.path.substring(2);
    const resolvedPath = `${nestedPath}.${pathWithoutHash}`;
    const resolvedValue = resolver.resolveMetadataPath(transactionData, resolvedPath);
    const works = resolvedValue !== undefined;
    
    console.log(`${i+1}. ${field.label}: ${resolvedValue || '[unmapped]'} ${works ? '✅' : '❌'}`);
    if (works) workingFields++;
  }
});

console.log(`\\nWorking fields: ${workingFields}/${format.fields.length}`);
console.log(`Success rate: ${Math.round((workingFields / format.fields.length) * 100)}%`);

if (workingFields === format.fields.length) {
  console.log('🎉 FIXED! ALL FIELDS WORKING!');
} else {
  console.log('❌ Still broken - need more investigation');
}