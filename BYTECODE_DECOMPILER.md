# Bytecode Decompiler for ERC-7730 Hardware Wallet Display

This feature allows you to decompile Ethereum transaction bytecode and match it with ERC-7730 metadata to visualize how transactions will appear on Ledger hardware wallets.

## Features

- **Bytecode Decompilation**: Analyzes transaction calldata to identify function calls and parameters
- **ERC-7730 Matching**: Matches decompiled data with ERC-7730 metadata for clear signing
- **Hardware Wallet Preview**: Shows exactly how transactions will appear on Ledger devices
- **Batch Transaction Support**: Handles complex batch operations (BatchExecutor, DeleGator)
- **Nested Operation Analysis**: Decodes inner transactions within batch operations

## Usage

### Via Hardware Viewer UI

1. Navigate to the Hardware Viewer page
2. Click on the "Bytecode Decompiler" tab
3. Enter:
   - Chain ID (1 for Mainnet, 11155111 for Sepolia)
   - Contract address
   - Transaction bytecode/calldata
4. Click "Decompile Bytecode" to analyze

### Via API

```bash
curl -X POST http://localhost:3000/api/decompile \
  -H "Content-Type: application/json" \
  -d '{
    "bytecode": "0xa9059cbb...",
    "contractAddress": "0x...",
    "chainId": 1
  }'
```

## Test Transactions

The following Sepolia transactions are available for testing:

### 1. BatchExecutor - Multiple Transfers
- TX: [0x7c756c8c...](https://sepolia.etherscan.io/tx/0x7c756c8c549e5ba4710ba81844ac6cef27326623424b470897dc8d08bfc43113)
- Contract: `0x5dd9fdf2310b5dac8dced8a100fb4952546ae7bd`
- Function: `executeBatch` with 2 ERC20 transfers

### 2. DeleGator - Execute with Mode
- TX: [0x2eca4eb7...](https://sepolia.etherscan.io/tx/0x2eca4eb7ae55dcc419c0e21ac34a3e57731b2bb5825bef9048afb1e55d0dccd0)
- Contract: `0x5315eb7f03465aa2aef2fe052b8eed2cab0741a0`
- Function: `execute` with batch mode

### 3. Simple Transfer
- TX: [0x8c99c823...](https://sepolia.etherscan.io/tx/0x8c99c823afaf80b6889a9a7d5eb9337bd60e88bd62f9dcce4491043d5576edbf)
- Contract: `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- Function: `transfer` (ERC20)

## Architecture

### Components

1. **bytecodeDecompiler.ts**: Core decompilation logic
   - Extracts function selectors
   - Decodes function parameters
   - Handles batch operations
   - Integrates with Etherscan for ABI fetching

2. **erc7730Matcher.ts**: ERC-7730 metadata matching
   - Loads metadata from various sources
   - Matches decompiled data with metadata fields
   - Generates hardware wallet display screens

3. **Hardware Viewer Integration**: UI component
   - Three modes: Simple, Advanced, and Bytecode Decompiler
   - Real-time preview of hardware wallet screens
   - Support for multiple metadata files

## Known Function Selectors

The decompiler recognizes common function selectors:
- `0xa9059cbb`: ERC20 transfer
- `0x095ea7b3`: ERC20 approve
- `0x23b872dd`: ERC20 transferFrom
- `0x34fcd5be`: BatchExecutor executeBatch
- `0x1cff79cd`: DeleGator execute

## Testing

Run the test script to verify functionality:

```bash
node test-decompiler.js
```

This will test all sample transactions and display the decompilation results.

## Future Improvements

- Support for more contract types and function selectors
- Integration with more hardware wallet types
- Enhanced ERC-7730 metadata discovery
- Support for complex DeFi protocols