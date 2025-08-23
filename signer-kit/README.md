# Ledger Ethereum Clear Signing Metadata Example

This project demonstrates how to implement clear signing metadata with the Ledger Ethereum Signer Kit. Clear signing allows users to see human-readable transaction details on their Ledger device instead of raw transaction data.

## Features

- **ERC20 Token Information**: Provides token metadata for clear display of token transfers
- **Contract Method Resolution**: Resolves contract methods for better transaction understanding
- **NFT Metadata**: Supports NFT collection information for clear signing
- **Domain Name Resolution**: Shows ENS domains instead of addresses
- **Plugin Support**: External plugin integration for complex contract interactions

## Installation

```bash
npm install
```

## Usage

### Basic Clear Signing Example
```bash
npm start
```

### Run Tests
```bash
# Test clear signing functionality
npm test

# Test ERC20 metadata specifically
npm run test-erc20
```

## Clear Signing Metadata Types

### 1. ERC20 Token Information
Provides token ticker, decimals, and contract address for clear display during token transfers.

### 2. Contract Method Resolution
Resolves contract methods to show function names and parameters in human-readable format.

### 3. NFT Collection Information
Shows NFT collection names and metadata instead of raw contract addresses.

### 4. Domain Name Resolution
Displays ENS domains and other naming services instead of hex addresses.

### 5. Plugin Integration
Supports external plugins for complex DeFi protocols like Uniswap, Compound, etc.

## Project Structure

```
├── src/
│   ├── index.js                 # Main example implementation
│   ├── clear-signing.js         # Clear signing metadata utilities
│   ├── erc20-metadata.js        # ERC20 token metadata handling
│   └── contract-resolver.js     # Contract method resolution
├── test/
│   ├── test-clear-signing.js    # Main test suite
│   └── test-erc20-metadata.js   # ERC20 specific tests
└── data/
    ├── erc20-tokens.json        # Sample ERC20 token data
    └── contracts.json           # Sample contract metadata
```

## Security Notes

- Always verify transaction details on your Ledger device
- Clear signing metadata should be from trusted sources
- Test with small amounts first
- Keep your Ledger firmware updated

## References

- [Ledger Developer Documentation](https://developers.ledger.com/docs/device-interaction/references/signers/eth)
- [EIP-712 Typed Data](https://eips.ethereum.org/EIPS/eip-712)
- [Ledger Clear Signing](https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-app-eth) 