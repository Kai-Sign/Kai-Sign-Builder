#!/bin/bash

URL="https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"

CONTRACT_ADDRESS="0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf"

echo "Checking all specs for contract $CONTRACT_ADDRESS..."
ALL_SPECS=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"{ specs(where: {targetContract: \\\"$CONTRACT_ADDRESS\\\"}) { ipfs targetContract status } }\"}" \
  "$URL")

echo "$ALL_SPECS"

IPFS_HASH=$(echo "$ALL_SPECS" | jq -r '.data.specs[0].ipfs')

if [ "$IPFS_HASH" != "null" ]; then
  echo -e "\n\nFetching metadata from IPFS: $IPFS_HASH"
  curl -s "https://gateway.pinata.cloud/ipfs/$IPFS_HASH"
else
  echo "No specs found for this contract"
fi