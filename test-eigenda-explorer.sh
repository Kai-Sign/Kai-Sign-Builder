#!/bin/bash

# Direct EigenDA Testing & Explorer Verification Script
# No decoding - just raw API calls and explorer links

echo "🚀 EigenDA Direct Testing & Explorer Verification"
echo "================================================="
echo ""

# Configuration
DISPERSER="disperser-holesky.eigenda.xyz:443"
EXPLORER="https://blobs-holesky.eigenda.xyz"
TEST_DATA='{"message":"Testing EigenDA Explorer","timestamp":'$(date +%s)',"from":"KaiSign"}'

echo "📡 Network: Holesky Testnet"
echo "🔍 Explorer: $EXPLORER"
echo ""

# Step 1: Post blob to EigenDA
echo "1️⃣  Posting blob to EigenDA..."
echo "   Data: $TEST_DATA"
echo ""

# Encode data for EigenDA (simple base64)
ENCODED_DATA=$(echo -n "$TEST_DATA" | base64)

# Create request
REQUEST='{"data":"'$ENCODED_DATA'"}'

echo "   Sending to disperser..."
RESPONSE=$(echo "$REQUEST" | grpcurl -d @ $DISPERSER disperser.Disperser/DisperseBlob 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Blob posted successfully!"
    echo ""
    
    # Extract request ID
    REQUEST_ID=$(echo "$RESPONSE" | grep -o '"requestId":\s*"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$REQUEST_ID" ]; then
        echo "📝 Request ID: $REQUEST_ID"
        echo ""
        
        # Decode request ID to get blob hash
        BLOB_INFO=$(echo "$REQUEST_ID" | base64 -d 2>/dev/null)
        BLOB_HASH=$(echo "$BLOB_INFO" | cut -d'-' -f1)
        
        echo "🔗 Blob Hash: $BLOB_HASH"
        echo ""
        
        # Step 2: Check status
        echo "2️⃣  Checking blob status..."
        sleep 5
        
        STATUS_REQUEST='{"request_id":"'$REQUEST_ID'"}'
        STATUS=$(echo "$STATUS_REQUEST" | grpcurl -d @ $DISPERSER disperser.Disperser/GetBlobStatus 2>/dev/null)
        
        echo "$STATUS" | grep -q "CONFIRMED"
        if [ $? -eq 0 ]; then
            echo "✅ Blob CONFIRMED on EigenDA!"
            
            # Extract batch info
            BATCH_ID=$(echo "$STATUS" | grep -o '"batchId":\s*[0-9]*' | cut -d':' -f2 | tr -d ' ')
            BLOB_INDEX=$(echo "$STATUS" | grep -o '"blobIndex":\s*[0-9]*' | cut -d':' -f2 | tr -d ' ')
            
            echo "   Batch ID: $BATCH_ID"
            echo "   Blob Index: $BLOB_INDEX"
            echo ""
            
            # Step 3: Explorer links
            echo "3️⃣  View on Explorer:"
            echo ""
            echo "   🔍 Blob Explorer:"
            echo "      $EXPLORER/blobs/$BLOB_HASH"
            echo ""
            echo "   📦 Batch Explorer:"
            echo "      $EXPLORER/batches/$BATCH_ID"
            echo ""
            
            # Step 4: Direct retrieval (no decoding)
            echo "4️⃣  Retrieve blob directly (raw):"
            echo ""
            echo "   Using grpcurl:"
            echo "   grpcurl -d '{\"request_id\":\"$REQUEST_ID\"}' \\"
            echo "     $DISPERSER disperser.Disperser/GetBlobStatus"
            echo ""
            
        else
            echo "⏳ Blob still processing..."
            echo "   Status: $(echo "$STATUS" | grep -o '"status":\s*"[^"]*"' | cut -d'"' -f4)"
        fi
        
        # Step 5: Direct API examples
        echo "5️⃣  Direct API Usage (no proxy needed):"
        echo ""
        echo "   Post blob:"
        echo "   echo '{\"data\":\"'$(echo -n "your data" | base64)'\"}' | \\"
        echo "     grpcurl -d @ $DISPERSER disperser.Disperser/DisperseBlob"
        echo ""
        echo "   Check status:"
        echo "   echo '{\"request_id\":\"<your_request_id>\"}' | \\"
        echo "     grpcurl -d @ $DISPERSER disperser.Disperser/GetBlobStatus"
        echo ""
        
    else
        echo "❌ Could not extract request ID"
    fi
else
    echo "❌ Failed to post blob"
    echo "   Make sure grpcurl is installed: brew install grpcurl"
fi

echo ""
echo "📚 Summary:"
echo "   - Blobs are posted directly to disperser"
echo "   - No decoding needed - disperser handles it"
echo "   - Explorer shows all blob details"
echo "   - Blob hash can be stored in smart contract"
echo ""