#!/usr/bin/env node
/**
 * Check Submitted Contracts
 * Shows all submitted metadata with contract names and Etherscan links
 *
 * Usage:
 *   node scripts/check-submissions.js [--status completed|finalized|error|all]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, 'submission-state.json');

const CHAIN_INFO = {
  1: { name: 'Ethereum', explorer: 'https://etherscan.io' },
  137: { name: 'Polygon', explorer: 'https://polygonscan.com' },
  42161: { name: 'Arbitrum', explorer: 'https://arbiscan.io' },
  10: { name: 'Optimism', explorer: 'https://optimistic.etherscan.io' },
  8453: { name: 'Base', explorer: 'https://basescan.org' },
  56: { name: 'BSC', explorer: 'https://bscscan.com' },
  43114: { name: 'Avalanche', explorer: 'https://snowtrace.io' },
  250: { name: 'Fantom', explorer: 'https://ftmscan.com' },
  100: { name: 'Gnosis', explorer: 'https://gnosisscan.io' },
  324: { name: 'zkSync', explorer: 'https://explorer.zksync.io' },
  59144: { name: 'Linea', explorer: 'https://lineascan.build' },
  534352: { name: 'Scroll', explorer: 'https://scrollscan.com' },
  81457: { name: 'Blast', explorer: 'https://blastscan.io' },
  34443: { name: 'Mode', explorer: 'https://explorer.mode.network' },
  11155111: { name: 'Sepolia', explorer: 'https://sepolia.etherscan.io' }
};

function getContractName(metadataFile, metadataPath) {
  try {
    let filePath = metadataPath;
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, 'lifi-facet-metadata', metadataFile);
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, metadataFile);
    }
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.metadata?.info?.legalName ||
             data.metadata?.info?.deployedName ||
             data.context?.contract?.name ||
             metadataFile.replace('.json', '');
    }
  } catch {}
  return metadataFile.replace('.json', '');
}

function getEtherscanLink(address, chainId) {
  const chain = CHAIN_INFO[chainId] || { name: `Chain ${chainId}`, explorer: null };
  if (chain.explorer) {
    return `${chain.explorer}/address/${address}`;
  }
  return null;
}

function formatStatus(status) {
  const colors = {
    completed: '\x1b[32m✓ completed\x1b[0m',
    finalized: '\x1b[36m★ finalized\x1b[0m',
    voted: '\x1b[33m⏳ voted\x1b[0m',
    error: '\x1b[31m✗ error\x1b[0m',
    pending: '\x1b[90m○ pending\x1b[0m',
    committing: '\x1b[33m⏳ committing\x1b[0m',
    revealing: '\x1b[33m⏳ revealing\x1b[0m'
  };
  return colors[status] || status;
}

function main() {
  const args = process.argv.slice(2);
  let statusFilter = 'all';

  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1 && args[statusIdx + 1]) {
    statusFilter = args[statusIdx + 1];
  }

  if (!fs.existsSync(STATE_FILE)) {
    console.log('No submissions found. Run autonomous-submitter.js first.');
    process.exit(0);
  }

  const states = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  let filtered = states;
  if (statusFilter !== 'all') {
    filtered = states.filter(s => s.status === statusFilter);
  }

  // Group by status
  const byStatus = {};
  for (const s of filtered) {
    if (!byStatus[s.status]) byStatus[s.status] = [];
    byStatus[s.status].push(s);
  }

  console.log('═'.repeat(80));
  console.log('SUBMITTED CONTRACTS');
  console.log('═'.repeat(80));
  console.log(`Total: ${states.length} | Showing: ${filtered.length} (filter: ${statusFilter})\n`);

  // Summary
  const summary = {};
  for (const s of states) {
    summary[s.status] = (summary[s.status] || 0) + 1;
  }
  console.log('Status Summary:');
  for (const [status, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${formatStatus(status)}: ${count}`);
  }
  console.log('');

  // List by status
  for (const [status, items] of Object.entries(byStatus).sort()) {
    console.log('─'.repeat(80));
    console.log(`${formatStatus(status).toUpperCase()} (${items.length})`);
    console.log('─'.repeat(80));

    for (const item of items) {
      const contractName = getContractName(item.metadataFile, item.metadataPath);
      const chainInfo = CHAIN_INFO[item.chainId] || { name: `Chain ${item.chainId}` };
      const link = getEtherscanLink(item.targetContract, item.chainId);

      console.log(`\n  📄 ${contractName}`);
      console.log(`     File: ${item.metadataFile}`);
      console.log(`     Chain: ${chainInfo.name} (${item.chainId})`);
      console.log(`     Contract: ${item.targetContract}`);
      if (link) {
        console.log(`     🔗 ${link}`);
      }
      if (item.specId) {
        console.log(`     SpecID: ${item.specId}`);
      }
      if (item.blobHash) {
        console.log(`     Blob: https://sepolia.blobscan.com/blob/${item.blobHash}`);
      }
      if (item.error) {
        console.log(`     ❌ Error: ${item.error}`);
      }
    }
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('Usage: node check-submissions.js [--status completed|finalized|error|all]');
  console.log('═'.repeat(80));
}

main();
