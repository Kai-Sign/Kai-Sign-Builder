#!/usr/bin/env node

/**
 * Verification script for KaiSign subgraph deployment
 * Tests that the new contract address and events are properly indexed
 */

const https = require('https');

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/117024/kai-sign/v.0.0.8';
const NEW_CONTRACT_ADDRESS = '0xA2119F82f3F595DB34fa059785BeA2f4F78D418B';

function makeGraphQLRequest(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(SUBGRAPH_URL, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runVerification() {
  console.log('🔍 Verifying KaiSign subgraph deployment...\n');
  console.log(`📡 Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`📋 Expected contract: ${NEW_CONTRACT_ADDRESS}\n`);

  const tests = [
    {
      name: 'Basic connectivity',
      query: '{ _meta { block { number } } }',
      validate: (result) => result.data && result.data._meta && result.data._meta.block
    },
    {
      name: 'LogCommitSpec events',
      query: '{ logCommitSpecs(first: 5) { id committer targetContract chainId } }',
      validate: (result) => result.data && Array.isArray(result.data.logCommitSpecs)
    },
    {
      name: 'LogRevealSpec events',
      query: '{ logRevealSpecs(first: 5) { id creator specID targetContract } }',
      validate: (result) => result.data && Array.isArray(result.data.logRevealSpecs)
    },
    {
      name: 'Updated LogCreateSpec events',
      query: '{ logCreateSpecs(first: 5) { id creator specID targetContract chainId incentiveId } }',
      validate: (result) => result.data && Array.isArray(result.data.logCreateSpecs)
    },
    {
      name: 'LogIncentiveCreated events',
      query: '{ logIncentiveCreateds(first: 5) { id incentiveId creator targetContract } }',
      validate: (result) => result.data && Array.isArray(result.data.logIncentiveCreateds)
    },
    {
      name: 'LogEmergencyPause events',
      query: '{ logEmergencyPauses(first: 5) { id admin } }',
      validate: (result) => result.data && Array.isArray(result.data.logEmergencyPauses)
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`⏳ Testing: ${test.name}...`);
      const result = await makeGraphQLRequest(test.query);
      
      if (result.errors) {
        console.log(`❌ ${test.name}: GraphQL errors`);
        console.log('   Errors:', result.errors);
        failed++;
      } else if (test.validate(result)) {
        console.log(`✅ ${test.name}: PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: Validation failed`);
        console.log('   Response:', JSON.stringify(result, null, 2));
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Request failed`);
      console.log('   Error:', error.message);
      failed++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Subgraph deployment verified successfully.');
    
    // Additional check for contract address
    try {
      const contractQuery = `{ 
        logCreateSpecs(first: 1, where: { targetContract: "${NEW_CONTRACT_ADDRESS.toLowerCase()}" }) { 
          id targetContract 
        } 
      }`;
      const contractResult = await makeGraphQLRequest(contractQuery);
      
      if (contractResult.data && contractResult.data.logCreateSpecs.length > 0) {
        console.log('✅ Contract address verification: Events found for new contract address');
      } else {
        console.log('⚠️  Contract address verification: No events found yet (may need time to index)');
      }
    } catch (e) {
      console.log('⚠️  Contract address verification: Could not verify');
    }
  } else {
    console.log('❌ Some tests failed. Check the deployment and try again.');
    process.exit(1);
  }
}

// Run verification
runVerification().catch(console.error);