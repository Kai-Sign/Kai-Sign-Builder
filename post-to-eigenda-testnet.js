#!/usr/bin/env node

/**
 * Post data to real EigenDA Holesky Testnet
 * This script properly encodes data for EigenDA
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Field element modulus for BLS12-381
const FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Encode data for EigenDA (must be field elements)
 */
function encodeForEigenDA(data) {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const dataBytes = Buffer.from(dataStr);
  
  // Pad data to be multiple of 31 bytes (to ensure < field modulus)
  const chunkSize = 31; // Use 31 bytes per field element to ensure it's always valid
  const chunks = [];
  
  for (let i = 0; i < dataBytes.length; i += chunkSize) {
    const chunk = dataBytes.slice(i, Math.min(i + chunkSize, dataBytes.length));
    // Pad chunk to 32 bytes with leading zero
    const paddedChunk = Buffer.concat([Buffer.from([0]), chunk]);
    if (paddedChunk.length < 32) {
      const padding = Buffer.alloc(32 - paddedChunk.length);
      chunks.push(Buffer.concat([padding, paddedChunk]));
    } else {
      chunks.push(paddedChunk);
    }
  }
  
  return Buffer.concat(chunks);
}

/**
 * Post blob to EigenDA testnet
 */
async function postToEigenDA(data) {
  console.log('📤 Posting to EigenDA Holesky Testnet...');
  console.log('   Data:', data.substring(0, 50) + '...');
  
  // Encode data properly
  const encodedData = encodeForEigenDA(data);
  const base64Data = encodedData.toString('base64');
  
  console.log('   Encoded size:', encodedData.length, 'bytes');
  
  // Create gRPC request
  const request = {
    data: base64Data,
    custom_quorum_numbers: []
  };
  
  try {
    // Post using grpcurl
    const command = `echo '${JSON.stringify(request)}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/DisperseBlob`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('WARNING')) {
      console.error('❌ Error:', stderr);
      return null;
    }
    
    if (stdout) {
      console.log('✅ Response received!');
      try {
        const response = JSON.parse(stdout);
        return response;
      } catch {
        console.log('Raw response:', stdout);
        return { raw: stdout };
      }
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    // If it's an encoding error, try simpler data
    if (error.message.includes('field element')) {
      console.log('Retrying with simpler encoding...');
      return postSimpleBlob(data);
    }
  }
  
  return null;
}

/**
 * Post simple blob (alternative encoding)
 */
async function postSimpleBlob(data) {
  // Create a very simple blob that should work
  const simpleData = Buffer.from(data).toString('hex');
  
  // Ensure each 32-byte chunk is valid
  const chunks = [];
  for (let i = 0; i < simpleData.length; i += 62) {
    // Use only 31 bytes (62 hex chars) per chunk to ensure validity
    const chunk = simpleData.slice(i, i + 62).padEnd(62, '0');
    chunks.push('00' + chunk); // Prepend 00 to make 32 bytes
  }
  
  const encoded = Buffer.from(chunks.join(''), 'hex');
  const base64Data = encoded.toString('base64');
  
  const request = {
    data: base64Data,
    custom_quorum_numbers: []
  };
  
  try {
    const command = `echo '${JSON.stringify(request)}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/DisperseBlob`;
    const { stdout } = await execAsync(command);
    
    if (stdout) {
      console.log('✅ Simple blob posted!');
      return JSON.parse(stdout);
    }
  } catch (error) {
    console.error('Simple blob also failed:', error.message);
  }
  
  return null;
}

/**
 * Check blob status
 */
async function checkBlobStatus(requestId) {
  console.log('\n🔍 Checking blob status...');
  
  const request = { request_id: requestId };
  
  try {
    const command = `echo '${JSON.stringify(request)}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/GetBlobStatus`;
    const { stdout } = await execAsync(command);
    
    if (stdout) {
      const status = JSON.parse(stdout);
      console.log('📊 Status:', status);
      return status;
    }
  } catch (error) {
    console.error('Failed to check status:', error.message);
  }
  
  return null;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 EigenDA Holesky Testnet Direct Post');
  console.log('=======================================');
  console.log('📡 Network: Holesky Testnet');
  console.log('🔗 Disperser: disperser-holesky.eigenda.xyz:443');
  console.log('🔍 Explorer: https://blobs-v2-testnet-holesky.eigenda.xyz');
  console.log('');
  
  // Create test data
  const testData = {
    message: "KaiSign posting to EigenDA",
    timestamp: Date.now(),
    network: "holesky-testnet",
    test: true
  };
  
  const dataStr = JSON.stringify(testData);
  console.log('📦 Test data:', dataStr);
  console.log('');
  
  // Post to EigenDA
  const result = await postToEigenDA(dataStr);
  
  if (result) {
    if (result.request_id) {
      console.log('\n🎉 SUCCESS! Blob posted to EigenDA testnet');
      console.log('📝 Request ID:', result.request_id);
      
      // Wait and check status
      console.log('\nWaiting 5 seconds before checking status...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const status = await checkBlobStatus(result.request_id);
      
      if (status && status.status === 'CONFIRMED') {
        console.log('\n✅ Blob confirmed on EigenDA!');
        console.log('🔍 View on explorer:');
        console.log(`   https://blobs-v2-testnet-holesky.eigenda.xyz/blobs/${result.request_id}`);
      }
    } else {
      console.log('Response:', result);
    }
  } else {
    console.log('\n❌ Failed to post blob');
    console.log('\n💡 Alternatives:');
    console.log('1. Use the mock server for local testing: node mock-eigenda-server.js');
    console.log('2. Run the proxy with Docker when available');
    console.log('3. Deploy eigenda-proxy to a cloud service');
  }
}

// Run
main().catch(console.error);