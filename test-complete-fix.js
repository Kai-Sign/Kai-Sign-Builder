#!/usr/bin/env node

// ITERATION 71 - Test complete workflow with the regex fix
console.log('ITERATION 71 - Testing complete workflow with regex fix');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// Extract executeBatch operation with EXACT logic
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
const executeBatchOps = allFunctionCalls.filter(op => op.name === 'executeBatch');
const executeBatchOp = executeBatchOps[0];

console.log('ExecuteBatch operation:');
console.log('  Path:', executeBatchOp.path);
console.log('  Level:', executeBatchOp.level);

// FIXED nestedPath construction with corrected regex
const adjustedLevel = executeBatchOp.path === 'methodCall' ? 0 : executeBatchOp.level;
let nestedPath = null;

if (adjustedLevel > 0) {
  // FIXED: Use the corrected regex that handles leading dot
  const cleanPath = executeBatchOp.path.replace(/^\.?methodCall\./, '');
  nestedPath = `#.${cleanPath}`;
}

console.log('  Adjusted Level:', adjustedLevel);
console.log('  FIXED NestedPath:', nestedPath);

// SmartPathResolver (EXACT from hardware viewer)
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
    if (!this.pathMap.has(metadataPath)) {
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

console.log(`\\nSmartPathResolver built with ${resolver.pathMap.size} paths`);

// Test field resolution with FIXED nested path mapping
function getFieldValueFromTransaction(path, format, field) {
  // Handle static values
  if (field && 'value' in field && field.value !== undefined) {
    return field.value.toString();
  }
  
  if (!transactionData || !resolver) {
    return `Mock ${format} value`;
  }
  
  // FIXED nested context path resolution 
  let resolvedPath = path;
  
  if (path.startsWith('@')) {
    resolvedPath = path;
  } else if (adjustedLevel === 0) {
    resolvedPath = path;
  } else if (adjustedLevel > 0 && nestedPath && path.startsWith('#')) {
    const pathWithoutHash = path.substring(2);
    resolvedPath = `${nestedPath}.${pathWithoutHash}`;
    console.log(`    🔗 Nested path mapping: ${path} → ${resolvedPath}`);
  } else {
    resolvedPath = path;
  }
  
  // Use smart resolver to get value
  const value = resolver.resolveMetadataPath(transactionData, resolvedPath);
  
  if (value === undefined) {
    console.log(`    ❌ Path resolution failed: ${resolvedPath}`);
    return "[unmapped]";
  }
  
  // Format the value
  switch (format) {
    case "addressName":
      return value.toString();
    default:
      return value.toString();
  }
}

// Test the complete metadata format
const format = metadata.display.formats['executeBatch((tuple,tuple))'];
console.log('\\n📱 Testing complete operation with FIXED paths:');
console.log('Intent:', format.intent);

let workingFields = 0;
format.fields.forEach((field, i) => {
  const label = field.label;
  const fieldFormat = field.format || "raw";
  const path = field.path || "";
  
  const displayValue = getFieldValueFromTransaction(path, fieldFormat, field);
  const isWorking = displayValue !== "[unmapped]";
  
  console.log(`${i+1}. ${label}: ${displayValue} ${isWorking ? '✅' : '❌'}`);
  
  if (isWorking) workingFields++;
});

console.log(`\\n🎯 FIXED WORKFLOW RESULTS:`);
console.log(`Working fields: ${workingFields}/${format.fields.length}`);
console.log(`Success rate: ${Math.round((workingFields / format.fields.length) * 100)}%`);

if (workingFields === format.fields.length) {
  console.log('\\n🎉 COMPLETELY FIXED!');
  console.log('✅ All metadata paths resolve correctly');
  console.log('✅ Nested path mapping works');
  console.log('✅ No [unmapped] values');
  console.log('✅ Regex fix successful');
  console.log('✅ Hardware viewer should work correctly now');
} else {
  console.log('\\n❌ Still broken - more investigation needed');
}