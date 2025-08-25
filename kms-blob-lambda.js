// AWS Lambda function for blob posting with KMS signing
// NO PRIVATE KEYS - uses AWS KMS for signing

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

// Provide an adapter exposing c-kzg-compatible methods expected by ethers v6
function toHexFromBytes(bytes) {
  return '0x' + Buffer.from(bytes).toString('hex');
}

function toBytes(data) {
  return ethers.getBytes(data);
}

const kzgAdapter = {
  blobToKzgCommitment(blob) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = kzg.blobToKzgCommitment(blobHex);
    return toBytes(commitmentHex);
  },
  computeBlobKzgProof(blob, commitment) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = ethers.hexlify(commitment);
    const proofHex = kzg.computeBlobProof(blobHex, commitmentHex);
    return toBytes(proofHex);
  },
  verifyBlobKzgProof(blob, commitment, proof) {
    const blobHex = toHexFromBytes(blob);
    const commitmentHex = ethers.hexlify(commitment);
    const proofHex = ethers.hexlify(proof);
    return kzg.verifyBlobProof(blobHex, commitmentHex, proofHex);
  }
};

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
  const publicKeyHex = Buffer.from(publicKeyDer).toString('hex');
  
  // Extract the 64-byte uncompressed key (skip DER headers)
  // This is a simplified extraction - in production, use proper DER parsing
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
  // Format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
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
  console.log('Trying to recover for address:', address);
  
  // Normalize s value (ensure it's in the lower half of the curve order)
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let sNormalized = s;
  if (s > secp256k1N / 2n) {
    sNormalized = secp256k1N - s;
    console.log('Normalized s value:', sNormalized.toString(16));
  }
  
  const rHex = '0x' + r.toString(16).padStart(64, '0');
  const sHex = '0x' + sNormalized.toString(16).padStart(64, '0');
  
  console.log('r:', rHex);
  console.log('s:', sHex);
  
  // Test both recovery IDs
  for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
    try {
      const recovered = ethers.recoverAddress(messageHash, {
        r: rHex,
        s: sHex,
        v: 27 + recoveryId
      });
      
      console.log(`Recovery ID ${recoveryId}: ${recovered}`);
      
      if (recovered.toLowerCase() === address.toLowerCase()) {
        console.log(`Found matching recovery ID: ${recoveryId}`);
        return { recoveryId, s: sNormalized };
      }
    } catch (e) {
      console.log(`Recovery ID ${recoveryId} failed:`, e.message);
    }
  }
  
  // If normalized s didn't work, try with original s
  if (sNormalized !== s) {
    console.log('Trying with original s value...');
    const sOrigHex = '0x' + s.toString(16).padStart(64, '0');
    
    for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
      try {
        const recovered = ethers.recoverAddress(messageHash, {
          r: rHex,
          s: sOrigHex,
          v: 27 + recoveryId
        });
        
        console.log(`Original s, Recovery ID ${recoveryId}: ${recovered}`);
        
        if (recovered.toLowerCase() === address.toLowerCase()) {
          console.log(`Found matching recovery ID with original s: ${recoveryId}`);
          return { recoveryId, s };
        }
      } catch (e) {
        console.log(`Original s, Recovery ID ${recoveryId} failed:`, e.message);
      }
    }
  }
  
  throw new Error('Could not determine recovery ID');
}

// Main Lambda handler
exports.handler = async (event, context) => {
  try {
    console.log('KMS Lambda invoked with event:', JSON.stringify(event));
    
    // Initialize KZG
    await initKzg();
    
    // Parse input data
    let jsonData;
    
    if (event.body) {
      let body;
      try {
        // Clean up the body string if needed
        const bodyStr = typeof event.body === 'string' ? event.body.trim() : event.body;
        body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
      } catch (parseError) {
        console.log('JSON parse error:', parseError.message);
        console.log('Raw body:', event.body);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body',
            details: parseError.message,
            receivedBody: event.body
          })
        };
      }
      jsonData = body.json || body.data || body;
    } else {
      jsonData = event.json || event.data || event;
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
    
    if (!KMS_KEY_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'AWS_KMS_KEY_ID not configured'
        })
      };
    }
    
    if (!RPC_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'SEPOLIA_RPC_URL not configured'
        })
      };
    }
    
    // Get KMS address
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
    console.log('Blob uint8 created:', blobUint8.length, 'bytes');
    
    // Generate KZG commitment and proof via adapter (c-kzg compatible)
    const commitment = kzgAdapter.blobToKzgCommitment(blobUint8);
    const proof = kzgAdapter.computeBlobKzgProof(blobUint8, commitment);
    
    // Verify the proof is valid
    const isValid = kzgAdapter.verifyBlobKzgProof(blobUint8, commitment, proof);
    console.log('KZG proof valid:', isValid);
    
    if (!isValid) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Invalid KZG proof generated'
        })
      };
    }
    
    // Create versioned hash
    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = '0x01' + commitmentHash.substring(4);
    
    console.log('Commitment:', ethers.hexlify(commitment));
    console.log('Versioned hash:', versionedHash);
    
    // Get nonce and fees
    const nonce = await provider.getTransactionCount(signerAddress);
    const latestBlock = await provider.getBlock('latest');
    const baseFee = latestBlock.baseFeePerGas;
    
    console.log('Nonce:', nonce);
    console.log('Base fee:', ethers.formatUnits(baseFee, 'gwei'), 'gwei');
    
    // Calculate estimated costs for blob transaction
    const maxPriorityFee = ethers.parseUnits('2', 'gwei');
    const maxFeePerGas = baseFee * 2n + maxPriorityFee; // base fee + priority fee
    const maxBlobFee = ethers.parseUnits('30', 'gwei');
    
    const estimatedGasCost = 21000n * maxFeePerGas;
    const estimatedBlobCost = 131072n * maxBlobFee; // blob size * blob fee
    const totalEstimatedCost = estimatedGasCost + estimatedBlobCost;
    
    console.log('Estimated gas cost:', ethers.formatEther(estimatedGasCost), 'ETH');
    console.log('Estimated blob cost:', ethers.formatEther(estimatedBlobCost), 'ETH');
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
    
    // Create the transaction with calculated fees
    const tx = {
      type: 3,
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: 0n,
      chainId: 11155111, // Sepolia
      nonce: nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFeePerGas,
      maxFeePerBlobGas: maxBlobFee,
      blobVersionedHashes: [versionedHash]
    };
    
    // Based on the working BlobTx.js pattern - sign the base transaction first
    const baseTransaction = {
      type: 3,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      chainId: tx.chainId,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      maxFeePerGas: tx.maxFeePerGas,
      maxFeePerBlobGas: tx.maxFeePerBlobGas,
      blobVersionedHashes: tx.blobVersionedHashes
    };
    
    console.log('Base transaction for signing:', baseTransaction);
    
    // Create ethers Transaction object for signing
    let ethTx;
    try {
      ethTx = ethers.Transaction.from(baseTransaction);
      console.log('Transaction object created successfully');
    } catch (error) {
      console.log('Error creating transaction object:', error.message);
      throw error;
    }
    
    // Get the signing hash
    const txHash = ethTx.unsignedHash;
    console.log('Signing transaction hash:', txHash);
    
    // Sign with KMS  
    const signature = await signWithKMS(KMS_KEY_ID, txHash);
    console.log('KMS signature:', signature);
    
    // Apply signature to transaction
    ethTx.signature = ethers.Signature.from({
      r: signature.r,
      s: signature.s,
      v: signature.v
    });
    
    console.log('Transaction signed successfully');
    
    // Create the transaction with sidecar data (like in BlobTx.js)
    const signedTxWithSidecar = {
      ...baseTransaction,
      signature: {
        r: signature.r,
        s: signature.s,
        v: signature.v
      },
      // Add KZG library and blob data for network format
      kzg: kzgAdapter,
      blobs: [blobUint8]
    };
    
    console.log('Transaction with sidecar created');
    
    console.log('Sending blob transaction...');
    
    // SIMPLE SOLUTION: Transfer ETH from KMS address to temporary wallet, then use temp wallet for blob tx
    let transactionHash;
    let transferTxHash = null;
    
    try {
      console.log('Using ETH transfer approach - creating temporary wallet...');
      
      // Create a temporary wallet with random private key
      const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
      console.log('Temporary wallet address:', tempWallet.address);
      
      // Calculate EXACT amount needed for blob transaction only
      const transferAmount = totalEstimatedCost;
      console.log('Will transfer', ethers.formatEther(transferAmount), 'ETH to temp wallet');
      
      // Step 1: Transfer ETH from KMS address to temp wallet
      console.log('Step 1: Transferring ETH from KMS to temp wallet...');
      
      const transferTx = {
        type: 2, // EIP-1559
        to: tempWallet.address,
        value: transferAmount,
        chainId: 11155111,
        nonce: nonce,
        gasLimit: 21000n,
        maxPriorityFeePerGas: maxPriorityFee,
        maxFeePerGas: maxFeePerGas
      };
      
      // Sign transfer with KMS
      const transferEthTx = ethers.Transaction.from(transferTx);
      const transferUnsignedHash = transferEthTx.unsignedHash;
      const transferSignature = await signWithKMS(KMS_KEY_ID, transferUnsignedHash);
      
      transferEthTx.signature = ethers.Signature.from({
        r: transferSignature.r,
        s: transferSignature.s,
        v: transferSignature.v
      });
      
      console.log('Sending ETH transfer transaction...');
      transferTxHash = await provider.send('eth_sendRawTransaction', [transferEthTx.serialized]);
      console.log('✅ ETH transfer sent:', transferTxHash);
      
      // Wait for transfer to be confirmed
      console.log('Waiting for ETH transfer confirmation...');
      let transferReceipt = null;
      for (let i = 0; i < 30; i++) { // Wait up to 5 minutes
        try {
          transferReceipt = await provider.getTransactionReceipt(transferTxHash);
          if (transferReceipt) {
            console.log('✅ ETH transfer confirmed in block:', transferReceipt.blockNumber);
            break;
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      }
      
      if (!transferReceipt) {
        throw new Error('ETH transfer not confirmed within timeout');
      }
      
      // Step 2: Now send the blob transaction using the funded temp wallet
      console.log('Step 2: Sending blob transaction with funded temp wallet...');
      
      // Get temp wallet's starting nonce
      const tempWalletStartingNonce = await tempWallet.getNonce();
      console.log('Temp wallet starting nonce:', tempWalletStartingNonce);
      
      // Create blob transaction exactly like BlobTx.js
      const blobTxWithSidecar = {
        type: 3,
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        value: 0n,
        chainId: 11155111,
        nonce: tempWalletStartingNonce, // Use the fetched nonce
        gasLimit: 21000n,
        maxPriorityFeePerGas: maxPriorityFee,
        maxFeePerGas: maxFeePerGas,
        maxFeePerBlobGas: maxBlobFee,
        blobVersionedHashes: [versionedHash],
        // Add KZG and blob data for ethers internal handling
        kzg: kzgAdapter,
        blobs: [blobUint8]
      };
      
      console.log('Sending blob transaction with temp wallet...');
      const blobTxResponse = await tempWallet.sendTransaction(blobTxWithSidecar);
      transactionHash = blobTxResponse.hash;
      
      console.log('🎉 SUCCESS! Blob transaction sent:', transactionHash);
      console.log('ETH transfer tx:', transferTxHash);
      console.log('Blob transaction tx:', transactionHash);
      
      // No need for return logic - we transferred the exact amount needed
      
    } catch (error) {
      console.error('ETH transfer + blob tx approach failed:', error.message);
      throw error;
    }
    console.log('Transaction sent:', transactionHash);
    
    // Wait for confirmation (simplified)
    let receipt = null;
    for (let i = 0; i < 30; i++) { // Wait up to 5 minutes
      try {
        receipt = await provider.getTransactionReceipt(transactionHash);
        if (receipt) break;
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    // Return success response
    const result = {
      success: true,
      blobTransactionHash: transactionHash,
      ethTransferHash: transferTxHash || null, // Include the ETH transfer tx hash
      blockNumber: receipt?.blockNumber || null,
      blobHash: versionedHash,
      gasUsed: receipt?.gasUsed?.toString() || null,
      blobGasUsed: receipt?.blobGasUsed?.toString() || null,
      etherscanBlobUrl: `https://sepolia.etherscan.io/tx/${transactionHash}`,
      etherscanTransferUrl: transferTxHash ? `https://sepolia.etherscan.io/tx/${transferTxHash}` : null,
      blobUrl: `https://sepolia.etherscan.io/blob/${versionedHash}`,
      signerAddress: signerAddress,
      dataSize: dataStr.length,
      kmsKeyId: KMS_KEY_ID.split('/').pop() // Just the key part, not full ARN
    };
    
    console.log('Blob posted successfully with KMS:', result);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('KMS Lambda error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      })
    };
  }
};