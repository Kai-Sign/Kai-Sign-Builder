// AWS Lambda function for monitoring blob transaction status
// Can be triggered by Step Functions, EventBridge, or direct invocation

const { ethers } = require('ethers');
const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

// DynamoDB client for storing transaction status
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'BlobTransactions';

// Store transaction status in DynamoDB
async function updateTransactionStatus(txHash, status) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      txHash: { S: txHash },
      status: { S: status.status },
      confirmed: { BOOL: status.confirmed },
      blockNumber: status.blockNumber ? { N: status.blockNumber.toString() } : { NULL: true },
      gasUsed: status.gasUsed ? { S: status.gasUsed } : { NULL: true },
      blobGasUsed: status.blobGasUsed ? { S: status.blobGasUsed } : { NULL: true },
      error: status.error ? { S: status.error } : { NULL: true },
      lastChecked: { S: new Date().toISOString() },
      ttl: { N: Math.floor(Date.now() / 1000 + 86400).toString() } // Expire after 24 hours
    }
  };
  
  try {
    await dynamoClient.send(new PutItemCommand(params));
    console.log(`Status updated for ${txHash}:`, status);
  } catch (error) {
    console.error('DynamoDB update error:', error);
  }
}

// Get transaction status from DynamoDB
async function getStoredStatus(txHash) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      txHash: { S: txHash }
    }
  };
  
  try {
    const result = await dynamoClient.send(new GetItemCommand(params));
    if (result.Item) {
      return {
        status: result.Item.status?.S,
        confirmed: result.Item.confirmed?.BOOL,
        blockNumber: result.Item.blockNumber?.N ? parseInt(result.Item.blockNumber.N) : null,
        gasUsed: result.Item.gasUsed?.S,
        blobGasUsed: result.Item.blobGasUsed?.S,
        error: result.Item.error?.S,
        lastChecked: result.Item.lastChecked?.S
      };
    }
    return null;
  } catch (error) {
    console.error('DynamoDB get error:', error);
    return null;
  }
}

// Check transaction on blockchain
async function checkTransactionOnChain(txHash, provider) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return {
        confirmed: true,
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        blobGasUsed: receipt.blobGasUsed?.toString()
      };
    }
    
    // Check if transaction exists in mempool
    const tx = await provider.getTransaction(txHash);
    if (tx) {
      return {
        confirmed: false,
        status: 'pending',
        blockNumber: null
      };
    }
    
    return {
      confirmed: false,
      status: 'not_found',
      error: 'Transaction not found on chain'
    };
  } catch (error) {
    return {
      confirmed: false,
      status: 'error',
      error: error.message
    };
  }
}

// Process blob transaction completion
async function processBlobCompletion(txData) {
  // This could trigger additional workflows like:
  // - Sending notifications (SNS)
  // - Updating application database
  // - Triggering downstream processes
  
  console.log('Blob transaction completed:', txData);
  
  // Example: Send SNS notification
  if (process.env.SNS_TOPIC_ARN) {
    const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    const snsClient = new SNSClient({ region: process.env.AWS_REGION });
    
    try {
      await snsClient.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: 'Blob Transaction Confirmed',
        Message: JSON.stringify({
          txHash: txData.txHash,
          blockNumber: txData.blockNumber,
          status: txData.status,
          timestamp: new Date().toISOString()
        })
      }));
    } catch (error) {
      console.error('SNS notification error:', error);
    }
  }
}

// Main handler
exports.handler = async (event) => {
  console.log('Blob monitor invoked:', JSON.stringify(event));
  
  try {
    // Parse input - support multiple formats
    let txHash, tempWalletPrivateKey, blobData;
    
    if (event.txHash) {
      // Direct invocation
      txHash = event.txHash;
      tempWalletPrivateKey = event.tempWalletPrivateKey;
      blobData = event.blobData;
    } else if (event.Records) {
      // SQS/EventBridge trigger
      const record = event.Records[0];
      const body = JSON.parse(record.body || record.Sns?.Message || '{}');
      txHash = body.txHash;
      tempWalletPrivateKey = body.tempWalletPrivateKey;
      blobData = body.blobData;
    } else if (event.detail) {
      // EventBridge detail
      txHash = event.detail.txHash;
      tempWalletPrivateKey = event.detail.tempWalletPrivateKey;
      blobData = event.detail.blobData;
    }
    
    if (!txHash) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No transaction hash provided' })
      };
    }
    
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    if (!RPC_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'SEPOLIA_RPC_URL not configured' })
      };
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check if we already have status cached
    const cachedStatus = await getStoredStatus(txHash);
    if (cachedStatus && cachedStatus.confirmed) {
      console.log('Using cached status:', cachedStatus);
      return {
        statusCode: 200,
        body: JSON.stringify(cachedStatus)
      };
    }
    
    // Check transaction on chain
    const status = await checkTransactionOnChain(txHash, provider);
    
    // Store status in DynamoDB
    await updateTransactionStatus(txHash, status);
    
    // If confirmed, trigger completion processing
    if (status.confirmed && status.status === 'success') {
      await processBlobCompletion({
        txHash,
        ...status
      });
    }
    
    // If transfer is confirmed but blob wasn't submitted, try to submit it
    if (status.confirmed && tempWalletPrivateKey && blobData && !event.isBlobTx) {
      console.log('Transfer confirmed, attempting blob submission...');
      
      try {
        const tempWallet = new ethers.Wallet(tempWalletPrivateKey, provider);
        const { KZG } = require('micro-eth-signer/kzg');
        const { trustedSetup } = require('@paulmillr/trusted-setups');
        const kzg = new KZG(trustedSetup);
        
        const tempWalletNonce = await provider.getTransactionCount(tempWallet.address);
        const latestBlock = await provider.getBlock('latest');
        const baseFee = latestBlock.baseFeePerGas;
        
        const blobTxWithSidecar = {
          type: 3,
          to: '0x0000000000000000000000000000000000000000',
          data: '0x',
          value: 0n,
          chainId: 11155111,
          nonce: tempWalletNonce,
          gasLimit: 21000n,
          maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
          maxFeePerGas: baseFee * 2n + ethers.parseUnits('2', 'gwei'),
          maxFeePerBlobGas: ethers.parseUnits('30', 'gwei'),
          blobVersionedHashes: [blobData.versionedHash],
          kzg: kzg,
          blobs: [Uint8Array.from(Buffer.from(blobData.blob.slice(2), 'hex'))]
        };
        
        const blobTxResponse = await tempWallet.sendTransaction(blobTxWithSidecar);
        console.log('Blob transaction submitted:', blobTxResponse.hash);
        
        // Store blob tx info
        await updateTransactionStatus(blobTxResponse.hash, {
          status: 'pending',
          confirmed: false,
          parentTxHash: txHash
        });
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            transferStatus: status,
            blobTxHash: blobTxResponse.hash,
            message: 'Blob transaction submitted successfully'
          })
        };
        
      } catch (blobError) {
        console.error('Blob submission failed:', blobError);
        return {
          statusCode: 207,
          body: JSON.stringify({
            transferStatus: status,
            blobError: blobError.message
          })
        };
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(status)
    };
    
  } catch (error) {
    console.error('Monitor error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};

// Export for testing
exports.checkTransactionOnChain = checkTransactionOnChain;
exports.updateTransactionStatus = updateTransactionStatus;