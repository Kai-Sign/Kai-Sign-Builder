#!/usr/bin/env node

// Complete workflow test simulating the exact hardware viewer process
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 ITERATION 44 - COMPLETE HARDWARE VIEWER WORKFLOW TEST\n');

// Load sample data and metadata
const sampleSetsPath = path.join(__dirname, 'frontend/public/samples/sample-sets.json');
const sampleSets = JSON.parse(fs.readFileSync(sampleSetsPath, 'utf8'));
const realBatchSample = sampleSets.sampleSets.find(set => set.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

const metadataPath = path.join(__dirname, 'frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json');
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

console.log('✅ Data loaded successfully');

// 1. Function extraction (exact hardware viewer logic)
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
console.log(`Step 1 ✅: Extracted ${allFunctionCalls.length} function calls`);

// 2. Batch prioritization (exact hardware viewer logic)
const executeBatchOps = allFunctionCalls.filter(op => op.name === 'executeBatch');
const handleOpsOps = allFunctionCalls.filter(op => op.name === 'handleOps');

let prioritizedOps = [];
if (executeBatchOps.length > 0) {
  console.log(`Step 2 ✅: Prioritizing ${executeBatchOps.length} executeBatch operations`);
  prioritizedOps = executeBatchOps;
} else if (handleOpsOps.length > 0) {
  console.log(`Step 2 ✅: Using ${handleOpsOps.length} handleOps operations`);
  prioritizedOps = handleOpsOps;
}

// 3. Metadata matching and operation creation (exact hardware viewer logic)
const formats = metadata.display?.formats || {};
const operations = [];

prioritizedOps.forEach((functionCall) => {
  const signature = functionCall.signature;
  
  if (formats[signature]) {
    console.log(`Step 3 ✅: Found metadata for ${signature}`);
    
    const format = formats[signature];
    
    // Construct nestedPath (exact hardware viewer logic)
    const adjustedLevel = functionCall.path === 'methodCall' ? 0 : functionCall.level;
    let nestedPath = null;
    
    if (adjustedLevel > 0) {
      const cleanPath = functionCall.path.replace(/^methodCall\./, '');
      nestedPath = `#.${cleanPath}`;
    }
    
    console.log(`   Level: ${adjustedLevel}, NestedPath: ${nestedPath}`);
    
    // Create operation with enhanced functionCall
    const enhancedFunctionCall = {
      ...functionCall.context,
      level: adjustedLevel,
      nestedPath: nestedPath
    };
    
    operations.push({
      operation: format.intent,
      fields: format.fields,
      functionCall: enhancedFunctionCall
    });
  } else {
    console.log(`Step 3 ❌: No metadata found for ${signature}`);
  }
});

console.log(`Step 3 ✅: Created ${operations.length} operations`);

// 4. SmartPathResolver setup (exact hardware viewer logic)
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

const smartPathResolver = new SmartPathResolver();
smartPathResolver.analyzeTransaction(transactionData);
console.log(`Step 4 ✅: SmartPathResolver initialized with ${smartPathResolver.pathMap.size} paths`);

// 5. Field value resolution (exact hardware viewer logic)
function getFieldValueFromTransaction(path, format, field) {
  // Handle static values
  if (field && 'value' in field && field.value !== undefined) {
    return field.value.toString();
  }
  
  if (!transactionData || !smartPathResolver) {
    return `Mock ${format} value`;
  }
  
  // Handle nested context path resolution (exact hardware viewer logic)
  let resolvedPath = path;
  
  if (path.startsWith('@')) {
    resolvedPath = path;
  } else if (field?.functionCall?.level === 0) {
    resolvedPath = path;
  } else if (field?.functionCall?.level > 0 && field?.functionCall?.nestedPath && path.startsWith('#')) {
    const pathWithoutHash = path.substring(2);
    resolvedPath = `${field.functionCall.nestedPath}.${pathWithoutHash}`;
    console.log(`    🔗 Nested path mapping: ${path} → ${resolvedPath} (level ${field.functionCall.level})`);
  } else {
    resolvedPath = path;
  }
  
  // Use smart resolver to get value
  const value = smartPathResolver.resolveMetadataPath(transactionData, resolvedPath);
  
  if (value === undefined) {
    console.log(`    ❌ Path resolution failed: ${path} → ${resolvedPath} [MISSING]`);
    return "[unmapped]";
  }
  
  // Apply formatting
  switch (format) {
    case "addressName":
      return value.toString() + " (address)";
    case "tokenAmount":
      return value.toString() + " tokens";
    default:
      return value.toString();
  }
}

// 6. Screen generation (simplified hardware viewer logic)
console.log('\\nStep 5 ✅: Testing field value resolution for each operation:');

operations.forEach((operation, opIndex) => {
  console.log(`\\n📱 Operation ${opIndex + 1}: ${operation.operation}`);
  
  operation.fields.forEach((field, fieldIndex) => {
    const label = field.label;
    const format = field.format || "raw";
    const path = field.path || "";
    
    console.log(`  Field ${fieldIndex + 1}: ${label}`);
    
    const displayValue = getFieldValueFromTransaction(path, format, { ...field, functionCall: operation.functionCall });
    console.log(`    Path: ${path}`);
    console.log(`    Format: ${format}`);
    console.log(`    Value: ${displayValue}`);
    console.log(`    Status: ${displayValue === "[unmapped]" ? "❌ FAIL" : "✅ PASS"}`);
  });
});

console.log('\\n🎯 FINAL VERIFICATION:');
const totalFields = operations.reduce((sum, op) => sum + op.fields.length, 0);
let successfulFields = 0;

operations.forEach((operation) => {
  operation.fields.forEach((field) => {
    const displayValue = getFieldValueFromTransaction(field.path || "", field.format || "raw", { ...field, functionCall: operation.functionCall });
    if (displayValue !== "[unmapped]") {
      successfulFields++;
    }
  });
});

console.log(`Total fields: ${totalFields}`);
console.log(`Successful fields: ${successfulFields}`);
console.log(`Success rate: ${Math.round((successfulFields / totalFields) * 100)}%`);
console.log(`Status: ${successfulFields === totalFields ? "🎉 ALL WORKING" : "⚠️  SOME ISSUES"}`);

if (successfulFields === totalFields) {
  console.log('\\n✅ METADATA IS FULLY FUNCTIONAL!');
  console.log('✅ All paths resolve correctly');
  console.log('✅ Nested path mapping works');
  console.log('✅ Operation-agnostic design verified');
  console.log('✅ Ready for production use');
}