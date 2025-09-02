// SQS message processor - handles actual blob submission
// Runs asynchronously without API Gateway timeout constraints

const { ethers } = require('ethers');
const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { KZG } = require('micro-eth-signer/kzg');
const { trustedSetup } = require('@paulmillr/trusted-setups');

// Initialize KZG once
let kzg = null;
let kzgInitialized = false;

async function initKzg() {
  if (!kzgInitialized) {
    console.log('Initializing KZG...');
    kzg = new KZG(trustedSetup);
    kzgInitialized = true;
  }
}

// Clients
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Update job status in DynamoDB
async function updateJobStatus(jobId, updates) {
  const timestamp = new Date().toISOString();
  
  // Build update expression
  const updateParts = ['updatedAt = :timestamp'];
  const expressionValues = { ':timestamp': { S: timestamp } };
  
  Object.entries(updates).forEach(([key, value]) => {
    const placeholder = `:${key}`;
    updateParts.push(`${key} = ${placeholder}`);
    
    // Determine type
    if (typeof value === 'string') {
      expressionValues[placeholder] = { S: value };
    } else if (typeof value === 'number') {
      expressionValues[placeholder] = { N: value.toString() };
    } else if (typeof value === 'boolean') {
      expressionValues[placeholder] = { BOOL: value };
    }
  });
  
  const command = new UpdateItemCommand({
    TableName: process.env.BLOB_JOBS_TABLE || 'blob-submission-jobs',
    Key: { jobId: { S: jobId } },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeValues: expressionValues
  });
  
  await dynamoClient.send(command);
}

// Convert data to blob format
function toBlobs(data) {
  const BLOB_SIZE = 131072;
  const blob = new Uint8Array(BLOB_SIZE);
  
  const bytes = Buffer.from(data);
  let blobIndex = 0;
  
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;
    
    if (fieldIndex >= 4096) break;
    
    blob[fieldIndex * 32 + byteIndex + 1] = bytes[i];
    blobIndex++;
  }
  
  return blob;
}

// Get Ethereum address from KMS
async function getEthAddressFromKMS(keyId) {
  const command = new GetPublicKeyCommand({ KeyId: keyId });
  const response = await kmsClient.send(command);
  
  const publicKeyDer = response.PublicKey;
  const publicKeyBytes = publicKeyDer.slice(-65);
  const uncompressed = publicKeyBytes.slice(1);
  
  const hash = ethers.keccak256(uncompressed);
  return ethers.getAddress('0x' + hash.slice(-40));
}

// Sign with KMS
async function signWithKMS(keyId, messageHash) {
  const command = new SignCommand({
    KeyId: keyId,
    Message: Buffer.from(messageHash.slice(2), 'hex'),
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });
  
  const response = await kmsClient.send(command);
  const signature = response.Signature;
  
  // Parse DER signature
  const parsed = parseSignature(signature);
  
  // Get recovery ID
  const recoveryResult = await getRecoveryId(messageHash, parsed.r, parsed.s, keyId);
  
  return {
    r: '0x' + parsed.r.toString(16).padStart(64, '0'),
    s: '0x' + recoveryResult.s.toString(16).padStart(64, '0'),
    v: 27 + recoveryResult.recoveryId
  };
}

// Parse DER signature
function parseSignature(derSignature) {
  const buffer = Buffer.from(derSignature);
  let offset = 2;
  
  offset += 1;
  const rLength = buffer[offset++];
  const r = BigInt('0x' + buffer.slice(offset, offset + rLength).toString('hex'));
  offset += rLength;
  
  offset += 1;
  const sLength = buffer[offset++];
  const s = BigInt('0x' + buffer.slice(offset, offset + sLength).toString('hex'));
  
  return { r, s };
}

// Get recovery ID
async function getRecoveryId(messageHash, r, s, keyId) {
  const address = await getEthAddressFromKMS(keyId);
  
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let sNormalized = s;
  if (s > secp256k1N / 2n) {
    sNormalized = secp256k1N - s;
  }
  
  const rHex = '0x' + r.toString(16).padStart(64, '0');
  const sHex = '0x' + sNormalized.toString(16).padStart(64, '0');
  
  for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
    try {
      const recovered = ethers.recoverAddress(messageHash, {
        r: rHex,
        s: sHex,
        v: 27 + recoveryId
      });
      
      if (recovered.toLowerCase() === address.toLowerCase()) {
        return { recoveryId, s: sNormalized };
      }
    } catch (e) {}
  }
  
  throw new Error('Could not determine recovery ID');
}

// Process blob submission
async function processBlobSubmission(jobId, data, kmsKeyId, rpcUrl) {
  console.log(`Processing job ${jobId}`);
  
  // Initialize KZG
  await initKzg();
  
  // Update status to processing
  await updateJobStatus(jobId, { status: 'processing' });
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signerAddress = await getEthAddressFromKMS(kmsKeyId);
  
  // Check balance
  const balance = await provider.getBalance(signerAddress);
  if (balance === 0n) {
    throw new Error('Insufficient balance');
  }
  
  // Convert to blob
  const blobUint8 = toBlobs(data);
  const blobHex = Buffer.from(blobUint8).toString('hex');
  
  // Generate KZG commitment and proof
  const commitment = kzg.blobToKzgCommitment(blobHex);
  const proof = kzg.computeBlobProof(blobHex, commitment);
  
  // Verify proof
  const isValid = kzg.verifyBlobProof(blobHex, commitment, proof);
  if (!isValid) {
    throw new Error('Invalid KZG proof');
  }
  
  // Create versioned hash
  const commitmentHash = ethers.sha256(commitment);
  const versionedHash = '0x01' + commitmentHash.substring(4);
  
  // Update status with blob hash
  await updateJobStatus(jobId, { 
    status: 'submitting',
    blobHash: versionedHash
  });
  
  // Get transaction parameters
  const [nonce, latestBlock] = await Promise.all([
    provider.getTransactionCount(signerAddress),
    provider.getBlock('latest')
  ]);
  
  const baseFee = latestBlock.baseFeePerGas;
  const maxPriorityFee = ethers.parseUnits('2', 'gwei');
  const maxFeePerGas = baseFee * 2n + maxPriorityFee;
  const maxBlobFee = ethers.parseUnits('30', 'gwei');
  
  // Create temp wallet for blob transaction
  const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  
  // Calculate exact amount needed
  const estimatedGasCost = 21000n * maxFeePerGas;
  const estimatedBlobCost = 131072n * maxBlobFee;
  const totalCost = estimatedGasCost + estimatedBlobCost;
  
  // Transfer ETH to temp wallet
  const transferTx = {
    type: 2,
    to: tempWallet.address,
    value: totalCost,
    chainId: 11155111,
    nonce: nonce,
    gasLimit: 21000n,
    maxPriorityFeePerGas: maxPriorityFee,
    maxFeePerGas: maxFeePerGas
  };
  
  const transferEthTx = ethers.Transaction.from(transferTx);
  const transferSignature = await signWithKMS(kmsKeyId, transferEthTx.unsignedHash);
  
  transferEthTx.signature = ethers.Signature.from({
    r: transferSignature.r,
    s: transferSignature.s,
    v: transferSignature.v
  });
  
  // Send transfer
  const transferResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendRawTransaction',
      params: [transferEthTx.serialized]
    })
  });
  
  const transferResult = await transferResponse.json();
  if (transferResult.error) {
    throw new Error(`Transfer failed: ${transferResult.error.message}`);
  }
  
  const transferTxHash = transferResult.result;
  console.log(`Transfer sent: ${transferTxHash}`);
  
  // Update status
  await updateJobStatus(jobId, { 
    status: 'waiting_transfer',
    transferHash: transferTxHash
  });
  
  // Wait for transfer confirmation
  let transferReceipt = null;
  for (let i = 0; i < 60; i++) { // Wait up to 10 minutes
    try {
      transferReceipt = await provider.getTransactionReceipt(transferTxHash);
      if (transferReceipt) break;
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  if (!transferReceipt) {
    throw new Error('Transfer not confirmed within timeout');
  }
  
  // Send blob transaction
  const blobTx = {
    type: 3,
    to: '0x0000000000000000000000000000000000000000',
    data: '0x',
    value: 0n,
    chainId: 11155111,
    nonce: await provider.getTransactionCount(tempWallet.address),
    gasLimit: 21000n,
    maxPriorityFeePerGas: maxPriorityFee,
    maxFeePerGas: maxFeePerGas,
    maxFeePerBlobGas: maxBlobFee,
    blobVersionedHashes: [versionedHash],
    kzg: kzg,
    blobs: [blobUint8]
  };
  
  const blobTxResponse = await tempWallet.sendTransaction(blobTx);
  const blobTxHash = blobTxResponse.hash;
  
  console.log(`Blob transaction sent: ${blobTxHash}`);
  
  // Update final status
  await updateJobStatus(jobId, {
    status: 'completed',
    transactionHash: blobTxHash,
    etherscanUrl: `https://sepolia.etherscan.io/tx/${blobTxHash}`
  });
  
  return blobTxHash;
}

// Lambda handler for SQS messages
exports.handler = async (event) => {
  console.log('Processor invoked with', event.Records?.length || 0, 'messages');
  
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { jobId, data, kmsKeyId, rpcUrl } = message;
    
    try {
      await processBlobSubmission(jobId, data, kmsKeyId, rpcUrl);
      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      
      // Update job status with error
      await updateJobStatus(jobId, {
        status: 'failed',
        error: error.message
      });
      
      // Don't throw - we don't want to retry failed blob submissions
      // The client can check status and decide what to do
    }
  }
  
  return { statusCode: 200, body: 'Processing complete' };
};