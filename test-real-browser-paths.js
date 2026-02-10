#!/usr/bin/env node

// ITERATION 60 - Test real browser path resolution
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('ITERATION 60 - Testing real browser path resolution');

// Load real data
const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const txData = sampleSets.sampleSets.find(s => s.id === 'real-batch-usdc-transfer').transactionData;
const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

// Test the EXACT SmartPathResolver logic from the hardware viewer
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
resolver.analyzeTransaction(txData);

console.log(`PathMap has ${resolver.pathMap.size} paths`);

// Test the EXACT metadata paths with nested mapping
const nestedPath = '#.ops.ops.callData.valueDecoded';
const metadataPaths = [
  '#.calls.calls.target',
  '#.calls.calls.data.valueDecoded.value', 
  '#.calls.calls.data.valueDecoded.to'
];

console.log('\\nTesting metadata paths with nested mapping:');
metadataPaths.forEach(path => {
  const pathWithoutHash = path.substring(2);
  const fullPath = `${nestedPath}.${pathWithoutHash}`;
  
  const inPathMap = resolver.pathMap.has(fullPath);
  const resolvedValue = resolver.resolveMetadataPath(txData, fullPath);
  
  console.log(`${path} → ${fullPath}`);
  console.log(`  In PathMap: ${inPathMap ? '✅' : '❌'}`);
  console.log(`  Resolves: ${resolvedValue !== undefined ? '✅' : '❌'} ${resolvedValue || '[undefined]'}`);
  console.log('');
});

// Test the REAL browser behavior by checking if the metadata format exists
const format = metadata.display.formats['executeBatch((tuple,tuple))'];
if (format) {
  console.log('\\n📱 Testing real metadata format:');
  console.log('Intent:', format.intent);
  console.log('Fields:', format.fields.length);
  
  let workingFields = 0;
  format.fields.forEach((field, i) => {
    if (field.value) {
      console.log(`Field ${i+1}: ${field.label} = "${field.value}" ✅`);
      workingFields++;
    } else if (field.path) {
      const pathWithoutHash = field.path.substring(2);
      const fullPath = `${nestedPath}.${pathWithoutHash}`;
      const resolvedValue = resolver.resolveMetadataPath(txData, fullPath);
      const works = resolvedValue !== undefined;
      console.log(`Field ${i+1}: ${field.label} = ${resolvedValue || '[unmapped]'} ${works ? '✅' : '❌'}`);
      if (works) workingFields++;
    }
  });
  
  console.log(`\\nWorking fields: ${workingFields}/${format.fields.length}`);
  console.log(`Success rate: ${Math.round((workingFields / format.fields.length) * 100)}%`);
  
  if (workingFields === format.fields.length) {
    console.log('🎉 ALL FIELDS WORKING!');
  } else {
    console.log('❌ SOME FIELDS STILL BROKEN!');
  }
}