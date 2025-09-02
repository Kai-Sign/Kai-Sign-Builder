#!/bin/bash

# Run EigenDA Proxy connected to real Holesky testnet
# This connects to the actual EigenDA network!

echo "🚀 Starting EigenDA Proxy for Holesky Testnet"
echo "============================================"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not running"
    echo "Please start Docker Desktop first"
    exit 1
fi

# Use a test private key (no funds needed for testnet)
# In production, use your own key
TEST_PRIVATE_KEY="0x0000000000000000000100000000000000000000000000000000000000000001"

echo "📡 Connecting to:"
echo "   Network: Holesky Testnet"
echo "   Disperser: disperser-holesky.eigenda.xyz:443"
echo "   Service Manager: 0xD4A7E1Bd8015057293f0D0A557088c286942e84b"
echo ""

# Run the proxy
docker run --rm -p 3100:3100 \
  --name eigenda-proxy-holesky \
  ghcr.io/layr-labs/eigenda-proxy:latest \
  --eigenda.disperser-rpc=disperser-holesky.eigenda.xyz:443 \
  --eigenda.eth-rpc=https://ethereum-holesky-rpc.publicnode.com \
  --eigenda.svc-manager-addr=0xD4A7E1Bd8015057293f0D0A557088c286942e84b \
  --eigenda.signer-private-key-hex=$TEST_PRIVATE_KEY \
  --eigenda.max-blob-length=1MiB \
  --port=3100

echo "✅ Proxy is running at http://localhost:3100"
echo "You can now post blobs to the real EigenDA testnet!"