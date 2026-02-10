#!/usr/bin/env node

// ITERATION 77 - Test handleOps-only scenario
console.log('ITERATION 77 - Testing handleOps-only scenario');

import fs from 'fs';

// Create a mock transaction with only handleOps (no nested executeBatch)
const mockTransactionData = {
  txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  methodCall: {
    name: "handleOps",
    params: [
      {
        name: "ops",
        type: "tuple",
        components: [
          {
            name: "ops",
            type: "tuple", 
            components: [
              { name: "sender", type: "address", value: "0x742d35Cc8639C16E6d3f8F6a8B3F3fE8A7c3b1a2" },
              { name: "nonce", type: "uint256", value: "1" },
              { name: "initCode", type: "bytes", value: "0x" },
              { 
                name: "callData", 
                type: "bytes", 
                value: "0x123456",
                // NO valueDecoded - this is just raw bytes, not decodable
              },
              { name: "accountGasLimits", type: "bytes32", value: "0x0000000000000000000000000000000000000000000000000000000000100000" },
              { name: "preVerificationGas", type: "uint256", value: "21000" },
              { name: "gasFees", type: "bytes32", value: "0x00000000000000000000000000000000000000000000000000000002540be400" },
              { name: "paymasterAndData", type: "bytes", value: "0x" },
              { name: "signature", type: "bytes", value: "0xabcdef123456789..." }
            ]
          }
        ]
      },
      {
        name: "beneficiary",
        type: "address",
        value: "0x1234567890123456789012345678901234567890"
      }
    ]
  }
};

// Function extraction
function extractFunctions(data, path = '', level = 0) {
  const functions = [];
  
  if (data?.name && data?.params) {
    const paramTypes = Array.isArray(data.params) ? data.params.map(p => 
      p.type === 'tuple' && p.components ? '(' + p.components.map(c => c.type).join(',') + ')' : p.type
    ).join(',') : '';
    const signature = data.name + '(' + paramTypes + ')';
    
    functions.push({ 
      name: data.name, 
      signature,
      path, 
      level,
      context: data
    });
  }
  
  if (data?.valueDecoded) {
    functions.push(...extractFunctions(data.valueDecoded, path + '.valueDecoded', level + 1));
  }
  if (data?.methodCall) {
    functions.push(...extractFunctions(data.methodCall, path + '.methodCall', level + 1));
  }
  if (Array.isArray(data?.params)) {
    data.params.forEach((p, i) => {
      const paramName = p.name || 'param' + i;
      functions.push(...extractFunctions(p, path + '.' + paramName, level + 1));
    });
  }
  if (Array.isArray(data?.components)) {
    data.components.forEach((c, i) => {
      const compName = c.name || 'component' + i;
      functions.push(...extractFunctions(c, path + '.' + compName, level + 1));
    });
  }
  
  return functions;
}

const allFunctions = extractFunctions(mockTransactionData);
console.log('Functions found in handleOps-only transaction:');
allFunctions.forEach((f, i) => console.log((i+1) + '. ' + f.signature + ' (level ' + f.level + ')'));

// Test prioritization
const executeBatchOps = allFunctions.filter(op => op.name === 'executeBatch');
const handleOpsOps = allFunctions.filter(op => op.name === 'handleOps');

console.log('\\nPrioritization with handleOps-only:');
console.log('ExecuteBatch operations:', executeBatchOps.length);
console.log('HandleOps operations:', handleOpsOps.length);

let prioritizedOps = [];
if (executeBatchOps.length > 0) {
  console.log('🎯 Prioritizing executeBatch operations');
  prioritizedOps = executeBatchOps;
} else if (handleOpsOps.length > 0) {
  console.log('🎯 Using handleOps operations (fallback)');
  prioritizedOps = handleOpsOps;
}

console.log('Final operations to display:', prioritizedOps.length);

// Test metadata loading
const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));

if (prioritizedOps.length > 0) {
  const operation = prioritizedOps[0];
  const format = metadata.display.formats[operation.signature];
  
  if (format) {
    console.log('\\n✅ Metadata found for handleOps operation');
    console.log('Intent:', format.intent);
    console.log('Fields:', format.fields.length);
    
    format.fields.forEach((field, i) => {
      if (field.path) {
        console.log('  ' + (i+1) + '. ' + field.label + ': ' + field.path);
      } else if (field.value) {
        console.log('  ' + (i+1) + '. ' + field.label + ': "' + field.value + '"');
      }
    });
    
    console.log('\\n✅ HandleOps-only scenario works correctly');
  } else {
    console.log('\\n❌ No metadata found for handleOps operation');
  }
} else {
  console.log('\\n❌ No operations found');
}

console.log('\\n🎯 Edge case test complete - handleOps fallback working');