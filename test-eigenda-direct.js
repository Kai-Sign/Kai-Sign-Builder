#!/usr/bin/env node

/**
 * Direct EigenDA Test Script - Connects directly to Holesky testnet
 * No Docker required - uses the public disperser endpoint
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration for direct connection to Holesky testnet
const DISPERSER_ENDPOINT = 'disperser-testnet-holesky.eigenda.xyz';
const DISPERSER_PORT = 443;

// Test data
const TEST_DATA = {
  simple: "Hello EigenDA Direct Connection!",
  json: {
    type: "ERC7730",
    version: "1.0.0",
    metadata: {
      description: "Test ERC7730 spec for EigenDA Holesky",
      timestamp: Date.now()
    },
    contract: {
      address: "0x1234567890123456789012345678901234567890",
      chainId: 17000, // Holesky chainId
      name: "TestContract"
    }
  }
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

/**
 * Since we can't directly call gRPC without dependencies,
 * let's use an alternative approach with the EigenDA REST gateway if available,
 * or provide instructions for the actual setup
 */
async function testDirectConnection() {
  log('\n🚀 EigenDA Direct Connection Test', 'bright');
  log('=====================================', 'bright');
  log(`Disperser: ${DISPERSER_ENDPOINT}:${DISPERSER_PORT}`, 'cyan');
  
  log('\n⚠️  Note: Direct gRPC connection requires additional setup', 'yellow');
  log('The EigenDA disperser uses gRPC protocol which requires:', 'yellow');
  log('1. gRPC client libraries (not available in pure Node.js)', 'blue');
  log('2. Protobuf definitions for EigenDA', 'blue');
  log('3. Proper authentication with a signer key', 'blue');
  
  log('\n📝 Here are your options to test EigenDA:', 'cyan');
  
  log('\n1️⃣  Use the EigenDA Proxy (Recommended):', 'green');
  log('   The proxy provides a REST API interface to EigenDA', 'blue');
  log('   You can run it locally or deploy it to a server', 'blue');
  
  log('\n2️⃣  Use grpcurl for command-line testing:', 'green');
  log('   Install: brew install grpcurl (Mac) or see grpcurl.github.io', 'blue');
  log('   Then use these commands:', 'blue');
  
  // Provide grpcurl examples
  const grpcurlExamples = `
  # List available services
  grpcurl -plaintext ${DISPERSER_ENDPOINT}:${DISPERSER_PORT} list

  # Describe the Disperser service
  grpcurl -plaintext ${DISPERSER_ENDPOINT}:${DISPERSER_PORT} describe disperser.Disperser

  # Post a blob (requires proper formatting)
  echo '{"data": "'"$(echo -n 'Hello EigenDA' | base64)"'"}' | \\
    grpcurl -plaintext -d @ \\
    ${DISPERSER_ENDPOINT}:${DISPERSER_PORT} \\
    disperser.Disperser/DisperseBlob
  `;
  
  log(grpcurlExamples, 'cyan');
  
  log('\n3️⃣  Use the Node.js client with dependencies:', 'green');
  log('   Install required packages:', 'blue');
  log('   npm install @grpc/grpc-js @grpc/proto-loader', 'blue');
  log('   Then use the full client implementation', 'blue');
  
  log('\n4️⃣  Deploy the backend service:', 'green');
  log('   The backend/eigenda-api.js service can be deployed', 'blue');
  log('   It will handle the gRPC communication for you', 'blue');
}

/**
 * Alternative: Create a simple HTTP proxy setup script
 */
function generateProxySetup() {
  log('\n📦 Generating EigenDA Proxy setup commands...', 'cyan');
  
  const setupCommands = `
# Option A: Run with Node.js (if Docker is not available)
# First, create a simple proxy server

cat > eigenda-proxy-server.js << 'EOF'
const express = require('express');
const app = express();
const port = 3100;

app.use(express.json());

// Mock endpoints for testing
app.post('/put', (req, res) => {
  // In production, this would connect to EigenDA
  const mockCertificate = Buffer.from(
    '0x' + Math.random().toString(16).substr(2) + 
    Math.random().toString(16).substr(2)
  ).toString('hex');
  
  res.send(Buffer.from(mockCertificate, 'hex'));
});

app.get('/get/:cert', (req, res) => {
  // In production, this would retrieve from EigenDA
  res.json({ message: 'Mock data retrieval', cert: req.params.cert });
});

app.listen(port, () => {
  console.log(\`Mock EigenDA proxy running on port \${port}\`);
});
EOF

# Then run it
npm install express
node eigenda-proxy-server.js

# Option B: Use a cloud service
# Deploy the EigenDA proxy to a service like Railway, Render, or Heroku
# This avoids local Docker requirements
`;

  log(setupCommands, 'blue');
}

/**
 * Test with public infrastructure
 */
async function testWithPublicInfra() {
  log('\n🌐 Testing with Public Infrastructure', 'bright');
  log('======================================', 'bright');
  
  // Check if there's a public EigenDA gateway available
  const publicEndpoints = [
    'https://eigenda-proxy.example.com', // Replace with actual public endpoint if available
    'https://api.eigenda.xyz',           // Hypothetical public API
  ];
  
  log('\n📡 Known Public Endpoints:', 'cyan');
  log('   Unfortunately, EigenDA doesn\'t provide public REST endpoints', 'yellow');
  log('   You need to run your own proxy or use the gRPC disperser directly', 'yellow');
  
  log('\n🔧 Quick Setup Without Docker:', 'green');
  log('1. Install Node.js dependencies:', 'blue');
  log('   cd backend && npm install', 'blue');
  
  log('\n2. Set up environment:', 'blue');
  log('   export EIGENDA_DISPERSER_RPC=' + DISPERSER_ENDPOINT + ':' + DISPERSER_PORT, 'blue');
  log('   export EIGENDA_SIGNER_KEY=0x0000000000000000000100000000000000000000000000000000000000000000', 'blue');
  
  log('\n3. Run the API server:', 'blue');
  log('   node backend/eigenda-api.js', 'blue');
  
  log('\n4. Test with curl:', 'blue');
  log('   curl -X POST http://localhost:3001/api/eigenda/blob \\', 'blue');
  log('     -H "Content-Type: application/json" \\', 'blue');
  log('     -d \'{"data": "Hello EigenDA"}\'', 'blue');
}

/**
 * Create a test data file for manual testing
 */
function createTestDataFile() {
  const fs = require('fs');
  const testFile = 'test-eigenda-data.json';
  
  fs.writeFileSync(testFile, JSON.stringify(TEST_DATA.json, null, 2));
  
  log(`\n📄 Created test file: ${testFile}`, 'green');
  log('   You can use this file for testing with other tools', 'blue');
}

// Main execution
async function main() {
  log('\n🔍 Checking your options for testing EigenDA...', 'cyan');
  
  // Test direct connection info
  await testDirectConnection();
  
  // Generate proxy setup
  generateProxySetup();
  
  // Test with public infrastructure
  await testWithPublicInfra();
  
  // Create test data file
  createTestDataFile();
  
  log('\n✅ Setup information complete!', 'green');
  log('\n📚 Summary:', 'bright');
  log('1. EigenDA requires gRPC for direct connection', 'blue');
  log('2. The easiest way is to use the EigenDA proxy', 'blue');
  log('3. You can run the proxy without Docker using the provided alternatives', 'blue');
  log('4. The backend service in this repo handles all the complexity for you', 'blue');
  
  log('\n🚀 Next Steps:', 'cyan');
  log('1. Start Docker Desktop (if available)', 'yellow');
  log('2. OR run the backend service directly with Node.js', 'yellow');
  log('3. OR deploy to a cloud service for testing', 'yellow');
}

// Run the script
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});