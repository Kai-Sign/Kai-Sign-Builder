import { ethers } from 'ethers';

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/1EFr4OH_BpQp-qxV_7Vv5';
const OLD_CONTRACT = '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa';
const NEW_CONTRACT = '0xA819D2d3A2820995701cF46F8a314C7040d86BEe';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  // Get merkle root from both contracts
  const newContract = new ethers.Contract(NEW_CONTRACT, ['function merkleRoot() view returns (bytes32)'], provider);
  const newRoot = await newContract.merkleRoot();
  
  const oldContract = new ethers.Contract(OLD_CONTRACT, ['function merkleRoot() view returns (bytes32)'], provider);
  const oldRoot = await oldContract.merkleRoot();
  
  console.log('Old contract merkle root:', oldRoot);
  console.log('New contract merkle root:', newRoot);
  console.log('Roots match:', newRoot === oldRoot);
  
  // Get attestation from old contract  
  const getAttABI = ['function getAttestation(bytes32) view returns (tuple(bytes32 uid, uint256 chainId, bytes32 extcodehash, bytes32 blobHash, bytes32 metadataHash, address attester, uint64 timestamp, uint64 idx, bool revoked, uint64 finalizedAt, uint64 revokeProposedAt, address revokeProposer))'];
  const oldWithAtt = new ethers.Contract(OLD_CONTRACT, getAttABI, provider);
  
  // Sample uid from earlier
  const sampleUid = '0xcbf82bc5755d7939181be9f2938ecd37c837468a4c4ce7b0e23d4d51b80b9157';
  const att = await oldWithAtt.getAttestation(sampleUid);
  
  console.log('\n=== Sample Attestation ===');
  console.log('uid:', sampleUid);
  console.log('chainId:', att.chainId.toString());
  console.log('extcodehash:', att.extcodehash);
  console.log('metadataHash:', att.metadataHash);
  console.log('idx:', att.idx.toString());
  console.log('revoked:', att.revoked);
  
  // Compute leaf hash
  const LEAF_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
    "RegistryLeaf(uint256 chainId,bytes32 extcodehash,bytes32 metadataHash,uint256 idx,bool revoked)"
  ));
  
  const leafHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bool'],
    [LEAF_TYPEHASH, att.chainId, att.extcodehash, att.metadataHash, att.idx, att.revoked]
  ));
  console.log('\nComputed leaf hash:', leafHash);
  console.log('\nTo verify proof, need to build full merkle tree with all 448 leaves');
}

main().catch(console.error);
