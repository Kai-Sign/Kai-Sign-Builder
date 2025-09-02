// Optimized KMS Lambda - works within 29-second API Gateway limit
// Drop-in replacement for kms-blob-lambda.js

const { ethers } = require('ethers');
const { KMSClient, SignCommand, GetPublicKeyCommand } = require('@aws-sdk/client-kms');
const { KZG } = require('micro-eth-signer/kzg');
const { trustedSetup } = require('@paulmillr/trusted-setups');

// Initialize KZG once during cold start
let kzg = null;
let kzgInitialized = false;
let cachedKmsAddress = null;

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

// Get Ethereum address from KMS (with caching)
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

// Sign with KMS (simplified)
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
  const buffer = Buffer.from(signature);
  let offset = 2;
  offset += 1;
  const rLength = buffer[offset++];
  const r = BigInt('0x' + buffer.slice(offset, offset + rLength).toString('hex'));
  offset += rLength;
  offset += 1;
  const sLength = buffer[offset++];
  const s = BigInt('0x' + buffer.slice(offset, offset + sLength).toString('hex'));
  
  // Quick recovery ID determination
  const address = await getEthAddressFromKMS(keyId);
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let sNormalized = s > secp256k1N / 2n ? secp256k1N - s : s;
  
  const rHex = '0x' + r.toString(16).padStart(64, '0');
  const sHex = '0x' + sNormalized.toString(16).padStart(64, '0');
  
  // Try recovery ID 0 first (most common)
  for (let recoveryId = 0; recoveryId <= 1; recoveryId++) {
    try {
      const recovered = ethers.recoverAddress(messageHash, { r: rHex, s: sHex, v: 27 + recoveryId });
      if (recovered.toLowerCase() === address.toLowerCase()) {
        return { r: rHex, s: sHex, v: 27 + recoveryId };
      }
    } catch (e) {}
  }
  
  throw new Error('Could not determine recovery ID');
}

// Main handler - OPTIMIZED FOR SPEED
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('Optimized KMS Lambda invoked');
    
    // Initialize KZG in parallel with other operations
    const kzgInit = initKzg();
    
    // Parse input quickly
    let jsonData;
    if (event.body) {
      const bodyStr = typeof event.body === 'string' ? event.body.trim() : event.body;
      const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
      jsonData = body.json || body.data || body;
    } else {
      jsonData = event.json || event.data || event;
    }
    
    const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    
    // Quick validation
    if (dataStr.length > 128 * 1024) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Data too large (max 128KB)' })
      };
    }
    
    const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    
    if (!KMS_KEY_ID || !RPC_URL) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing configuration' })
      };
    }
    
    // Parallel operations
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const [signerAddress] = await Promise.all([
      getEthAddressFromKMS(KMS_KEY_ID),
      kzgInit // Ensure KZG is ready
    ]);
    
    console.log('KMS address:', signerAddress);
    
    // Quick balance check
    const balance = await provider.getBalance(signerAddress);
    if (balance === 0n) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Insufficient balance', address: signerAddress })
      };
    }
    
    // Create blob and KZG proofs
    const blobUint8 = toBlobs(dataStr);
    const blobHex = Buffer.from(blobUint8).toString('hex');
    
    const commitment = kzg.blobToKzgCommitment(blobHex);
    const proof = kzg.computeBlobProof(blobHex, commitment);
    
    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = '0x01' + commitmentHash.substring(4);
    
    // Get transaction parameters in parallel
    const [nonce, latestBlock] = await Promise.all([
      provider.getTransactionCount(signerAddress),
      provider.getBlock('latest')
    ]);
    
    const baseFee = latestBlock.baseFeePerGas;
    const maxPriorityFee = ethers.parseUnits('2', 'gwei');
    const maxFeePerGas = baseFee * 2n + maxPriorityFee;
    const maxBlobFee = ethers.parseUnits('30', 'gwei');
    
    // OPTIMIZATION: Return early with transaction details for client-side submission
    // if we're approaching timeout (20 seconds)
    if (Date.now() - startTime > 20000) {
      console.log('Approaching timeout, returning transaction details');
      
      // Create temp wallet
      const tempWallet = ethers.Wallet.createRandom();
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          status: 'prepared',
          message: 'Transaction prepared. Submit manually or retry.',
          tempWallet: {
            address: tempWallet.address,
            privateKey: tempWallet.privateKey
          },
          transferAmount: ethers.formatEther(21000n * maxFeePerGas + 131072n * maxBlobFee),
          fromAddress: signerAddress,
          blobData: {
            versionedHash,
            commitment: ethers.hexlify(commitment),
            proof: ethers.hexlify(proof),
            blob: ethers.hexlify(blobUint8)
          },
          txParams: {
            nonce,
            maxPriorityFee: maxPriorityFee.toString(),
            maxFeePerGas: maxFeePerGas.toString(),
            maxBlobFee: maxBlobFee.toString()
          }
        })
      };
    }
    
    // Create temp wallet and transfer ETH
    const tempWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    const transferAmount = 21000n * maxFeePerGas + 131072n * maxBlobFee;
    
    // Quick transfer
    const transferTx = {
      type: 2,
      to: tempWallet.address,
      value: transferAmount,
      chainId: 11155111,
      nonce: nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFeePerGas
    };
    
    const transferEthTx = ethers.Transaction.from(transferTx);
    const transferSignature = await signWithKMS(KMS_KEY_ID, transferEthTx.unsignedHash);
    
    transferEthTx.signature = ethers.Signature.from(transferSignature);
    
    // Send transfer via direct RPC call (faster than provider)
    const transferResponse = await fetch(RPC_URL, {
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
    console.log('Transfer sent:', transferTxHash);
    
    // Poll for confirmation with timeout
    let confirmed = false;
    const maxWaitTime = 25000 - (Date.now() - startTime); // Leave 4 seconds buffer
    const pollEnd = Date.now() + Math.min(maxWaitTime, 10000); // Max 10 seconds polling
    
    while (Date.now() < pollEnd) {
      const receipt = await provider.getTransactionReceipt(transferTxHash).catch(() => null);
      if (receipt) {
        confirmed = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (!confirmed) {
      // Return with transfer hash and temp wallet details
      return {
        statusCode: 202,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          status: 'transfer_pending',
          ethTransferHash: transferTxHash,
          tempWallet: {
            address: tempWallet.address,
            privateKey: tempWallet.privateKey
          },
          message: 'Transfer pending. Use temp wallet to submit blob when confirmed.',
          etherscanUrl: `https://sepolia.etherscan.io/tx/${transferTxHash}`
        })
      };
    }
    
    // Send blob transaction
    const blobTx = {
      type: 3,
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: 0n,
      chainId: 11155111,
      nonce: 0, // First tx from temp wallet
      gasLimit: 21000n,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFeePerGas,
      maxFeePerBlobGas: maxBlobFee,
      blobVersionedHashes: [versionedHash],
      kzg: kzg,
      blobs: [blobUint8]
    };
    
    const blobTxResponse = await tempWallet.sendTransaction(blobTx);
    
    // Return immediately without waiting for confirmation
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        blobTransactionHash: blobTxResponse.hash,
        ethTransferHash: transferTxHash,
        blobVersionedHash: versionedHash,
        etherscanBlobUrl: `https://sepolia.etherscan.io/tx/${blobTxResponse.hash}`,
        blobUrl: `https://sepolia.etherscan.io/blob/${versionedHash}`,
        signerAddress: signerAddress,
        executionTime: `${Date.now() - startTime}ms`
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        executionTime: `${Date.now() - startTime}ms`
      })
    };
  }
};