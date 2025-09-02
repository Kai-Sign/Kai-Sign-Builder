#!/usr/bin/env node

const SUBGRAPH_URL = "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.8";

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

// Function to fetch blob data from Ethereum (simulated for now)
async function fetchBlobData(blobHash) {
  // This would normally fetch from an Ethereum node with blob support
  // For now, we'll return simulated data structure
  return {
    hash: blobHash,
    data: "Blob data would be fetched from Ethereum node",
    note: "Requires access to Ethereum node with blob support (post-EIP-4844)"
  };
}

// Execute query
async function executeQuery(query) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return data.data;
  } catch (error) {
    console.error(`${colors.red}Query failed:${colors.reset}`, error.message);
    throw error;
  }
}

// Main function to fetch and analyze metadata
async function fetchAndAnalyzeMetadata() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════╗
║    KaiSign Metadata Analysis               ║
╚════════════════════════════════════════════╝${colors.reset}`);

  // 1. Get all specs with their statuses and blob hashes
  console.log(`\n${colors.cyan}Fetching all specs with blobHash information...${colors.reset}`);
  
  const specsQuery = `{
    specs(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
      id
      user
      targetContract
      chainID
      blockTimestamp
      status
      questionId
      proposedTimestamp
      isFinalized
      isAccepted
      eventTimestamp
      incentiveId
    }
    logRevealSpecs(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
      id
      creator
      specID
      commitmentId
      blobHash
      targetContract
      chainId
      blockTimestamp
    }
    logContractSpecAddeds(first: 20) {
      id
      targetContract
      specID
      creator
      chainId
      blobHash
      blockTimestamp
    }
  }`;

  try {
    const data = await executeQuery(specsQuery);
    
    // Process specs by status
    const specsByStatus = {
      SUBMITTED: [],
      PROPOSED: [],
      FINALIZED: [],
      REJECTED: []
    };

    // Map blob hashes to spec IDs
    const blobHashMap = new Map();
    
    // Process reveal specs to get blob hashes
    data.logRevealSpecs.forEach(reveal => {
      blobHashMap.set(reveal.specID, {
        blobHash: reveal.blobHash,
        creator: reveal.creator,
        targetContract: reveal.targetContract,
        timestamp: reveal.blockTimestamp
      });
    });

    // Also check contract spec added events for blob hashes
    data.logContractSpecAddeds.forEach(added => {
      if (!blobHashMap.has(added.specID)) {
        blobHashMap.set(added.specID, {
          blobHash: added.blobHash,
          creator: added.creator,
          targetContract: added.targetContract,
          timestamp: added.blockTimestamp
        });
      }
    });

    // Categorize specs
    data.specs.forEach(spec => {
      const specData = {
        ...spec,
        blobInfo: blobHashMap.get(spec.id) || null
      };
      
      if (spec.status in specsByStatus) {
        specsByStatus[spec.status].push(specData);
      }
    });

    // Display results
    console.log(`\n${colors.bright}${colors.green}═══ METADATA STATUS SUMMARY ═══${colors.reset}\n`);

    // FINALIZED Specs
    console.log(`${colors.green}${colors.bright}FINALIZED SPECS (${specsByStatus.FINALIZED.length})${colors.reset}`);
    if (specsByStatus.FINALIZED.length > 0) {
      specsByStatus.FINALIZED.forEach(spec => {
        console.log(`${colors.green}  ✓${colors.reset} Spec ID: ${spec.id.substring(0, 20)}...`);
        console.log(`    Target: ${spec.targetContract}`);
        console.log(`    User: ${spec.user}`);
        console.log(`    Chain: ${spec.chainID}`);
        console.log(`    Accepted: ${spec.isAccepted ? 'Yes' : 'No'}`);
        if (spec.blobInfo) {
          console.log(`    ${colors.magenta}Blob Hash: ${spec.blobInfo.blobHash.substring(0, 20)}...${colors.reset}`);
        }
        console.log();
      });
    } else {
      console.log(`  ${colors.yellow}No finalized specs found${colors.reset}\n`);
    }

    // PROPOSED Specs
    console.log(`${colors.yellow}${colors.bright}PROPOSED SPECS (${specsByStatus.PROPOSED.length})${colors.reset}`);
    if (specsByStatus.PROPOSED.length > 0) {
      specsByStatus.PROPOSED.forEach(spec => {
        console.log(`${colors.yellow}  ⏳${colors.reset} Spec ID: ${spec.id.substring(0, 20)}...`);
        console.log(`    Target: ${spec.targetContract}`);
        console.log(`    User: ${spec.user}`);
        console.log(`    Question ID: ${spec.questionId ? spec.questionId.substring(0, 20) + '...' : 'N/A'}`);
        console.log(`    Proposed at: ${new Date(parseInt(spec.proposedTimestamp) * 1000).toISOString()}`);
        if (spec.blobInfo) {
          console.log(`    ${colors.magenta}Blob Hash: ${spec.blobInfo.blobHash.substring(0, 20)}...${colors.reset}`);
        }
        console.log();
      });
    } else {
      console.log(`  ${colors.yellow}No proposed specs found${colors.reset}\n`);
    }

    // SUBMITTED Specs
    console.log(`${colors.blue}${colors.bright}SUBMITTED SPECS (${specsByStatus.SUBMITTED.length})${colors.reset}`);
    if (specsByStatus.SUBMITTED.length > 0) {
      specsByStatus.SUBMITTED.forEach(spec => {
        console.log(`${colors.blue}  📝${colors.reset} Spec ID: ${spec.id.substring(0, 20)}...`);
        console.log(`    Target: ${spec.targetContract}`);
        console.log(`    User: ${spec.user}`);
        console.log(`    Timestamp: ${new Date(parseInt(spec.blockTimestamp) * 1000).toISOString()}`);
        if (spec.blobInfo) {
          console.log(`    ${colors.magenta}Blob Hash: ${spec.blobInfo.blobHash.substring(0, 20)}...${colors.reset}`);
        }
        console.log();
      });
    } else {
      console.log(`  ${colors.yellow}No submitted specs found${colors.reset}\n`);
    }

    // REJECTED Specs
    console.log(`${colors.red}${colors.bright}REJECTED SPECS (${specsByStatus.REJECTED.length})${colors.reset}`);
    if (specsByStatus.REJECTED.length > 0) {
      specsByStatus.REJECTED.forEach(spec => {
        console.log(`${colors.red}  ✗${colors.reset} Spec ID: ${spec.id.substring(0, 20)}...`);
        console.log(`    Target: ${spec.targetContract}`);
        console.log(`    User: ${spec.user}`);
        if (spec.blobInfo) {
          console.log(`    ${colors.magenta}Blob Hash: ${spec.blobInfo.blobHash.substring(0, 20)}...${colors.reset}`);
        }
        console.log();
      });
    } else {
      console.log(`  ${colors.yellow}No rejected specs found${colors.reset}\n`);
    }

    // Attempt to fetch blob data for finalized specs
    console.log(`\n${colors.bright}${colors.cyan}═══ BLOB DATA FETCHING ═══${colors.reset}\n`);
    
    const finalizedWithBlobs = specsByStatus.FINALIZED.filter(spec => spec.blobInfo);
    if (finalizedWithBlobs.length > 0) {
      console.log(`Found ${finalizedWithBlobs.length} finalized spec(s) with blob hashes:\n`);
      
      for (const spec of finalizedWithBlobs) {
        console.log(`${colors.bright}Fetching blob for spec: ${spec.id.substring(0, 20)}...${colors.reset}`);
        console.log(`Blob Hash: ${spec.blobInfo.blobHash}`);
        
        try {
          const blobData = await fetchBlobData(spec.blobInfo.blobHash);
          console.log(`${colors.green}✓ Blob fetch info:${colors.reset}`);
          console.log(`  ${blobData.note}`);
          console.log(`  Hash: ${blobData.hash.substring(0, 40)}...`);
          console.log();
        } catch (error) {
          console.log(`${colors.red}✗ Failed to fetch blob: ${error.message}${colors.reset}\n`);
        }
      }
    } else {
      console.log(`${colors.yellow}No finalized specs with blob hashes found${colors.reset}`);
      console.log(`Note: Blob data requires an Ethereum node with EIP-4844 blob support\n`);
    }

    // Summary statistics
    console.log(`\n${colors.bright}${colors.blue}═══ STATISTICS ═══${colors.reset}`);
    console.log(`Total Specs: ${data.specs.length}`);
    console.log(`  ${colors.green}Finalized: ${specsByStatus.FINALIZED.length}${colors.reset}`);
    console.log(`  ${colors.yellow}Proposed: ${specsByStatus.PROPOSED.length}${colors.reset}`);
    console.log(`  ${colors.blue}Submitted: ${specsByStatus.SUBMITTED.length}${colors.reset}`);
    console.log(`  ${colors.red}Rejected: ${specsByStatus.REJECTED.length}${colors.reset}`);
    console.log(`\nSpecs with Blob Hashes: ${blobHashMap.size}`);
    
    // Most recent activity
    if (data.specs.length > 0) {
      const mostRecent = data.specs[0];
      console.log(`\n${colors.bright}Most Recent Activity:${colors.reset}`);
      console.log(`  Spec: ${mostRecent.id.substring(0, 20)}...`);
      console.log(`  Status: ${mostRecent.status}`);
      console.log(`  Time: ${new Date(parseInt(mostRecent.blockTimestamp) * 1000).toISOString()}`);
    }

  } catch (error) {
    console.error(`\n${colors.red}Failed to fetch metadata:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run the analysis
fetchAndAnalyzeMetadata().then(() => {
  console.log(`\n${colors.bright}Analysis complete!${colors.reset}\n`);
  process.exit(0);
}).catch(error => {
  console.error(`${colors.red}Analysis failed:${colors.reset}`, error);
  process.exit(1);
});