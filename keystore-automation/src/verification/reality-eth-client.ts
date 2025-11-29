import { ethers } from 'ethers';
import { ChainConfig } from '../config/chains.js';
import { botLogger } from '../utils/logger.js';

export interface Question {
  questionId: string;
  content_hash: string;
  arbitrator: string;
  opening_ts: bigint;
  timeout: bigint;
  finalize_ts: bigint;
  is_pending_arbitration: boolean;
  bounty: bigint;
  best_answer: string;
  history_hash: string;
  bond: bigint;
  min_bond: bigint;
}

export interface AnswerEvent {
  answer: string;
  user: string;
  bond: bigint;
  ts: number;
  is_commitment: boolean;
}

export class RealityEthClient {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private chain: ChainConfig;

  private readonly REALITY_ETH_ABI = [
    {
      "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
      "name": "questions",
      "outputs": [
        {"internalType": "bytes32", "name": "content_hash", "type": "bytes32"},
        {"internalType": "address", "name": "arbitrator", "type": "address"},
        {"internalType": "uint32", "name": "opening_ts", "type": "uint32"},
        {"internalType": "uint32", "name": "timeout", "type": "uint32"},
        {"internalType": "uint32", "name": "finalize_ts", "type": "uint32"},
        {"internalType": "bool", "name": "is_pending_arbitration", "type": "bool"},
        {"internalType": "uint256", "name": "bounty", "type": "uint256"},
        {"internalType": "bytes32", "name": "best_answer", "type": "bytes32"},
        {"internalType": "bytes32", "name": "history_hash", "type": "bytes32"},
        {"internalType": "uint256", "name": "bond", "type": "uint256"},
        {"internalType": "uint256", "name": "min_bond", "type": "uint256"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "bytes32", "name": "question_id", "type": "bytes32"},
        {"internalType": "bytes32", "name": "answer", "type": "bytes32"},
        {"internalType": "uint256", "name": "max_previous", "type": "uint256"}
      ],
      "name": "submitAnswer",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "finalize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "isFinalized",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "resultFor",
      "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "getBond",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "getMinBond",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
      "name": "getBestAnswer",
      "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "bytes32", "name": "question_id", "type": "bytes32"},
        {"internalType": "bytes32", "name": "answer", "type": "bytes32"}
      ],
      "name": "getBondForAnswer",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    // Events
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "bytes32", "name": "question_id", "type": "bytes32"},
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "bytes32", "name": "answer", "type": "bytes32"},
        {"indexed": false, "internalType": "uint256", "name": "bond", "type": "uint256"},
        {"indexed": false, "internalType": "uint256", "name": "ts", "type": "uint256"},
        {"indexed": false, "internalType": "bool", "name": "is_commitment", "type": "bool"}
      ],
      "name": "LogNewAnswer",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "bytes32", "name": "question_id", "type": "bytes32"},
        {"indexed": false, "internalType": "bytes32", "name": "answer", "type": "bytes32"}
      ],
      "name": "LogFinalize",
      "type": "event"
    }
  ];

  constructor(provider: ethers.Provider, contractAddress: string, chain: ChainConfig) {
    this.provider = provider;
    this.chain = chain;
    this.contract = new ethers.Contract(contractAddress, this.REALITY_ETH_ABI, provider);
  }

  /**
   * Get question details
   */
  async getQuestion(questionId: string): Promise<Question | null> {
    try {
      const result = await this.contract.questions(questionId);
      
      if (result.content_hash === ethers.ZeroHash) {
        return null; // Question doesn't exist
      }

      return {
        questionId,
        content_hash: result.content_hash,
        arbitrator: result.arbitrator,
        opening_ts: result.opening_ts,
        timeout: result.timeout,
        finalize_ts: result.finalize_ts,
        is_pending_arbitration: result.is_pending_arbitration,
        bounty: result.bounty,
        best_answer: result.best_answer,
        history_hash: result.history_hash,
        bond: result.bond,
        min_bond: result.min_bond
      };

    } catch (error) {
      botLogger.error(`Failed to get question ${questionId}`, error);
      return null;
    }
  }

  /**
   * Submit an answer to a question
   */
  async submitAnswer(
    wallet: ethers.Wallet,
    questionId: string,
    answer: boolean, // true for valid, false for invalid
    bondAmountEth: string,
    maxPrevious?: string
  ): Promise<string> {
    try {
      const bondAmount = ethers.parseEther(bondAmountEth);
      const answerBytes = answer ? ethers.ZeroHash.replace('0x00', '0x01') : ethers.ZeroHash;
      const maxPrev = maxPrevious ? ethers.parseEther(maxPrevious) : 0;

      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;

      // Estimate gas
      const gasEstimate = await contractWithSigner.submitAnswer.estimateGas(
        questionId,
        answerBytes,
        maxPrev,
        { value: bondAmount }
      );

      // Execute transaction
      const tx = await contractWithSigner.submitAnswer(
        questionId,
        answerBytes,
        maxPrev,
        {
          value: bondAmount,
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
          gasPrice: await this.getOptimalGasPrice()
        }
      );

      botLogger.verification(`Answer submitted: ${answer ? 'VALID' : 'INVALID'}`, {
        questionId: questionId.substring(0, 10) + '...',
        bondAmount: bondAmountEth,
        txHash: tx.hash,
        wallet: wallet.address
      });

      await tx.wait();
      return tx.hash;

    } catch (error) {
      botLogger.error(`Failed to submit answer for question ${questionId}`, error);
      throw error;
    }
  }

  /**
   * Finalize a question after timeout
   */
  async finalize(wallet: ethers.Wallet, questionId: string): Promise<string> {
    try {
      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;

      // Estimate gas
      const gasEstimate = await contractWithSigner.finalize.estimateGas(questionId);

      // Execute transaction
      const tx = await contractWithSigner.finalize(questionId, {
        gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
        gasPrice: await this.getOptimalGasPrice()
      });

      botLogger.verification(`Question finalized`, {
        questionId: questionId.substring(0, 10) + '...',
        txHash: tx.hash,
        wallet: wallet.address
      });

      await tx.wait();
      return tx.hash;

    } catch (error) {
      botLogger.error(`Failed to finalize question ${questionId}`, error);
      throw error;
    }
  }

  /**
   * Check if a question is finalized
   */
  async isFinalized(questionId: string): Promise<boolean> {
    try {
      return await this.contract.isFinalized(questionId);
    } catch (error) {
      botLogger.error(`Failed to check finalization status for ${questionId}`, error);
      return false;
    }
  }

  /**
   * Get the final result of a question
   */
  async getResult(questionId: string): Promise<boolean | null> {
    try {
      const isFinalized = await this.isFinalized(questionId);
      if (!isFinalized) {
        return null;
      }

      const result = await this.contract.resultFor(questionId);
      return result !== ethers.ZeroHash;

    } catch (error) {
      botLogger.error(`Failed to get result for question ${questionId}`, error);
      return null;
    }
  }

  /**
   * Get current bond required to change the answer
   */
  async getCurrentBond(questionId: string): Promise<bigint> {
    try {
      return await this.contract.getBond(questionId);
    } catch (error) {
      botLogger.error(`Failed to get current bond for ${questionId}`, error);
      return 0n;
    }
  }

  /**
   * Get minimum bond required for a question
   */
  async getMinBond(questionId: string): Promise<bigint> {
    try {
      return await this.contract.getMinBond(questionId);
    } catch (error) {
      botLogger.error(`Failed to get min bond for ${questionId}`, error);
      return 0n;
    }
  }

  /**
   * Get current best answer
   */
  async getBestAnswer(questionId: string): Promise<boolean | null> {
    try {
      const answer = await this.contract.getBestAnswer(questionId);
      if (answer === ethers.ZeroHash) {
        return null; // No answers yet
      }
      return answer !== ethers.ZeroHash.replace('0x00', '0x01');
    } catch (error) {
      botLogger.error(`Failed to get best answer for ${questionId}`, error);
      return null;
    }
  }

  /**
   * Calculate the bond required to submit a specific answer
   */
  async getBondForAnswer(questionId: string, answer: boolean): Promise<bigint> {
    try {
      const answerBytes = answer ? ethers.ZeroHash.replace('0x00', '0x01') : ethers.ZeroHash;
      return await this.contract.getBondForAnswer(questionId, answerBytes);
    } catch (error) {
      botLogger.error(`Failed to get bond for answer on ${questionId}`, error);
      return 0n;
    }
  }

  /**
   * Check if a question is ready for finalization
   */
  async canFinalize(questionId: string): Promise<boolean> {
    try {
      const question = await this.getQuestion(questionId);
      if (!question) return false;

      const now = Math.floor(Date.now() / 1000);
      const finalizeTime = Number(question.finalize_ts);

      return finalizeTime > 0 && now >= finalizeTime && !question.is_pending_arbitration;
    } catch (error) {
      botLogger.error(`Failed to check finalization eligibility for ${questionId}`, error);
      return false;
    }
  }

  /**
   * Get question timeout timestamp
   */
  async getQuestionTimeout(questionId: string): Promise<Date | null> {
    try {
      const question = await this.getQuestion(questionId);
      if (!question) return null;

      const timeoutTimestamp = Number(question.opening_ts) + Number(question.timeout);
      return new Date(timeoutTimestamp * 1000);
    } catch (error) {
      botLogger.error(`Failed to get timeout for ${questionId}`, error);
      return null;
    }
  }

  /**
   * Get answer events for a question
   */
  async getAnswerHistory(questionId: string): Promise<AnswerEvent[]> {
    try {
      const filter = this.contract.filters.LogNewAnswer(questionId);
      const events = await this.contract.queryFilter(filter);

      return events.map(event => ({
        answer: event.args.answer !== ethers.ZeroHash.replace('0x00', '0x01'),
        user: event.args.user,
        bond: event.args.bond,
        ts: Number(event.args.ts),
        is_commitment: event.args.is_commitment
      }));

    } catch (error) {
      botLogger.error(`Failed to get answer history for ${questionId}`, error);
      return [];
    }
  }

  private async getOptimalGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      
      // Use EIP-1559 if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        return feeData.maxFeePerGas;
      }

      // Fallback to legacy gas price with small premium
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      return gasPrice * BigInt(110) / BigInt(100); // 10% premium
      
    } catch (error) {
      botLogger.error('Failed to get optimal gas price', error);
      return ethers.parseUnits('20', 'gwei'); // Conservative fallback
    }
  }
}