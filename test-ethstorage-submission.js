/**
 * EthStorage ERC7730 Blob Submission Test
 *
 * Tests uploading an ERC7730 JSON metadata file to EthStorage testnet.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node test-ethstorage-submission.js
 *
 * If no private key is provided, a new wallet will be generated and its
 * address shown for funding with Sepolia ETH.
 */

import { EthStorage, FlatDirectory } from 'ethstorage-sdk';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// EthStorage Testnet Configuration (Chain ID: 3333, uses Sepolia as L1)
const ETHSTORAGE_CONFIG = {
  // Use PublicNode Sepolia RPC for L1 (supports post-Fusaka blobs)
  rpc: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  ethStorageRpc: 'https://rpc.testnet.ethstorage.io:9546', // EthStorage testnet RPC
  storageContract: '0xAb3d380A268d088BA21Eb313c1C23F3BEC5cfe93',
  chainId: 3333
};

// Test ERC7730 data to upload
const testErc7730 = {
  "$schema": "https://schemas.erc7730.org/erc7730-v1.json",
  "context": {
    "eip712Domain": {
      "name": "EthStorage Test Metadata",
      "version": "1"
    },
    "contract": {
      "deployments": [
        {
          "chainId": 1,
          "address": "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"
        }
      ]
    }
  },
  "metadata": {
    "owner": "KaiSign",
    "info": {
      "url": "https://kai-sign.com",
      "legalName": "KaiSign ERC7730 Test",
      "lastUpdate": new Date().toISOString().split('T')[0]
    }
  },
  "display": {
    "formats": {
      "testFunction(address,uint256)": {
        "intent": "Test function for EthStorage blob submission",
        "fields": [
          {
            "path": "#.recipient",
            "label": "Recipient",
            "format": "addressName"
          },
          {
            "path": "#.amount",
            "label": "Amount",
            "format": "tokenAmount"
          }
        ]
      }
    }
  }
};

async function testEthStorageConnectivity() {
  console.log('\n🔍 Testing EthStorage network connectivity...');

  try {
    const provider = new ethers.JsonRpcProvider(ETHSTORAGE_CONFIG.ethStorageRpc);
    const network = await provider.getNetwork();
    console.log(`✅ Connected to EthStorage testnet - Chain ID: ${network.chainId}`);

    // Note: EthStorage RPC doesn't support eth_blockNumber, so we just verify chainId
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to EthStorage: ${error.message}`);
    return false;
  }
}

async function checkBalance(privateKey) {
  const provider = new ethers.JsonRpcProvider(ETHSTORAGE_CONFIG.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`\n💰 Wallet: ${wallet.address}`);
  console.log(`   Sepolia ETH Balance: ${ethers.formatEther(balance)} ETH`);

  return { wallet, balance, hasEnough: balance > ethers.parseEther('0.01') };
}

async function uploadToEthStorage(privateKey) {
  console.log('\n📤 Uploading ERC7730 to EthStorage...');

  try {
    // Create EthStorage instance
    const ethStorage = await EthStorage.create({
      rpc: ETHSTORAGE_CONFIG.rpc,
      ethStorageRpc: ETHSTORAGE_CONFIG.ethStorageRpc,
      privateKey: privateKey
    });

    console.log('   EthStorage SDK initialized');

    // Generate a unique key for this upload
    const timestamp = Date.now();
    const key = `erc7730-test-${timestamp}.json`;
    const data = Buffer.from(JSON.stringify(testErc7730, null, 2));

    console.log(`   Key: ${key}`);
    console.log(`   Data size: ${data.length} bytes`);

    // Upload the data
    console.log('   Submitting blob transaction...');
    const result = await ethStorage.write(key, data);

    console.log(`\n✅ Upload successful!`);
    console.log(`   Key: ${key}`);
    console.log(`   Result:`, result);

    // Close the SDK connection
    await ethStorage.close();

    return { success: true, key, result };

  } catch (error) {
    console.error(`\n❌ Upload failed: ${error.message}`);
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Your wallet needs Sepolia ETH. Get some from:');
      console.log('   - https://sepoliafaucet.com');
      console.log('   - https://www.alchemy.com/faucets/ethereum-sepolia');
    }
    return { success: false, error: error.message };
  }
}

async function uploadWithFlatDirectory(privateKey) {
  console.log('\n📤 Uploading ERC7730 using FlatDirectory (blob type)...');

  try {
    const flatDirectory = await FlatDirectory.create({
      rpc: ETHSTORAGE_CONFIG.rpc,
      ethStorageRpc: ETHSTORAGE_CONFIG.ethStorageRpc,
      privateKey: privateKey
    });

    console.log('   FlatDirectory SDK initialized');

    const timestamp = Date.now();
    const key = `erc7730-blob-${timestamp}.json`;
    const data = Buffer.from(JSON.stringify(testErc7730, null, 2));

    console.log(`   Key: ${key}`);
    console.log(`   Data size: ${data.length} bytes`);

    const callback = {
      onProgress: (progress, count) => console.log(`   Progress: ${progress}/${count} chunks`),
      onFail: (err) => console.log(`   Chunk failed: ${err}`),
      onFinish: (totalChunks, totalSize, totalCost) => {
        console.log(`   ✅ Complete: ${totalChunks} chunks, ${totalSize} bytes, cost: ${totalCost}`);
      }
    };

    console.log('   Submitting blob transaction (type: 2 = blob)...');
    await flatDirectory.upload({
      key: key,
      content: data,
      type: 2, // 2 = blob storage (EIP-4844)
      callback: callback
    });

    await flatDirectory.close();

    return { success: true, key };

  } catch (error) {
    console.error(`\n❌ FlatDirectory upload failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function readFromEthStorage(privateKey, key) {
  console.log(`\n📥 Reading back from EthStorage: ${key}`);

  try {
    const ethStorage = await EthStorage.create({
      rpc: ETHSTORAGE_CONFIG.rpc,
      ethStorageRpc: ETHSTORAGE_CONFIG.ethStorageRpc,
      privateKey: privateKey
    });

    const data = await ethStorage.read(key);
    await ethStorage.close();

    if (data) {
      console.log('   ✅ Data retrieved successfully!');
      console.log('   Content:', data.toString().substring(0, 200) + '...');
      return { success: true, data: data.toString() };
    } else {
      console.log('   ⚠️ No data found (might need to wait for sync)');
      return { success: false, error: 'No data found' };
    }
  } catch (error) {
    console.error(`   ❌ Read failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        EthStorage ERC7730 Blob Submission Test             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test connectivity first
  const connected = await testEthStorageConnectivity();
  if (!connected) {
    console.log('\n⚠️  Cannot proceed without EthStorage connectivity');
    process.exit(1);
  }

  // Get or generate private key
  let privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.log('\n⚠️  No PRIVATE_KEY environment variable found');
    console.log('   Generating a new test wallet...');

    const newWallet = ethers.Wallet.createRandom();
    privateKey = newWallet.privateKey;

    console.log('\n   🔑 New Test Wallet Generated:');
    console.log(`   Address: ${newWallet.address}`);
    console.log(`   Private Key: ${privateKey}`);
    console.log('\n   📋 To use this wallet, fund it with Sepolia ETH and run:');
    console.log(`   PRIVATE_KEY=${privateKey} node test-ethstorage-submission.js`);
  }

  // Check balance
  const { wallet, balance, hasEnough } = await checkBalance(privateKey);

  if (!hasEnough) {
    console.log('\n⚠️  Insufficient balance for blob transaction');
    console.log('   Need at least 0.01 Sepolia ETH');
    console.log('\n💡 Get Sepolia ETH from:');
    console.log('   - https://sepoliafaucet.com');
    console.log('   - https://www.alchemy.com/faucets/ethereum-sepolia');
    console.log('   - https://sepolia-faucet.pk910.de/');
    console.log(`\n   Fund address: ${wallet.address}`);
    process.exit(1);
  }

  // Try uploading with EthStorage class first
  console.log('\n' + '='.repeat(60));
  console.log('Method 1: Using EthStorage.write()');
  console.log('='.repeat(60));

  const result1 = await uploadToEthStorage(privateKey);

  if (result1.success) {
    // Wait a bit and try to read it back
    console.log('\n⏳ Waiting 5 seconds for sync...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await readFromEthStorage(privateKey, result1.key);
  }

  // Also try FlatDirectory method
  console.log('\n' + '='.repeat(60));
  console.log('Method 2: Using FlatDirectory.upload() with blob type');
  console.log('='.repeat(60));

  const result2 = await uploadWithFlatDirectory(privateKey);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('                      SUMMARY');
  console.log('═'.repeat(60));
  console.log(`EthStorage.write():      ${result1.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`FlatDirectory.upload():  ${result2.success ? '✅ SUCCESS' : '❌ FAILED'}`);

  if (result1.success || result2.success) {
    console.log('\n🎉 ERC7730 blob submission to EthStorage successful!');
    console.log('\n📍 Network: EthStorage Testnet (Chain ID: 3333)');
    console.log(`📍 RPC: ${ETHSTORAGE_CONFIG.ethStorageRpc}`);
  }
}

main().catch(console.error);
