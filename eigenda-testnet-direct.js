#!/usr/bin/env node

/**
 * Direct connection to EigenDA Holesky Testnet
 * Posts blobs directly to the real testnet without Docker
 */

import https from 'https';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Real EigenDA Holesky Testnet Configuration
const TESTNET_CONFIG = {
  disperser: 'disperser-holesky.eigenda.xyz:443',
  serviceManager: '0xD4A7E1Bd8015057293f0D0A557088c286942e84b',
  ethRpc: 'https://ethereum-holesky-rpc.publicnode.com',
  chainId: 17000, // Holesky chain ID
  blobExplorer: 'https://blobs-v2-testnet-holesky.eigenda.xyz',
  // Test private key (no funds) - for authentication only
  signerKey: '0x0000000000000000000100000000000000000000000000000000000000000001'
};

console.log('🚀 EigenDA Holesky Testnet Direct Connection');
console.log('===========================================');
console.log(`📡 Disperser: ${TESTNET_CONFIG.disperser}`);
console.log(`🔗 Chain: Holesky (${TESTNET_CONFIG.chainId})`);
console.log(`🔍 Explorer: ${TESTNET_CONFIG.blobExplorer}`);
console.log('');

/**
 * Use grpcurl to interact with EigenDA (if available)
 */
async function checkGrpcurl() {
  try {
    await execAsync('which grpcurl');
    return true;
  } catch {
    return false;
  }
}

/**
 * Post blob using grpcurl
 */
async function postBlobWithGrpcurl(data) {
  console.log('📤 Posting blob to EigenDA testnet using grpcurl...');
  
  // Encode data as base64
  const base64Data = Buffer.from(data).toString('base64');
  
  // Create the gRPC request JSON
  const request = {
    data: base64Data,
    custom_quorum_numbers: [],
    account_id: ""
  };
  
  try {
    // Use grpcurl to call DisperseBlob
    const command = `echo '${JSON.stringify(request)}' | grpcurl -plaintext -d @ ${TESTNET_CONFIG.disperser} disperser.Disperser/DisperseBlob`;
    
    console.log('Executing:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Error:', stderr);
    }
    
    if (stdout) {
      console.log('✅ Response:', stdout);
      const response = JSON.parse(stdout);
      return response;
    }
  } catch (error) {
    console.error('❌ Failed to post blob:', error.message);
    return null;
  }
}

/**
 * Alternative: Use curl to post via a running proxy
 */
async function postBlobViaProxy(data) {
  console.log('📤 Attempting to post via local proxy...');
  
  const { stdout } = await execAsync(`curl -s -X POST http://localhost:3100/put \
    -H "Content-Type: application/octet-stream" \
    --data-binary "${data}" | xxd -p | tr -d '\\n'`).catch(() => ({ stdout: null }));
  
  if (stdout) {
    console.log('✅ Posted via proxy, certificate:', stdout.substring(0, 64) + '...');
    return stdout;
  }
  
  console.log('❌ No proxy running at localhost:3100');
  return null;
}

/**
 * Instructions for manual setup
 */
function showManualInstructions() {
  console.log('\n📝 To post blobs to the real EigenDA testnet:');
  console.log('\n1️⃣  Option 1: Install grpcurl and run this script');
  console.log('   brew install grpcurl  # Mac');
  console.log('   apt-get install grpcurl  # Linux');
  console.log('   Then run: node eigenda-testnet-direct.js');
  
  console.log('\n2️⃣  Option 2: Use the EigenDA CLI (if available)');
  console.log('   npm install -g @eigenda/cli');
  console.log('   eigenda post --network holesky --data "your data"');
  
  console.log('\n3️⃣  Option 3: Deploy the proxy to a cloud service');
  console.log('   Deploy eigenda-proxy to Railway/Render/Fly.io');
  console.log('   Then use the HTTP API endpoints');
  
  console.log('\n4️⃣  Option 4: Use the test environment');
  console.log('   1. Install Docker Desktop');
  console.log('   2. Run: ./run-eigenda-proxy.sh');
  console.log('   3. Post to http://localhost:3100/put');
}

/**
 * Create a verifiable test blob
 */
async function createTestBlob() {
  const timestamp = Date.now();
  const testData = {
    message: "KaiSign EigenDA Test",
    timestamp: timestamp,
    network: "holesky",
    chainId: TESTNET_CONFIG.chainId,
    random: crypto.randomBytes(16).toString('hex')
  };
  
  return JSON.stringify(testData, null, 2);
}

/**
 * Main execution
 */
async function main() {
  // Check if grpcurl is available
  const hasGrpcurl = await checkGrpcurl();
  
  if (hasGrpcurl) {
    console.log('✅ grpcurl is installed');
    
    // Create test data
    const testData = await createTestBlob();
    console.log('\n📦 Test data:', testData.substring(0, 100) + '...');
    
    // Post blob using grpcurl
    const result = await postBlobWithGrpcurl(testData);
    
    if (result && result.request_id) {
      console.log('\n🎉 Success! Blob posted to EigenDA testnet');
      console.log('Request ID:', result.request_id);
      console.log('\n🔍 To verify:');
      console.log(`1. Check status: grpcurl -plaintext -d '{"request_id":"${result.request_id}"}' ${TESTNET_CONFIG.disperser} disperser.Disperser/GetBlobStatus`);
      console.log(`2. Visit explorer: ${TESTNET_CONFIG.blobExplorer}`);
    }
  } else {
    console.log('⚠️  grpcurl not found');
    
    // Try proxy
    const testData = await createTestBlob();
    const proxyResult = await postBlobViaProxy(testData);
    
    if (!proxyResult) {
      showManualInstructions();
    }
  }
  
  console.log('\n📊 Testnet Information:');
  console.log(`Network: Holesky (Chain ID: ${TESTNET_CONFIG.chainId})`);
  console.log(`Service Manager: ${TESTNET_CONFIG.serviceManager}`);
  console.log(`Blob Explorer: ${TESTNET_CONFIG.blobExplorer}`);
  console.log('\n✅ You can verify all blobs on the explorer!');
}

// Run
main().catch(console.error);