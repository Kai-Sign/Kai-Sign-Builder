import { ethers } from 'ethers';
import { KAISIGN_ABI, CONTRACTS, CONFIG, CommitResult, RevealResult } from './types';

export class KaiSignContract {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(CONTRACTS.KAISIGN, KAISIGN_ABI, signer);
  }

  /**
   * Get the minimum bond required for spec submission
   */
  async getMinBond(): Promise<bigint> {
    return await this.contract.minBond();
  }

  /**
   * Generate a commitment hash from metadata hash and nonce
   */
  generateCommitment(metadataHash: string, nonce: bigint): string {
    return ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'uint256'], [metadataHash, nonce])
    );
  }

  /**
   * Calculate the expected commitment ID
   */
  async calculateCommitmentId(
    commitment: string,
    committer: string,
    targetContract: string,
    chainId: number,
    timestamp: number
  ): Promise<string> {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'address', 'address', 'uint256', 'uint64'],
        [commitment, committer, targetContract, chainId, timestamp]
      )
    );
  }

  /**
   * Submit a commitment for a new spec
   */
  async commitSpec(
    metadataHash: string,
    nonce: bigint,
    targetContract: string,
    chainId: number
  ): Promise<CommitResult> {
    try {
      console.log(`  Committing spec for contract ${targetContract} on chain ${chainId}...`);

      // Generate commitment
      const commitment = this.generateCommitment(metadataHash, nonce);
      console.log(`  Commitment: ${commitment}`);

      // Submit transaction
      const tx = await this.contract.commitSpec(commitment, targetContract, chainId);
      console.log(`  Commit TX: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`  Commit confirmed in block ${receipt.blockNumber}`);

      // Parse the LogCommitSpec event to get commitmentId
      const commitEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed?.name === 'LogCommitSpec';
        } catch {
          return false;
        }
      });

      if (!commitEvent) {
        throw new Error('LogCommitSpec event not found in transaction receipt');
      }

      const parsedEvent = this.contract.interface.parseLog(commitEvent);
      const commitmentId = parsedEvent?.args?.commitmentId || parsedEvent?.args?.[1];

      console.log(`  CommitmentId: ${commitmentId}`);

      return {
        success: true,
        commitmentId: commitmentId,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error(`  Commit failed: ${error.message}`);
      return {
        success: false,
        commitmentId: '',
        txHash: '',
        error: error.message
      };
    }
  }

  /**
   * Reveal a committed spec with blob hash
   */
  async revealSpec(
    commitmentId: string,
    blobHash: string,
    metadataHash: string,
    nonce: bigint,
    bondAmount: bigint
  ): Promise<RevealResult> {
    try {
      console.log(`  Revealing spec with bond ${ethers.formatEther(bondAmount)} ETH...`);
      console.log(`  CommitmentId: ${commitmentId}`);
      console.log(`  BlobHash: ${blobHash}`);
      console.log(`  MetadataHash: ${metadataHash}`);
      console.log(`  Nonce: ${nonce}`);

      // Submit reveal transaction with bond
      const tx = await this.contract.revealSpec(
        commitmentId,
        blobHash,
        metadataHash,
        nonce,
        { value: bondAmount }
      );
      console.log(`  Reveal TX: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`  Reveal confirmed in block ${receipt.blockNumber}`);

      // Parse events
      let specId = '';
      let questionId = '';

      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog(log);
          if (parsed?.name === 'LogRevealSpec') {
            specId = parsed.args?.specID || parsed.args?.[1];
          }
          if (parsed?.name === 'LogProposeSpec') {
            questionId = parsed.args?.questionId || parsed.args?.[2];
          }
        } catch {
          // Skip logs that don't match our ABI
        }
      }

      if (!specId) {
        throw new Error('LogRevealSpec event not found - reveal may have failed');
      }

      console.log(`  SpecId: ${specId}`);
      console.log(`  QuestionId: ${questionId || 'Not proposed yet'}`);

      return {
        success: true,
        specId,
        questionId,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error(`  Reveal failed: ${error.message}`);
      return {
        success: false,
        specId: '',
        questionId: '',
        txHash: '',
        error: error.message
      };
    }
  }

  /**
   * Get spec details by ID
   */
  async getSpec(specId: string): Promise<{
    createdTimestamp: bigint;
    proposedTimestamp: bigint;
    status: number;
    totalBonds: bigint;
    creator: string;
    targetContract: string;
    blobHash: string;
    questionId: string;
    incentiveId: string;
    chainId: bigint;
  } | null> {
    try {
      const spec = await this.contract.specs(specId);
      return {
        createdTimestamp: spec[0],
        proposedTimestamp: spec[1],
        status: spec[2],
        totalBonds: spec[3],
        creator: spec[5],
        targetContract: spec[6],
        blobHash: spec[7],
        questionId: spec[8],
        incentiveId: spec[9],
        chainId: spec[10]
      };
    } catch (error) {
      console.error('Failed to get spec:', error);
      return null;
    }
  }

  /**
   * Check commitment status
   */
  async getCommitment(commitmentId: string): Promise<{
    committer: string;
    commitTimestamp: bigint;
    targetContract: string;
    isRevealed: boolean;
    bondAmount: bigint;
    revealDeadline: bigint;
    chainId: bigint;
  } | null> {
    try {
      const commitment = await this.contract.commitments(commitmentId);
      return {
        committer: commitment[0],
        commitTimestamp: commitment[1],
        targetContract: commitment[3],
        isRevealed: commitment[4],
        bondAmount: commitment[5],
        revealDeadline: commitment[7],
        chainId: commitment[8]
      };
    } catch (error) {
      console.error('Failed to get commitment:', error);
      return null;
    }
  }
}
