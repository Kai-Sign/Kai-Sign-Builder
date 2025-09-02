#!/bin/bash

# Simple EigenDA Test Script - No dependencies required
# This script tests EigenDA blob posting using only curl

# Configuration
EIGENDA_PROXY_URL="${EIGENDA_PROXY_URL:-http://localhost:3100}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 EigenDA Simple Test Script${NC}"
echo -e "${CYAN}================================${NC}"
echo -e "${BLUE}Proxy URL: ${EIGENDA_PROXY_URL}${NC}\n"

# Function to check if proxy is running
check_proxy() {
    echo -e "${CYAN}🔍 Checking EigenDA Proxy health...${NC}"
    
    if curl -s -o /dev/null -w "%{http_code}" "${EIGENDA_PROXY_URL}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ EigenDA Proxy is reachable${NC}"
        return 0
    else
        echo -e "${RED}❌ EigenDA Proxy not reachable at ${EIGENDA_PROXY_URL}${NC}"
        echo -e "${YELLOW}💡 Start the proxy first:${NC}"
        echo -e "${BLUE}   With Docker (memstore for testing):${NC}"
        echo -e "${BLUE}   docker run --rm -p 3100:3100 ghcr.io/layr-labs/eigenda-proxy:latest --memstore.enabled --port 3100${NC}\n"
        echo -e "${BLUE}   With Docker Compose (Holesky testnet):${NC}"
        echo -e "${BLUE}   docker-compose -f docker-compose.eigenda.yml up -d${NC}\n"
        return 1
    fi
}

# Function to post a blob
post_blob() {
    local data="$1"
    local description="$2"
    
    echo -e "\n${CYAN}📤 Posting ${description}...${NC}"
    echo -e "${BLUE}   Size: ${#data} bytes${NC}"
    
    # Post the blob and capture response
    response=$(curl -s -X POST \
        -H "Content-Type: application/octet-stream" \
        --data-binary "${data}" \
        "${EIGENDA_PROXY_URL}/put?commitment_mode=standard" \
        2>/dev/null | xxd -p | tr -d '\n')
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        # Extract first 64 chars (32 bytes) as blob hash
        blob_hash="0x${response:0:64}"
        
        echo -e "${GREEN}✅ Blob posted successfully${NC}"
        echo -e "${BLUE}   Certificate: ${response:0:40}...${NC}"
        echo -e "${BLUE}   Blob Hash: ${blob_hash}${NC}"
        
        # Return the certificate
        echo "$response"
        return 0
    else
        echo -e "${RED}❌ Failed to post blob${NC}"
        return 1
    fi
}

# Function to retrieve a blob
retrieve_blob() {
    local certificate="$1"
    local description="$2"
    
    echo -e "\n${CYAN}📥 Retrieving ${description}...${NC}"
    
    # Remove 0x prefix if present
    certificate="${certificate#0x}"
    
    # Retrieve the blob
    response=$(curl -s -X GET \
        "${EIGENDA_PROXY_URL}/get/${certificate}?commitment_mode=standard" \
        2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo -e "${GREEN}✅ Blob retrieved successfully${NC}"
        echo -e "${BLUE}   Size: ${#response} bytes${NC}"
        echo -e "${BLUE}   Content preview: ${response:0:100}...${NC}"
        
        # Return the data
        echo "$response"
        return 0
    else
        echo -e "${RED}❌ Failed to retrieve blob${NC}"
        return 1
    fi
}

# Main test flow
main() {
    # Check if proxy is available
    if ! check_proxy; then
        exit 1
    fi
    
    echo -e "\n${CYAN}==============================================================${NC}"
    echo -e "${CYAN}TEST 1: Simple String${NC}"
    echo -e "${CYAN}==============================================================${NC}"
    
    # Test 1: Simple string
    test_data="Hello EigenDA from bash script!"
    certificate=$(post_blob "$test_data" "simple string")
    
    if [ $? -eq 0 ]; then
        sleep 2  # Wait for propagation
        retrieved_data=$(retrieve_blob "$certificate" "simple string")
        
        if [ "$retrieved_data" = "$test_data" ]; then
            echo -e "${GREEN}✅ Data verification passed - content matches!${NC}"
        else
            echo -e "${RED}❌ Data verification failed - content mismatch!${NC}"
        fi
    fi
    
    echo -e "\n${CYAN}==============================================================${NC}"
    echo -e "${CYAN}TEST 2: JSON Data${NC}"
    echo -e "${CYAN}==============================================================${NC}"
    
    # Test 2: JSON data
    json_data='{"type":"ERC7730","version":"1.0.0","contract":{"address":"0x123...","chainId":11155111}}'
    certificate=$(post_blob "$json_data" "JSON object")
    
    if [ $? -eq 0 ]; then
        sleep 2  # Wait for propagation
        retrieved_data=$(retrieve_blob "$certificate" "JSON object")
        
        if [ "$retrieved_data" = "$json_data" ]; then
            echo -e "${GREEN}✅ Data verification passed - content matches!${NC}"
        else
            echo -e "${RED}❌ Data verification failed - content mismatch!${NC}"
        fi
    fi
    
    # Test 3: File upload (if provided)
    if [ -n "$1" ]; then
        echo -e "\n${CYAN}==============================================================${NC}"
        echo -e "${CYAN}TEST 3: File Upload${NC}"
        echo -e "${CYAN}==============================================================${NC}"
        
        if [ -f "$1" ]; then
            file_data=$(cat "$1")
            certificate=$(post_blob "$file_data" "file: $1")
            
            if [ $? -eq 0 ]; then
                sleep 2  # Wait for propagation
                retrieved_data=$(retrieve_blob "$certificate" "file: $1")
                
                if [ "$retrieved_data" = "$file_data" ]; then
                    echo -e "${GREEN}✅ Data verification passed - content matches!${NC}"
                else
                    echo -e "${RED}❌ Data verification failed - content mismatch!${NC}"
                fi
            fi
        else
            echo -e "${RED}❌ File not found: $1${NC}"
        fi
    fi
    
    echo -e "\n${CYAN}==============================================================${NC}"
    echo -e "${GREEN}✅ Tests completed!${NC}"
    echo -e "${CYAN}==============================================================${NC}"
    
    echo -e "\n${CYAN}📖 Usage:${NC}"
    echo -e "${BLUE}   ./test-eigenda-simple.sh              # Run basic tests${NC}"
    echo -e "${BLUE}   ./test-eigenda-simple.sh file.json    # Test with a file${NC}"
    echo -e "${BLUE}   EIGENDA_PROXY_URL=http://localhost:3100 ./test-eigenda-simple.sh${NC}"
}

# Run main function with optional file argument
main "$@"