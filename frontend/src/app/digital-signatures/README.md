# Ethereum Digital Signatures

This module provides a comprehensive implementation for creating and verifying digital signatures using Ethereum wallets. It allows users to:

1. Sign messages with their Ethereum wallet
2. Verify message signatures and recover the signer's address
3. Support for both personal signatures (EIP-191) and typed data signatures (EIP-712)

## Implementation

### Core Components

- `SignatureService`: Utility class for working with Ethereum signatures
- `useSignature`: React hook for integrating signature functionality in components
- `SignMessage`: UI component for signing messages
- `VerifySignature`: UI component for verifying signatures

### Security Features

- **Timestamp inclusion**: Automatically adds timestamps to signed messages to prevent replay attacks
- **Address validation**: Custom address validation ensures properly formatted Ethereum addresses
- **Error handling**: Comprehensive error handling for wallet connection issues, invalid signatures, etc.

## How It Works

### Signing Messages

1. User connects their Ethereum wallet (MetaMask, etc.)
2. User enters a message to sign
3. Message is combined with a timestamp
4. Wallet signing flow is triggered via `ethers.js`
5. Signature is displayed along with the full message and signer address

### Verifying Signatures

1. User inputs the original signed message
2. User inputs the signature
3. Optional: Input the expected signer address
4. System recovers the address that created the signature
5. If expected address was provided, system verifies the match

## Code Example - Signing

```typescript
// Using the hook in a component
const { signMessage, signatureState } = useSignature();

// Trigger signing
await signMessage("Hello, world!");

// Access the result
console.log(signatureState.message);    // The signed message with timestamp
console.log(signatureState.signature);  // The signature
console.log(signatureState.address);    // The signer's address
console.log(signatureState.timestamp);  // The timestamp
```

## Code Example - Verifying

```typescript
// Using the hook in a component
const { verifyMessageSignature, verificationState } = useSignature();

// Verify a signature
verifyMessageSignature(
  "Hello, world!\nTimestamp: 1647123456789", 
  "0x1234...",                               // Signature
  "0xabc..."                                 // Optional: expected address
);

// Access the result
console.log(verificationState.isValid);         // Whether verification succeeded
console.log(verificationState.recoveredAddress); // The address that signed the message
```

## Technical Details

1. **Message Signing**: Uses `eth_sign` JSON-RPC method through ethers.js
2. **Address Recovery**: Uses ECDSA cryptography to recover the public key/address from the signature and message
3. **EIP-712 Support**: Supports structured data signing for improved security and UX

## Security Considerations

- Always include timestamps or nonces to prevent replay attacks
- Verify that the recovered address matches the expected signer
- Be aware that message signatures can be used for authentication
- Never sign arbitrary messages from untrusted sources

## Testing

The signature implementation includes comprehensive tests:
- `test-signature.mjs`: Tests basic signing and verification 
- `test-signatures-integration.js`: Tests integration with UI components

To run the tests:
```
node test-signature.mjs
node test-signatures-integration.js
``` 