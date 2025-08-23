# Hardware Wallet Integration Guide

## Overview

This signer-kit provides production-ready hardware wallet integration with ERC-7730 clear signing support. Unlike traditional blind signing where users see only hexadecimal data, ERC-7730 enables hardware wallets to display human-readable transaction details.

## Key Differences from Mock Implementation

### Previous Mock Implementation Issues:
- ❌ Used mock transport instead of real hardware connection
- ❌ Hardcoded metadata instead of fetching from registry
- ❌ No actual ERC-7730 schema validation
- ❌ Missing proper error handling
- ❌ No multi-wallet support

### Current Production Implementation:
- ✅ Real hardware wallet connections (USB/WebUSB)
- ✅ Dynamic ERC-7730 metadata fetching
- ✅ Full schema validation
- ✅ Comprehensive error handling
- ✅ Support for multiple wallet types

## File Structure

```
signer-kit/
├── src/
│   ├── index.js                    # Main integration examples
│   ├── hardware-wallet-signer.js   # Core hardware wallet interface
│   ├── erc7730-provider.js        # ERC-7730 metadata management
│   ├── transaction-parser.js       # Transaction interpretation
│   ├── clear-signing.js           # Legacy clear signing resolver
│   └── erc20-metadata.js          # Token metadata provider
├── contracts/                       # ERC-7730 metadata files
│   ├── kaisign-erc7730.json
│   ├── usdc-erc7730.json
│   └── uniswap-v3-erc7730.json
└── test/                           # Test suites
```

## How It Works

### 1. Transaction Flow

```javascript
// User initiates transaction
const tx = {
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  data: '0xa9059cbb...', // transfer(address,uint256)
  value: '0x0'
};

// System fetches ERC-7730 metadata
const metadata = await erc7730Provider.getContractMetadata(tx.to, chainId);

// Formats for hardware wallet display
const display = await erc7730Provider.formatTransactionForDisplay(tx, 'transfer');

// Sends to hardware wallet with clear text
await hardwareWallet.signTransaction(tx, display);
// User sees: "Transfer 100 USDC to alice.eth"
```

### 2. ERC-7730 Metadata Resolution

The system resolves metadata through multiple sources:

1. **Local Registry**: Pre-cached metadata files
2. **On-chain Registry**: MetadataRegistry contract
3. **IPFS**: Decentralized metadata storage
4. **API Fallback**: Centralized registry service

### 3. Display Field Processing

ERC-7730 defines how each field should be displayed:

```json
{
  "fields": [
    {
      "path": "to",           // Data location
      "label": "Recipient",   // Display label
      "format": "addressName" // Format type (ENS lookup)
    },
    {
      "path": "amount",
      "label": "Amount", 
      "format": "tokenAmount", // Formats with decimals
      "params": {
        "tokenPath": "USDC"   // Token context
      }
    }
  ]
}
```

## Hardware Wallet Support

### Ledger Devices

**Supported Models:**
- Ledger Nano S/S Plus
- Ledger Nano X
- Ledger Stax

**Features:**
- Full ERC-7730 clear signing
- ERC-20 token recognition
- NFT collection display
- ENS name resolution
- DeFi protocol plugins

### Trezor Devices (Planned)

**Planned Support:**
- Trezor Model One
- Trezor Model T
- Trezor Safe 3

## Security Architecture

### 1. Metadata Validation

```javascript
// Every metadata file is validated
async validateMetadata(metadata) {
  // Check ERC-7730 schema compliance
  validateSchema(metadata);
  
  // Verify cryptographic signature
  verifySignature(metadata.signature);
  
  // Check contract deployment
  verifyDeployment(metadata.context.deployments);
}
```

### 2. Transaction Verification

- Contract address verification
- Method selector validation
- Parameter bounds checking
- Chain ID confirmation

### 3. User Protection

- Never sign if metadata invalid
- Show warnings for unknown contracts
- Require explicit confirmation
- Display full transaction context

## Common Use Cases

### DeFi Trading

```javascript
// Uniswap swap
const swapTx = {
  to: UNISWAP_ROUTER,
  data: encodeSwap(tokenIn, tokenOut, amount)
};

await signer.signTransaction(swapTx);
// Shows: "Swap 100 USDC for ~0.05 ETH on Uniswap"
```

### NFT Operations

```javascript
// NFT transfer
const nftTx = {
  to: NFT_CONTRACT,
  data: encodeTransfer(from, to, tokenId)
};

await signer.signTransaction(nftTx);
// Shows: "Transfer CryptoPunk #1234 to bob.eth"
```

### Multi-signature

```javascript
// Safe transaction
const safeTx = {
  to: SAFE_CONTRACT,
  data: encodeExecTransaction(target, value, data)
};

await signer.signTransaction(safeTx);
// Shows: "Execute: Transfer 1000 USDC via Safe"
```

## Troubleshooting

### Connection Issues

```bash
# Check USB permissions (Linux)
sudo usermod -a -G plugdev $USER

# Install udev rules
wget -q -O - https://raw.githubusercontent.com/LedgerHQ/udev-rules/master/add_udev_rules.sh | sudo bash
```

### Metadata Not Found

```javascript
// Fallback to basic signing
if (!metadata) {
  console.warn('No ERC-7730 metadata, using blind signing');
  // Still signs but shows hex data
}
```

### Device Not Responding

1. Ensure Ethereum app is open
2. Check cable connection
3. Try different USB port
4. Update device firmware

## Development Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Set up environment
export DEVICE_TYPE=ledger
export RPC_URL=your_rpc_url
```

### Testing with Hardware

```bash
# Connect your hardware wallet first
npm run test:hardware

# Test specific device
DEVICE_TYPE=ledger npm test
```

### Mock Testing

```bash
# No hardware required
npm run test:mock
```

## Best Practices

1. **Always Validate Metadata**: Never trust unverified metadata
2. **Cache Wisely**: Cache metadata but validate on use
3. **Handle Disconnections**: Gracefully handle device disconnections
4. **User Experience**: Show progress during signing
5. **Error Messages**: Provide clear, actionable error messages

## Future Enhancements

- [ ] Trezor device support
- [ ] Lattice1 integration
- [ ] Mobile wallet connections
- [ ] Batch transaction signing
- [ ] Advanced DeFi protocol plugins
- [ ] Cross-chain metadata support

## Contributing

To add support for new contracts:

1. Create ERC-7730 metadata file
2. Validate against schema
3. Test with hardware device
4. Submit PR with tests

## Support

For issues or questions:
- GitHub Issues: [Create issue](https://github.com/kaisign/signer-kit/issues)
- Documentation: [ERC-7730 Specs](https://specs.erc7730.org)
- Discord: [Join community](https://discord.gg/kaisign)