#!/bin/bash

# AWS Setup Script for Async Blob Submission
# Run this BEFORE deploy-async.sh

set -e

echo "🔧 AWS Setup for Async Blob Submission"
echo "======================================"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli  (macOS)"
    echo "   Or visit: https://aws.amazon.com/cli/"
    exit 1
fi

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Not logged into AWS. Please run:"
    echo "   aws configure"
    exit 1
fi

echo "✅ AWS Account: $AWS_ACCOUNT_ID"
echo ""

# Get or create KMS key
echo "📌 KMS Key Setup"
echo "----------------"
echo "Do you have an existing KMS key for Ethereum signing? (y/n)"
read -r HAS_KMS_KEY

if [ "$HAS_KMS_KEY" = "y" ]; then
    echo "Enter your KMS Key ID (just the ID, not full ARN):"
    read -r KMS_KEY_ID
else
    echo "Creating new KMS key for Ethereum signing..."
    KMS_RESPONSE=$(aws kms create-key \
        --description "Ethereum blob signing key" \
        --key-usage SIGN_VERIFY \
        --key-spec ECC_SECG_P256K1 \
        --origin AWS_KMS)
    
    KMS_KEY_ID=$(echo "$KMS_RESPONSE" | grep -o '"KeyId": "[^"]*' | grep -o '[^"]*$')
    echo "✅ Created KMS Key: $KMS_KEY_ID"
    
    # Create alias for easier reference
    aws kms create-alias \
        --alias-name "alias/ethereum-blob-signer" \
        --target-key-id "$KMS_KEY_ID"
    
    echo "✅ Created alias: alias/ethereum-blob-signer"
fi

# Get KMS Ethereum address
echo ""
echo "Getting Ethereum address from KMS key..."
cat > get-kms-address.js << 'EOF'
const { KMSClient, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { ethers } = require('ethers');

async function getAddress() {
    const client = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const response = await client.send(new GetPublicKeyCommand({ 
        KeyId: process.env.KMS_KEY_ID 
    }));
    
    const publicKeyBytes = response.PublicKey.slice(-65);
    const uncompressed = publicKeyBytes.slice(1);
    const hash = ethers.keccak256(uncompressed);
    const address = ethers.getAddress('0x' + hash.slice(-40));
    
    console.log(address);
}

getAddress().catch(console.error);
EOF

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install ethers @aws-sdk/client-kms --save
fi

export KMS_KEY_ID
KMS_ADDRESS=$(node get-kms-address.js)
rm get-kms-address.js

echo "✅ KMS Ethereum Address: $KMS_ADDRESS"
echo ""

# Sepolia RPC Setup
echo "📌 Sepolia RPC Setup"
echo "--------------------"
echo "Enter your Sepolia RPC URL (e.g., from Alchemy/Infura):"
echo "Example: https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY"
read -r SEPOLIA_RPC_URL

# Test RPC connection
echo "Testing RPC connection..."
BLOCK_NUMBER=$(curl -s -X POST "$SEPOLIA_RPC_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    | grep -o '"result":"[^"]*' | cut -d'"' -f4)

if [ -z "$BLOCK_NUMBER" ]; then
    echo "⚠️  Warning: Could not connect to RPC endpoint"
else
    echo "✅ RPC connected. Latest block: $BLOCK_NUMBER"
fi

# Check balance
echo ""
echo "Checking balance..."
BALANCE_WEI=$(curl -s -X POST "$SEPOLIA_RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$KMS_ADDRESS\",\"latest\"],\"id\":1}" \
    | grep -o '"result":"[^"]*' | cut -d'"' -f4)

if [ -n "$BALANCE_WEI" ]; then
    # Convert hex to decimal (rough estimate)
    BALANCE_ETH=$(echo "$BALANCE_WEI" | sed 's/0x//' | awk '{print strtonum("0x" $0) / 10^18}')
    echo "💰 Current balance: ~$BALANCE_ETH ETH"
    
    if [ "$BALANCE_ETH" = "0" ]; then
        echo ""
        echo "⚠️  WARNING: Account has 0 ETH"
        echo "Send Sepolia ETH to: $KMS_ADDRESS"
        echo "Get test ETH from: https://sepoliafaucet.com"
    fi
else
    echo "⚠️  Could not check balance"
fi

# Create .env file
echo ""
echo "📝 Creating .env file..."
cat > .env << EOF
# AWS Configuration
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
AWS_REGION=${AWS_REGION:-us-east-1}
KMS_KEY_ID=$KMS_KEY_ID
KMS_ADDRESS=$KMS_ADDRESS

# Blockchain Configuration  
SEPOLIA_RPC_URL=$SEPOLIA_RPC_URL

# Deployment Configuration
STACK_NAME=blob-submission-stack
DEPLOYMENT_BUCKET=blob-deployment-$AWS_ACCOUNT_ID
EOF

echo "✅ Created .env file"

# Create deployment config
echo ""
echo "📝 Creating deployment config..."
cat > deploy-config.sh << EOF
#!/bin/bash
# Auto-generated deployment configuration

export AWS_ACCOUNT_ID="$AWS_ACCOUNT_ID"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export KMS_KEY_ID="$KMS_KEY_ID"
export SEPOLIA_RPC_URL="$SEPOLIA_RPC_URL"
export KMS_ADDRESS="$KMS_ADDRESS"

echo "✅ Configuration loaded"
echo "   Account: \$AWS_ACCOUNT_ID"
echo "   Region: \$AWS_REGION"
echo "   KMS Key: \$KMS_KEY_ID"
echo "   KMS Address: \$KMS_ADDRESS"
EOF

chmod +x deploy-config.sh

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Summary:"
echo "   AWS Account: $AWS_ACCOUNT_ID"
echo "   AWS Region: ${AWS_REGION:-us-east-1}"
echo "   KMS Key ID: $KMS_KEY_ID"
echo "   KMS Address: $KMS_ADDRESS"
echo "   RPC URL: $SEPOLIA_RPC_URL"
echo ""
echo "🚀 Next Steps:"
echo "1. Ensure $KMS_ADDRESS has Sepolia ETH"
echo "2. Run: source deploy-config.sh"
echo "3. Run: ./deploy-async.sh"
echo ""
echo "💡 To check everything:"
echo "   source deploy-config.sh && env | grep -E 'AWS_|KMS_|SEPOLIA'"