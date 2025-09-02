#!/bin/bash

# Deploy script for KaiSign Lambda functions
set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="KaiSign-BlobSubmission-${ENVIRONMENT}"

echo "🚀 Deploying KaiSign Lambda Infrastructure"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack: ${STACK_NAME}"

# Check required environment variables
if [ -z "$KMS_KEY_ID" ]; then
    echo "❌ Error: KMS_KEY_ID environment variable is required"
    echo "Export it with: export KMS_KEY_ID=your-kms-key-id"
    exit 1
fi

if [ -z "$SEPOLIA_RPC_URL" ]; then
    echo "❌ Error: SEPOLIA_RPC_URL environment variable is required"
    echo "Export it with: export SEPOLIA_RPC_URL=your-rpc-url"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Step 2: Create deployment package
echo "📁 Creating deployment package..."
rm -f lambda-deployment.zip
zip -r lambda-deployment.zip \
    lambda-kms-optimized.js \
    lambda-blob-monitor.js \
    node_modules/ \
    -x "*.git*" \
    -x "*.md" \
    -x "test-*" \
    -x "deploy-*"

# Step 3: Upload to S3 (create bucket if needed)
BUCKET_NAME="kaisign-lambda-${ENVIRONMENT}-${REGION}-$(aws sts get-caller-identity --query Account --output text)"
echo "📤 Uploading to S3 bucket: ${BUCKET_NAME}"

# Create bucket if it doesn't exist
aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null || \
    aws s3api create-bucket \
        --bucket "${BUCKET_NAME}" \
        --region "${REGION}" \
        $(if [ "${REGION}" != "us-east-1" ]; then echo "--create-bucket-configuration LocationConstraint=${REGION}"; fi)

# Upload Lambda package
aws s3 cp lambda-deployment.zip "s3://${BUCKET_NAME}/lambda-deployment.zip"

# Step 4: Deploy CloudFormation stack
echo "☁️ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file aws-infrastructure.yaml \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides \
        KMSKeyId="${KMS_KEY_ID}" \
        SepoliaRpcUrl="${SEPOLIA_RPC_URL}" \
        Environment="${ENVIRONMENT}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

# Step 5: Update Lambda function code
echo "🔄 Updating Lambda function code..."
SUBMIT_FUNCTION="KaiSign-BlobSubmit-${ENVIRONMENT}"
MONITOR_FUNCTION="KaiSign-BlobMonitor-${ENVIRONMENT}"

aws lambda update-function-code \
    --function-name "${SUBMIT_FUNCTION}" \
    --s3-bucket "${BUCKET_NAME}" \
    --s3-key "lambda-deployment.zip" \
    --region "${REGION}" \
    --publish

aws lambda update-function-code \
    --function-name "${MONITOR_FUNCTION}" \
    --s3-bucket "${BUCKET_NAME}" \
    --s3-key "lambda-deployment.zip" \
    --region "${REGION}" \
    --publish

# Step 6: Get outputs
echo "📊 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs" \
    --output table

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='SubmitEndpoint'].OutputValue" \
    --output text)

echo ""
echo "✅ Deployment complete!"
echo "API Endpoint: ${API_ENDPOINT}"
echo ""
echo "Test with:"
echo "curl -X POST ${API_ENDPOINT} \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"json\": {\"test\": \"data\"}}'"

# Cleanup
rm -f lambda-deployment.zip