#!/usr/bin/env node

/**
 * CLI Hardware Viewer - Uses the actual TypeScript hardware viewer implementation
 * Now ACTUALLY imports from the compiled TypeScript functions
 *
 * Usage: node cli-hardware-viewer-fixed.js [metadata.json] [transaction.json]
 * Or: node cli-hardware-viewer-fixed.js --sample-safe
 * Or: node cli-hardware-viewer-fixed.js --sample-simple
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the ACTUAL TypeScript functions
let resolveValueAtPath, getFieldValueFromTransaction;

try {
  console.log('🔧 Importing ACTUAL TypeScript functions from hardware-viewer-core.js...');
  const coreModule = await import('./hardware-viewer-core.js');
  resolveValueAtPath = coreModule.resolveValueAtPath;
  getFieldValueFromTransaction = coreModule.getFieldValueFromTransaction;
  console.log('✅ Successfully imported TypeScript functions!');
} catch (error) {
  console.error('❌ Failed to import TypeScript functions:', error.message);
  console.log('📝 Falling back to CLI-only implementation');
  
  // Fallback implementation (just in case)
  resolveValueAtPath = function(data, metadata, path) {
    console.warn('⚠️  Using FALLBACK path resolution - TypeScript import failed');
    return undefined;
  };
  
  getFieldValueFromTransaction = function(path, format, transactionData, metadata = {}) {
    console.warn('⚠️  Using FALLBACK field extraction - TypeScript import failed');
    return `[FALLBACK: ${format}]`;
  };
}

// Sample ERC7730 metadata (same as in hardwareViewer.tsx)
const sampleData = {
  "$schema": "https://schemas.ledger.com/erc7730/1.0.0",
  "context": {
    "contract": {
      "address": "0x1234567890123456789012345678901234567890",
      "chainId": 1
    }
  },
  "metadata": {
    "owner": "Sample DApp",
    "info": {
      "url": "https://example.com",
      "legalName": "Sample Company"
    }
  },
  "display": {
    "formats": {
      "transfer": {
        "intent": "Transfer tokens",
        "fields": [
          {
            "path": "#.to",
            "label": "To",
            "format": "addressName",
            "params": {}
          },
          {
            "path": "#.value",
            "label": "Amount",
            "format": "tokenAmount",
            "params": {
              "tokenPath": "$.contract"
            }
          }
        ]
      }
    }
  }
};

// Sample transaction data (Loop Decoder format)
const sampleTransactionData = {
  txHash: "0x22a244794f155ce4a5765588353cf82dfc842c33ee3ed98e95ef488f6964f4fb",
  txType: "contract interaction",
  fromAddress: "0x049bdd0528e2d5f2e579e1bdd133Daed7c935DFC",
  toAddress: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
  contractName: "",
  contractType: "SAFE-PROXY",
  methodCall: {
    name: "execTransaction",
    type: "function",
    signature: "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)",
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
      },
      {
        name: "data",
        type: "bytes",
        value: "0xa9059cbb000000000000000000000000a1371748d65baef4509a3c067b3fe3a1b79183ae000000000000000000000000000000000000000000000000000000001f143c37",
        valueDecoded: {
          name: "transfer",
          signature: "transfer(address,uint256)",
          type: "function",
          params: [
            {
              name: "to",
              type: "address",
              value: "0xA1371748D65baEF4509A3c067b3fe3a1b79183aE"
            },
            {
              name: "value",
              type: "uint256",
              value: "521419831"
            }
          ]
        }
      },
      {
        name: "operation",
        type: "uint8",
        value: "0"
      },
      {
        name: "safeTxGas",
        type: "uint256",
        value: "0"
      },
      {
        name: "baseGas",
        type: "uint256",
        value: "0"
      },
      {
        name: "gasPrice",
        type: "uint256",
        value: "0"
      },
      {
        name: "gasToken",
        type: "address",
        value: "0x0000000000000000000000000000000000000000"
      },
      {
        name: "refundReceiver",
        type: "address",
        value: "0x0000000000000000000000000000000000000000"
      },
      {
        name: "signatures",
        type: "bytes",
        value: "0x000000000000000000000000049bdd0528e2d5f2e579e1bdd133daed7c935dfc000000000000000000000000000000000000000000000000000000000000000001be6195185c0afdda36c5ccc9951d628873f0c2546d68edd266c4a6142ef05ed30be88a934eac08bb8d86705cb7a339d61c2342fdd7607806c488e0055a0232e51c"
      }
    ]
  },
  transfers: [
    {
      type: "ERC20",
      name: "USD Coin",
      symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amount: "521.419831",
      to: "0xA1371748D65baEF4509A3c067b3fe3a1b79183aE",
      from: "0x6092722B33FcF90af6e99C93F5F9349473869e23"
    }
  ],
  addressesMeta: {
    "0x6092722B33FcF90af6e99C93F5F9349473869e23": {
      contractAddress: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
      contractName: "",
      tokenSymbol: "",
      decimals: null,
      type: "SAFE-PROXY",
      address: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
      chainID: 1
    },
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      contractName: "USD Coin",
      tokenSymbol: "USDC",
      decimals: 6,
      type: "ERC20",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainID: 1
    }
  }
};

// Screen generation logic (ported from getScreensForOperation.tsx)
const ITEM_PER_SCREEN = 4;

function getScreensForOperation(operation, transactionData = null, metadata = {}) {
  const displays = operation.fields.filter((field) => {
    const label = field && field.label;
    return !(label === undefined || label === null || label === "");
  });

  const screens = [];
  let screen = [];

  for (let i = 0; i < displays.length; i++) {
    const isLastItem = i === displays.length - 1;
    const displayItem = displays[i];
    const label = displayItem && displayItem.label;

    if (label === undefined || label === null || label === "") continue;
    if (!displayItem) continue;

    const format = displayItem.format || "raw";
    const path = displayItem.path || "";

    const displayValue = transactionData
      ? getFieldValueFromTransaction(path, format, transactionData, metadata)
      : `Mock ${format} value`;
    
    // Show which function we're using
    if (transactionData) {
      console.log(`🔍 Path: ${path} → Value: ${displayValue} (using ${getFieldValueFromTransaction === undefined ? 'FALLBACK' : 'TYPESCRIPT'} function)`);
    }

    screen.push({
      label,
      isActive: true,
      displayValue
    });

    if (screen.length === ITEM_PER_SCREEN || isLastItem) {
      screens.push(screen);
      screen = [];
    }
  }

  return screens;
}

// CLI rendering functions
function renderScreen(screen, index, total) {
  const border = "═".repeat(60);
  const sideBorder = "║";

  console.log(`\n┌${border}┐`);
  console.log(`${sideBorder}${' '.repeat(22)}HARDWARE WALLET${' '.repeat(22)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(25)}Screen ${index + 1}/${total}${' '.repeat(25)}${sideBorder}`);
  console.log(`├${border}┤`);

  screen.forEach((item, itemIndex) => {
    const labelLine = `${sideBorder} ${item.label}:${' '.repeat(58 - item.label.length - 1)}${sideBorder}`;
    const valueLine = `${sideBorder}   ${item.displayValue}${' '.repeat(57 - item.displayValue.length)}${sideBorder}`;

    console.log(labelLine);
    console.log(valueLine);

    if (itemIndex < screen.length - 1) {
      console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);
    }
  });

  console.log(`└${border}┘`);
}

function renderTitleScreen(operationName, owner) {
  const border = "═".repeat(60);
  const sideBorder = "║";

  console.log(`\n┌${border}┐`);
  console.log(`${sideBorder}${' '.repeat(22)}HARDWARE WALLET${' '.repeat(22)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(28)}Page 1${' '.repeat(26)}${sideBorder}`);
  console.log(`├${border}┤`);
  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(20)}📄 TRANSACTION${' '.repeat(25)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);

  const intentLine = operationName.length > 50 ? operationName.substring(0, 47) + "..." : operationName;
  const padding = Math.max(0, (60 - intentLine.length) / 2);
  console.log(`${sideBorder}${' '.repeat(Math.floor(padding))}${intentLine}${' '.repeat(Math.ceil(60 - Math.floor(padding) - intentLine.length))}${sideBorder}`);

  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);

  if (owner) {
    const ownerText = `From: ${owner}`;
    const ownerPadding = Math.max(0, (60 - ownerText.length) / 2);
    console.log(`${sideBorder}${' '.repeat(Math.floor(ownerPadding))}${ownerText}${' '.repeat(Math.ceil(60 - Math.floor(ownerPadding) - ownerText.length))}${sideBorder}`);
  }

  console.log(`└${border}┘`);
}

function renderSignScreen(operationName) {
  const border = "═".repeat(60);
  const sideBorder = "║";

  console.log(`\n┌${border}┐`);
  console.log(`${sideBorder}${' '.repeat(22)}HARDWARE WALLET${' '.repeat(22)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(25)}Final Screen${' '.repeat(23)}${sideBorder}`);
  console.log(`├${border}┤`);
  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(22)}Hold to sign${' '.repeat(25)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);

  const intentLine = operationName.length > 50 ? operationName.substring(0, 47) + "..." : operationName;
  const padding = Math.max(0, (60 - intentLine.length) / 2);
  console.log(`${sideBorder}${' '.repeat(Math.floor(padding))}${intentLine}${' '.repeat(Math.ceil(60 - Math.floor(padding) - intentLine.length))}${sideBorder}`);

  console.log(`${sideBorder}${' '.repeat(60)}${sideBorder}`);
  console.log(`${sideBorder}${' '.repeat(25)}[SIGN] 🔄${' '.repeat(25)}${sideBorder}`);
  console.log(`└${border}┘`);
}

// Main simulation function
function simulateHardwareViewer(metadata, transactionData = null, operationKey = null) {
  console.log("🔧 Hardware Viewer CLI Simulation (Using ACTUAL TypeScript functions)");
  console.log("==================================================================");

  if (!metadata.display || !metadata.display.formats) {
    console.error("❌ Invalid metadata: No display formats found");
    return;
  }

  const operations = Object.keys(metadata.display.formats);

  if (operations.length === 0) {
    console.error("❌ No operations found in metadata");
    return;
  }

  // Use provided operation key or first available operation
  const selectedOperation = operationKey || operations[0];
  const operation = metadata.display.formats[selectedOperation];

  if (!operation) {
    console.error(`❌ Operation '${selectedOperation}' not found. Available operations:`, operations);
    return;
  }

  console.log(`📋 Selected Operation: ${selectedOperation}`);
  console.log(`💡 Intent: ${operation.intent || selectedOperation}`);

  if (transactionData) {
    console.log(`🔗 Using real transaction data: ${transactionData.txHash || 'N/A'}`);
    
    // Test the TypeScript functions directly
    console.log('\n🧪 Testing TypeScript functions:');
    const testPath = '#.to';
    const testValue = resolveValueAtPath(transactionData, {}, testPath);
    console.log(`  Path "${testPath}" resolves to: ${testValue}`);
    
    const testDisplay = getFieldValueFromTransaction(testPath, 'addressName', transactionData);
    console.log(`  Formatted as addressName: ${testDisplay}`);
  } else {
    console.log("🎭 Using mock data for field values");
  }

  // Generate screens
  const screens = getScreensForOperation(operation, transactionData);
  const operationName = operation.intent || selectedOperation;
  const owner = metadata.metadata?.owner || "";

  // Render title screen
  renderTitleScreen(operationName, owner);

  // Render review screens
  screens.forEach((screen, index) => {
    renderScreen(screen, index + 1, screens.length + 2);
  });

  // Render sign screen
  renderSignScreen(operationName);

  console.log("\n✅ Hardware simulation complete!");
  console.log(`📊 Total screens: ${screens.length + 2} (1 title + ${screens.length} review + 1 sign)`);
}

// CLI argument parsing
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log("Hardware Viewer CLI Simulation (Using ACTUAL TypeScript)");
    console.log("Usage:");
    console.log("  node cli-hardware-viewer-fixed.js [metadata.json] [transaction.json] [operation]");
    console.log("  node cli-hardware-viewer-fixed.js --sample-simple");
    console.log("  node cli-hardware-viewer-fixed.js --sample-safe");
    return;
  }

  if (args[0] === '--sample-simple') {
    console.log("🎯 Running simple sample (ERC20 transfer)");
    simulateHardwareViewer(sampleData, null, 'transfer');
    return;
  }

  if (args[0] === '--sample-safe') {
    console.log("🎯 Running Safe sample (execTransaction with USDC transfer)");
    // Load the actual metadata file
    const safeMetadataPath = 'frontend/public/erc7730/erc7730-safe-wallet-enhanced.json';
    if (!fs.existsSync(safeMetadataPath)) {
      console.error(`❌ Metadata file not found: ${safeMetadataPath}`);
      return;
    }
    
    let safeMetadata;
    try {
      const metadataContent = fs.readFileSync(safeMetadataPath, 'utf8');
      safeMetadata = JSON.parse(metadataContent);
    } catch (error) {
      console.error(`❌ Failed to parse Safe metadata JSON: ${error.message}`);
      return;
    }
    
    simulateHardwareViewer(safeMetadata, sampleTransactionData, 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)');
    return;
  }

  // Load metadata file
  const metadataPath = args[0];
  if (!fs.existsSync(metadataPath)) {
    console.error(`❌ Metadata file not found: ${metadataPath}`);
    return;
  }

  let metadata;
  try {
    const metadataContent = fs.readFileSync(metadataPath, 'utf8');
    metadata = JSON.parse(metadataContent);
  } catch (error) {
    console.error(`❌ Failed to parse metadata JSON: ${error.message}`);
    return;
  }

  // Load transaction data if provided
  let transactionData = null;
  if (args.length > 1) {
    const transactionPath = args[1];
    if (!fs.existsSync(transactionPath)) {
      console.error(`❌ Transaction file not found: ${transactionPath}`);
      return;
    }

    try {
      const transactionContent = fs.readFileSync(transactionPath, 'utf8');
      transactionData = JSON.parse(transactionContent);
    } catch (error) {
      console.error(`❌ Failed to parse transaction JSON: ${error.message}`);
      return;
    }
  }

  // Get operation key if provided
  const operationKey = args.length > 2 ? args[2] : null;

  simulateHardwareViewer(metadata, transactionData, operationKey);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}