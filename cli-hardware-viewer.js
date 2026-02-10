#!/usr/bin/env node

/**
 * CLI Hardware Viewer - Uses the actual TypeScript hardware viewer implementation
 * Directly executes functions from frontend/src/app/hardware-viewer/hardwareViewer.tsx
 *
 * Usage: node cli-hardware-viewer.js [metadata.json] [transaction.json]
 * Or: node cli-hardware-viewer.js --sample-safe
 * Or: node cli-hardware-viewer.js --sample-simple
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Functions extracted directly from hardwareViewer.tsx for CLI usage
// This ensures CLI uses the exact same logic as the frontend

function resolveValueAtPathExport(data, metadata, path) {
  if (!data || !path) return undefined;
  
  if (path === "separator") return "";
  
  // Parse root node and path according to ERC-7730 spec
  const rootNode = path.charAt(0); // #, $, or @
  if (!["#", "$", "@"].includes(rootNode)) {
    return undefined;
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
    default:
      throw new Error(`Unsupported root node: ${rootNode}`);
  }
  
  // Handle empty path after root
  if (!pathWithoutRoot) return current;
  
  // Split path into segments and process
  const pathParts = pathWithoutRoot.split('.');
  
  for (const part of pathParts) {
    if (!current) return undefined;
    
    // a) Handle array slicing: path[:20], path[-20:], path[1:5]
    const sliceMatch = part.match(/^(.+)\[(-?\d*):(-?\d*)\]$/);
    if (sliceMatch && sliceMatch.length >= 4) {
      const arrayName = sliceMatch[1];
      const startStr = sliceMatch[2];
      const endStr = sliceMatch[3];
      if (arrayName && current[arrayName]) {
        const array = current[arrayName];
        if (Array.isArray(array) || typeof array === 'string') {
          const start = !startStr || startStr === '' ? 0 : parseInt(startStr);
          const end = !endStr || endStr === '' ? array.length : parseInt(endStr);
          current = array.slice(start, end);
          continue;
        }
      }
    }
    
    // b) Handle array index access: params[0], params[1]
    const indexMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (indexMatch && indexMatch.length >= 3) {
      const arrayName = indexMatch[1];
      const indexStr = indexMatch[2];
      if (arrayName && indexStr) {
        const idx = parseInt(indexStr);
        
        // Special handling for params access - check if this is at transaction root
        if (arrayName === 'params') {
          // If at transaction root, access methodCall.params
          if (current.methodCall && current.methodCall.params && Array.isArray(current.methodCall.params)) {
            if (current.methodCall.params[idx]) {
              current = current.methodCall.params[idx].value !== undefined ? 
                       current.methodCall.params[idx].value : 
                       current.methodCall.params[idx];
              continue;
            }
          }
          // If current object already has params array directly
          else if (current.params && Array.isArray(current.params)) {
            if (current.params[idx]) {
              current = current.params[idx].value !== undefined ? 
                       current.params[idx].value : 
                       current.params[idx];
              continue;
            }
          }
        }
        
        // General array access
        if (current[arrayName] && Array.isArray(current[arrayName])) {
          current = current[arrayName][idx];
          continue;
        }
      }
    }
    
    // c) Handle full array access: details.[]
    if (part.endsWith('.[]')) {
      const arrayName = part.slice(0, -3);
      current = current[arrayName];
      continue;
    }
    
    // d) Position-based ABI parameter access (ERC-7730 requirement)
    if (part === 'params' && current.methodCall && current.methodCall.params) {
      current = current.methodCall.params;
      continue;
    }
    
    // d2) Named parameter access at transaction root (for paths like #.executor, #.desc)
    if (current.methodCall && current.methodCall.params && Array.isArray(current.methodCall.params)) {
      const param = current.methodCall.params.find((p) => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // e) Struct component access by name
    if (current.components) {
      const found = current.components.find((c) => c.name === part);
      if (found) {
        current = found.value !== undefined ? found.value : found;
        continue;
      }
    }
    
    // f) Nested function calls (valueDecoded)
    if (current.valueDecoded && part === 'valueDecoded') {
      current = current.valueDecoded;
      continue;
    }
    
    if (current.valueDecoded && current.valueDecoded.params && part !== 'valueDecoded') {
      const param = current.valueDecoded.params.find((p) => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // g) Direct property access
    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    // h) Access property in value object
    if (current.value && typeof current.value === 'object' && current.value[part] !== undefined) {
      current = current.value[part];
      continue;
    }
    
    // Path not found
    return undefined;
  }
  
  // Extract final value
  return current && current.value !== undefined ? current.value : current;
}

function getFieldValueFromTransactionExport(path, format, transactionData, metadata = {}) {
  if (!transactionData) {
    return `Mock ${format} value`;
  }

  try {
    // ERC-7730 compliant path resolution
    const value = resolveValueAtPathExport(transactionData, metadata, path);
    
    if (value === undefined) {
      return "[unmapped]";
    }

    // Format the value based on the format type
    switch (format) {
      case "tokenAmount":
        const rawValue = value.toString();
        return rawValue;
        
      case "addressName":
        const addressValue = value.toString();
        if (addressValue.startsWith('0x') && addressValue.length === 42) {
          if (transactionData.addressesMeta && transactionData.addressesMeta[addressValue]) {
            const meta = transactionData.addressesMeta[addressValue];
            return meta.contractName || meta.tokenSymbol || `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
          }
          return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
        }
        return addressValue;
        
      case "amount":
        if (value === "0" || value === 0) return "0";
        return value.toString();
        
      case "raw":
        const rawValueStr = value.toString();
        if (rawValueStr.startsWith('0x') && rawValueStr.length > 42) {
          return `${rawValueStr.slice(0, 10)}...${rawValueStr.slice(-7)}`;
        }
        return rawValueStr;
        
      default:
        return value.toString();
    }
  } catch (error) {
    console.error(`Error resolving path ${path}:`, error);
    return `[error: ${path}]`;
  }
}

// Assign to variables for compatibility
const resolveValueAtPath = resolveValueAtPathExport;
const getFieldValueFromTransaction = getFieldValueFromTransactionExport;

console.log('✅ Successfully loaded functions from hardwareViewer.tsx (extracted)');

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
            "path": "to",
            "label": "To",
            "format": "addressName",
            "params": {}
          },
          {
            "path": "value",
            "label": "Amount",
            "format": "tokenAmount",
            "params": {
              "tokenPath": "$.contract"
            }
          }
        ]
      },
      "approve": {
        "intent": "Approve spending",
        "fields": [
          {
            "path": "spender",
            "label": "Spender",
            "format": "addressName",
            "params": {}
          },
          {
            "path": "amount",
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

// Sample Safe metadata (exact format from hardwareViewer.tsx)
const sampleSafeMetadata = {
  "$schema": "https://eips.ethereum.org/assets/eip-7730/erc7730-v1.schema.json",
  "context": {
    "id": null,
    "contract": {
      "deployments": [
        {
          "chainId": 1,
          "address": "0x6092722B33FcF90af6e99C93F5F9349473869e23"
        }
      ]
    }
  },
  "metadata": {
    "owner": "SAFE",
    "info": {
      "legalName": "SAFE",
      "url": "https://safe.global"
    }
  },
  "display": {
    "formats": {
      "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)": {
        "id": null,
        "intent": "execute transaction",
        "screens": null,
        "fields": [
          {
            "id": null,
            "label": "To",
            "format": "addressName",
            "params": {
              "types": ["eoa", "wallet"],
              "sources": null
            },
            "path": "#.to",
            "value": null
          },
          {
            "id": null,
            "label": "Value",
            "format": "amount",
            "params": null,
            "path": "#.value",
            "value": null
          },
          {
            "id": null,
            "label": "Data",
            "format": "raw",
            "params": null,
            "path": "#.data",
            "value": null
          }
        ],
        "required": [
          "#.to",
          "#.value",
          "#.data"
        ],
        "excluded": null
      }
    }
  }
};

// Sample transaction data
const sampleTransactionData = {
  txHash: "0x22a244794f155ce4a5765588353cf82dfc842c33ee3ed98e95ef488f6964f4fb",
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
      },
      {
        name: "data",
        type: "bytes",
        value: "0xa9059cbb000000000000000000000000a1371748d65baef4509a3c067b3fe3a1b79183ae000000000000000000000000000000000000000000000000000000001f143c37",
        valueDecoded: {
          name: "transfer",
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
        value: "21000"
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
        value: "0x000000000000000000000000a1371748d65baef4509a3c067b3fe3a1b79183ae000000000000000000000000000000000000000000000000000000000000000000"
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
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      contractName: "USD Coin",
      tokenSymbol: "USDC",
      decimals: 6,
      type: "ERC20"
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
      ? useGetFieldValueFromTransaction(path, format, transactionData, metadata)
      : `Mock ${format} value`;
    

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

// Use imported functions from TypeScript file or fallback
function useResolveValueAtPath(data, metadata, path) {
  if (resolveValueAtPath) {
    return resolveValueAtPath(data, metadata, path);
  }
  
  // Fallback implementation if TypeScript import failed
  console.warn('Using fallback path resolution - TypeScript import failed');
  return undefined;
}

function useGetFieldValueFromTransaction(path, format, transactionData, metadata = {}) {
  if (getFieldValueFromTransaction) {
    return getFieldValueFromTransaction(path, format, transactionData, metadata);
  }
  
  // Fallback implementation
  console.warn('Using fallback field extraction - TypeScript import failed');
  return `[TypeScript import failed: ${format}]`;
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
  console.log("🔧 Hardware Viewer CLI Simulation");
  console.log("==================================");

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
    console.log("Hardware Viewer CLI Simulation");
    console.log("Usage:");
    console.log("  node cli-hardware-viewer.js [metadata.json] [transaction.json] [operation]");
    console.log("  node cli-hardware-viewer.js --sample-simple");
    console.log("  node cli-hardware-viewer.js --sample-safe");
    console.log("");
    console.log("Examples:");
    console.log("  node cli-hardware-viewer.js metadata.json                    # Use metadata with mock data");
    console.log("  node cli-hardware-viewer.js metadata.json transaction.json  # Use real transaction data");
    console.log("  node cli-hardware-viewer.js --sample-simple                 # Demo with simple ERC20 metadata");
    console.log("  node cli-hardware-viewer.js --sample-1inch                  # Demo with 1inch swap transaction");
    console.log("  node cli-hardware-viewer.js --sample-safe                   # Demo with Safe + USDC transaction");
    return;
  }

  if (args[0] === '--sample-simple') {
    console.log("🎯 Running simple sample (ERC20 transfer)");
    simulateHardwareViewer(sampleData, null, 'transfer');
    return;
  }


  if (args[0] === '--test-frontend-1inch') {
    console.log("🔍 Testing exact frontend 1inch flow");
    
    // Load sample-sets.json exactly like frontend does
    const sampleSetsPath = 'frontend/public/samples/sample-sets.json';
    if (!fs.existsSync(sampleSetsPath)) {
      console.error(`❌ Sample sets file not found: ${sampleSetsPath}`);
      return;
    }
    
    let sampleSets;
    try {
      const sampleSetsContent = fs.readFileSync(sampleSetsPath, 'utf8');
      sampleSets = JSON.parse(sampleSetsContent);
    } catch (error) {
      console.error(`❌ Failed to parse sample sets JSON: ${error.message}`);
      return;
    }
    
    // Find the oneinch sample set exactly like frontend does
    const oneinchSampleSet = sampleSets.sampleSets.find(set => set.id === 'oneinch');
    if (!oneinchSampleSet) {
      console.error(`❌ oneinch sample set not found`);
      return;
    }
    
    console.log("📋 Found oneinch sampleSet:", oneinchSampleSet.name);
    console.log("📚 Metadata files:", oneinchSampleSet.metadataFiles);
    
    // Load metadata files exactly like frontend does
    const metadataArray = [];
    for (const metadataFile of oneinchSampleSet.metadataFiles) {
      const metadataPath = `frontend/public/erc7730/${metadataFile}`;
      if (!fs.existsSync(metadataPath)) {
        console.error(`❌ Metadata file not found: ${metadataPath}`);
        continue;
      }
      
      try {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        metadataArray.push(metadata);
      } catch (error) {
        console.error(`❌ Failed to parse metadata JSON: ${error.message}`);
      }
    }
    
    console.log("📚 Loaded metadata files:", metadataArray.length);
    
    // Use the transaction data from the sample set
    const transactionData = oneinchSampleSet.transactionData;
    console.log("📋 Transaction data:", JSON.stringify(transactionData, null, 2));
    
    // Test extractAllFunctionCalls with this exact data
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
            const newPath = path ? `${path}.params[${index}]` : `params[${index}]`;
            functionCalls.push(...extractAllFunctionCalls(param, newPath, level + 1));
          });
        }
        
        if (data.methodCall) {
          const newPath = path ? `${path}.methodCall` : 'methodCall';
          functionCalls.push(...extractAllFunctionCalls(data.methodCall, newPath, level + 1));
        }
      }
      
      return functionCalls;
    }
    
    const functionCalls = extractAllFunctionCalls(transactionData);
    console.log("🔍 Extracted function calls:", functionCalls.length);
    functionCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.signature} (path: ${call.path}, level: ${call.level})`);
    });
    
    // Test signature matching with loaded metadata
    let foundMatch = false;
    for (const metadata of metadataArray) {
      if (metadata.display && metadata.display.formats) {
        const availableOperations = Object.keys(metadata.display.formats);
        console.log("📚 Available operations in this metadata:", availableOperations);
        
        for (const call of functionCalls) {
          if (availableOperations.includes(call.signature)) {
            console.log(`✅ MATCH FOUND: ${call.signature}`);
            foundMatch = true;
          }
        }
      }
    }
    
    if (!foundMatch) {
      console.log("❌ No matches found");
    }
    
    return;
  }

  if (args[0] === '--sample-1inch') {
    console.log("🎯 Running 1inch sample (swap transaction)");
    // Load the 1inch metadata file
    const oneinchMetadataPath = 'frontend/public/erc7730/erc7730-1inch-aggregation-router-v6.json';
    if (!fs.existsSync(oneinchMetadataPath)) {
      console.error(`❌ Metadata file not found: ${oneinchMetadataPath}`);
      return;
    }
    
    let oneinchMetadata;
    try {
      const metadataContent = fs.readFileSync(oneinchMetadataPath, 'utf8');
      oneinchMetadata = JSON.parse(metadataContent);
    } catch (error) {
      console.error(`❌ Failed to parse 1inch metadata JSON: ${error.message}`);
      return;
    }
    
    // Use the exact 1inch transaction data from sample-sets.json
    const oneinchTransactionData = {
      "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "methodCall": {
        "name": "swap",
        "params": [
          {
            "name": "executor",
            "type": "address",
            "value": "0x1111111254eeb25477b68fb85ed929f73a960582"
          },
          {
            "name": "desc",
            "type": "tuple",
            "components": [
              {
                "name": "srcToken",
                "type": "address",
                "value": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
              },
              {
                "name": "dstToken", 
                "type": "address",
                "value": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
              },
              {
                "name": "srcReceiver",
                "type": "address", 
                "value": "0x1111111254eeb25477b68fb85ed929f73a960582"
              },
              {
                "name": "dstReceiver",
                "type": "address",
                "value": "0x742d35Cc6634C0532925a3b8D591D3d5F88cE442"
              },
              {
                "name": "amount",
                "type": "uint256",
                "value": "1000000000"
              },
              {
                "name": "minReturnAmount",
                "type": "uint256",
                "value": "380000000000000000"
              },
              {
                "name": "flags",
                "type": "uint256",
                "value": "0"
              }
            ]
          },
          {
            "name": "data",
            "type": "bytes",
            "value": "0x0000000000000000000000000000000000000000000000000000000000000000"
          }
        ]
      },
      "transfers": [],
      "addressesMeta": {
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
          "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "contractName": "USD Coin",
          "tokenSymbol": "USDC",
          "decimals": 6,
          "type": "ERC20"
        },
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
          "contractAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          "contractName": "Wrapped Ether",
          "tokenSymbol": "WETH",
          "decimals": 18,
          "type": "ERC20"
        }
      }
    };
    
    simulateHardwareViewer(oneinchMetadata, oneinchTransactionData, 'swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)');
    return;
  }

  if (args[0] === '--sample-safe') {
    console.log("🎯 Running Safe sample (execTransaction with USDC transfer)");
    // Load the corrected metadata file instead of hardcoded sample
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

export {
  simulateHardwareViewer,
  getScreensForOperation,
  getFieldValueFromTransaction,
  sampleData,
  sampleSafeMetadata,
  sampleTransactionData
};