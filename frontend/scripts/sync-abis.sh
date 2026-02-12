#!/bin/bash

# Sync ABIs from v1-core to frontend
# This script copies the compiled contract ABIs from the v1-core repository

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
V1_CORE_PATH="../../v1-core/out"
ABI_DIR="src/lib/abis/generated"

echo -e "${YELLOW}Syncing ABIs from v1-core...${NC}"

# Create directory if it doesn't exist
mkdir -p "$ABI_DIR"

# Check if v1-core exists
if [ ! -d "$V1_CORE_PATH" ]; then
    echo "Error: v1-core not found at $V1_CORE_PATH"
    echo "Please ensure v1-core is cloned and compiled"
    exit 1
fi

# Copy ABI files
cp "$V1_CORE_PATH/KaiSign.sol/KaiSign.json" "$ABI_DIR/KaiSign.json"
cp "$V1_CORE_PATH/KAIArbitration.sol/KAIArbitration.json" "$ABI_DIR/KAIArbitration.json"
cp "$V1_CORE_PATH/KAIToken.sol/KAIToken.json" "$ABI_DIR/KAIToken.json"

echo -e "${GREEN}✅ ABIs synced successfully!${NC}"
echo "  - KaiSign.json"
echo "  - KAIArbitration.json"
echo "  - KAIToken.json"
