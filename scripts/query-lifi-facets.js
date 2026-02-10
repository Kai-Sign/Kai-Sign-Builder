const { ethers } = require('ethers');

// LiFi Diamond address
const LIFI_DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';

// RPC endpoint (using public Ethereum RPC)
const RPC_URL = 'https://eth.llamarpc.com';

// DiamondLoupeFacet ABI for facets() function
const DIAMOND_LOUPE_ABI = [
  {
    "inputs": [],
    "name": "facets",
    "outputs": [
      {
        "components": [
          { "name": "facetAddress", "type": "address" },
          { "name": "functionSelectors", "type": "bytes4[]" }
        ],
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "_functionSelector", "type": "bytes4" }],
    "name": "facetAddress",
    "outputs": [{ "name": "facetAddress_", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function queryFacets() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const diamond = new ethers.Contract(LIFI_DIAMOND, DIAMOND_LOUPE_ABI, provider);
  
  console.log('Querying LiFi Diamond facets at:', LIFI_DIAMOND);
  console.log('Using RPC:', RPC_URL);
  console.log('---');
  
  try {
    const facets = await diamond.facets();
    
    console.log(`Found ${facets.length} facets:\n`);
    
    const facetData = [];
    
    for (const facet of facets) {
      const facetAddress = facet.facetAddress;
      const selectors = facet.functionSelectors;
      
      console.log(`Facet: ${facetAddress}`);
      console.log(`  Selectors (${selectors.length}):`);
      
      const selectorList = [];
      for (const selector of selectors) {
        console.log(`    ${selector}`);
        selectorList.push(selector);
      }
      console.log('');
      
      facetData.push({
        address: facetAddress.toLowerCase(),
        selectors: selectorList
      });
    }
    
    // Output as JSON for processing
    console.log('\n=== JSON OUTPUT ===');
    console.log(JSON.stringify(facetData, null, 2));
    
    return facetData;
  } catch (error) {
    console.error('Error querying facets:', error.message);
    throw error;
  }
}

queryFacets().catch(console.error);
