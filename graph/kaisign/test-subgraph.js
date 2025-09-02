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
  cyan: "\x1b[36m"
};

// Test queries
const queries = {
  // 1. Get all specs
  getAllSpecs: {
    name: "Get All Specs (Latest 5)",
    query: `{
      specs(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        ipfs
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
    }`
  },

  // 2. Get specs by status
  getProposedSpecs: {
    name: "Get PROPOSED Specs",
    query: `{
      specs(where: {status: "PROPOSED"}) {
        id
        user
        ipfs
        targetContract
        status
        proposedTimestamp
        questionId
      }
    }`
  },

  getSubmittedSpecs: {
    name: "Get SUBMITTED Specs",
    query: `{
      specs(where: {status: "SUBMITTED"}, first: 3) {
        id
        user
        ipfs
        targetContract
        status
        blockTimestamp
      }
    }`
  },

  getFinalizedSpecs: {
    name: "Get FINALIZED Specs",
    query: `{
      specs(where: {status: "FINALIZED"}) {
        id
        user
        ipfs
        targetContract
        status
        isAccepted
      }
    }`
  },

  // 3. Get specs for specific contract
  getSpecsByContract: {
    name: "Get Specs for KaiSign Contract",
    query: `{
      specs(where: {targetContract: "0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719"}) {
        id
        ipfs
        status
        blockTimestamp
        user
      }
    }`
  },

  // 4. Get incentives
  getIncentiveCreated: {
    name: "Get Created Incentives",
    query: `{
      logIncentiveCreateds(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
        id
        incentiveId
        creator
        targetContract
        chainId
        amount
        deadline
        description
        blockTimestamp
      }
    }`
  },

  getIncentiveClaimed: {
    name: "Get Claimed Incentives",
    query: `{
      logIncentiveClaimeds(first: 5) {
        id
        incentiveId
        claimer
        specID
        amount
        blockTimestamp
      }
    }`
  },

  // 5. Get commit-reveal data
  getCommitments: {
    name: "Get Spec Commitments",
    query: `{
      logCommitSpecs(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
        id
        committer
        commitmentId
        targetContract
        chainId
        bondAmount
        revealDeadline
        blockTimestamp
      }
    }`
  },

  getReveals: {
    name: "Get Spec Reveals",
    query: `{
      logRevealSpecs(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
        id
        creator
        specID
        commitmentId
        blobHash
        targetContract
        chainId
        blockTimestamp
      }
    }`
  },

  // 6. Get contract specs
  getContractSpecs: {
    name: "Get Contract Spec Added Events",
    query: `{
      logContractSpecAddeds(first: 5) {
        id
        targetContract
        specID
        creator
        chainId
        blobHash
        blockTimestamp
      }
    }`
  },

  // 7. Get proposals
  getProposals: {
    name: "Get Spec Proposals",
    query: `{
      logProposeSpecs(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
        id
        user
        specID
        questionId
        bond
        blockTimestamp
      }
    }`
  },

  // 8. Get handle results
  getHandleResults: {
    name: "Get Handle Results",
    query: `{
      logHandleResults(first: 5) {
        id
        specID
        isAccepted
        blockTimestamp
      }
    }`
  },

  // 9. Get contracts
  getContracts: {
    name: "Get Registered Contracts",
    query: `{
      contracts(first: 5) {
        id
        address
        chainID
        name
        version
        description
        hasApprovedMetadata
        latestApprovedSpecID
        latestSpecTimestamp
        functionCount
        createdAt
        updatedAt
      }
    }`
  },

  // 10. Get functions
  getFunctions: {
    name: "Get Contract Functions",
    query: `{
      functions(first: 10) {
        id
        selector
        chainID
        name
        intent
        displayFormat
        parameterTypes
        createdAt
      }
    }`
  },

  // 11. Complex query - specs with incentives
  getSpecsWithIncentives: {
    name: "Get Specs with Associated Incentives",
    query: `{
      specs(where: {incentiveId_not: null}, first: 5) {
        id
        targetContract
        user
        ipfs
        status
        incentiveId
        blockTimestamp
      }
    }`
  },

  // 12. Get emergency pause/unpause events
  getEmergencyEvents: {
    name: "Get Emergency Pause/Unpause Events",
    query: `{
      logEmergencyPauses(first: 5) {
        id
        admin
        blockTimestamp
      }
      logEmergencyUnpauses(first: 5) {
        id
        admin
        blockTimestamp
      }
    }`
  }
};

// Execute query function
async function executeQuery(name, query) {
  try {
    console.log(`\n${colors.cyan}Testing: ${name}${colors.reset}`);
    console.log(`${colors.bright}Query:${colors.reset}`);
    console.log(query.replace(/\s+/g, ' ').substring(0, 150) + '...');
    
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    
    if (data.errors) {
      console.log(`${colors.red}✗ Error:${colors.reset}`, data.errors[0].message);
      return { success: false, error: data.errors[0].message };
    }

    // Count results
    const resultKeys = Object.keys(data.data);
    let totalResults = 0;
    resultKeys.forEach(key => {
      if (Array.isArray(data.data[key])) {
        totalResults += data.data[key].length;
      }
    });

    console.log(`${colors.green}✓ Success:${colors.reset} Found ${totalResults} results`);
    
    // Show sample data if available
    if (totalResults > 0) {
      console.log(`${colors.yellow}Sample data:${colors.reset}`);
      const firstKey = resultKeys[0];
      const firstItem = Array.isArray(data.data[firstKey]) ? data.data[firstKey][0] : data.data[firstKey];
      if (firstItem) {
        console.log(JSON.stringify(firstItem, null, 2).substring(0, 300) + '...');
      }
    }
    
    return { success: true, data: data.data, count: totalResults };
  } catch (error) {
    console.log(`${colors.red}✗ Failed:${colors.reset}`, error.message);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════╗
║    KaiSign Subgraph Query Test Suite       ║
╚════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`\n${colors.bright}Endpoint:${colors.reset} ${SUBGRAPH_URL}`);
  console.log(`${colors.bright}Time:${colors.reset} ${new Date().toISOString()}`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Run all tests
  for (const [key, test] of Object.entries(queries)) {
    results.total++;
    const result = await executeQuery(test.name, test.query);
    
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
      results.errors.push({ name: test.name, error: result.error });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log(`\n${colors.bright}${colors.blue}
╔════════════════════════════════════════════╗
║              TEST SUMMARY                  ║
╚════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`${colors.bright}Total Tests:${colors.reset} ${results.total}`);
  console.log(`${colors.green}Passed:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
  console.log(`${colors.bright}Success Rate:${colors.reset} ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results.errors.forEach(err => {
      console.log(`  ${colors.red}✗${colors.reset} ${err.name}: ${err.error}`);
    });
  }

  // Test specific contract queries
  console.log(`\n${colors.bright}${colors.yellow}Testing KaiSign Contract Specific Queries...${colors.reset}`);
  
  const kaisignAddress = "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719";
  const contractQuery = `{
    specs(where: {targetContract: "${kaisignAddress.toLowerCase()}"}) {
      id
      status
    }
    logIncentiveCreateds(where: {targetContract: "${kaisignAddress.toLowerCase()}"}) {
      id
      amount
    }
  }`;
  
  await executeQuery("KaiSign Contract Combined Query", contractQuery);
}

// Run the tests
runTests().then(() => {
  console.log(`\n${colors.bright}Test suite completed!${colors.reset}\n`);
  process.exit(0);
}).catch(error => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});