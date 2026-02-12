/**
 * ContractService - Event parsing and contract interaction utilities
 *
 * Implements patterns from scripts/autonomous-submitter.js:
 * - Event parsing from transaction receipts
 * - Retry logic for flaky RPC calls
 * - Error handling and decoding
 */

import { ethers } from 'ethers';
import {
  type LogCommitSpecEvent,
  type LogRevealSpecEvent,
  type LogProposeSpecEvent,
  type QuestionCreatedEvent,
  parseContractError,
} from './types';

export class ContractService {
  private static instance: ContractService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ContractService {
    if (!ContractService.instance) {
      ContractService.instance = new ContractService();
    }
    return ContractService.instance;
  }

  /**
   * Parse events from transaction receipt
   *
   * Pattern from autonomous-submitter.js lines 524-533:
   * Iterates through receipt logs and parses events matching the given name
   *
   * @param receipt - Transaction receipt with logs
   * @param contract - Contract instance with ABI interface
   * @param eventName - Name of event to parse (e.g., 'LogCommitSpec')
   * @returns Array of parsed events (empty if none found)
   */
  parseTransactionEvents(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract,
    eventName: string
  ): ethers.LogDescription[] {
    const events: ethers.LogDescription[] = [];

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed && parsed.name === eventName) {
          events.push(parsed);
        }
      } catch {
        // Log belongs to different contract or invalid format
        continue;
      }
    }

    return events;
  }

  /**
   * Extract LogCommitSpec event from transaction receipt
   *
   * @param receipt - Transaction receipt
   * @param contract - KaiSign contract instance
   * @returns Parsed event data
   * @throws Error if event not found
   */
  parseLogCommitSpec(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract
  ): LogCommitSpecEvent {
    const events = this.parseTransactionEvents(receipt, contract, 'LogCommitSpec');

    if (events.length === 0) {
      throw new Error('LogCommitSpec event not found in transaction receipt');
    }

    const event = events[0];
    if (!event) {
      throw new Error('LogCommitSpec event is undefined');
    }

    return {
      committer: event.args.committer || event.args[0],
      commitmentId: event.args.commitmentId || event.args[1],
      chainId: event.args.chainId || event.args[2],
      extcodehash: event.args.extcodehash || event.args[3],
      revealDeadline: event.args.revealDeadline,
    };
  }

  /**
   * Extract LogRevealSpec event from transaction receipt
   *
   * CRITICAL: The specID MUST be extracted from this event, not calculated!
   * Pattern from autonomous-submitter.js lines 576-586
   *
   * @param receipt - Transaction receipt
   * @param contract - KaiSign contract instance
   * @returns Parsed event data with specID
   * @throws Error if event not found
   */
  parseLogRevealSpec(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract
  ): LogRevealSpecEvent {
    const events = this.parseTransactionEvents(receipt, contract, 'LogRevealSpec');

    if (events.length === 0) {
      throw new Error('LogRevealSpec event not found in transaction receipt');
    }

    const event = events[0];
    if (!event) {
      throw new Error('LogRevealSpec event is undefined');
    }

    // Handle both 'uid' (old naming) and 'specID' (new naming)
    const specID = event.args.specID || event.args.uid || event.args[1];

    return {
      creator: event.args.creator || event.args[0],
      specID,
      blobHash: event.args.blobHash || event.args[2],
      commitmentId: event.args.commitmentId || event.args[3],
      chainId: event.args.chainId || event.args[4],
      extcodehash: event.args.extcodehash || event.args[5],
    };
  }

  /**
   * Extract LogProposeSpec event from transaction receipt
   *
   * @param receipt - Transaction receipt
   * @param contract - KaiSign contract instance
   * @returns Parsed event data with votingID
   * @throws Error if event not found
   */
  parseLogProposeSpec(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract
  ): LogProposeSpecEvent {
    const events = this.parseTransactionEvents(receipt, contract, 'LogProposeSpec');

    if (events.length === 0) {
      throw new Error('LogProposeSpec event not found in transaction receipt');
    }

    const event = events[0];
    if (!event) {
      throw new Error('LogProposeSpec event is undefined');
    }

    return {
      specID: event.args.specID || event.args[0],
      votingID: event.args.votingID || event.args.questionId || event.args[1],
      bond: event.args.bond || event.args[2],
      user: event.args.user,
    };
  }

  /**
   * Extract QuestionCreated event from transaction receipt
   *
   * Pattern from autonomous-submitter.js lines 584-586
   *
   * @param receipt - Transaction receipt
   * @param contract - KaiSign contract instance
   * @returns Parsed event data
   * @throws Error if event not found
   */
  parseQuestionCreated(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract
  ): QuestionCreatedEvent {
    const events = this.parseTransactionEvents(receipt, contract, 'QuestionCreated');

    if (events.length === 0) {
      throw new Error('QuestionCreated event not found in transaction receipt');
    }

    const event = events[0];
    if (!event) {
      throw new Error('QuestionCreated event is undefined');
    }

    return {
      specID: event.args.specID || event.args.uid || event.args[0],
      questionId: event.args.questionId || event.args[1],
      bond: event.args.bond || event.args[2],
    };
  }

  /**
   * Execute operation with retry logic for network errors
   *
   * Handles transient RPC failures (NETWORK_ERROR, TIMEOUT, etc.)
   * Pattern from autonomous-submitter.js (implicit in multiple retries)
   *
   * @param operation - Async operation to execute
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param retryDelay - Base delay between retries in ms (default: 1000)
   * @returns Result of operation
   * @throws Error if all retries fail
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        // On last attempt, throw error
        if (attempt === maxRetries) {
          throw new Error(`Operation failed after ${maxRetries} attempts: ${parseContractError(error)}`);
        }

        // Check if error is retryable
        const isRetryable =
          error?.code === 'NETWORK_ERROR' ||
          error?.code === 'TIMEOUT' ||
          error?.code === 'SERVER_ERROR' ||
          error?.code === 'UNKNOWN_ERROR' ||
          error?.message?.includes('timeout') ||
          error?.message?.includes('network') ||
          error?.message?.includes('connection');

        if (!isRetryable) {
          // Non-retryable error (contract revert, invalid params, etc.)
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const delay = retryDelay * attempt;
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // TypeScript requires this, but it's unreachable
    throw new Error('Max retries exceeded');
  }

  /**
   * Wait for transaction receipt with retry logic
   *
   * @param tx - Transaction response
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @param timeout - Timeout in ms (default: 120000 = 2 minutes)
   * @returns Transaction receipt
   */
  async waitForTransaction(
    tx: ethers.TransactionResponse,
    confirmations: number = 1,
    timeout: number = 120000
  ): Promise<ethers.TransactionReceipt> {
    return this.executeWithRetry(
      async () => {
        const receipt = await tx.wait(confirmations, timeout);
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }
        return receipt;
      },
      3,
      2000
    );
  }

  /**
   * Parse all events from a transaction receipt
   *
   * Useful for debugging and comprehensive event analysis
   *
   * @param receipt - Transaction receipt
   * @param contract - Contract instance
   * @returns Map of event names to parsed events
   */
  parseAllEvents(
    receipt: ethers.TransactionReceipt,
    contract: ethers.Contract
  ): Map<string, ethers.LogDescription[]> {
    const eventMap = new Map<string, ethers.LogDescription[]>();

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed) {
          const existing = eventMap.get(parsed.name) || [];
          existing.push(parsed);
          eventMap.set(parsed.name, existing);
        }
      } catch {
        // Log belongs to different contract
        continue;
      }
    }

    return eventMap;
  }

  /**
   * Estimate gas with buffer for safety
   *
   * @param operation - Contract call to estimate
   * @param bufferPercent - Buffer percentage (default: 20%)
   * @returns Estimated gas with buffer
   */
  async estimateGasWithBuffer(
    operation: () => Promise<bigint>,
    bufferPercent: number = 20
  ): Promise<bigint> {
    const estimated = await this.executeWithRetry(operation);
    const buffer = (estimated * BigInt(bufferPercent)) / 100n;
    return estimated + buffer;
  }
}

/**
 * Export singleton instance for convenience
 */
export const contractService = ContractService.getInstance();
