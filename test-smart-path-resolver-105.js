#!/usr/bin/env node

// ITERATION 105 - Test SmartPathResolver with path validation fix
console.log('🎯 ITERATION 105 - SMARTPATHRESOLVER COMPATIBILITY TEST\n');

import fs from 'fs';

const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const entryPointMetadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

const realBatchSample = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer');
const transactionData = realBatchSample.transactionData;

// SmartPathResolver class (exact hardware viewer logic)
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

console.log('Step 1: Initialize SmartPathResolver...');
const smartPathResolver = new SmartPathResolver();
smartPathResolver.analyzeTransaction(transactionData);
console.log(`✅ PathMap initialized with ${smartPathResolver.pathMap.size} paths`);

console.log('\nStep 2: List all available paths...');
const pathMap = Array.from(smartPathResolver.pathMap.entries());
pathMap.forEach(([path, info], i) => {
  console.log(`   ${i+1}. ${path} (level ${info.level}, type: ${info.type})`);
});

console.log('\nStep 3: Test metadata path validation...');
// Get executeBatch operation from metadata
const executeBatchFormat = entryPointMetadata.display.formats['executeBatch((tuple,tuple))'];
const metadataFields = executeBatchFormat.fields;

console.log('Metadata fields to test:');
metadataFields.forEach((field, i) => {
  console.log(`   ${i+1}. ${field.label}: ${field.path}`);
});

// Test the NEW path validation logic (with transformation)
console.log('\nStep 4: Test path validation WITH transformation...');
const functionCall = {
  level: 5,
  nestedPath: '#.ops.ops.callData.valueDecoded'
};

const metadataPaths = metadataFields.map(f => f.path).filter(Boolean);
console.log('Original metadata paths:', metadataPaths);

// Apply transformation logic (same as hardware viewer fix)
const transformedPaths = metadataPaths.map(path => {
  if (!path || !path.startsWith('#')) return path;
  
  if (functionCall.level > 0 && functionCall.nestedPath) {
    const pathWithoutHash = path.substring(2); // Remove '#.'
    return `${functionCall.nestedPath}.${pathWithoutHash}`;
  }
  return path;
});

console.log('Transformed paths:', transformedPaths);

// Validate transformed paths
const validPaths = transformedPaths.filter(path => smartPathResolver.pathMap.has(path));
const invalidPaths = transformedPaths.filter(path => !smartPathResolver.pathMap.has(path));

console.log(`✅ Valid transformed paths (${validPaths.length}):`, validPaths);
console.log(`❌ Invalid transformed paths (${invalidPaths.length}):`, invalidPaths);

console.log('\nStep 5: Test path resolution with transformed paths...');
transformedPaths.forEach((path, i) => {
  const value = smartPathResolver.resolveMetadataPath(transactionData, path);
  const originalPath = metadataPaths[i];
  console.log(`   ${originalPath} → ${path}`);
  console.log(`     Resolved: ${value !== undefined ? value : '[UNDEFINED]'}`);
});

console.log('\nStep 6: Compare OLD vs NEW validation...');
console.log('OLD validation (original paths):');
const oldValidPaths = metadataPaths.filter(path => smartPathResolver.pathMap.has(path));
const oldInvalidPaths = metadataPaths.filter(path => !smartPathResolver.pathMap.has(path));
console.log(`   ✅ Valid: ${oldValidPaths.length}`, oldValidPaths);
console.log(`   ❌ Invalid: ${oldInvalidPaths.length}`, oldInvalidPaths);

console.log('NEW validation (transformed paths):');
console.log(`   ✅ Valid: ${validPaths.length}`, validPaths);  
console.log(`   ❌ Invalid: ${invalidPaths.length}`, invalidPaths);

console.log('\n🎯 SMARTPATHRESOLVER COMPATIBILITY TEST RESULTS:');
console.log(`✅ PathMap size: ${smartPathResolver.pathMap.size === 19 ? 'PASS' : 'FAIL'} (${smartPathResolver.pathMap.size})`);
console.log(`✅ Original path validation: ${oldInvalidPaths.length === 3 ? 'PASS' : 'FAIL'} (${oldInvalidPaths.length} invalid)`);
console.log(`✅ Transformed path validation: ${validPaths.length === 3 ? 'PASS' : 'FAIL'} (${validPaths.length} valid)`);
console.log(`✅ All paths resolve: ${transformedPaths.every(p => smartPathResolver.resolveMetadataPath(transactionData, p) !== undefined) ? 'PASS' : 'FAIL'}`);

if (validPaths.length === 3 && invalidPaths.length === 0) {
  console.log('\n🎉 PATH VALIDATION FIX SUCCESSFUL!');
  console.log('✅ Transformed paths are now correctly validated');
  console.log('✅ All metadata paths resolve to actual values');
  console.log('✅ No false "MISSING" errors');
} else {
  console.log('\n❌ PATH VALIDATION STILL HAS ISSUES');
  console.log(`❌ ${invalidPaths.length} paths still invalid after transformation`);
}

console.log('\n📊 SMARTPATHRESOLVER COMPATIBILITY TEST COMPLETE - ITERATION 105');