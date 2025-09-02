# How to Use EigenDA Proxy as the Actual Endpoint

The EigenDA proxy is what makes everything simple - it provides REST endpoints instead of gRPC and handles all encoding/decoding automatically!

## 1. Start the EigenDA Proxy

### Option A: Using Docker (Recommended)
```bash
docker run --rm -p 3100:3100 \
  ghcr.io/layr-labs/eigenda-proxy:latest \
  --eigenda.disperser-rpc=disperser-holesky.eigenda.xyz:443 \
  --eigenda.eth-rpc=https://ethereum-holesky-rpc.publicnode.com \
  --eigenda.svc-manager-addr=0xD4A7E1Bd8015057293f0D0A557088c286942e84b \
  --eigenda.signer-private-key-hex=0x0000000000000000000100000000000000000000000000000000000000000001 \
  --port=3100
```

### Option B: Deploy to Cloud (Production)
Deploy the proxy to services like:
- Railway.app
- Render.com
- Fly.io
- AWS/GCP/Azure
- Your own VPS

## 2. Use the Proxy Endpoints

Once running, the proxy provides these simple REST endpoints:

### POST Blob (No Encoding Needed!)
```bash
# Just send your raw JSON data
curl -X POST http://localhost:3100/put \
  -H "Content-Type: application/octet-stream" \
  -d '{"message": "Hello EigenDA", "data": "anything"}' \
  -o certificate.bin

# The proxy returns a certificate (binary)
```

### GET Blob (Automatically Decoded!)
```bash
# Convert certificate to hex
CERT_HEX=$(xxd -p certificate.bin | tr -d '\n')

# Retrieve - comes back decoded!
curl http://localhost:3100/get/$CERT_HEX

# Response: {"message": "Hello EigenDA", "data": "anything"}
```

## 3. JavaScript/Frontend Usage

```javascript
// POST data to EigenDA via proxy
async function postToEigenDA(data) {
  const response = await fetch('http://localhost:3100/put', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: JSON.stringify(data)
  });
  
  // Get certificate as hex
  const buffer = await response.arrayBuffer();
  const certificate = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return certificate;
}

// GET data from EigenDA via proxy
async function getFromEigenDA(certificate) {
  const response = await fetch(`http://localhost:3100/get/${certificate}`);
  const data = await response.json(); // Already decoded!
  return data;
}

// Example usage
async function example() {
  // Post
  const cert = await postToEigenDA({ 
    type: "ERC7730", 
    contract: "0x123..." 
  });
  console.log('Certificate:', cert);
  
  // Retrieve
  const data = await getFromEigenDA(cert);
  console.log('Retrieved:', data); // Your original JSON!
}
```

## 4. Production Setup

### Environment Variables
```bash
# .env file
EIGENDA_PROXY_URL=https://your-proxy.domain.com
EIGENDA_DISPERSER_RPC=disperser-holesky.eigenda.xyz:443
EIGENDA_ETH_RPC=https://ethereum-holesky-rpc.publicnode.com
EIGENDA_SERVICE_MANAGER=0xD4A7E1Bd8015057293f0D0A557088c286942e84b
EIGENDA_SIGNER_KEY=your-private-key-here
```

### Docker Compose
```yaml
version: '3.8'
services:
  eigenda-proxy:
    image: ghcr.io/layr-labs/eigenda-proxy:latest
    ports:
      - "3100:3100"
    environment:
      - EIGENDA_PROXY_EIGENDA_DISPERSER_RPC=${EIGENDA_DISPERSER_RPC}
      - EIGENDA_PROXY_EIGENDA_ETH_RPC=${EIGENDA_ETH_RPC}
      - EIGENDA_PROXY_EIGENDA_SERVICE_MANAGER_ADDR=${EIGENDA_SERVICE_MANAGER}
      - EIGENDA_PROXY_EIGENDA_SIGNER_PRIVATE_KEY_HEX=${EIGENDA_SIGNER_KEY}
    restart: unless-stopped
```

## 5. Key Benefits of Using the Proxy

| Direct gRPC | Via Proxy |
|-------------|-----------|
| Complex gRPC protocol | Simple REST API |
| Manual encoding required | Automatic encoding |
| Returns encoded data | Returns decoded data |
| Need grpcurl or gRPC client | Works with curl/fetch |
| Field element errors | Handles all complexity |

## 6. Testing the Proxy

```bash
# Quick test
echo "Test data" | curl -X POST http://localhost:3100/put \
  --data-binary @- -s | xxd -p | tr -d '\n' > cert.txt

# Retrieve
curl http://localhost:3100/get/$(cat cert.txt)
# Output: Test data
```

## 7. Smart Contract Integration

The certificate/blob hash from the proxy can be stored in your contract:

```solidity
// Store the blob hash (first 32 bytes of certificate)
bytes32 public eigenDABlobHash;

function storeBlob(bytes32 _blobHash) external {
    eigenDABlobHash = _blobHash; // Same as EIP-4844!
}
```

## Summary

**The proxy IS the actual endpoint you should use!**
- Disperser endpoint: `disperser-holesky.eigenda.xyz:443` (gRPC, complex)
- Proxy endpoint: `http://localhost:3100` or `https://your-proxy.com` (REST, simple)

The proxy talks to the disperser for you and handles all the complexity!