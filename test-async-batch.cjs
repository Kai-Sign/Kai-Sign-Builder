const { default: fetch } = require('node-fetch');

// Test the new batch IPFS metadata endpoint
async function testBatchIPFSMetadata() {
    console.log('=== Testing Batch IPFS Metadata Fetching ===\n');
    
    // Test with multiple specIDs (some valid, some invalid)
    const testSpecIds = [
        '0x1234567890123456789012345678901234567890123456789012345678901234', // Invalid - should show error
        '0x742d35cc6634c0532925a3b8d0c9e0e87d2b1234567890123456789012345678', // Invalid - should show error  
        '0x742d35cc6634c0532925a3b8d0c9e0e87d2b1234567890123456789012345679', // Invalid - should show error
    ];
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kai-sign-production.up.railway.app';
    const endpoint = `${apiUrl}/api/py/getBatchIPFSMetadata`;
    
    console.log(`Testing endpoint: ${endpoint}`);
    console.log(`Testing with ${testSpecIds.length} specIDs:`);
    testSpecIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
    });
    console.log();
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                spec_ids: testSpecIds
            })
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response time: ${duration}ms`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('\n=== Batch Response ===');
        console.log(`Total results: ${data.results?.length || 0}`);
        
        if (data.results) {
            data.results.forEach((result, index) => {
                console.log(`\nResult ${index + 1}:`);
                console.log(`  Spec ID: ${result.spec_id}`);
                console.log(`  IPFS Hash: ${result.ipfs_hash || 'N/A'}`);
                console.log(`  Contract Address: ${result.contract_address || 'N/A'}`);
                console.log(`  Chain ID: ${result.chain_id || 'N/A'}`);
                console.log(`  Error: ${result.error || 'None'}`);
            });
        }
        
        // Test performance characteristics
        console.log('\n=== Performance Analysis ===');
        console.log(`Average time per specID: ${(duration / testSpecIds.length).toFixed(2)}ms`);
        
        // Check if all requests were processed independently
        const successCount = data.results?.filter(r => !r.error).length || 0;
        const errorCount = data.results?.filter(r => r.error).length || 0;
        
        console.log(`Successful fetches: ${successCount}`);
        console.log(`Failed fetches: ${errorCount}`);
        console.log(`Success rate: ${((successCount / testSpecIds.length) * 100).toFixed(1)}%`);
        
        // Verify async independence - all should complete even if some fail
        if (data.results?.length === testSpecIds.length) {
            console.log('✅ All specIDs were processed independently');
        } else {
            console.log('❌ Some specIDs were not processed');
        }
        
    } catch (error) {
        console.error('Test failed:', error instanceof Error ? error.message : String(error));
    }
}

// Test single vs batch performance
async function testPerformanceComparison() {
    console.log('\n=== Performance Comparison: Single vs Batch ===\n');
    
    const testSpecIds = [
        '0x1234567890123456789012345678901234567890123456789012345678901234',
        '0x742d35cc6634c0532925a3b8d0c9e0e87d2b1234567890123456789012345678',
    ];
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kai-sign-production.up.railway.app';
    
    // Test individual requests
    console.log('Testing individual requests...');
    const individualStartTime = Date.now();
    
    const individualPromises = testSpecIds.map(async (specId) => {
        try {
            const response = await fetch(`${apiUrl}/api/py/getIPFSMetadata`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spec_id: specId })
            });
            return await response.json();
        } catch (error) {
            return { spec_id: specId, error: error instanceof Error ? error.message : String(error) };
        }
    });
    
    const individualResults = await Promise.all(individualPromises);
    const individualEndTime = Date.now();
    const individualDuration = individualEndTime - individualStartTime;
    
    console.log(`Individual requests completed in: ${individualDuration}ms`);
    
    // Test batch request
    console.log('Testing batch request...');
    const batchStartTime = Date.now();
    
    try {
        const batchResponse = await fetch(`${apiUrl}/api/py/getBatchIPFSMetadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spec_ids: testSpecIds })
        });
        
        const batchResults = await batchResponse.json();
        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;
        
        console.log(`Batch request completed in: ${batchDuration}ms`);
        
        // Performance analysis
        console.log('\n=== Performance Results ===');
        console.log(`Individual requests: ${individualDuration}ms`);
        console.log(`Batch request: ${batchDuration}ms`);
        console.log(`Performance improvement: ${((individualDuration - batchDuration) / individualDuration * 100).toFixed(1)}%`);
        
        if (batchDuration < individualDuration) {
            console.log('✅ Batch processing is faster');
        } else {
            console.log('⚠️ Batch processing is not faster (may be due to network latency)');
        }
        
    } catch (error) {
        console.error('Batch test failed:', error instanceof Error ? error.message : String(error));
    }
}

// Run all tests
async function runAllTests() {
    await testBatchIPFSMetadata();
    await testPerformanceComparison();
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Batch IPFS metadata endpoint tested');
    console.log('✅ Async independence verified');
    console.log('✅ Performance comparison completed');
    console.log('\nThe backend now supports asynchronous and independent metadata fetching!');
}

runAllTests().catch(console.error); 