import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';

const KAISIGN_ABI = [
  {
    inputs: [],
    name: 'minBond',
    outputs: [{type: 'uint256'}],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {name: 'commitment', type: 'bytes32'},
      {name: 'targetContract', type: 'address'},
      {name: 'targetChainId', type: 'uint256'}
    ],
    name: 'commitSpec',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const KAISIGN = '0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719';
const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

async function test() {
  console.log('Testing commit...');
  console.log('RPC:', rpcUrl);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('No PRIVATE_KEY in env');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  console.log('Signer:', await signer.getAddress());

  const balance = await provider.getBalance(await signer.getAddress());
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  const kaisign = new ethers.Contract(KAISIGN, KAISIGN_ABI, signer);

  // Test read
  try {
    const minBond = await kaisign.minBond();
    console.log('Min bond:', ethers.formatEther(minBond), 'ETH');
  } catch (e) {
    console.log('Read error:', e.message);
  }

  // Try a commit
  const testCommitment = ethers.keccak256(ethers.toUtf8Bytes('test' + Date.now()));
  const testTarget = '0x40a2accbd92bca938b02010e17a5b8929b49130d';
  const testChainId = 1;

  console.log('Attempting commit...');
  console.log('Commitment:', testCommitment);
  console.log('Target:', testTarget);
  console.log('ChainId:', testChainId);

  try {
    console.log('Estimating gas...');
    const gasEstimate = await kaisign.commitSpec.estimateGas(testCommitment, testTarget, testChainId);
    console.log('Gas estimate:', gasEstimate.toString());

    console.log('Sending transaction...');
    const tx = await kaisign.commitSpec(testCommitment, testTarget, testChainId);
    console.log('TX sent:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Confirmed in block:', receipt.blockNumber);
  } catch (e) {
    console.log('Commit error:', e.message);
    if (e.data) console.log('Error data:', e.data);
    if (e.reason) console.log('Reason:', e.reason);
  }
}

test();
