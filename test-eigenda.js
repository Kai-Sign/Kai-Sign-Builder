#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const EIGENDA_PROXY_URL = process.env.EIGENDA_PROXY_URL || 'http://localhost:3100';

// Test data
const TEST_DATA = {
  simple: "Hello EigenDA!",
  json: {
    type: "ERC7730",
    version: "1.0.0",
    metadata: {
      description: "Test ERC7730 spec for EigenDA",
      timestamp: Date.now()
    },
    contract: {
      address: "0x1234567890123456789012345678901234567890",
      chainId: 11155111,
      name: "TestContract"
    }
  },
  large: Buffer.alloc(100000).fill('A').toString() // 100KB of 'A's
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkProxyHealth() {
  try {
    log('\n🔍 Checking EigenDA Proxy health...', 'cyan');
    
    // Try to connect to the proxy
    const response = await axios.get(EIGENDA_PROXY_URL, { 
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    
    log(`✅ EigenDA Proxy is reachable at ${EIGENDA_PROXY_URL}`, 'green');
    return true;
  } catch (error) {
    log(`❌ EigenDA Proxy not reachable at ${EIGENDA_PROXY_URL}`, 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return false;
  }
}

async function postBlob(data, description) {
  try {
    log(`\n📤 Posting ${description}...`, 'cyan');
    
    // Convert data to buffer
    const dataBuffer = typeof data === 'object' 
      ? Buffer.from(JSON.stringify(data, null, 2))
      : Buffer.from(data);
    
    log(`   Size: ${dataBuffer.length} bytes`, 'blue');
    
    const startTime = Date.now();
    
    // Post to EigenDA proxy
    const response = await axios.post(
      `${EIGENDA_PROXY_URL}/put?commitment_mode=standard`,
      dataBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        responseType: 'arraybuffer',
        timeout: 120000, // 2 minute timeout
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Convert response to hex certificate
    const certificate = Buffer.from(response.data).toString('hex');
    const blobHash = '0x' + certificate.slice(0, 64); // First 32 bytes as blob hash
    
    log(`✅ Blob posted successfully in ${elapsedTime}s`, 'green');
    log(`   Certificate: ${certificate.slice(0, 40)}...`, 'blue');
    log(`   Blob Hash: ${blobHash}`, 'blue');
    
    return { certificate, blobHash, size: dataBuffer.length, time: elapsedTime };
  } catch (error) {
    log(`❌ Failed to post ${description}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'yellow');
      log(`   Error: ${error.response.data?.toString() || error.message}`, 'yellow');
    } else {
      log(`   Error: ${error.message}`, 'yellow');
    }
    return null;
  }
}

async function retrieveBlob(certificate, description) {
  try {
    log(`\n📥 Retrieving ${description}...`, 'cyan');
    
    const certHex = certificate.startsWith('0x') ? certificate.slice(2) : certificate;
    
    const startTime = Date.now();
    
    const response = await axios.get(
      `${EIGENDA_PROXY_URL}/get/${certHex}?commitment_mode=standard`,
      {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      }
    );
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = Buffer.from(response.data);
    
    log(`✅ Blob retrieved successfully in ${elapsedTime}s`, 'green');
    log(`   Size: ${data.length} bytes`, 'blue');
    
    // Try to parse as JSON and display preview
    try {
      const jsonData = JSON.parse(data.toString());
      log(`   Content preview: ${JSON.stringify(jsonData).slice(0, 100)}...`, 'blue');
    } catch {
      log(`   Content preview: ${data.toString().slice(0, 100)}...`, 'blue');
    }
    
    return { data, time: elapsedTime };
  } catch (error) {
    log(`❌ Failed to retrieve ${description}`, 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return null;
  }
}

async function runTest(testName, testData) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`TEST: ${testName}`, 'bright');
  log('='.repeat(60), 'bright');
  
  // Post blob
  const postResult = await postBlob(testData, testName);
  if (!postResult) return false;
  
  // Wait a bit for propagation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Retrieve blob
  const retrieveResult = await retrieveBlob(postResult.certificate, testName);
  if (!retrieveResult) return false;
  
  // Verify data matches
  const originalData = typeof testData === 'object' 
    ? JSON.stringify(testData, null, 2)
    : testData;
  
  const retrievedData = retrieveResult.data.toString();
  
  if (originalData === retrievedData) {
    log(`✅ Data verification passed - content matches!`, 'green');
  } else {
    log(`❌ Data verification failed - content mismatch!`, 'red');
    log(`   Original length: ${originalData.length}`, 'yellow');
    log(`   Retrieved length: ${retrievedData.length}`, 'yellow');
  }
  
  // Summary
  log(`\n📊 Test Summary:`, 'cyan');
  log(`   Post time: ${postResult.time}s`, 'blue');
  log(`   Retrieve time: ${retrieveResult.time}s`, 'blue');
  log(`   Data size: ${postResult.size} bytes`, 'blue');
  log(`   Certificate: ${postResult.certificate.slice(0, 40)}...`, 'blue');
  
  return true;
}

async function runMemstoreTest() {
  log('\n🧪 Running Memstore Test (local only)', 'bright');
  log('Starting EigenDA proxy with memstore backend...', 'cyan');
  
  // Note: This assumes docker is installed
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Start proxy with memstore
    log('Starting docker container...', 'blue');
    await execPromise('docker run -d --rm -p 3100:3100 --name eigenda-test ghcr.io/layr-labs/eigenda-proxy:latest --memstore.enabled --port 3100');
    
    // Wait for it to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run tests
    await runTest('Simple String (Memstore)', TEST_DATA.simple);
    await runTest('JSON Object (Memstore)', TEST_DATA.json);
    
    // Stop container
    log('\nStopping docker container...', 'blue');
    await execPromise('docker stop eigenda-test');
    
  } catch (error) {
    log(`Failed to run memstore test: ${error.message}`, 'red');
    log('Make sure Docker is installed and running', 'yellow');
  }
}

async function main() {
  log('\n🚀 EigenDA Blob Testing Script', 'bright');
  log('================================', 'bright');
  log(`Proxy URL: ${EIGENDA_PROXY_URL}`, 'cyan');
  
  // Check if proxy is available
  const isHealthy = await checkProxyHealth();
  
  if (!isHealthy) {
    log('\n💡 Tip: Start the EigenDA proxy first:', 'yellow');
    log('   Option 1: Use docker-compose', 'blue');
    log('   $ docker-compose -f docker-compose.eigenda.yml up -d', 'blue');
    log('\n   Option 2: Run with memstore for testing', 'blue');
    log('   $ docker run --rm -p 3100:3100 ghcr.io/layr-labs/eigenda-proxy:latest --memstore.enabled --port 3100', 'blue');
    log('\n   Option 3: Run memstore test (requires Docker)', 'blue');
    log('   $ node test-eigenda.js --memstore', 'blue');
    
    if (process.argv.includes('--memstore')) {
      await runMemstoreTest();
    }
    return;
  }
  
  // Run tests
  let allPassed = true;
  
  // Test 1: Simple string
  if (!await runTest('Simple String', TEST_DATA.simple)) {
    allPassed = false;
  }
  
  // Test 2: JSON object
  if (!await runTest('JSON Object', TEST_DATA.json)) {
    allPassed = false;
  }
  
  // Test 3: Large data (optional)
  if (process.argv.includes('--large')) {
    if (!await runTest('Large Data (100KB)', TEST_DATA.large)) {
      allPassed = false;
    }
  }
  
  // Test 4: Custom file (if provided)
  const fileArg = process.argv.find(arg => arg.startsWith('--file='));
  if (fileArg) {
    const filePath = fileArg.split('=')[1];
    try {
      const fileData = fs.readFileSync(filePath);
      if (!await runTest(`File: ${path.basename(filePath)}`, fileData)) {
        allPassed = false;
      }
    } catch (error) {
      log(`\n❌ Failed to read file: ${filePath}`, 'red');
      log(`   Error: ${error.message}`, 'yellow');
      allPassed = false;
    }
  }
  
  // Final summary
  log('\n' + '='.repeat(60), 'bright');
  if (allPassed) {
    log('✅ All tests passed!', 'green');
  } else {
    log('❌ Some tests failed', 'red');
  }
  log('='.repeat(60), 'bright');
  
  // Usage instructions
  log('\n📖 Additional Options:', 'cyan');
  log('   --large           Include large data test (100KB)', 'blue');
  log('   --file=path.json  Test with a custom file', 'blue');
  log('   --memstore        Run with local memstore (requires Docker)', 'blue');
  log('\n📖 Environment Variables:', 'cyan');
  log('   EIGENDA_PROXY_URL  Set proxy URL (default: http://localhost:3100)', 'blue');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run the script
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});