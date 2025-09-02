# Async Blob Submission Solution

## Overview

This solution completely bypasses the AWS API Gateway 29-second timeout limitation by implementing an asynchronous job queue architecture.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────────┐
│   Client    │────▶│ API Gateway  │────▶│ Handler │────▶│     SQS      │
│             │     │ (29s limit)  │     │ Lambda  │     │    Queue     │
└─────────────┘     └──────────────┘     └─────────┘     └──────────────┘
       │                                        │                 │
       │                                        ▼                 ▼
       │                                  ┌──────────┐    ┌──────────────┐
       │                                  │ DynamoDB │◀───│  Processor   │
       └─────────────────────────────────▶│  Table   │    │   Lambda     │
              Check Status                └──────────┘    │ (15min max)  │
                                                          └──────────────┘
```

## Key Benefits

1. **Immediate Response**: Returns job ID in < 1 second
2. **No Timeout Issues**: Processing happens asynchronously
3. **Reliable**: Built-in retry logic with DLQ
4. **Scalable**: Can process multiple jobs in parallel
5. **Monitoring**: Full visibility via CloudWatch Dashboard

## Files

- `kms-blob-async-handler.js` - API-facing Lambda (returns job ID immediately)
- `kms-blob-processor.js` - Background processor (handles actual blob submission)
- `aws-blob-infrastructure.yaml` - CloudFormation template
- `deploy-async.sh` - Deployment script
- `package.json` - Dependencies
- `test-async.js` - Test script

## Deployment

### Prerequisites

1. AWS CLI configured
2. Node.js 18+ installed
3. Environment variables set:

```bash
export AWS_ACCOUNT_ID=your-account-id
export AWS_REGION=us-east-1
export KMS_KEY_ID=your-kms-key-id
export SEPOLIA_RPC_URL=https://your-rpc-url
```

### Deploy

```bash
# Install dependencies
npm install

# Deploy infrastructure
./deploy-async.sh
```

The script will:
1. Create S3 deployment bucket
2. Package Lambda functions
3. Create dependencies layer
4. Deploy CloudFormation stack
5. Output API endpoint and resources

## Usage

### Submit Blob

```bash
curl -X POST https://your-api.execute-api.region.amazonaws.com/prod/blob/submit \
  -H "Content-Type: application/json" \
  -d '{"data": "your-data-here"}'
```

Response:
```json
{
  "success": true,
  "jobId": "uuid-here",
  "status": "queued",
  "checkStatusUrl": "/blob/status?jobId=uuid-here",
  "estimatedCompletion": "30-60 seconds"
}
```

### Check Status

```bash
curl https://your-api.execute-api.region.amazonaws.com/prod/blob/status?jobId=uuid-here
```

Response:
```json
{
  "jobId": "uuid-here",
  "status": "completed",
  "transactionHash": "0x...",
  "blobHash": "0x...",
  "etherscanUrl": "https://sepolia.etherscan.io/tx/0x..."
}
```

Status values:
- `queued` - Job is waiting to be processed
- `processing` - Job is being processed
- `submitting` - Transaction is being submitted
- `waiting_transfer` - Waiting for ETH transfer
- `completed` - Successfully submitted
- `failed` - Failed (check error field)

## Testing

```bash
# Set API endpoint from deployment output
export API_ENDPOINT=https://your-api.execute-api.region.amazonaws.com/prod

# Run test
npm test
```

## Monitoring

CloudWatch Dashboard: `blob-submission-monitoring`

Metrics tracked:
- Lambda invocations
- Error rates
- Processing duration
- Queue depth
- Dead letter queue messages

## Cost Estimates

Based on 1,000 blob submissions per day:

- Lambda: ~$0.50/month
- DynamoDB: ~$0.25/month  
- SQS: ~$0.40/month
- API Gateway: ~$3.50/month
- **Total: ~$5/month**

## Troubleshooting

### Job stuck in "queued" status

Check SQS queue and Lambda logs:
```bash
aws sqs get-queue-attributes \
  --queue-url your-queue-url \
  --attribute-names ApproximateNumberOfMessages
```

### Jobs failing

Check processor Lambda logs:
```bash
aws logs tail /aws/lambda/kms-blob-processor --follow
```

### High latency

Increase Lambda memory or reserved concurrency:
```bash
aws lambda update-function-configuration \
  --function-name kms-blob-processor \
  --memory-size 2048
```

## Architecture Decisions

1. **SQS over Step Functions**: Simpler, cheaper for this use case
2. **DynamoDB over RDS**: Serverless, scales automatically
3. **Separate handler/processor**: Allows immediate response to client
4. **TTL on DynamoDB**: Auto-cleanup of old jobs
5. **Dead Letter Queue**: Captures failed jobs for analysis

## Security Considerations

1. KMS key never exposed
2. Temporary wallets used for blob transactions
3. IAM roles with least privilege
4. No sensitive data in logs
5. CORS configured for frontend access

## Future Enhancements

1. WebSocket support for real-time updates
2. Batch processing for multiple blobs
3. Cost optimization with Fargate for long-running jobs
4. Multi-region support
5. GraphQL API for richer queries