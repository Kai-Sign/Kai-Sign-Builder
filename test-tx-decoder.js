const { transactionDecoderService } = require('./frontend/src/lib/transactionDecoderService.ts');

// Test basic functionality
console.log('Testing transaction decoder service...');

// Test supported networks
const networks = transactionDecoderService.getSupportedNetworks();
console.log(`Found ${networks.length} supported networks:`);
networks.slice(0, 5).forEach(network => {
  console.log(`- ${network.name} (Chain ID: ${network.chainId})`);
});

console.log('Transaction decoder service test completed.');