import { ethers } from 'ethers';
import { REALITY_ETH_ABI, CONTRACTS, VoteResult } from './types';

export class RealityEthContract {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(CONTRACTS.REALITY_ETH, REALITY_ETH_ABI, signer);
  }

  /**
   * Get current bond for a question
   */
  async getBond(questionId: string): Promise<bigint> {
    try {
      return await this.contract.getBond(questionId);
    } catch (error) {
      console.error('Failed to get bond:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if a question is finalized
   */
  async isFinalized(questionId: string): Promise<boolean> {
    try {
      return await this.contract.isFinalized(questionId);
    } catch (error) {
      console.error('Failed to check finalization:', error);
      return false;
    }
  }

  /**
   * Get the current best answer for a question
   */
  async getBestAnswer(questionId: string): Promise<string> {
    try {
      return await this.contract.getBestAnswer(questionId);
    } catch (error) {
      console.error('Failed to get best answer:', error);
      return ethers.ZeroHash;
    }
  }

  /**
   * Get question details
   */
  async getQuestion(questionId: string): Promise<{
    contentHash: string;
    arbitrator: string;
    openingTs: number;
    timeout: number;
    finalizeTs: number;
    isPendingArbitration: boolean;
    bounty: bigint;
    bestAnswer: string;
    historyHash: string;
    bond: bigint;
    minBond: bigint;
  } | null> {
    try {
      const q = await this.contract.questions(questionId);
      return {
        contentHash: q[0],
        arbitrator: q[1],
        openingTs: Number(q[2]),
        timeout: Number(q[3]),
        finalizeTs: Number(q[4]),
        isPendingArbitration: q[5],
        bounty: q[6],
        bestAnswer: q[7],
        historyHash: q[8],
        bond: q[9],
        minBond: q[10]
      };
    } catch (error) {
      console.error('Failed to get question:', error);
      return null;
    }
  }

  /**
   * Submit an answer to vote on a question
   * @param questionId The question ID
   * @param answer The answer (bytes32): 0x0...01 for valid, 0x0...00 for invalid
   * @param maxPrevious The maximum bond of any previous answer (for ordering)
   * @param bondAmount The bond to submit with this answer (must be > current bond)
   */
  async submitAnswer(
    questionId: string,
    answer: string,
    maxPrevious: bigint,
    bondAmount: bigint
  ): Promise<VoteResult> {
    try {
      console.log(`  Submitting answer to Reality.eth...`);
      console.log(`  QuestionId: ${questionId}`);
      console.log(`  Answer: ${answer}`);
      console.log(`  Bond: ${ethers.formatEther(bondAmount)} ETH`);

      const tx = await this.contract.submitAnswer(
        questionId,
        answer,
        maxPrevious,
        { value: bondAmount }
      );
      console.log(`  Vote TX: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`  Vote confirmed in block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: tx.hash,
        bondAmount: bondAmount.toString()
      };
    } catch (error: any) {
      console.error(`  Vote failed: ${error.message}`);
      return {
        success: false,
        txHash: '',
        bondAmount: '0',
        error: error.message
      };
    }
  }

  /**
   * Vote that a spec is VALID (answer = 1)
   * Automatically calculates required bond (2x current bond)
   */
  async voteValid(questionId: string): Promise<VoteResult> {
    try {
      // Get current bond
      const currentBond = await this.getBond(questionId);
      console.log(`  Current bond: ${ethers.formatEther(currentBond)} ETH`);

      // Get question details to check min_bond
      const question = await this.getQuestion(questionId);

      // Calculate new bond: must be at least 2x current or min_bond
      let newBond: bigint;
      if (currentBond === BigInt(0)) {
        // First answer - use min_bond from question
        newBond = question?.minBond || BigInt('100000000000000'); // 0.0001 ETH default
      } else {
        // Subsequent answer - must be 2x previous
        newBond = currentBond * BigInt(2);
      }

      console.log(`  New bond: ${ethers.formatEther(newBond)} ETH`);

      // Answer bytes32(1) = valid
      const validAnswer = ethers.zeroPadValue(ethers.toBeHex(1), 32);

      return await this.submitAnswer(questionId, validAnswer, currentBond, newBond);
    } catch (error: any) {
      console.error(`  Vote valid failed: ${error.message}`);
      return {
        success: false,
        txHash: '',
        bondAmount: '0',
        error: error.message
      };
    }
  }

  /**
   * Vote that a spec is INVALID (answer = 0)
   */
  async voteInvalid(questionId: string): Promise<VoteResult> {
    try {
      const currentBond = await this.getBond(questionId);
      const question = await this.getQuestion(questionId);

      let newBond: bigint;
      if (currentBond === BigInt(0)) {
        newBond = question?.minBond || BigInt('100000000000000');
      } else {
        newBond = currentBond * BigInt(2);
      }

      // Answer bytes32(0) = invalid
      const invalidAnswer = ethers.zeroPadValue(ethers.toBeHex(0), 32);

      return await this.submitAnswer(questionId, invalidAnswer, currentBond, newBond);
    } catch (error: any) {
      console.error(`  Vote invalid failed: ${error.message}`);
      return {
        success: false,
        txHash: '',
        bondAmount: '0',
        error: error.message
      };
    }
  }

  /**
   * Get time remaining until finalization
   */
  async getTimeUntilFinalization(questionId: string): Promise<number> {
    const question = await this.getQuestion(questionId);
    if (!question) return -1;

    const now = Math.floor(Date.now() / 1000);
    const finalizeAt = question.finalizeTs;

    if (finalizeAt === 0) {
      // Not yet started, will be timeout seconds after first answer
      return question.timeout;
    }

    return Math.max(0, finalizeAt - now);
  }
}
