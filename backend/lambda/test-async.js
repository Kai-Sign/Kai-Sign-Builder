// Test script for async blob submission
const https = require('https');

// Configuration - update these values after deployment
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://your-api.execute-api.region.amazonaws.com/prod';
const TEST_DATA = {
  data: {
    message: "Test blob submission",
    timestamp: new Date().toISOString(),
    random: Math.random().toString(36).substring(7)
  }
};

// Submit blob and get job ID
async function submitBlob(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_ENDPOINT}/blob/submit`);
    const body = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Check job status
async function checkStatus(jobId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_ENDPOINT}/blob/status?jobId=${jobId}`);
    
    https.get(url, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    }).on('error', reject);
  });
}

// Main test function
async function runTest() {
  console.log('🧪 Testing async blob submission...\n');
  
  try {
    // Submit blob
    console.log('📤 Submitting blob...');
    console.log('Data:', JSON.stringify(TEST_DATA, null, 2));
    
    const submitResult = await submitBlob(TEST_DATA);
    console.log('\n✅ Submission response:', JSON.stringify(submitResult, null, 2));
    
    if (!submitResult.jobId) {
      throw new Error('No job ID returned');
    }
    
    const jobId = submitResult.jobId;
    console.log(`\n📋 Job ID: ${jobId}`);
    
    // Poll for status
    console.log('\n⏳ Checking status...');
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const status = await checkStatus(jobId);
      console.log(`\nAttempt ${attempts + 1}: ${status.status}`);
      
      if (status.status === 'completed') {
        console.log('\n🎉 SUCCESS! Blob submitted successfully');
        console.log('Transaction Hash:', status.transactionHash);
        console.log('Blob Hash:', status.blobHash);
        console.log('Etherscan URL:', status.etherscanUrl);
        break;
      } else if (status.status === 'failed') {
        console.log('\n❌ FAILED:', status.error);
        break;
      } else {
        console.log('Status:', JSON.stringify(status, null, 2));
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⚠️ Timeout: Job did not complete within 5 minutes');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  if (!API_ENDPOINT || API_ENDPOINT.includes('your-api')) {
    console.error('❌ Please set API_ENDPOINT environment variable');
    console.error('Example: export API_ENDPOINT=https://your-api.execute-api.region.amazonaws.com/prod');
    process.exit(1);
  }
  
  runTest().catch(console.error);
}