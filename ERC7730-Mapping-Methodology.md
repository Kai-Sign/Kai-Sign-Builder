# ERC7730 Metadata to Transaction Data Mapping Methodology

## Overview

This document explains the technical methodology for mapping ERC7730 metadata to Ethereum transaction bytecode, ensuring 1:1 correspondence between metadata field definitions and actual transaction data without hardcoded assumptions.

## Ethereum Transaction Bytecode Structure

### Function Selector (First 4 Bytes)
```
Transaction Data: 0xa9059cbb000000000000000000000000a1371748d65baef4509a3c067b3fe3a1b79183ae000000000000000000000000000000000000000000000000000000001f143c37
                  ^^^^^^^^ Function Selector (4 bytes)
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Encoded Parameters
```

The first 4 bytes (`0xa9059cbb`) are the **function selector**, derived from:
1. Function signature: `transfer(address,uint256)`
2. Keccak-256 hash: `keccak256("transfer(address,uint256)")`
3. First 4 bytes: `0xa9059cbb`

### ABI Encoding Structure
After the function selector, parameters are encoded according to Ethereum's ABI specification:
- **Static types** (uint256, address, bool): 32-byte aligned
- **Dynamic types** (bytes, string, arrays): Offset pointer + length + data
- **Struct types**: Sequential encoding of components

## ERC7730 Clear Signing Standard

### Purpose
ERC7730 provides metadata to transform raw bytecode into human-readable information:
- **Function identification**: Match selectors to human-readable operation names
- **Parameter mapping**: Map bytecode positions to semantic field labels
- **Value formatting**: Apply proper formatting (token amounts, addresses, etc.)

### Metadata Structure
```json
{
  "display": {
    "formats": {
      "transfer(address,uint256)": {
        "intent": "Transfer Tokens",
        "fields": [
          {
            "path": "#.to",
            "label": "Recipient", 
            "format": "addressName"
          },
          {
            "path": "#.value",
            "label": "Amount",
            "format": "tokenAmount"
          }
        ]
      }
    }
  }
}
```

## Path Resolution Methodology

### ERC7730 Path Format
- `#.fieldName`: Direct parameter access by name
- `methodCall.params[0].value`: Array index access
- `nested.params[1].components[0].value`: Struct component access

### Universal Path Resolver Algorithm
```typescript
function resolveValueAtPath(data: any, path: string): any {
  // 1. Clean path format (remove "#." prefix)
  let cleanPath = path.startsWith('#.') ? path.substring(2) : path;
  
  // 2. Split path into segments
  const pathParts = cleanPath.split('.');
  let current = data;
  
  // 3. Navigate through each path segment
  for (const part of pathParts) {
    // 4. Handle different data structures:
    
    // a) Method call parameter lookup by name
    if (current.methodCall?.params) {
      const param = current.methodCall.params.find(p => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // b) Array index access [0], [1], etc.
    if (/^\d+$/.test(part)) {
      const idx = parseInt(part);
      if (Array.isArray(current) && idx < current.length) {
        current = current[idx];
        continue;
      }
    }
    
    // c) Struct component access
    if (current.components) {
      const found = current.components.find(c => c.name === part);
      if (found) {
        current = found.value !== undefined ? found.value : found;
        continue;
      }
    }
    
    // d) Nested function calls (valueDecoded)
    if (current.valueDecoded?.params) {
      const param = current.valueDecoded.params.find(p => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // e) Direct property access
    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    // 5. Path not found - return undefined
    return undefined;
  }
  
  // 6. Return final resolved value
  return current?.value !== undefined ? current.value : current;
}
```

## Mapping Process Flow

### 1. Function Signature Matching
```typescript
// Extract function selector from transaction
const selector = transactionData.methodCall.name; // "transfer"
const params = transactionData.methodCall.params.map(p => p.type); // ["address", "uint256"]
const signature = `${selector}(${params.join(',')})`;  // "transfer(address,uint256)"

// Match against metadata operations
const operation = metadata.display.formats[signature];
```

### 2. Field Mapping
```typescript
// For each field defined in metadata
operation.fields.forEach(field => {
  // Resolve the value using the path
  const value = resolveValueAtPath(transactionData, field.path);
  
  // Apply formatting
  const displayValue = formatValue(value, field.format);
  
  // Display with label
  display(field.label, displayValue);
});
```

### 3. Nested Function Handling
For complex transactions with nested function calls (e.g., Safe multisig executing ERC20 transfer):

```typescript
// 1. Extract all function calls at any nesting level
const allFunctionCalls = extractAllFunctionCalls(transactionData);

// 2. Match each function to metadata
const operations = allFunctionCalls
  .map(func => findMetadataForSignature(func.signature))
  .filter(match => match !== null);

// 3. Display only metadata-defined operations
operations.forEach(op => displayOperation(op));
```

## Critical Principles

### 1. Zero Hardcoding
❌ **Forbidden**: Custom logic for specific protocols
```typescript
// WRONG - Protocol-specific hardcoding
if (operationName === 'repay') {
  // Custom Aave logic
}
```

✅ **Correct**: Generic metadata-driven approach
```typescript
// RIGHT - Pure metadata resolution
const value = resolveValueAtPath(data, field.path);
const formatted = formatValue(value, field.format);
```

### 2. Complete Argument Translation
- If metadata defines 5 fields → display all 5 fields
- If metadata defines 0 fields → show only generic transfer
- **Never pick and choose** which fields to display

### 3. Unmapped Data Handling
When metadata paths don't resolve to transaction data:
```typescript
if (value === undefined) {
  return "[unmapped]"; // Leave as bytecode indication
}
```

This ensures users understand when data exists but lacks metadata definition.

### 4. Exact Path Matching
Paths must resolve to actual transaction structure:
```json
// Transaction structure
{
  "methodCall": {
    "name": "execTransaction",
    "params": [
      {"name": "to", "type": "address", "value": "0x123..."},
      {"name": "data", "type": "bytes", "value": "0xabc...", 
       "valueDecoded": {
         "name": "transfer", 
         "params": [
           {"name": "recipient", "type": "address", "value": "0x456..."}
         ]
       }}
    ]
  }
}

// Valid paths
"#.to" → "0x123..." (main function parameter)
"#.data.valueDecoded.recipient" → "0x456..." (nested function parameter)
```

## Security Implications

### Path Validation
- All paths must resolve to actual transaction data
- No assumed parameter names or positions
- No fallback to hardcoded values

### Metadata Trust Model
- Hardware wallets verify metadata authenticity
- Users see only what metadata explicitly defines
- Unmapped data remains visible as bytecode

### Attack Prevention
- Prevents malicious metadata from hiding transaction details
- Ensures 1:1 correspondence between metadata and actual data
- No custom protocol logic that could be exploited

## Implementation Verification

### Testing Methodology
1. **Function Signature Tests**: Verify exact matching
2. **Path Resolution Tests**: Test all nesting levels
3. **Unmapped Data Tests**: Ensure proper bytecode display
4. **Cross-Protocol Tests**: Verify no hardcoded assumptions

### Example Test Cases
```bash
# Test 1: Direct ERC20 transfer
node cli-hardware-viewer.js erc20-metadata.json erc20-transfer.json

# Test 2: Safe multisig with nested ERC20 transfer  
node cli-hardware-viewer.js safe-metadata.json safe-exec-transfer.json

# Test 3: Complex DeFi operation with multiple nested calls
node cli-hardware-viewer.js aave-metadata.json aave-repay.json
```

Each test verifies:
- Correct function signature matching
- Accurate path resolution at all nesting levels
- Proper handling of unmapped data
- No hardcoded protocol assumptions

## Conclusion

The ERC7730 mapping methodology provides a secure, generic framework for translating Ethereum transaction bytecode into human-readable information. By following strict path resolution, avoiding hardcoded logic, and maintaining 1:1 metadata-to-data correspondence, it enables safe clear signing across all Ethereum protocols without protocol-specific customizations.

The system's strength lies in its simplicity: metadata defines paths, paths resolve to data, data gets formatted for display. No exceptions, no special cases, no hardcoded assumptions.