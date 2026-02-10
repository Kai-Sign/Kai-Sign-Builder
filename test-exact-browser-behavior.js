#!/usr/bin/env node

// ITERATION 64 - Test EXACT browser behavior simulation
console.log('ITERATION 64 - Simulating EXACT browser behavior');

import fs from 'fs';

// Load all the data the browser would load
const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));
const usdcMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/erc7730-usdc-mainnet.json', 'utf8'));

console.log('✅ Loaded all metadata files');

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('✅ Loaded transaction data');

// EXACT function extraction logic from hardwareViewer.tsx
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

console.log('\\n🔍 Step 1: Function extraction');
const allFunctionCalls = extractAllFunctionCalls(transactionData);
console.log('Functions found:', allFunctionCalls.length);
allFunctionCalls.forEach((f, i) => console.log(`${i+1}. ${f.signature}`));

console.log('\\n🔍 Step 2: Batch prioritization (EXACT logic)');
const executeBatchOps = allFunctionCalls.filter(op => op.name === 'executeBatch');
const handleOpsOps = allFunctionCalls.filter(op => op.name === 'handleOps');

let prioritizedOps = [];
if (executeBatchOps.length > 0) {
  console.log(`🎯 Prioritizing executeBatch operations only`);
  prioritizedOps = executeBatchOps;
} else if (handleOpsOps.length > 0) {
  console.log(`Using handleOps operations`);
  prioritizedOps = handleOpsOps;
}

console.log('Operations to display:', prioritizedOps.length);

console.log('\\n🔍 Step 3: Metadata matching');
const metadataEntries = [
  { id: 'entrypoint', metadata },
  { id: 'usdc', metadata: usdcMetadata }
];

const operations = [];

prioritizedOps.forEach((functionCall) => {
  const signature = functionCall.signature;
  
  // Find matching metadata
  for (const entry of metadataEntries) {
    const formats = entry.metadata.display?.formats || {};
    if (formats[signature]) {
      console.log(`✅ Found metadata for ${signature} in ${entry.id}`);
      
      const format = formats[signature];
      
      // Construct nestedPath (EXACT logic from hardwareViewer.tsx)
      const adjustedLevel = functionCall.path === 'methodCall' ? 0 : functionCall.level;
      let nestedPath = null;
      
      if (adjustedLevel > 0) {
        const cleanPath = functionCall.path.replace(/^methodCall\\./, '');
        nestedPath = `#.${cleanPath}`;
      }
      
      console.log(`   Level: ${adjustedLevel}, NestedPath: ${nestedPath}`);
      
      const enhancedFunctionCall = {
        ...functionCall.context,
        level: adjustedLevel,
        nestedPath: nestedPath
      };
      
      operations.push({
        operation: format.intent,
        fields: format.fields,
        functionCall: enhancedFunctionCall,
        metadata: entry.metadata
      });
      
      break; // Found match, stop looking
    }
  }
});

console.log('Operations created:', operations.length);

console.log('\\n🔍 Step 4: SmartPathResolver (EXACT logic)');
class SmartPathResolver {
  constructor() {
    this.pathMap = new Map();
  }
  
  analyzeTransaction(transaction) {
    this.pathMap.clear();
    if (!transaction.methodCall?.params) return;
    this.buildPathMap(transaction.methodCall.params, '', 0);
    console.log(`PathMap built with ${this.pathMap.size} paths`);
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

const smartPathResolver = new SmartPathResolver();
smartPathResolver.analyzeTransaction(transactionData);

console.log('\\n🔍 Step 5: Field value resolution (EXACT logic)');
function getFieldValueFromTransaction(path, format, field, operation) {
  // Handle static values (EXACT logic from hardwareViewer.tsx)
  if (field && 'value' in field && field.value !== undefined) {
    return field.value.toString();
  }
  
  if (!transactionData || !smartPathResolver) {
    return `Mock ${format} value`;
  }
  
  // Handle nested context path resolution (EXACT logic)
  let resolvedPath = path;
  
  if (path.startsWith('@')) {
    resolvedPath = path;
  } else if (operation.functionCall?.level === 0) {
    resolvedPath = path;
  } else if (operation.functionCall?.level > 0 && operation.functionCall?.nestedPath && path.startsWith('#')) {
    const pathWithoutHash = path.substring(2);
    resolvedPath = `${operation.functionCall.nestedPath}.${pathWithoutHash}`;
    console.log(`    🔗 Nested path mapping: ${path} → ${resolvedPath}`);
  } else {
    resolvedPath = path;
  }
  
  // Use smart resolver to get value
  const value = smartPathResolver.resolveMetadataPath(transactionData, resolvedPath);
  
  if (value === undefined) {
    console.log(`    ❌ Path resolution failed: ${resolvedPath}`);
    return "[unmapped]";
  }
  
  // Apply formatting (simplified)
  switch (format) {
    case "addressName":
      return value.toString();
    default:
      return value.toString();
  }
}

console.log('\\n🔍 Step 6: Testing all operations and fields');
let totalFields = 0;
let workingFields = 0;

operations.forEach((operation, opIndex) => {
  console.log(`\\n📱 Operation ${opIndex + 1}: ${operation.operation}`);
  
  operation.fields.forEach((field, fieldIndex) => {
    totalFields++;
    const label = field.label;
    const format = field.format || "raw";
    const path = field.path || "";
    
    const displayValue = getFieldValueFromTransaction(path, format, field, operation);
    const isWorking = displayValue !== "[unmapped]";
    
    console.log(`  ${fieldIndex + 1}. ${label}: ${displayValue} ${isWorking ? '✅' : '❌'}`);
    
    if (isWorking) workingFields++;
  });
});

console.log('\\n🎯 FINAL BROWSER SIMULATION RESULTS:');
console.log(`Total fields: ${totalFields}`);
console.log(`Working fields: ${workingFields}`);
console.log(`Success rate: ${Math.round((workingFields / totalFields) * 100)}%`);

if (workingFields === totalFields) {
  console.log('🎉 BROWSER SIMULATION: ALL WORKING!');
  console.log('✅ Hardware viewer should display correctly');
  console.log('✅ No [unmapped] values');
  console.log('✅ Batch operations prioritized');
  console.log('✅ Metadata paths resolve correctly');
} else {
  console.log('❌ BROWSER SIMULATION: STILL BROKEN!');
  console.log(`❌ ${totalFields - workingFields} fields not working`);
}