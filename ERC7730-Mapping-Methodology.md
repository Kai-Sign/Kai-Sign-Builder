# ERC7730 Metadata to Transaction Data Mapping Methodology

## Overview

This document explains the technical methodology for mapping ERC7730 metadata to Ethereum transaction bytecode, ensuring 1:1 correspondence between metadata field definitions and actual transaction data without hardcoded assumptions.

## References and Citations

### Official Specifications
- **ERC-7730 Standard**: [Ethereum Improvement Proposal](https://eips.ethereum.org/EIPS/eip-7730)
- **Ledger ERC-7730 Documentation**: [Developer Portal](https://developers.ledger.com/docs/clear-signing/references/erc7730-standard)
- **ERC-7730 Registry**: [GitHub Repository](https://github.com/LedgerHQ/clear-signing-erc7730-registry)
- **Solidity ABI Specification**: [Official Documentation](https://docs.soliditylang.org/en/latest/abi-spec.html)
- **Ethereum Yellow Paper**: [Formal Specification](https://ethereum.github.io/yellowpaper/paper.pdf)

### Technical Standards
- **Function Selectors**: [Ethereum Stack Exchange](https://ethereum.stackexchange.com/questions/72363/what-is-a-function-selector)
- **4-Byte Directory**: [Signature Database](https://www.4byte.directory/)
- **Method ID Specification**: [Etherscan Documentation](https://info.etherscan.com/what-is-method-id/)

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

**Source**: [Solidity ABI Specification](https://docs.soliditylang.org/en/latest/abi-spec.html) - "The first four bytes of the call data for a function call specifies the function to be called. It is the first (left, high-order in big-endian) four bytes of the Keccak-256 hash of the signature of the function."

### ABI Encoding Structure
After the function selector, parameters are encoded according to Ethereum's ABI specification:
- **Static types** (uint256, address, bool): 32-byte aligned
- **Dynamic types** (bytes, string, arrays): Offset pointer + length + data
- **Struct types**: Sequential encoding of components

**Source**: [Solidity ABI Specification](https://docs.soliditylang.org/en/latest/abi-spec.html) - "The Contract Application Binary Interface (ABI) is the standard way to interact with contracts in the Ethereum ecosystem, both from outside the blockchain and for contract-to-contract interaction."

## ERC7730 Clear Signing Standard

### Purpose
ERC7730 provides metadata to transform raw bytecode into human-readable information:
- **Function identification**: Match selectors to human-readable operation names
- **Parameter mapping**: Map bytecode positions to semantic field labels
- **Value formatting**: Apply proper formatting (token amounts, addresses, etc.)

**Source**: [ERC-7730 Standard](https://eips.ethereum.org/EIPS/eip-7730) - "The ERC-7730 specification enriches type data contained in the ABIs and schemas of structured messages with additional formatting information, so that wallets can construct a better UI when displaying the data before signature."

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
ERC-7730 uses a sophisticated path notation with three root node types:
- `#.fieldName`: References structured data schema (ABI parameters)
- `$.metadata.constants`: References metadata constants within the file
- `@.from`: References container structure values (transaction metadata)

Additional path features:
- Array slicing: `#.params.path[:20]` (first 20 bytes), `#.params.path[-20:]` (last 20 bytes)
- Index access: `#.params[0]`, `#.params[1]` (position-based ABI access)
- Full arrays: `#.details.[]` (entire array)

**Source**: [ERC-7730 Registry Specification](https://github.com/LedgerHQ/clear-signing-erc7730-registry/blob/master/specs/erc-7730.md) - "Root Node Identifiers: # refers to structured data schema, $ refers to current file's metadata, @ refers to container structure values."

### ERC-7730 Compliant Path Resolver Algorithm
```typescript
function resolveValueAtPath(data: any, metadata: any, path: string): any {
  // 1. Parse root node and path
  const rootNode = path.charAt(0); // #, $, or @
  if (!["#", "$", "@"].includes(rootNode)) {
    throw new Error(`Invalid root node: ${rootNode}`);
  }
  
  const pathWithoutRoot = path.substring(2); // Remove root + dot
  
  // 2. Resolve based on root node type
  let current: any;
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
  
  // 3. Handle array slice notation
  const pathParts = pathWithoutRoot.split('.');
  
  for (const part of pathParts) {
    if (!current) return undefined;
    
    // a) Handle array slicing: path[:20], path[-20:], path[1:5]
    const sliceMatch = part.match(/^(.+)\[(-?\d*):(-?\d*)\]$/);
    if (sliceMatch) {
      const [, arrayName, startStr, endStr] = sliceMatch;
      const array = current[arrayName];
      if (Array.isArray(array) || typeof array === 'string') {
        const start = startStr === '' ? 0 : parseInt(startStr);
        const end = endStr === '' ? array.length : parseInt(endStr);
        current = array.slice(start, end);
        continue;
      }
    }
    
    // b) Handle array index access: params[0], params[1]
    const indexMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (indexMatch) {
      const [, arrayName, indexStr] = indexMatch;
      const idx = parseInt(indexStr);
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        current = current[arrayName][idx];
        continue;
      }
    }
    
    // c) Handle full array access: details.[]
    if (part.endsWith('.[]')) {
      const arrayName = part.slice(0, -3);
      current = current[arrayName];
      continue;
    }
    
    // d) Position-based ABI parameter access (ERC-7730 requirement)
    if (part === 'params' && current.methodCall?.params) {
      current = current.methodCall.params;
      continue;
    }
    
    // e) Direct property access
    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    // 5. Path not found
    return undefined;
  }
  
  // 6. Extract final value
  return current?.value !== undefined ? current.value : current;
```

## Mapping Process Flow

### 1. Function Signature Matching
```typescript
// Extract function signature from transaction
const functionName = transactionData.methodCall.name; // "transfer"
const params = transactionData.methodCall.params.map(p => p.type); // ["address", "uint256"]
const signature = `${functionName}(${params.join(',')})`;  // "transfer(address,uint256)"

// Compute ERC-7730 compliant function selector (4-byte Keccak-256 hash)
import { keccak256 } from 'ethers';
const selectorHash = keccak256(Buffer.from(signature));
const selector = selectorHash.slice(0, 10); // "0xa9059cbb"

// Match against metadata operations (can use signature or selector)
const operation = metadata.display.formats[signature] || metadata.display.formats[selector];
```

### 2. Field Mapping
```typescript
// For each field defined in metadata
operation.fields.forEach(field => {
  // Resolve the value using ERC-7730 compliant path resolution
  const value = resolveValueAtPath(transactionData, metadata, field.path);
  
  // Apply formatting based on ERC-7730 format types
  const displayValue = formatValue(value, field.format, field.params);
  
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

### 1. ERC-7730 Compliance
❌ **Forbidden**: Non-compliant path resolution
```typescript
// WRONG - Stripping root nodes
if (path.startsWith('#.')) {
  cleanPath = path.substring(2);
}
```

✅ **Correct**: ERC-7730 compliant root node handling
```typescript
// RIGHT - Preserve and process root nodes
const rootNode = path.charAt(0); // #, $, or @
switch (rootNode) {
  case '#': resolveFromStructuredData(data, pathWithoutRoot);
  case '$': resolveFromMetadata(metadata, pathWithoutRoot);
  case '@': resolveFromContainer(container, pathWithoutRoot);
}
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

### 4. ERC-7730 Path Resolution
Paths must follow ERC-7730 specification exactly:
```json
// Transaction structure (ABI-encoded)
{
  "methodCall": {
    "name": "execTransaction",
    "params": [
      {"type": "address", "value": "0x123..."}, // params[0]
      {"type": "bytes", "value": "0xabc..."}     // params[1]
    ]
  }
}

// Valid ERC-7730 paths
"#.params[0]" → "0x123..." (position-based access)
"#.params[1][:4]" → "0xabc9" (slice first 4 bytes)
"$.metadata.constants.tokenAddress" → metadata constant
"@.from" → transaction sender address
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

**Source**: [Ledger Clear Signing Documentation](https://developers.ledger.com/docs/clear-signing/erc7730) - "The main security concern introduced by ERC-7730 is to avoid attacks that would use the ERC-7730 formatting mechanism to trick users into signing something wrong."

## Implementation Verification

### Testing Methodology
1. **Function Selector Tests**: Verify Keccak-256 hash computation
2. **Root Node Tests**: Test `#`, `$`, `@` path resolution
3. **Array Slice Tests**: Verify `[:20]`, `[-20:]`, `[1:5]` notation
4. **Position-Based Access**: Test `#.params[0]`, `#.params[1]` resolution
5. **Metadata Constants**: Test `$.metadata.constants` access
6. **Container Values**: Test `@.from`, `@.to` resolution

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

**Implementation Validation**: This corrected methodology now properly aligns with the official ERC-7730 specification, including:
- Correct root node resolution (`#`, `$`, `@`)
- Position-based ABI parameter access
- Array slice selector support
- Keccak-256 function selector computation
- Metadata constant resolution

The previous implementation had critical compliance violations that have been addressed in this specification.

## Additional Reading

- [Ledger Generic Parser Blog Post](https://www.ledger.com/blog-generic-parser-erc7730)
- [ERC-7730 Developer Tools](https://github.com/LedgerHQ/clear-signing-erc7730-developer-tools)
- [Ethereum Magicians ERC-7730 Discussion](https://ethereum-magicians.org/t/eip-7730-proposal-for-a-clear-signing-standard-format-for-wallets/20403)