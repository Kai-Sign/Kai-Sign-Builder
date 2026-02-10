#!/usr/bin/env node

// Debug script to test function extraction from the transaction
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the actual batch transaction
const transactionPath = path.join(__dirname, 'test-batch-transaction.json');
const transaction = JSON.parse(fs.readFileSync(transactionPath, 'utf8'));

// Replicate the extractAllFunctionCalls function
const extractAllFunctionCalls = (data, path = '', level = 0) => {
  const functionCalls = [];
  
  // Base case: if this looks like a function call
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
  
  // Recursively search through all properties
  if (data && typeof data === 'object') {
    // Search in valueDecoded for nested function calls
    if (data.valueDecoded) {
      const newPath = path ? `${path}.valueDecoded` : 'valueDecoded';
      functionCalls.push(...extractAllFunctionCalls(data.valueDecoded, newPath, level + 1));
    }
    
    // Search in params array
    if (Array.isArray(data.params)) {
      data.params.forEach((param, index) => {
        const paramName = param.name || `param${index}`;
        const newPath = path ? `${path}.${paramName}` : paramName;
        functionCalls.push(...extractAllFunctionCalls(param, newPath, level + 1));
      });
    }
    
    // Search in methodCall
    if (data.methodCall) {
      const newPath = path ? `${path}.methodCall` : 'methodCall';
      functionCalls.push(...extractAllFunctionCalls(data.methodCall, newPath, level + 1));
    }
    
    // Search in components array (for tuple types)
    if (Array.isArray(data.components)) {
      data.components.forEach((component, index) => {
        const componentName = component.name || `component${index}`;
        const newPath = path ? `${path}.${componentName}` : componentName;
        functionCalls.push(...extractAllFunctionCalls(component, newPath, level + 1));
      });
    }
    
    // Search in all object properties recursively (catch-all for nested structures)
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
};

console.log('🔍 Extracting all function calls from transaction...\n');

const allFunctionCalls = extractAllFunctionCalls(transaction);

console.log(`Found ${allFunctionCalls.length} function calls:\n`);

allFunctionCalls.forEach((call, index) => {
  console.log(`${index + 1}. Function: ${call.name}`);
  console.log(`   Signature: ${call.signature}`);
  console.log(`   Path: ${call.path}`);
  console.log(`   Level: ${call.level}`);
  console.log(`   Params: ${call.params.length}`);
  console.log('');
});

// Check if we found the checkIn function
const checkInCall = allFunctionCalls.find(call => call.name === 'checkIn');
if (checkInCall) {
  console.log('✅ Found checkIn() function call!');
  console.log(`   Signature: ${checkInCall.signature}`);
  console.log(`   Path: ${checkInCall.path}`);
  console.log(`   Level: ${checkInCall.level}`);
} else {
  console.log('❌ checkIn() function call not found!');
}

// Check what metadata files would be needed
console.log('\n📋 Required metadata files:');
const uniqueSignatures = [...new Set(allFunctionCalls.map(call => call.signature))];
uniqueSignatures.forEach(sig => {
  console.log(`   - ${sig}`);
});