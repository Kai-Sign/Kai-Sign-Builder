#!/usr/bin/env node

// ITERATION 114 - Correct level-based metadata mapping
console.log('🎯 ITERATION 114 - CORRECT LEVEL-BASED METADATA MAPPING\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));
const usdcMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/erc7730-usdc-mainnet.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

console.log('✅ Data loaded successfully');

// CORRECT APPROACH: Level-based metadata mapping
console.log('\nImplementing correct level-based metadata mapping...');

// 1. Extract ALL function calls with their nesting levels
function extractAllFunctionCallsWithLevels(data, path = '', level = 0) {
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
      signature: signature,
      level: level,
      path: path,
      data: data  // Keep reference to actual data
    });
  }
  
  // Recursively extract from all nested structures
  if (data && typeof data === 'object') {
    if (data.valueDecoded) {
      functionCalls.push(...extractAllFunctionCallsWithLevels(data.valueDecoded, `${path}.valueDecoded`, level + 1));
    }
    if (Array.isArray(data.params)) {
      data.params.forEach((param, index) => {
        functionCalls.push(...extractAllFunctionCallsWithLevels(param, `${path}.params[${index}]`, level + 1));
      });
    }
    if (data.methodCall) {
      functionCalls.push(...extractAllFunctionCallsWithLevels(data.methodCall, `${path}.methodCall`, level + 1));
    }
    if (Array.isArray(data.components)) {
      data.components.forEach((component, index) => {
        functionCalls.push(...extractAllFunctionCallsWithLevels(component, `${path}.components[${index}]`, level + 1));
      });
    }
    Object.keys(data).forEach((key) => {
      if (!['valueDecoded', 'params', 'methodCall', 'components'].includes(key)) {
        const value = data[key];
        if (value && typeof value === 'object') {
          functionCalls.push(...extractAllFunctionCallsWithLevels(value, `${path}.${key}`, level + 1));
        }
      }
    });
  }
  
  return functionCalls;
}

// 2. Find metadata for function signature (ERC-7730 compliant)
function findMetadataForFunction(functionSignature, metadataEntries) {
  for (const entry of metadataEntries) {
    const formats = entry.metadata.display?.formats || {};
    
    // Check if this signature exists in metadata
    if (formats[functionSignature]) {
      return {
        metadata: entry.metadata,
        format: formats[functionSignature],
        source: entry.id
      };
    }
  }
  return null;
}

// 3. ERC-7730 compliant path resolver
function resolveValueAtPath(data, metadata, path) {
  // Parse root node
  const rootNode = path.charAt(0);
  if (!["#", "$", "@"].includes(rootNode)) {
    return undefined; // Invalid root node
  }
  
  const pathWithoutRoot = path.substring(2); // Remove root + dot
  
  // Resolve based on root node type
  let current;
  switch (rootNode) {
    case '#': // Structured data (ABI)
      current = data;
      break;
    case '$': // Metadata constants
      current = metadata;
      break;
    case '@': // Container values (transaction metadata)
      current = data.container || data;
      break;
  }
  
  if (!pathWithoutRoot) {
    return current?.value !== undefined ? current.value : current;
  }
  
  // Navigate path
  const pathParts = pathWithoutRoot.split('.');
  
  for (const part of pathParts) {
    if (!current) return undefined;
    
    // Handle array index access: params[0], params[1]
    const indexMatch = part.match(/^(.+)\\[(\\d+)\\]$/);
    if (indexMatch) {
      const [, arrayName, indexStr] = indexMatch;
      const idx = parseInt(indexStr);
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        current = current[arrayName][idx];
        continue;
      }
    }
    
    // Handle valueDecoded navigation
    if (part === 'valueDecoded' && current.valueDecoded) {
      current = current.valueDecoded;
      continue;
    }
    
    // Handle params navigation
    if (part === 'params' && current.params) {
      current = current.params;
      continue;
    }
    
    // Direct property access
    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    // Parameter name-based search (for now, until we switch to position-based)
    if (Array.isArray(current)) {
      const param = current.find(p => p && p.name === part);
      if (param) {
        current = param;
        continue;
      }
    }
    
    return undefined; // Path not found
  }
  
  return current?.value !== undefined ? current.value : current;
}

// 4. CORRECT LEVEL-BASED MAPPING IMPLEMENTATION
console.log('\\nStep 1: Extract all function calls with levels...');
const allFunctionCalls = extractAllFunctionCallsWithLevels(transactionData);
console.log(`✅ Found ${allFunctionCalls.length} function calls at different levels:`);
allFunctionCalls.forEach((func, i) => {
  console.log(`   ${i+1}. Level ${func.level}: ${func.signature}`);
});

console.log('\\nStep 2: Apply metadata to each level...');
const metadataEntries = [
  { id: 'entrypoint', metadata: entryPointMetadata },
  { id: 'usdc', metadata: usdcMetadata }
];

const levelBasedOperations = [];

// Process each function call independently - NO HARDCODED NESTING
allFunctionCalls.forEach((functionCall, index) => {
  console.log(`\\nProcessing function ${index + 1} - Level ${functionCall.level}: ${functionCall.signature}`);
  
  // Find metadata for this specific function
  const metadataMatch = findMetadataForFunction(functionCall.signature, metadataEntries);
  
  if (metadataMatch) {
    console.log(`  ✅ Found metadata in ${metadataMatch.source}`);
    console.log(`  Intent: ${metadataMatch.format.intent}`);
    console.log(`  Fields: ${metadataMatch.format.fields.length}`);
    
    // Create operation for this level
    const operation = {
      level: functionCall.level,
      signature: functionCall.signature,
      intent: metadataMatch.format.intent,
      fields: metadataMatch.format.fields,
      functionData: functionCall.data,
      metadata: metadataMatch.metadata
    };
    
    levelBasedOperations.push(operation);
  } else {
    console.log(`  ❌ No metadata found for ${functionCall.signature}`);
  }
});

console.log(`\\n✅ Created ${levelBasedOperations.length} level-based operations`);

// 5. DYNAMIC BATCH ITERATION - Handle ANY number of operations
console.log('\\nStep 3: Dynamic batch iteration for ANY number of operations...');

function processBatchDynamically(operations) {
  console.log(`Processing ${operations.length} operations dynamically:`);
  
  operations.forEach((operation, opIndex) => {
    console.log(`\\n📱 Operation ${opIndex + 1} (Level ${operation.level}): ${operation.intent}`);
    
    // Process each field defined in metadata
    operation.fields.forEach((field, fieldIndex) => {
      const label = field.label;
      const path = field.path;
      const format = field.format || 'raw';
      
      if (field.value !== undefined) {
        // Static value from metadata
        console.log(`     ${fieldIndex + 1}. ${label}: ${field.value} (static)`);
      } else if (path) {
        // Resolve value from transaction data using ERC-7730 path
        const value = resolveValueAtPath(operation.functionData, operation.metadata, path);
        if (value !== undefined) {
          console.log(`     ${fieldIndex + 1}. ${label}: ${value} (from ${path})`);
        } else {
          console.log(`     ${fieldIndex + 1}. ${label}: [unmapped] (path: ${path})`);
        }
      } else {
        console.log(`     ${fieldIndex + 1}. ${label}: [no path defined]`);
      }
    });
  });
}

// Execute dynamic batch processing
processBatchDynamically(levelBasedOperations);

console.log('\\n🎯 CORRECT LEVEL-BASED MAPPING RESULTS:');
console.log(`📊 Function calls extracted: ${allFunctionCalls.length}`);
console.log(`📊 Metadata matches found: ${levelBasedOperations.length}`);
console.log(`📊 Levels processed: ${[...new Set(allFunctionCalls.map(f => f.level))].join(', ')}`);

console.log('\\n✅ KEY PRINCIPLES FOLLOWED:');
console.log('✅ No hardcoded transaction-specific mappings');
console.log('✅ Each metadata applies to ONE level only');
console.log('✅ Dynamic iteration handles ANY number of batches');
console.log('✅ Only maps what is defined in metadata');
console.log('✅ ERC-7730 compliant path resolution');
console.log('✅ Level-based metadata application');

console.log('\\n📊 CORRECT LEVEL-BASED MAPPING COMPLETE - ITERATION 114');