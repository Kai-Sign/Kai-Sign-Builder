// Async blob submission handler - returns immediately with job ID
// Works with Step Functions for orchestration

const { ethers } = require('ethers');
const { KMSClient, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Clients
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Get Ethereum address from KMS public key (cached)
let cachedKmsAddress = null;
async function getEthAddressFromKMS(keyId) {
  if (cachedKmsAddress) return cachedKmsAddress;
  
  const command = new GetPublicKeyCommand({ KeyId: keyId });
  const response = await kmsClient.send(command);
  
  const publicKeyDer = response.PublicKey;
  const publicKeyBytes = publicKeyDer.slice(-65);
  const uncompressed = publicKeyBytes.slice(1);
  
  const hash = ethers.keccak256(uncompressed);
  cachedKmsAddress = ethers.getAddress('0x' + hash.slice(-40));
  
  return cachedKmsAddress;
}

// Main handler - returns immediately with job ID
exports.handler = async (event) => {
  try {
    console.log('Async blob handler invoked');
    
    // Parse input
    let jsonData;
    if (event.body) {
      const bodyStr = typeof event.body === 'string' ? event.body.trim() : event.body;
      const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
      jsonData = body.json || body.data || body;
    } else {
      jsonData = event.json || event.data || event;
    }
    
    // Check if this is a status check
    if (event.queryStringParameters?.jobId) {
      const jobId = event.queryStringParameters.jobId;
      
      // Get status from DynamoDB
      const getCommand = new GetItemCommand({
        TableName: process.env.BLOB_JOBS_TABLE || 'blob-submission-jobs',
        Key: { jobId: { S: jobId } }
      });
      
      const result = await dynamoClient.send(getCommand);
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Job not found' })
        };
      }
      
      // Parse DynamoDB item
      const item = result.Item;
      const status = {
        jobId: item.jobId.S,
        status: item.status.S,
        createdAt: item.createdAt.S,
        updatedAt: item.updatedAt?.S,
        blobHash: item.blobHash?.S,
        transactionHash: item.transactionHash?.S,
        transferHash: item.transferHash?.S,
        error: item.error?.S,
        etherscanUrl: item.etherscanUrl?.S,
        dataSize: item.dataSize?.N
      };
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(status)
      };
    }
    
    // Validate data size
    const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    if (dataStr.length > 128 * 1024) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Data too large for blob (max 128KB)',
          dataSize: dataStr.length
        })
      };
    }
    
    // Quick validation checks
    const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const QUEUE_URL = process.env.BLOB_QUEUE_URL;
    
    if (!KMS_KEY_ID || !RPC_URL || !QUEUE_URL) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Missing configuration',
          missing: [
            !KMS_KEY_ID && 'AWS_KMS_KEY_ID',
            !RPC_URL && 'SEPOLIA_RPC_URL', 
            !QUEUE_URL && 'BLOB_QUEUE_URL'
          ].filter(Boolean)
        })
      };
    }
    
    // Quick balance check
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signerAddress = await getEthAddressFromKMS(KMS_KEY_ID);
    const balance = await provider.getBalance(signerAddress);
    
    if (balance === 0n) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Insufficient balance',
          address: signerAddress,
          balance: '0'
        })
      };
    }
    
    // Generate job ID
    const jobId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Store initial job status in DynamoDB
    const putCommand = new PutItemCommand({
      TableName: process.env.BLOB_JOBS_TABLE || 'blob-submission-jobs',
      Item: {
        jobId: { S: jobId },
        status: { S: 'queued' },
        createdAt: { S: timestamp },
        dataSize: { N: dataStr.length.toString() },
        signerAddress: { S: signerAddress },
        ttl: { N: Math.floor(Date.now() / 1000 + 86400).toString() } // 24 hour TTL
      }
    });
    
    await dynamoClient.send(putCommand);
    
    // Send to SQS for processing
    const sqsMessage = {
      jobId,
      data: dataStr,
      kmsKeyId: KMS_KEY_ID,
      rpcUrl: RPC_URL,
      signerAddress,
      timestamp
    };
    
    const sqsCommand = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
      MessageAttributes: {
        jobId: { DataType: 'String', StringValue: jobId },
        dataSize: { DataType: 'Number', StringValue: dataStr.length.toString() }
      }
    });
    
    await sqsClient.send(sqsCommand);
    
    console.log(`Job ${jobId} queued successfully`);
    
    // Return immediately with job ID
    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        jobId,
        status: 'queued',
        message: 'Blob submission job queued for processing',
        checkStatusUrl: `/blob/status?jobId=${jobId}`,
        estimatedCompletion: '30-60 seconds',
        signerAddress,
        dataSize: dataStr.length
      })
    };
    
  } catch (error) {
    console.error('Async handler error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};