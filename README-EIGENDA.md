# EigenDA Integration for KaiSign

This branch contains the EigenDA v2 testnet integration for posting ERC7730 specifications as blobs.

## 🚀 Quick Start (No Docker Required!)

### Run Mock EigenDA Server Locally

```bash
# Start the mock server (no dependencies needed)
node mock-eigenda-server.js

# In another terminal, test it
curl -X POST http://localhost:3100/put \
  -H "Content-Type: application/octet-stream" \
  --data-binary "Hello EigenDA"

# The server will return a certificate (hex encoded)
# Use it to retrieve your data:
curl http://localhost:3100/get/{certificate}
```

## Quick Start

### 1. Test EigenDA with Simple Script (No Dependencies)

```bash
# Test with bash script (requires only curl)
./test-eigenda-simple.sh

# Test with a JSON file
./test-eigenda-simple.sh your-file.json
```

### 2. Test with Node.js Script (Requires npm packages)

```bash
# Install dependencies first
cd backend && npm install && cd ..

# Run tests
node test-eigenda.js

# Test with large data
node test-eigenda.js --large

# Test with custom file
node test-eigenda.js --file=path/to/your/file.json

# Run with local memstore (requires Docker)
node test-eigenda.js --memstore
```

## Running EigenDA Proxy

### Option 1: Quick Test with Memstore (Local Only)

```bash
# Run EigenDA proxy with in-memory storage (for testing only)
docker run --rm -p 3100:3100 ghcr.io/layr-labs/eigenda-proxy:latest \
  --memstore.enabled \
  --port 3100
```

### Option 2: Connect to Holesky Testnet

```bash
# Using docker-compose (recommended)
docker-compose -f docker-compose.eigenda.yml up -d

# Check logs
docker-compose -f docker-compose.eigenda.yml logs -f

# Stop
docker-compose -f docker-compose.eigenda.yml down
```

### Option 3: Manual Docker Run for Holesky

```bash
docker run --rm -p 3100:3100 ghcr.io/layr-labs/eigenda-proxy:latest \
  --eigenda.eth-rpc=https://ethereum-holesky-rpc.publicnode.com \
  --eigenda.network=holesky_testnet \
  --eigenda.dispersal-backend=V2 \
  --eigenda.storage-backends-enabled=V1,V2 \
  --eigenda.disperser-rpc=disperser-testnet-holesky.eigenda.xyz:443 \
  --eigenda.service-manager-addr=0xD4A7E1Bd8015057293f0D0A557088c286942e84b \
  --eigenda.signer-private-key-hex=0000000000000000000100000000000000000000000000000000000000000000 \
  --port=3100
```

## Configuration

### Environment Variables

Create a `.env.eigenda` file:

```bash
cp .env.eigenda.example .env.eigenda
# Edit with your configuration
```

Key variables:
- `EIGENDA_PROXY_URL`: URL of the EigenDA proxy (default: http://localhost:3100)
- `EIGENDA_SIGNER_KEY`: Private key for signing (use test key for development)
- `EIGENDA_NETWORK`: Network to use (holesky_testnet for testnet)

## API Endpoints

Once the backend is running (`node backend/eigenda-api.js`):

### Post a Blob
```bash
curl -X POST http://localhost:3001/api/eigenda/blob \
  -H "Content-Type: application/json" \
  -d '{"data": "Hello EigenDA"}'
```

### Retrieve a Blob
```bash
curl http://localhost:3001/api/eigenda/blob/{certificate}
```

### Post ERC7730 Spec
```bash
curl -X POST http://localhost:3001/api/eigenda/erc7730 \
  -H "Content-Type: application/json" \
  -d '{
    "erc7730Data": {
      "type": "ERC7730",
      "version": "1.0.0",
      "contract": "0x..."
    },
    "metadata": {
      "chainId": 11155111
    }
  }'
```

## How It Works

1. **Data Submission**: Instead of posting to EIP-4844 blobs on Ethereum, data is sent to EigenDA
2. **Certificate Return**: EigenDA returns a certificate that acts like a blob hash
3. **On-chain Reference**: The certificate/blob hash is stored in the smart contract (same as before)
4. **Data Retrieval**: Use the certificate to retrieve the original data from EigenDA

## Key Differences from EIP-4844

| Feature | EIP-4844 | EigenDA |
|---------|----------|---------|
| Data Size Limit | 128KB | 1MB+ |
| Cost | L1 Gas fees | Much cheaper |
| Availability | 2 weeks | Configurable |
| Network | Ethereum L1 | EigenDA network |
| Finality | L1 finality | DA layer finality |

## Testnet Information

- **Network**: Holesky Testnet
- **Disperser**: `disperser-testnet-holesky.eigenda.xyz:443`
- **Service Manager**: `0xD4A7E1Bd8015057293f0D0A557088c286942e84b`
- **Blob Explorer**: https://blobs-v2-testnet-holesky.eigenda.xyz/

## Troubleshooting

### Proxy Not Reachable
- Ensure Docker is running
- Check if port 3100 is available
- Verify network connectivity to disperser endpoint

### Blob Posting Fails
- Check proxy logs: `docker logs eigenda-proxy`
- Ensure you have a valid signer key (even test key for testnet)
- Verify the data size is within limits (1MB)

### Timeout Issues
- EigenDA dispersal can take up to 2 minutes
- Retrieval should be faster (< 30 seconds)
- Consider increasing timeouts in production

## Security Notes

⚠️ **IMPORTANT**: 
- Never use the test private key in production
- Generate your own keypair for mainnet
- The test key (`0x0000...0001`) has no funds and is for testing only

## Next Steps

1. Test blob posting with the scripts
2. Integrate the EigenDA service into your application
3. Update frontend to use EigenDA endpoints
4. Deploy smart contracts that reference EigenDA blob hashes

## Resources

- [EigenDA Documentation](https://docs.eigenda.xyz/)
- [EigenDA GitHub](https://github.com/Layr-Labs/eigenda)
- [Blob Explorer](https://blobs-v2-testnet-holesky.eigenda.xyz/)
- [EigenDA Proxy](https://github.com/Layr-Labs/eigenda-proxy)