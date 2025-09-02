// AWS Lambda function for blob posting with KMS signing
// Optimized for API Gateway 29-second timeout with optimistic responses

const { ethers } = require('ethers');
const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { KZG } = require('micro-eth-signer/kzg');
const { trustedSetup } = require('@paulmillr/trusted-setups');

// Initialize KZG once during cold start
let kzg = null;
let kzgInitialized = false;

async function initKzg() {
  if (!kzgInitialized) {
    console.log('Initializing KZG (pure JS)...');
    kzg = new KZG(trustedSetup);
    kzgInitialized = true;
    console.log('KZG initialized successfully');
  }
}

// KMS Client
const kmsClient = new KMSClient({ region: process.env.KMS_REGION || process.env.AWS_REGION || 'us-east-1' });

// Convert data to blob format
function toBlobs(data) {
  const BLOB_SIZE = 131072; // 4096 * 32
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

// Get Ethereum address from KMS public key
async function getEthAddressFromKMS(keyId) {
  const command = new GetPublicKeyCommand({ KeyId: keyId });
  const response = await kmsClient.send(command);
  
  // Parse DER-encoded public key
  const publicKeyDer = response.PublicKey;
  
  // Extract the 64-byte uncompressed key (skip DER headers)
  const publicKeyBytes = publicKeyDer.slice(-65); // Last 65 bytes (0x04 + 64 bytes)
  const uncompressed = publicKeyBytes.slice(1); // Remove 0x04 prefix
  
  // Ethereum address = last 20 bytes of keccak256(public_key)
  const hash = ethers.keccak256(uncompressed);
  const address = ethers.getAddress('0x' + hash.slice(-40));
  
  return address;
}

// Sign transaction hash with KMS
async function signWithKMS(keyId, messageHash) {
  const command = new SignCommand({
    KeyId: keyId,
    Message: Buffer.from(messageHash.slice(2), 'hex'), // Remove 0x prefix
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256'
  });
  
  const response = await kmsClient.send(command);
  const signature = response.Signature;
  
  // Parse DER signature to get r, s values
  const parsed = parseSignature(signature);
  
  // Determine recovery ID by testing both values
  const recoveryResult = await getRecoveryId(messageHash, parsed.r, parsed.s, keyId);
  let recoveryId, finalS;
  
  if (typeof recoveryResult === 'object') {
    recoveryId = recoveryResult.recoveryId;
    finalS = recoveryResult.s;
  } else {
    recoveryId = recoveryResult;
    finalS = parsed.s;
  }
  
  return {
    r: '0x' + parsed.r.toString(16).padStart(64, '0'),
    s: '0x' + finalS.toString(16).padStart(64, '0'),
    v: 27 + recoveryId
  };
}

// Parse DER-encoded signature
function parseSignature(derSignature) {
  const buffer = Buffer.from(derSignature);
  
  // Simple DER parsing for ECDSA signature
  let offset = 2; // Skip 0x30 and total length
  
  // Parse r
  offset += 1; // Skip 0x02
  const rLength = buffer[offset++];
  const r = BigInt('0x' + buffer.slice(offset, offset + rLength).toString('hex'));
  offset += rLength;
  
  // Parse s
  offset += 1; // Skip 0x02
  const sLength = buffer[offset++];
  const s = BigInt('0x' + buffer.slice(offset, offset + sLength).toString('hex'));
  
  return { r, s };
}

// Get recovery ID by testing both possibilities
async function getRecoveryId(messageHash, r, s, keyId) {
  const address = await getEthAddressFromKMS(keyId);
  
  // Normalize s value (ensure it's in the lower half of the curve order)
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let sNormalized = s;
  if (s > secp256k1N / 2n) {
    sNormalized = secp256k1N - s;
  }
  
  const rHex = '0x' + r.toString(16).padStart(64, '0');
  const sHex = '0x' + sNormalized.toString(16).padStart(64, '0');
  
  // Test both recovery IDs
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
    } catch (e) {
      // Continue to next recovery ID
    }
  }
  
  // If normalized s didn't work, try with original s
  if (sNormalized !== s) {
    const sOrigHex = '0x' + s.toString(16).padStart(64, '0');
    
    for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
      try {
        const recovered = ethers.recoverAddress(messageHash, {
          r: rHex,
          s: sOrigHex,
          v: 27 + recoveryId
        });
        
        if (recovered.toLowerCase() === address.toLowerCase()) {
          return { recoveryId, s };
        }
      } catch (e) {
        // Continue to next recovery ID
      }
    }
  }
  
  throw new Error('Could not determine recovery ID');
}

// Check transaction status (for async monitoring)
async function checkTransactionStatus(txHash, provider) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return {
        confirmed: true,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        blobGasUsed: receipt.blobGasUsed?.toString(),
        status: receipt.status
      };
    }
    return { confirmed: false };
  } catch (error) {
    return { confirmed: false, error: error.message };
  }
}

// Main Lambda handler with optimistic response
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('KMS Lambda invoked at:', new Date().toISOString());
    
    // Initialize KZG (should be fast from cache)
    await initKzg();
    
    // Parse input data
    let jsonData;
    
    if (event.body) {
      let body;
      try {
        const bodyStr = typeof event.body === 'string' ? event.body.trim() : event.body;
        body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body',
            details: parseError.message
          })
        };
      }
      jsonData = body.json || body.data || body;
    } else {
      jsonData = event.json || event.data || event;
    }
    
    // Check if this is a status check request
    if (event.queryStringParameters?.action === 'status' && event.queryStringParameters?.txHash) {
      const RPC_URL = process.env.SEPOLIA_RPC_URL;
      if (!RPC_URL) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'SEPOLIA_RPC_URL not configured' })
        };
      }
      
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const status = await checkTransactionStatus(event.queryStringParameters.txHash, provider);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(status)
      };
    }
    
    // Validate data size
    const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    if (dataStr.length > 128 * 1024) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Data too large for blob (max 128KB)',
          dataSize: dataStr.length
        })
      };
    }
    
    console.log('Data size:', dataStr.length, 'bytes');
    
    // Get environment variables
    const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    
    if (!KMS_KEY_ID || !RPC_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing configuration',
          missing: [!KMS_KEY_ID && 'AWS_KMS_KEY_ID', !RPC_URL && 'SEPOLIA_RPC_URL'].filter(Boolean)
        })
      };
    }
    
    // Get KMS address (cache this if possible)
    const signerAddress = await getEthAddressFromKMS(KMS_KEY_ID);
    console.log('KMS signer address:', signerAddress);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check balance
    const balance = await provider.getBalance(signerAddress);
    console.log('Account balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance === 0n) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Insufficient balance - account has 0 ETH',
          address: signerAddress,
          balance: '0'
        })
      };
    }
    
    // Convert to blob
    const blobUint8 = toBlobs(dataStr);
    const blobHex = Buffer.from(blobUint8).toString('hex');
    
    // Generate KZG commitment and proof
    const commitment = kzg.blobToKzgCommitment(blobHex);
    const proof = kzg.computeBlobProof(blobHex, commitment);
    
    // Verify the proof is valid
    const isValid = kzg.verifyBlobProof(blobHex, commitment, proof);
    if (!isValid) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid KZG proof generated' })
      };
    }
    
    // Create versioned hash
    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = '0x01' + commitmentHash.substring(4);
    
    console.log('Versioned hash:', versionedHash);
    
    // Get nonce and fees
    const [nonce, latestBlock] = await Promise.all([
      provider.getTransactionCount(signerAddress),
      provider.getBlock('latest')
    ]);
    
    const baseFee = latestBlock.baseFeePerGas;
    const maxPriorityFee = ethers.parseUnits('2', 'gwei');
    const maxFeePerGas = baseFee * 2n + maxPriorityFee;
    const maxBlobFee = ethers.parseUnits('30', 'gwei');
    
    const estimatedGasCost = 21000n * maxFeePerGas;
    const estimatedBlobCost = 131072n * maxBlobFee;
    const totalEstimatedCost = estimatedGasCost + estimatedBlobCost;
    
    console.log('Total estimated cost:', ethers.formatEther(totalEstimatedCost), 'ETH');
    
    if (balance < totalEstimatedCost) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Insufficient balance for blob transaction',
          address: signerAddress,
          balance: ethers.formatEther(balance),
          estimatedCost: ethers.formatEther(totalEstimatedCost)
        })
      };
    }
    
    // Check remaining time (target: complete within 25 seconds to be safe)
    const elapsedTime = Date.now() - startTime;
    const remainingTime = 25000 - elapsedTime; // 25 seconds target
    
    console.log(`Elapsed: ${elapsedTime}ms, Remaining: ${remainingTime}ms`);
    
    // OPTIMISTIC APPROACH: Use temp wallet for blob tx
    const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    console.log('Temp wallet address:', tempWallet.address);
    
    // Step 1: Transfer ETH (should be fast)
    const transferTx = {
      type: 2,
      to: tempWallet.address,
      value: totalEstimatedCost,
      chainId: 11155111,
      nonce: nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFeePerGas
    };
    
    const transferEthTx = ethers.Transaction.from(transferTx);
    const transferUnsignedHash = transferEthTx.unsignedHash;
    const transferSignature = await signWithKMS(KMS_KEY_ID, transferUnsignedHash);
    
    transferEthTx.signature = ethers.Signature.from({
      r: transferSignature.r,
      s: transferSignature.s,
      v: transferSignature.v
    });
    
    console.log('Sending ETH transfer...');
    const transferRpcResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendRawTransaction',
        params: [transferEthTx.serialized]
      })
    });
    
    const transferResult = await transferRpcResponse.json();
    if (transferResult.error) {
      throw new Error(`ETH transfer failed: ${transferResult.error.message}`);
    }
    
    const transferTxHash = transferResult.result;
    console.log('ETH transfer sent:', transferTxHash);
    
    // Check time again
    const timeAfterTransfer = Date.now() - startTime;
    console.log(`Time after transfer: ${timeAfterTransfer}ms`);
    
    // OPTIMISTIC: Return immediately with transfer hash and instructions
    if (timeAfterTransfer > 15000) { // If we're past 15 seconds, return optimistically
      console.log('Returning optimistic response (transfer only)');
      
      return {
        statusCode: 202, // Accepted
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          status: 'pending_blob_submission',
          message: 'ETH transferred to temp wallet. Blob submission pending.',
          ethTransferHash: transferTxHash,
          tempWalletAddress: tempWallet.address,
          tempWalletPrivateKey: tempWallet.privateKey, // Client can continue the blob tx if needed
          blobVersionedHash: versionedHash,
          estimatedCompletion: '30-60 seconds',
          checkStatusUrl: `/status?txHash=${transferTxHash}`,
          etherscanTransferUrl: `https://sepolia.etherscan.io/tx/${transferTxHash}`,
          instructions: 'Save the tempWalletPrivateKey to manually submit blob if needed'
        })
      };
    }
    
    // Try to wait a bit for transfer confirmation (with timeout)
    let transferConfirmed = false;
    const confirmationTimeout = Math.min(5000, remainingTime - 5000); // Leave 5s buffer
    const confirmationDeadline = Date.now() + confirmationTimeout;
    
    while (Date.now() < confirmationDeadline) {
      try {
        const receipt = await provider.getTransactionReceipt(transferTxHash);
        if (receipt) {
          console.log('Transfer confirmed in block:', receipt.blockNumber);
          transferConfirmed = true;
          break;
        }
      } catch (e) {
        // Ignore errors, keep trying
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!transferConfirmed) {
      console.log('Transfer not confirmed yet, proceeding optimistically');
      
      // Return with pending status but include everything needed to continue
      return {
        statusCode: 202,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          status: 'transfer_pending',
          message: 'ETH transfer submitted. Blob can be submitted once confirmed.',
          ethTransferHash: transferTxHash,
          tempWalletAddress: tempWallet.address,
          tempWalletPrivateKey: tempWallet.privateKey,
          blobData: {
            versionedHash: versionedHash,
            commitment: ethers.hexlify(commitment),
            proof: ethers.hexlify(proof),
            blob: ethers.hexlify(blobUint8)
          },
          nextStep: 'Wait for transfer confirmation then submit blob with temp wallet',
          etherscanTransferUrl: `https://sepolia.etherscan.io/tx/${transferTxHash}`
        })
      };
    }
    
    // Transfer confirmed, try to send blob tx
    console.log('Sending blob transaction...');
    
    try {
      const tempWalletNonce = await provider.getTransactionCount(tempWallet.address);
      
      const blobTxWithSidecar = {
        type: 3,
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        value: 0n,
        chainId: 11155111,
        nonce: tempWalletNonce,
        gasLimit: 21000n,
        maxPriorityFeePerGas: maxPriorityFee,
        maxFeePerGas: maxFeePerGas,
        maxFeePerBlobGas: maxBlobFee,
        blobVersionedHashes: [versionedHash],
        kzg: kzg,
        blobs: [blobUint8]
      };
      
      const blobTxResponse = await tempWallet.sendTransaction(blobTxWithSidecar);
      const blobTxHash = blobTxResponse.hash;
      
      console.log('Blob transaction sent:', blobTxHash);
      
      // Return success immediately (don't wait for confirmation)
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          status: 'blob_submitted',
          blobTransactionHash: blobTxHash,
          ethTransferHash: transferTxHash,
          blobVersionedHash: versionedHash,
          etherscanBlobUrl: `https://sepolia.etherscan.io/tx/${blobTxHash}`,
          etherscanTransferUrl: `https://sepolia.etherscan.io/tx/${transferTxHash}`,
          blobUrl: `https://sepolia.etherscan.io/blob/${versionedHash}`,
          signerAddress: signerAddress,
          tempWalletAddress: tempWallet.address,
          dataSize: dataStr.length,
          executionTime: `${Date.now() - startTime}ms`,
          message: 'Blob transaction submitted successfully'
        })
      };
      
    } catch (blobError) {
      console.error('Blob submission failed:', blobError.message);
      
      // Even if blob fails, transfer succeeded - return partial success
      return {
        statusCode: 207, // Multi-Status
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          status: 'blob_failed',
          error: 'Blob submission failed but ETH transferred successfully',
          ethTransferHash: transferTxHash,
          tempWalletAddress: tempWallet.address,
          tempWalletPrivateKey: tempWallet.privateKey,
          blobError: blobError.message,
          blobData: {
            versionedHash: versionedHash,
            commitment: ethers.hexlify(commitment),
            proof: ethers.hexlify(proof)
          },
          instructions: 'Use temp wallet private key to manually retry blob submission',
          etherscanTransferUrl: `https://sepolia.etherscan.io/tx/${transferTxHash}`
        })
      };
    }
    
  } catch (error) {
    console.error('Lambda error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        executionTime: `${Date.now() - startTime}ms`
      })
    };
  }
};

// Export for testing
exports.checkTransactionStatus = checkTransactionStatus;