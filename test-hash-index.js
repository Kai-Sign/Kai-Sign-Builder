#!/usr/bin/env node
/**
 * Test script for metadata hash index
 *
 * Tests:
 * 1. Stats endpoint
 * 2. Query by hash
 * 3. Reverse lookup (contract → hashes)
 * 4. Leaf hash verification
 */

import { ethers } from 'ethers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

async function testStats() {
  log(colors.cyan, '\n📊 Test 1: Get Stats');
  log(colors.blue, '─'.repeat(80));

  try {
    const response = await fetch(`${BACKEND_URL}/api/py/metadata/hash/stats`);
    const data = await response.json();

    log(colors.green, '✅ Stats retrieved:');
    console.log(JSON.stringify(data, null, 2));

    return data.total_entries > 0;
  } catch (error) {
    log(colors.red, '❌ Failed:', error.message);
    return false;
  }
}

async function testQueryByHash(hash) {
  log(colors.cyan, '\n🔍 Test 2: Query by Hash');
  log(colors.blue, '─'.repeat(80));
  log(colors.yellow, `Hash: ${hash}`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/py/metadata/hash/${hash}`);

    if (!response.ok) {
      log(colors.red, `❌ HTTP ${response.status}: ${await response.text()}`);
      return false;
    }

    const data = await response.json();

    log(colors.green, '✅ Metadata retrieved:');
    console.log(JSON.stringify({
      metadata_hash: data.metadata_hash,
      target_contract: data.target_contract,
      chain_id: data.chain_id,
      leaf_components: data.leaf_components,
      leaf_hash: data.leaf_hash,
      status: data.status
    }, null, 2));

    // Verify metadata structure
    if (!data.metadata || !data.leaf_components) {
      log(colors.red, '❌ Missing required fields');
      return false;
    }

    return true;
  } catch (error) {
    log(colors.red, '❌ Failed:', error.message);
    return false;
  }
}

async function testReverseLookup(address, chainId) {
  log(colors.cyan, '\n🔄 Test 3: Reverse Lookup (Contract → Hashes)');
  log(colors.blue, '─'.repeat(80));
  log(colors.yellow, `Contract: ${address}`);
  log(colors.yellow, `Chain ID: ${chainId}`);

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/py/metadata/contract/${address}/hashes?chain_id=${chainId}`
    );

    if (!response.ok) {
      log(colors.red, `❌ HTTP ${response.status}: ${await response.text()}`);
      return false;
    }

    const data = await response.json();

    log(colors.green, `✅ Found ${data.count} hash(es):`);
    data.hashes.forEach((hash, i) => {
      console.log(`  ${i + 1}. ${hash}`);
    });

    return data.count > 0 ? data.hashes[0] : null;
  } catch (error) {
    log(colors.red, '❌ Failed:', error.message);
    return null;
  }
}

async function testLeafHashVerification(hash) {
  log(colors.cyan, '\n🔐 Test 4: Leaf Hash Verification');
  log(colors.blue, '─'.repeat(80));

  try {
    // Fetch metadata with leaf components
    const response = await fetch(`${BACKEND_URL}/api/py/metadata/hash/${hash}`);
    const data = await response.json();

    const { leaf_components, leaf_hash } = data;

    log(colors.yellow, 'Leaf components:');
    console.log(JSON.stringify(leaf_components, null, 2));

    // Compute leaf hash locally
    const LEAF_TYPEHASH = ethers.keccak256(
      ethers.toUtf8Bytes('RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,uint256 idx,bool revoked)')
    );

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
      [
        LEAF_TYPEHASH,
        leaf_components.chain_id,
        leaf_components.extcodehash,
        leaf_components.metadata_hash,
        leaf_components.idx,
        leaf_components.revoked
      ]
    );

    const computed = ethers.keccak256(encoded);

    log(colors.yellow, `\nExpected leaf hash: ${leaf_hash}`);
    log(colors.yellow, `Computed leaf hash: ${computed}`);

    if (computed.toLowerCase() === leaf_hash.toLowerCase()) {
      log(colors.green, '✅ Leaf hash verified! Matches on-chain formula');
      return true;
    } else {
      log(colors.red, '❌ Leaf hash mismatch!');
      return false;
    }
  } catch (error) {
    log(colors.red, '❌ Failed:', error.message);
    return false;
  }
}

async function main() {
  log(colors.cyan, '\n' + '═'.repeat(80));
  log(colors.cyan, '🧪 Metadata Hash Index Test Suite');
  log(colors.cyan, '═'.repeat(80));

  const results = {
    stats: false,
    query: false,
    reverse: false,
    verify: false
  };

  // Test 1: Stats
  results.stats = await testStats();

  if (!results.stats) {
    log(colors.red, '\n⚠️  Index is empty. Please run the backend to populate it.');
    log(colors.yellow, 'Expected: Backend should auto-load on startup from submission-state.json');
    process.exit(1);
  }

  // Test 3: Reverse lookup (to get a hash to test with)
  const testAddress = '0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d';
  const testChainId = 1;
  const hash = await testReverseLookup(testAddress, testChainId);

  if (!hash) {
    log(colors.yellow, '\n⚠️  No metadata found for test contract. Trying known hash...');
    // Try a known hash from submission-state.json
    const knownHash = '0x32bbd60b8b6829c08df23cee6111a5f7427f144a0bed8b0e90d64edb67effbbc';
    results.query = await testQueryByHash(knownHash);
    if (results.query) {
      results.verify = await testLeafHashVerification(knownHash);
    }
  } else {
    results.reverse = true;

    // Test 2: Query by hash
    results.query = await testQueryByHash(hash);

    // Test 4: Verify leaf hash
    if (results.query) {
      results.verify = await testLeafHashVerification(hash);
    }
  }

  // Summary
  log(colors.cyan, '\n' + '═'.repeat(80));
  log(colors.cyan, '📋 Test Summary');
  log(colors.cyan, '═'.repeat(80));

  const tests = [
    ['Stats Endpoint', results.stats],
    ['Query by Hash', results.query],
    ['Reverse Lookup', results.reverse],
    ['Leaf Hash Verification', results.verify]
  ];

  tests.forEach(([name, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    log(color, `${icon} ${name}`);
  });

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  log(colors.cyan, '\n' + '─'.repeat(80));

  if (passedCount === totalCount) {
    log(colors.green, `\n🎉 All ${totalCount} tests passed!`);
    process.exit(0);
  } else {
    log(colors.yellow, `\n⚠️  ${passedCount}/${totalCount} tests passed`);
    process.exit(1);
  }
}

main().catch(error => {
  log(colors.red, '\n💥 Fatal error:', error.message);
  console.error(error);
  process.exit(1);
});
