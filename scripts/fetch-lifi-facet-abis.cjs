const { ethers } = require('ethers');
const fs = require('fs');

// LiFi Diamond facet data (from previous query)
const FACETS = [
  { address: "0xf7993a8df974ad022647e63402d6315137c58abf", selectors: ["0x1f931c1c"] },
  { address: "0xf5ba8db6fea7af820de35c8d0c294e17dbc1b9d2", selectors: ["0xcdffacc6", "0x52ef6b2c", "0xadfca15e", "0x7a0ed627", "0x01ffc9a7"] },
  { address: "0x6faa6906b9e4a59020e673910105567e809789e0", selectors: ["0x23452b9c", "0x7200b829", "0x8da5cb5b", "0xf2fde38b"] },
  { address: "0xdc49bca8314e7cd7c90edb8652375a0b15efe611", selectors: ["0x82a3279b", "0x753cbab6", "0xe10c04c1"] },
  { address: "0x22b31a1a81d5e594315c866616db793e799556c5", selectors: ["0x536db266", "0xfbb2d381", "0xfcd8e49e", "0x9afc19c7", "0x44e2b18c", "0x2d2506a9", "0x124f1ead", "0xc3a6a96b"] },
  { address: "0x77a13abb679a0dafb4435d1fa4ccc95d1ab51cfc", selectors: ["0x612ad9cb", "0xa4c3366e"] },
  { address: "0x03f58dc7e2195a0c6f501bc4819066fd9dfe307f", selectors: ["0x3f313808", "0xa8f66666"] },
  { address: "0x108b0c3f20f266469fd2e98750926811ad632589", selectors: ["0x5df39dde", "0x9f5e58f5", "0xf2455b71", "0x4004633e", "0x2c7d2db0", "0x9eaeb24f"] },
  { address: "0xc4e5f14dfe359653d66ae49b1f12177e6f99102b", selectors: ["0xae0b91e5", "0x482c6a85", "0x0d19e519"] },
  { address: "0x9a82bb477c30d92dab74875027e14d1de3510ef9", selectors: ["0xf66fe519", "0x7bf96e0a"] },
  { address: "0xac82fa2d953ee5c61d87686ade620b0728f484e6", selectors: ["0xc9851d0b", "0x3cc9517b"] },
  { address: "0x6f2baa7cd5f156ca1b132f7ff11e0fa2ad775f61", selectors: ["0xf86368ae", "0x5ad317a4", "0x0340e905", "0x2fc487ae"] },
  { address: "0x3de506059ae0b239e125e6b1365cfa92100540c0", selectors: ["0x54e97ec9", "0xcc41fe54", "0x808d859c", "0xdd081734", "0xd24c2325", "0xcd48728d", "0x1dc3017e", "0xdf834e15"] },
  { address: "0x88e0dd83e6da24bf317323e5ca06842406d57ed0", selectors: ["0xb94289bb", "0x092e8fa4", "0xa3443faa"] },
  { address: "0x7570e6b01e43df1b0c67f99c4156285adc36c360", selectors: ["0x782621d8", "0x95726782"] },
  { address: "0x54678c366682a29112609882dc58def6753bfc27", selectors: ["0xdecb09d7", "0xce8a97a5", "0x5bb5d448"] },
  { address: "0x99fb0babba2c437153d25aff79dc80b905a27a5a", selectors: ["0xaf62c7d6", "0xb4f37581"] },
  { address: "0x29bedc1be2eecb654f7a9cd3f21b466c148186c2", selectors: ["0xce90a721", "0xb621b032", "0x30c48952"] },
  { address: "0x69cb467efd8044ac9edb88f363309ab1cbfa0a15", selectors: ["0xa516f0f3", "0x5c2ed36a"] },
  { address: "0xa74c9c1b2194f27c372b0892839624852de21687", selectors: ["0x4630a0d8"] },
  { address: "0x5ac2c4836c45faae84c7d73065796ac863ffb8c6", selectors: ["0x3961d1ed", "0xb3b63587", "0xa01fe784"] },
  { address: "0x9fc3d15a029bfee6eb27e3d061210a465e231362", selectors: ["0x0680ded4", "0x082bc047", "0x03add8c3", "0x0b4cb5d8", "0x55c99cd8", "0x42afe79a", "0x8d03f456", "0xd40e64cc", "0xca360ae0"] },
  { address: "0xef67be6d1a68ede5a21230629dfe896731adf947", selectors: ["0x28cc4316", "0x28832cbd"] },
  { address: "0x260fb3d593f6acb08e0aa380a123ce07d2bd4b7e", selectors: ["0xfc852c5a", "0xbe8a84ac", "0xaef365ad", "0xa2ed5607", "0xdee4be1b", "0xf6848697", "0x0193979f", "0x0078afb6"] },
  { address: "0x4640aaaab3e6f5bb9b4a16fb00ea0dbd6d98b397", selectors: ["0x6a51e9a9", "0x63267469"] },
  { address: "0xfdb9a62a5f4f98a0c4e4b864eb22a9eecb0bce5f", selectors: ["0xc18fa245", "0x54de26d9", "0xbd6d15ca", "0xfc1ebe3e", "0xe8bd0564", "0x26a93135", "0xad6607ff", "0xcda5f324", "0x1a0b79bf", "0x7cccba6d", "0x4bd751a8", "0x6c225efe", "0x3c580fed", "0x4b06e05f", "0x33619a2d", "0xc5e04e30", "0x1223354c", "0x76e04bbc", "0xc5ae0fe6", "0x04c5aa34", "0x161be542"] },
  { address: "0x8bd90ea4ef3df26c385646f4f41e4c5e3c11bb2a", selectors: ["0xbab657d8", "0x8fab0663"] },
  { address: "0xfa93141130a11fdab7c6c800dfb93a5d19da6aa4", selectors: ["0x7766d1ed", "0x0ad553b3", "0xee3314a1"] },
  { address: "0xbf4ad13fa0e6e05916a78c201f147c5152dbe1c9", selectors: ["0x14d53077", "0xa6010a66", "0xfb214c2f"] },
  { address: "0x7a5c119ec5ddbf9631cf40f6e5db28f31d4332a0", selectors: ["0x7f99d7af", "0x103c5200", "0xc318eeda", "0xee0aa320", "0x070e81f1", "0xd53482cf", "0xf58ae2ce"] },
  { address: "0x26fc055eaf6a6df15502f2466990528ec55c857d", selectors: ["0xf21a2116", "0x981886a7", "0x81d82dd8", "0xae328590", "0x25d374e8"] },
  { address: "0xcaefac1ea4dec8fd866cbc5b6dd3054f80d49b80", selectors: ["0x2541ec57", "0xad673d88"] },
  { address: "0x94ef6d1702ac7e30a5cef39dee26fab180c251fe", selectors: ["0x1458d7ad", "0xd9caed12"] },
  { address: "0x8c9dba771220ed09580b77f0765e7153fbde7790", selectors: ["0x5fd9ae2e", "0x2c57e884", "0x736eac0b", "0x4666fc80", "0x733214a3", "0xaf7060fd", "0xd5bcb610"] },
  { address: "0x65d6b9a368be49bca4964b66e54f828cab64b8f9", selectors: ["0x46fd98e2", "0xfc5f1003", "0x606326ff", "0x194c869f", "0xb49d391d"] },
  { address: "0x23fc1b73e66cd13e988170cb94e252cb7ff88185", selectors: ["0xb70fb9a5", "0x6e067161"] },
  { address: "0xd69e5ea7458abff098e9240f81f733898535c7a0", selectors: ["0xbbbf77d5", "0x6f9206ba", "0x9c4b6dd9"] },
  { address: "0xad3f1634a917924cbb54a0f76e43ca035d2b6bcd", selectors: ["0xe796cd98", "0xf97136af", "0xa1f1ce43", "0x1794958f"] },
  { address: "0x8cd89ea14345f24d0299c2180aec97a417ca34e3", selectors: ["0x79b80512", "0x012f27e7", "0x1626cde1", "0xc93ff540", "0x7260352d", "0x36b92404", "0x72dd147e", "0xc5d60e97"] },
  { address: "0xafe2648acc4a5720e0c3930df5bf247d446bffde", selectors: ["0x0ff754ea", "0x7e56b7b0", "0x9e75aa95"] },
  { address: "0xa20d724c81ddde4a65f682a766881970245b31af", selectors: ["0x5f9af35d", "0x76ad76fe"] },
  { address: "0xb28dd740d27853a91639795223ab409088a73e23", selectors: ["0x1171c007", "0x00816c97", "0x6d028027", "0x90f3d77b", "0x94ddf663", "0x13f44d10", "0x9baf00f9", "0x56977cc0", "0xb06faf62", "0x51fed648"] },
  { address: "0x66fd4424bc4e24b6183e95dd74a3f3857725457f", selectors: ["0x1fe5bb31", "0x93057564", "0x5627b1f3"] },
  { address: "0x989a7efabb9be76ac3424b940862d9cf55334873", selectors: ["0x64261d58", "0x21a3af52"] },
  { address: "0xe46e9a5ae71f1fb3ac59d09469830d6ecc1d21f2", selectors: ["0x3f44d05f", "0x4213dfff", "0x22256e89"] },
  { address: "0xb815b47ad429436892fc3c6ed1d401f515c7f763", selectors: ["0xbf69fa61", "0x89a30271", "0xe0a4201c", "0x4f3b0759"] }
];

// Get checksum address
function checksumAddress(address) {
  return ethers.getAddress(address);
}

// Fetch ABI from Etherscan
async function fetchABI(address) {
  const apiKey = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
  const checksumAddr = checksumAddress(address);

  const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${checksumAddr}&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result) {
      return JSON.parse(data.result);
    } else {
      const msg = data.message || data.result || 'Unknown error';
      console.log(`  No verified ABI for ${address}: ${msg}`);
      return null;
    }
  } catch (error) {
    console.log(`  Error fetching ABI for ${address}: ${error.message}`);
    return null;
  }
}

// Compute function selector from signature
function computeSelector(signature) {
  return ethers.id(signature).slice(0, 10);
}

// Build function signature from ABI entry
function buildSignature(abiEntry) {
  if (abiEntry.type !== 'function') return null;

  const inputTypes = abiEntry.inputs.map(input => {
    if (input.type === 'tuple') {
      return buildTupleType(input.components);
    } else if (input.type === 'tuple[]') {
      return buildTupleType(input.components) + '[]';
    }
    return input.type;
  });

  return `${abiEntry.name}(${inputTypes.join(',')})`;
}

function buildTupleType(components) {
  if (!components) return 'tuple';
  const types = components.map(comp => {
    if (comp.type === 'tuple') {
      return buildTupleType(comp.components);
    } else if (comp.type === 'tuple[]') {
      return buildTupleType(comp.components) + '[]';
    }
    return comp.type;
  });
  return `(${types.join(',')})`;
}

async function main() {
  console.log('Fetching ABIs for all LiFi Diamond facets...\n');

  const facetData = [];
  let totalFunctions = 0;

  for (let i = 0; i < FACETS.length; i++) {
    const facet = FACETS[i];
    console.log(`[${i + 1}/${FACETS.length}] Fetching ABI for ${facet.address}...`);

    const abi = await fetchABI(facet.address);

    if (abi) {
      // Map selectors to functions
      const functions = [];
      const functionAbi = abi.filter(entry => entry.type === 'function');

      for (const abiEntry of functionAbi) {
        const signature = buildSignature(abiEntry);
        if (!signature) continue;

        const selector = computeSelector(signature);

        // Check if this selector is in the facet's registered selectors
        if (facet.selectors.includes(selector)) {
          functions.push({
            name: abiEntry.name,
            signature: signature,
            selector: selector,
            inputs: abiEntry.inputs,
            outputs: abiEntry.outputs,
            stateMutability: abiEntry.stateMutability
          });
          totalFunctions++;
        }
      }

      if (functions.length > 0) {
        facetData.push({
          address: facet.address,
          functions: functions
        });
        console.log(`  Found ${functions.length} matching functions`);
      } else {
        console.log(`  No matching functions found (selectors may not match computed signatures)`);
      }
    }

    // Rate limit to avoid API throttling
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Facets with ABIs: ${facetData.length}`);
  console.log(`Total functions: ${totalFunctions}`);

  // Save to file
  const outputPath = 'scripts/lifi-facet-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(facetData, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  return facetData;
}

main().catch(console.error);
