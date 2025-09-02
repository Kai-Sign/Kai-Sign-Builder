/**
 * Example: Using EigenDA V2 with direct gRPC commands
 * Shows both proxy usage and direct grpcurl commands
 */

import React from 'react';
import { eigenDAService } from './frontend/src/lib/eigenDAService';

// Generate grpcurl commands for direct EigenDA interaction
function generateGrpcCommands(data: any) {
  // Encode data for EigenDA (simple base64 for example)
  const jsonString = JSON.stringify(data);
  const base64Data = Buffer.from(jsonString).toString('base64');
  
  return {
    // Post blob to EigenDA
    disperse: `echo '{"data":"${base64Data}"}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/DisperseBlob`,
    
    // Check status (use request_id from disperse response)
    getStatus: (requestId: string) => 
      `echo '{"request_id":"${requestId}"}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/GetBlobStatus`,
    
    // Retrieve blob (use batch_header_hash and blob_index from status)
    retrieve: (batchHeaderHash: string, blobIndex: number) =>
      `echo '{"batch_header_hash":"${batchHeaderHash}","blob_index":${blobIndex}}' | grpcurl -d @ disperser-holesky.eigenda.xyz:443 disperser.Disperser/RetrieveBlob`
  };
}

// Use EigenDA via proxy (easy mode)
async function postViaProxy(jsonData: any) {
  // Just send the data - relayer handles everything!
  const result = await eigenDAService.postERC7730(jsonData);
  
  if (result.success) {
    return result.blobHash; // Can be stored in contract same as EIP-4844 hash
  }
  
  throw new Error(result.error || 'Failed to post to EigenDA');
}

// Example React component with grpcurl command generation
export function BlobPoster() {
  const [grpcCommands, setGrpcCommands] = React.useState<any>(null);
  const [requestId, setRequestId] = React.useState<string>('');
  
  const handlePostBlob = async () => {
    const erc7730Data = {
      type: "ERC7730",
      version: "1.0.0",
      contract: "0x1234567890123456789012345678901234567890",
      chainId: 11155111,
      timestamp: Date.now(),
      spec: {
        name: "Test Contract",
        functions: []
      }
    };

    try {
      // Generate grpcurl commands
      const commands = generateGrpcCommands(erc7730Data);
      setGrpcCommands(commands);
      
      console.log('📋 Generated grpcurl commands:');
      console.log('1. Post blob:', commands.disperse);
      console.log('2. Check status:', commands.getStatus('YOUR_REQUEST_ID'));
      console.log('3. Retrieve:', commands.retrieve('BATCH_HEADER_HASH', 0));
      
      // Option 1: Post via proxy (easy)
      const blobHash = await postViaProxy(erc7730Data);
      console.log('✅ Posted via proxy:', blobHash);
      
      // Option 2: Direct grpcurl (copy commands to terminal)
      // The commands are displayed for manual execution
      
    } catch (error) {
      console.error('Failed:', error);
    }
  };
  
  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    alert('Command copied to clipboard!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>EigenDA Blob Poster</h2>
      
      <button onClick={handlePostBlob}>
        Generate gRPC Commands & Post Blob
      </button>
      
      {grpcCommands && (
        <div style={{ marginTop: '20px', background: '#f0f0f0', padding: '15px', borderRadius: '5px' }}>
          <h3>Generated grpcurl Commands:</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <strong>1. Post Blob:</strong>
            <pre style={{ background: '#000', color: '#0f0', padding: '10px', overflow: 'auto' }}>
              {grpcCommands.disperse}
            </pre>
            <button onClick={() => handleCopyCommand(grpcCommands.disperse)}>
              Copy Command
            </button>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <strong>2. Check Status (after getting request_id):</strong>
            <input 
              type="text" 
              placeholder="Enter request_id from step 1"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              style={{ width: '100%', padding: '5px', marginBottom: '5px' }}
            />
            {requestId && (
              <>
                <pre style={{ background: '#000', color: '#0f0', padding: '10px', overflow: 'auto' }}>
                  {grpcCommands.getStatus(requestId)}
                </pre>
                <button onClick={() => handleCopyCommand(grpcCommands.getStatus(requestId))}>
                  Copy Command
                </button>
              </>
            )}
          </div>
          
          <div>
            <strong>3. Retrieve Blob (get batch_header_hash and blob_index from status):</strong>
            <p>Use the batch_header_hash and blob_index from step 2</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Key Benefits of EigenDA V2:
 * 
 * 1. ✅ No manual encoding/decoding - relayer handles it
 * 2. ✅ Larger data size (1MB+ vs 128KB)
 * 3. ✅ Much cheaper than L1 blobs
 * 4. ✅ Same interface - blob hash stored in contract
 * 5. ✅ Automatic compression and optimization
 * 6. ✅ Built-in redundancy and availability guarantees
 */

// Comparison table
const comparison = {
  "EIP-4844": {
    maxSize: "128KB",
    encoding: "Manual KZG commitment",
    cost: "L1 gas fees",
    complexity: "High - need blob transactions",
    availability: "2 weeks on L1"
  },
  "EigenDA V2": {
    maxSize: "1MB+",
    encoding: "Automatic by relayer",
    cost: "Much cheaper",
    complexity: "Low - just HTTP POST",
    availability: "Configurable (months)"
  }
};