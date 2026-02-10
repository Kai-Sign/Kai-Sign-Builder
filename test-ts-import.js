#!/usr/bin/env node

/**
 * Test script to verify we can import and use functions from hardwareViewer.tsx
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Try to compile the TypeScript file to JavaScript and import it
console.log('🔧 Testing TypeScript import from hardwareViewer.tsx...');

try {
  // Compile the TypeScript file to temporary JavaScript
  console.log('📦 Compiling TypeScript...');
  execSync('npx tsc frontend/src/app/hardware-viewer/hardwareViewer.tsx --target ES2022 --module ES2022 --outDir /tmp/ts-test --skipLibCheck --jsx react', { stdio: 'inherit' });
  
  // Try to import the compiled JavaScript
  console.log('📥 Importing compiled functions...');
  const { resolveValueAtPathExport, getFieldValueFromTransactionExport } = await import('/tmp/ts-test/frontend/src/app/hardware-viewer/hardwareViewer.js');
  
  console.log('✅ Successfully imported functions from TypeScript!');
  
  // Test the functions with sample data
  const testTransaction = {
    methodCall: {
      name: "execTransaction",
      params: [
        {
          name: "to",
          type: "address", 
          value: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        },
        {
          name: "value",
          type: "uint256",
          value: "0"
        }
      ]
    },
    addressesMeta: {
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
        contractName: "USD Coin",
        tokenSymbol: "USDC"
      }
    }
  };
  
  // Test path resolution
  console.log('🧪 Testing path resolution...');
  const toValue = resolveValueAtPathExport(testTransaction, {}, '#.to');
  console.log(`Path "#.to" resolved to: ${toValue}`);
  
  // Test field value extraction
  console.log('🧪 Testing field value extraction...');
  const addressDisplay = getFieldValueFromTransactionExport('#.to', 'addressName', testTransaction);
  console.log(`Field "#.to" with format "addressName" displays as: ${addressDisplay}`);
  
  if (toValue === "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" && addressDisplay === "USD Coin") {
    console.log('🎉 TypeScript functions working correctly!');
  } else {
    console.log('❌ TypeScript functions not working as expected');
    console.log(`Expected: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, got: ${toValue}`);
    console.log(`Expected: USD Coin, got: ${addressDisplay}`);
  }
  
} catch (error) {
  console.error('❌ Failed to import TypeScript functions:', error.message);
  console.log('📝 This means the CLI is using its own implementation, not the TypeScript one');
}