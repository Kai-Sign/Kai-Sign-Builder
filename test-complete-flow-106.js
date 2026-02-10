#!/usr/bin/env node

// ITERATION 106 - Complete end-to-end flow test
console.log('🎯 ITERATION 106 - COMPLETE END-TO-END FLOW TEST\n');

import fs from 'fs';

// Load all data
const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));
const usdcMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/erc7730-usdc-mainnet.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('✅ Data loaded successfully');

// Function extraction
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

console.log('\nStep 1: Function extraction...');
const allFunctionCalls = extractAllFunctionCalls(transactionData);
console.log(`✅ Extracted ${allFunctionCalls.length} functions`);

// Batch prioritization
console.log('\nStep 2: Batch prioritization...');
const executeBatchOps = allFunctionCalls.filter(op => op.name === 'executeBatch');
const handleOpsOps = allFunctionCalls.filter(op => op.name === 'handleOps');

let prioritizedOps = [];
if (executeBatchOps.length > 0) {
  prioritizedOps = executeBatchOps;
} else if (handleOpsOps.length > 0) {
  prioritizedOps = handleOpsOps;
}
console.log(`✅ Prioritized ${prioritizedOps.length} operations`);

// Metadata matching
console.log('\nStep 3: Metadata matching...');
const metadataEntries = [
  { id: 'entrypoint', metadata: entryPointMetadata },
  { id: 'usdc', metadata: usdcMetadata }
];

const operations = [];

prioritizedOps.forEach((functionCall) => {
  const signature = functionCall.signature;
  
  for (const entry of metadataEntries) {
    const formats = entry.metadata.display?.formats || {};
    if (formats[signature]) {
      const format = formats[signature];
      
      const adjustedLevel = functionCall.path === 'methodCall' ? 0 : functionCall.level;
      let nestedPath = null;
      
      if (adjustedLevel > 0) {
        const cleanPath = functionCall.path.replace(/^\.?methodCall\./, '');
        nestedPath = `#.${cleanPath}`;
      }
      
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
      
      break;
    }
  }
});

console.log(`✅ Created ${operations.length} operations`);

// SmartPathResolver
console.log('\nStep 4: SmartPathResolver initialization...');
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
console.log(`✅ PathMap initialized with ${smartPathResolver.pathMap.size} paths`);

// NEW path validation logic (with transformation)
console.log('\nStep 5: Path validation with transformation...');
operations.forEach((operation, opIndex) => {
  console.log(`\nOperation ${opIndex + 1}: ${operation.operation}`);
  
  // Extract metadata paths
  const metadataPaths = operation.fields.map(f => f.path).filter(Boolean);
  console.log(`  Original metadata paths: ${metadataPaths.length}`);
  
  // Transform metadata paths for nested operations
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
  
  console.log(`  ✅ Valid transformed paths: ${validPaths.length}`);
  console.log(`  ❌ Invalid transformed paths: ${invalidPaths.length}`);
  
  if (invalidPaths.length > 0) {
    console.log(`     Invalid paths:`, invalidPaths);
  }
});

// Field value resolution
console.log('\nStep 6: Field value resolution...');
function getFieldValueFromTransaction(path, format, field, operation) {
  if (field && 'value' in field && field.value !== undefined) {
    return field.value.toString();
  }
  
  if (!transactionData || !smartPathResolver) {
    return `Mock ${format} value`;
  }
  
  let resolvedPath = path;
  
  if (path.startsWith('@')) {
    resolvedPath = path;
  } else if (operation.functionCall?.level === 0) {
    resolvedPath = path;
  } else if (operation.functionCall?.level > 0 && operation.functionCall?.nestedPath && path.startsWith('#')) {
    const pathWithoutHash = path.substring(2);
    resolvedPath = `${operation.functionCall.nestedPath}.${pathWithoutHash}`;
  } else {
    resolvedPath = path;
  }
  
  const value = smartPathResolver.resolveMetadataPath(transactionData, resolvedPath);
  
  if (value === undefined) {
    return "[unmapped]";
  }
  
  return value.toString();
}

let totalFields = 0;
let workingFields = 0;

operations.forEach((operation, opIndex) => {
  console.log(`\nOperation ${opIndex + 1}: ${operation.operation}`);
  
  operation.fields.forEach((field, fieldIndex) => {
    totalFields++;
    const label = field.label;
    const format = field.format || "raw";
    const path = field.path || "";
    
    const displayValue = getFieldValueFromTransaction(path, format, field, operation);
    const isWorking = displayValue !== "[unmapped]";
    
    console.log(`   ${fieldIndex + 1}. ${label}: ${displayValue} ${isWorking ? '✅' : '❌'}`);
    
    if (isWorking) workingFields++;
  });
});

console.log('\n🎯 COMPLETE END-TO-END FLOW TEST RESULTS:');
console.log(`📊 Function extraction: ${allFunctionCalls.length} functions extracted`);
console.log(`📊 Batch prioritization: ${prioritizedOps.length} operations prioritized`);
console.log(`📊 Metadata matching: ${operations.length} operations matched`);
console.log(`📊 Path resolution: ${smartPathResolver.pathMap.size} paths available`);
console.log(`📊 Field validation: ${totalFields} total fields`);
console.log(`📊 Working fields: ${workingFields} fields resolving correctly`);
console.log(`📊 Success rate: ${Math.round((workingFields / totalFields) * 100)}%`);

const allPassing = workingFields === totalFields && 
                   allFunctionCalls.length === 4 && 
                   prioritizedOps.length === 1 && 
                   operations.length === 1 &&
                   smartPathResolver.pathMap.size === 19;

if (allPassing) {
  console.log('\n🎉 COMPLETE END-TO-END SUCCESS!');
  console.log('✅ Function extraction: WORKING');
  console.log('✅ Batch prioritization: WORKING');  
  console.log('✅ Metadata matching: WORKING');
  console.log('✅ SmartPathResolver: WORKING');
  console.log('✅ Path validation with transformation: WORKING');
  console.log('✅ Field value resolution: WORKING');
  console.log('✅ All metadata paths resolve correctly');
  console.log('✅ No [unmapped] values');
  console.log('✅ PATH VALIDATION FIX FULLY VERIFIED');
} else {
  console.log('\n❌ ISSUES STILL REMAIN');
  console.log(`❌ ${totalFields - workingFields} fields not working`);
}

console.log('\n📊 COMPLETE END-TO-END FLOW TEST COMPLETE - ITERATION 106');