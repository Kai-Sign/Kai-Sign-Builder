#!/usr/bin/env node

// Quick setup with default values for testing
import fs from 'fs/promises';
import path from 'path';

console.log('🔐 Quick Setup for Testing');

const config = {
  keystoreDir: './config/keystores',
  password: 'test-password-123456-secure',
  accountCounts: {
    submitters: 2,
    verifiers: 3,
    challengers: 1,
    monitors: 1
  },
  chains: [11155111], // Sepolia only for testing
};

// Create .env file
const envContent = `# KaiSign Bot Configuration - Test Setup
KEYSTORE_PASSWORD=${config.password}
KEYSTORE_DIR=${config.keystoreDir}

# RPC Endpoints (Add your API keys)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_api_key

# KaiSign Contract Addresses  
KAISIGN_V1_ADDRESS=0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719
REALITY_ETH_ADDRESS=0x5b7dD1E86623dDB25ff312e17C5c51f9ee4C1555

# Bot Configuration
MAX_CONCURRENT_SUBMISSIONS=3
SUBMISSION_DELAY_MS=30000
VERIFICATION_DELAY_MS=60000
MAX_BOND_AMOUNT_ETH=0.05
MIN_BOND_AMOUNT_ETH=0.01

# API Keys (Add your keys)
ETHERSCAN_API_KEY=your_etherscan_api_key
`;

try {
    await fs.writeFile('.env', envContent);
    console.log('✅ Created .env file');
    
    // Create config directory
    await fs.mkdir('./config/keystores', { recursive: true });
    console.log('✅ Created keystore directory');
    
    console.log('');
    console.log('📋 Test Configuration Created:');
    console.log(`  Password: ${config.password}`);
    console.log(`  Keystore Dir: ${config.keystoreDir}`);
    console.log(`  Accounts: ${config.accountCounts.submitters + config.accountCounts.verifiers + config.accountCounts.challengers + config.accountCounts.monitors} total`);
    console.log(`  Chains: Sepolia testnet (${config.chains[0]})`);
    
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Update .env with your API keys');
    console.log('2. Run: npm run setup-keystores -- --interactive');
    console.log('   (Use the password above when prompted)');
    console.log('3. Or run: npm run status to test the system');
    
} catch (error) {
    console.error('❌ Quick setup failed:', error.message);
}