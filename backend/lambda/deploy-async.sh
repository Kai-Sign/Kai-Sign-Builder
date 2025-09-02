#!/bin/bash

# Deploy script for async blob submission infrastructure
# This script packages and deploys the Lambda functions and infrastructure

set -e

echo "🚀 Starting deployment of async blob submission infrastructure..."

# Check required environment variables
if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "❌ Error: AWS_ACCOUNT_ID not set"
  echo "Run: export AWS_ACCOUNT_ID=your-account-id"
  exit 1
fi

if [ -z "$AWS_REGION" ]; then
  export AWS_REGION="us-east-1"
  echo "ℹ️ AWS_REGION not set, using default: $AWS_REGION"
fi

if [ -z "$KMS_KEY_ID" ]; then
  echo "❌ Error: KMS_KEY_ID not set"
  echo "Run: export KMS_KEY_ID=your-kms-key-id"
  exit 1
fi

if [ -z "$SEPOLIA_RPC_URL" ]; then
  echo "❌ Error: SEPOLIA_RPC_URL not set"
  echo "Run: export SEPOLIA_RPC_URL=your-rpc-url"
  exit 1
fi

# S3 bucket name for deployment
DEPLOYMENT_BUCKET="blob-deployment-${AWS_ACCOUNT_ID}"
STACK_NAME="blob-submission-stack"

echo "📦 Creating deployment S3 bucket if not exists..."
aws s3api head-bucket --bucket "$DEPLOYMENT_BUCKET" 2>/dev/null || \
  aws s3api create-bucket --bucket "$DEPLOYMENT_BUCKET" --region "$AWS_REGION"

# Package dependencies layer
echo "📚 Creating dependencies layer..."
mkdir -p temp/nodejs
cp package.json temp/nodejs/
cd temp/nodejs
npm install --production
cd ../..
cd temp
zip -r ../blob-dependencies.zip nodejs
cd ..
rm -rf temp

# Upload layer to S3
echo "⬆️ Uploading dependencies layer to S3..."
aws s3 cp blob-dependencies.zip "s3://${DEPLOYMENT_BUCKET}/layers/blob-dependencies.zip"

# Package Lambda functions
echo "📦 Packaging Lambda functions..."

# Package async handler
zip -j kms-blob-async-handler.zip kms-blob-async-handler.js
aws s3 cp kms-blob-async-handler.zip "s3://${DEPLOYMENT_BUCKET}/functions/kms-blob-async-handler.zip"

# Package processor
zip -j kms-blob-processor.zip kms-blob-processor.js
aws s3 cp kms-blob-processor.zip "s3://${DEPLOYMENT_BUCKET}/functions/kms-blob-processor.zip"

# Deploy CloudFormation stack
echo "🏗️ Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file aws-blob-infrastructure.yaml \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    KmsKeyId="$KMS_KEY_ID" \
    SepoliaRpcUrl="$SEPOLIA_RPC_URL" \
  --capabilities CAPABILITY_IAM \
  --region "$AWS_REGION"

# Get stack outputs
echo "📋 Getting stack outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text \
  --region "$AWS_REGION")

QUEUE_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`QueueUrl`].OutputValue' \
  --output text \
  --region "$AWS_REGION")

TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`TableName`].OutputValue' \
  --output text \
  --region "$AWS_REGION")

# Clean up zip files
echo "🧹 Cleaning up temporary files..."
rm -f *.zip

echo "✅ Deployment complete!"
echo ""
echo "📊 Infrastructure Details:"
echo "API Endpoint: $API_ENDPOINT"
echo "Queue URL: $QUEUE_URL"
echo "DynamoDB Table: $TABLE_NAME"
echo ""
echo "🔧 Usage:"
echo "Submit blob: POST ${API_ENDPOINT}/blob/submit"
echo "Check status: GET ${API_ENDPOINT}/blob/status?jobId={jobId}"
echo ""
echo "💡 Example:"
echo 'curl -X POST '"$API_ENDPOINT"'/blob/submit \
  -H "Content-Type: application/json" \
  -d "{\"data\": \"your-data-here\"}"'