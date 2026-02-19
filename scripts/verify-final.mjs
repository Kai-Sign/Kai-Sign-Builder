import { ethers } from 'ethers';

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const OLD_CONTRACT = '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa';
const NEW_CONTRACT = '0xA819D2d3A2820995701cF46F8a314C7040d86BEe';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  const oldRoot = await new ethers.Contract(OLD_CONTRACT, ['function merkleRoot() view returns (bytes32)'], provider).merkleRoot();
  const newRoot = await new ethers.Contract(NEW_CONTRACT, ['function merkleRoot() view returns (bytes32)'], provider).merkleRoot();
  
  console.log('=== Final Verification ===');
  console.log('Old contract (0xC203...):', oldRoot);
  console.log('New contract (0x32a4...):', newRoot);
  console.log('Roots match:', oldRoot === newRoot ? '✓ YES' : '✗ NO');
  
  // Check currentIdx
  const newIdx = await new ethers.Contract(NEW_CONTRACT, ['function currentIdx() view returns (uint64)'], provider).currentIdx();
  console.log('New contract currentIdx:', newIdx.toString(), '(next spec will be', (Number(newIdx) + 1) + ')');
}

main().catch(console.error);
