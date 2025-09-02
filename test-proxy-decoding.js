/**
 * Test if EigenDA proxy actually decodes to plaintext
 * This is the critical test to determine if Succinct is necessary
 */

const PROXY_URL = 'http://localhost:3100';

async function testProxyDecoding() {
  console.log('🧪 Testing EigenDA Proxy Decoding Capability\n');
  console.log('=' .repeat(50));
  
  // Test data with various formats
  const testCases = [
    {
      name: 'Simple JSON',
      data: { message: 'Hello EigenDA' },
      type: 'application/json'
    },
    {
      name: 'Complex ERC7730',
      data: {
        type: 'ERC7730',
        version: '1.0.0',
        contract: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
        nested: {
          arrays: [1, 2, 3],
          unicode: 'Hello 世界 🌍',
          special: 'Characters: ", \', \\, \n, \t'
        }
      },
      type: 'application/json'
    },
    {
      name: 'Plain Text',
      data: 'This is plain text, not JSON',
      type: 'text/plain'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      // Prepare data
      const dataToSend = typeof testCase.data === 'string' 
        ? testCase.data 
        : JSON.stringify(testCase.data);
      
      console.log('Input data:', dataToSend);
      console.log('Data size:', dataToSend.length, 'bytes');
      
      // Step 1: Post to proxy
      console.log('\n1️⃣ Posting to proxy...');
      const postResponse = await fetch(
        `${PROXY_URL}/put`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: dataToSend
        }
      );
      
      // Convert certificate to hex
      const certificateBuffer = await postResponse.arrayBuffer();
      const certificate = Buffer.from(certificateBuffer).toString('hex');
      console.log('✅ Posted successfully');
      console.log('Certificate (first 64 chars):', certificate.substring(0, 64) + '...');
      
      // Step 2: Retrieve from proxy
      console.log('\n2️⃣ Retrieving from proxy...');
      const getResponse = await fetch(
        `${PROXY_URL}/get/${certificate}`
      );
      
      const retrievedData = await getResponse.text();
      console.log('✅ Retrieved successfully');
      console.log('Retrieved data:', retrievedData);
      console.log('Retrieved size:', retrievedData.length, 'bytes');
      
      // Step 3: Analyze the result
      console.log('\n3️⃣ Analysis:');
      
      // Check if it matches original
      const matches = retrievedData === dataToSend;
      console.log(`Exact match: ${matches ? '✅ YES' : '❌ NO'}`);
      
      // Check if it's valid JSON (for JSON test cases)
      if (testCase.type === 'application/json') {
        try {
          const parsed = JSON.parse(retrievedData);
          console.log('Valid JSON: ✅ YES');
          console.log('Parsed successfully:', JSON.stringify(parsed, null, 2));
          
          // Deep equality check
          const originalParsed = JSON.parse(dataToSend);
          const deepEqual = JSON.stringify(originalParsed) === JSON.stringify(parsed);
          console.log(`Deep equality: ${deepEqual ? '✅ YES' : '❌ NO'}`);
        } catch (e) {
          console.log('Valid JSON: ❌ NO');
          console.log('Parse error:', e.message);
          console.log('Looks like encoded data!');
        }
      }
      
      // Check if it looks encoded
      const looksEncoded = /^[A-Za-z0-9+/]+=*$/.test(retrievedData) || 
                          retrievedData.startsWith('0x') ||
                          /^[0-9a-fA-F]+$/.test(retrievedData);
      
      if (looksEncoded) {
        console.log('⚠️ WARNING: Data appears to be encoded!');
        console.log('This means hardware wallets CANNOT read it directly!');
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
    }
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(50));
  console.log('🎯 FINAL VERDICT:\n');
  console.log('If the proxy returns decoded plaintext:');
  console.log('  ✅ Hardware wallets can read it directly');
  console.log('  ✅ No need for Succinct (unless you want proof)');
  console.log('');
  console.log('If the proxy returns encoded data:');
  console.log('  ❌ Hardware wallets CANNOT read it');
  console.log('  ❌ You NEED Succinct or another decoder');
  console.log('  ❌ Current architecture won\'t work for hardware wallets');
}

// Run the test
console.log('🚀 Starting EigenDA Proxy Decoding Test');
console.log('Make sure the proxy is running at', PROXY_URL);
console.log('');

testProxyDecoding().catch(console.error);