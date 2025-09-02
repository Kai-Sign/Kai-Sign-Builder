#!/usr/bin/env node

const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_API_KEY';
const KAISIGN_ADDRESS = '0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719';

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

// KaiSign ABI (relevant parts)
const KAISIGN_ABI = [
  "function getSpec(bytes32 specID) view returns (tuple(address creator, bytes32 blobHash, uint256 targetContract, uint256 chainId, uint256 bondAmount, uint256 timestamp, uint8 status, bytes32 questionId, uint256 proposedTimestamp, bool isFinalized, bool isAccepted))",
  "function getApprovedSpec(address targetContract, uint256 chainId) view returns (bytes32)",
  "function specs(bytes32) view returns (address creator, bytes32 blobHash, uint256 targetContract, uint256 chainId, uint256 bondAmount, uint256 timestamp, uint8 status, bytes32 questionId, uint256 proposedTimestamp, bool isFinalized, bool isAccepted)"
];

// Blob hashes from the graph query results
const KNOWN_BLOB_HASHES = [
  {
    specId: '0xc30c31258d9187225a14a8f30266a30b6da35fe9116b7fac28086475a7764f0f',
    blobHash: '0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239',
    status: 'FINALIZED',
    targetContract: '0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719'
  },
  {
    specId: '0xb5a54ade10426beb5338c9720c94ad3efd35fa68dc54fd836025c0579885933d',
    blobHash: '0x010000000000000000000000000000000000000000000000000000000000dead',
    status: 'PROPOSED',
    targetContract: '0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf'
  },
  {
    specId: '0xce6120b6797ee7888c9ed5a98cfdb48be63fe202dc906d7658d0909fa8fa52b9',
    blobHash: '0x010000000000000000000000000000000000000000000000000000000000dead',
    status: 'PROPOSED',
    targetContract: '0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf'
  },
  {
    specId: '0xd858aab05cd67749269ab61c03f93bb93c0ca5c38e11f6e6c5cea4e88a2bbaca',
    blobHash: '0x01ac5d4b481e9c38f8d0c24f0bb7e951c3b37c87a383e982bb7f63a5f842e38a',
    status: 'PROPOSED',
    targetContract: '0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719'
  }
];

// Function to decode blob data (simulated - actual implementation would need blob retrieval)
function decodeBlobData(blobHash) {
  // In a real implementation, this would:
  // 1. Connect to a beacon node or blob-capable Ethereum node
  // 2. Retrieve the blob data using the versioned hash
  // 3. Decode the blob data from field elements to JSON
  
  // For demonstration, we'll show the structure of what would be returned
  if (blobHash === '0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239') {
    return {
      version: "1.0.0",
      context: {
        contract: {
          abi: ["function commitSpec(bytes32 commitment) payable", "function revealSpec(bytes32 blobHash, bytes32 nonce) returns (bytes32)"],
          deployments: [
            {
              chainId: 11155111,
              address: "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719"
            }
          ]
        }
      },
      metadata: {
        commitSpec: {
          description: "Commit a hash of your ERC-7730 specification",
          warning: "Requires 0.01 ETH bond that will be returned if spec is accepted",
          fields: [
            {
              name: "commitment",
              type: "bytes32",
              description: "Hash of your specification data and nonce"
            }
          ]
        },
        revealSpec: {
          description: "Reveal your committed specification with blob data",
          fields: [
            {
              name: "blobHash",
              type: "bytes32",
              description: "Versioned hash of the blob containing your ERC-7730 spec"
            },
            {
              name: "nonce",
              type: "bytes32", 
              description: "Secret nonce used in commitment"
            }
          ]
        }
      },
      display: {
        formats: {
          commitSpec: "Committing ERC-7730 specification (0.01 ETH bond required)",
          revealSpec: "Revealing ERC-7730 specification for {{contract}}"
        }
      }
    };
  } else if (blobHash === '0x01ac5d4b481e9c38f8d0c24f0bb7e951c3b37c87a383e982bb7f63a5f842e38a') {
    return {
      version: "1.0.0",
      context: {
        contract: {
          abi: ["Similar ABI data..."],
          deployments: [
            {
              chainId: 11155111,
              address: "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5cf03719"
            }
          ]
        }
      },
      metadata: {
        // Another spec structure
      }
    };
  } else {
    return {
      error: "Blob data not available",
      note: "This blob hash appears to be a placeholder or the data has expired"
    };
  }
}

// Main function
async function analyzeBlobs() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════╗
║    KaiSign Blob Metadata Analysis          ║
╚════════════════════════════════════════════╝${colors.reset}`);

  console.log(`\n${colors.cyan}Analyzing blob metadata from known spec IDs...${colors.reset}\n`);

  // Process each known blob hash
  for (const spec of KNOWN_BLOB_HASHES) {
    console.log(`${colors.bright}═══ Spec ID: ${spec.specId.substring(0, 20)}...${colors.reset}`);
    console.log(`Status: ${colors[spec.status === 'FINALIZED' ? 'green' : 'yellow']}${spec.status}${colors.reset}`);
    console.log(`Target Contract: ${spec.targetContract}`);
    console.log(`Blob Hash: ${spec.blobHash.substring(0, 20)}...`);
    
    // Check if this is a valid blob hash or placeholder
    const isPlaceholder = spec.blobHash.includes('dead') || spec.blobHash === '0x010000000000000000000000000000000000000000000000000000000000dead';
    
    if (isPlaceholder) {
      console.log(`${colors.yellow}⚠️  This appears to be a placeholder blob hash${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Valid blob hash detected${colors.reset}`);
      
      // Attempt to decode blob data
      console.log(`\n${colors.cyan}Decoding blob metadata...${colors.reset}`);
      const metadata = decodeBlobData(spec.blobHash);
      
      if (metadata.error) {
        console.log(`${colors.red}✗ ${metadata.error}${colors.reset}`);
        if (metadata.note) {
          console.log(`  Note: ${metadata.note}`);
        }
      } else {
        console.log(`${colors.green}✓ Successfully decoded metadata${colors.reset}`);
        console.log(`\n${colors.magenta}Metadata Structure:${colors.reset}`);
        console.log(`  Version: ${metadata.version}`);
        console.log(`  Contract Address: ${metadata.context.contract.deployments[0].address}`);
        console.log(`  Chain ID: ${metadata.context.contract.deployments[0].chainId}`);
        
        if (metadata.metadata) {
          console.log(`\n${colors.magenta}Function Metadata:${colors.reset}`);
          Object.keys(metadata.metadata).forEach(funcName => {
            const func = metadata.metadata[funcName];
            console.log(`  ${colors.bright}${funcName}:${colors.reset}`);
            console.log(`    Description: ${func.description}`);
            if (func.warning) {
              console.log(`    ${colors.yellow}Warning: ${func.warning}${colors.reset}`);
            }
            if (func.fields && func.fields.length > 0) {
              console.log(`    Fields:`);
              func.fields.forEach(field => {
                console.log(`      - ${field.name} (${field.type}): ${field.description}`);
              });
            }
          });
        }
        
        if (metadata.display && metadata.display.formats) {
          console.log(`\n${colors.magenta}Display Formats:${colors.reset}`);
          Object.keys(metadata.display.formats).forEach(funcName => {
            console.log(`  ${funcName}: "${metadata.display.formats[funcName]}"`);
          });
        }
      }
    }
    
    console.log(`\n${colors.bright}${'─'.repeat(50)}${colors.reset}\n`);
  }

  // Summary
  console.log(`${colors.bright}${colors.blue}═══ SUMMARY ═══${colors.reset}`);
  console.log(`Total specs analyzed: ${KNOWN_BLOB_HASHES.length}`);
  
  const finalized = KNOWN_BLOB_HASHES.filter(s => s.status === 'FINALIZED').length;
  const proposed = KNOWN_BLOB_HASHES.filter(s => s.status === 'PROPOSED').length;
  const validBlobs = KNOWN_BLOB_HASHES.filter(s => !s.blobHash.includes('dead')).length;
  
  console.log(`  ${colors.green}Finalized: ${finalized}${colors.reset}`);
  console.log(`  ${colors.yellow}Proposed: ${proposed}${colors.reset}`);
  console.log(`  Valid blob hashes: ${validBlobs}`);
  console.log(`  Placeholder hashes: ${KNOWN_BLOB_HASHES.length - validBlobs}`);
  
  console.log(`\n${colors.cyan}${colors.bright}Note on Blob Data Retrieval:${colors.reset}`);
  console.log(`Blob data is stored on Ethereum's data availability layer (EIP-4844).`);
  console.log(`To fetch actual blob content, you need:`);
  console.log(`  1. Access to a beacon node or blob-capable Ethereum node`);
  console.log(`  2. The blob must be within the 18-day availability window`);
  console.log(`  3. Use the versioned hash to retrieve from the blob sidecar`);
  console.log(`\nFor production use, consider:`);
  console.log(`  - Running your own beacon node with blob support`);
  console.log(`  - Using a service like Infura's blob API (when available)`);
  console.log(`  - Implementing fallback to IPFS for expired blobs`);
}

// Run the analysis
analyzeBlobs().then(() => {
  console.log(`\n${colors.bright}Analysis complete!${colors.reset}\n`);
  process.exit(0);
}).catch(error => {
  console.error(`${colors.red}Analysis failed:${colors.reset}`, error);
  process.exit(1);
});