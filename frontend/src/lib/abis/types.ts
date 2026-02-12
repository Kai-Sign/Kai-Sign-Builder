/**
 * TypeScript type definitions for v1-core contracts
 *
 * These types match the Solidity structs and events from:
 * - KaiSign.sol (v2.0.0)
 * - KAIArbitration.sol
 * - KAIToken.sol
 */

import { ethers } from 'ethers';

// Import ABIs from generated files
import KaiSignABI from './generated/KaiSign.json';
import KAIArbitrationABI from './generated/KAIArbitration.json';
import KAITokenABI from './generated/KAIToken.json';

// Export ABIs
export const KAISIGN_ABI = KaiSignABI.abi;
export const KAIARBITRATION_ABI = KAIArbitrationABI.abi;
export const KAITOKEN_ABI = KAITokenABI.abi;

// Spec Status Enum (matches Solidity)
export enum SpecStatus {
  Committed = 0,
  Submitted = 1,
  Proposed = 2,
  Finalized = 3,
  Cancelled = 4
}

// Commitment Status Enum
export enum CommitmentStatus {
  Active = 0,
  Revealed = 1,
  Expired = 2
}

// Incentive Status Enum
export enum IncentiveStatus {
  Active = 0,
  Reserved = 1,
  Completed = 2,
  Expired = 3
}

/**
 * SpecStruct - Matches KaiSign.sol struct
 * Updated for v2.0.0 with votingID field
 */
export interface SpecStruct {
  createdTimestamp: bigint;
  proposedTimestamp: bigint;
  status: SpecStatus;
  totalBonds: bigint;
  creator: string;  // address
  targetContract: string;  // address (but stored as bytes32 extcodehash in v2.0.0)
  blobHash: string;  // bytes32
  votingID: string;  // bytes32 (NEW in v2.0.0 - replaces questionId)
  incentiveId: string;  // bytes32
  chainId: bigint;
}

/**
 * CommitmentStruct - Matches KaiSign.sol struct
 */
export interface CommitmentStruct {
  committer: string;  // address
  timestamp: bigint;
  revealDeadline: bigint;
  targetContract: string;  // address (extcodehash in v2.0.0)
  chainId: bigint;
  status: CommitmentStatus;
}

/**
 * IncentiveStruct - Matches KaiSign.sol struct
 */
export interface IncentiveStruct {
  creator: string;  // address
  amount: bigint;
  reserved: bigint;
  deadline: bigint;  // uint64
  createdAt: bigint;  // uint64
  targetContract: string;  // address (extcodehash in v2.0.0)
  specID: string;  // bytes32
  description: string;
  chainId: bigint;
  status: IncentiveStatus;
}

/**
 * Event Types - Extracted from transaction receipts
 */

export interface LogCommitSpecEvent {
  committer: string;  // indexed
  commitmentId: string;  // indexed - bytes32
  chainId: bigint;
  extcodehash: string;  // bytes32 (v2.0.0 uses extcodehash instead of address)
  revealDeadline?: bigint;  // May be included in some versions
}

export interface LogRevealSpecEvent {
  creator: string;  // indexed
  specID: string;  // indexed - bytes32 (formerly 'uid')
  blobHash: string;  // indexed - bytes32
  commitmentId: string;  // bytes32
  chainId: bigint;
  extcodehash: string;  // bytes32
}

export interface LogProposeSpecEvent {
  specID: string;  // indexed - bytes32
  votingID: string;  // indexed - bytes32 (NEW in v2.0.0 - replaces questionId)
  bond: bigint;
  user?: string;  // May be included in some versions
}

export interface LogFinalizeSpecEvent {
  specID: string;  // indexed - bytes32
  accepted: boolean;
  finalizer: string;  // address
}

export interface QuestionCreatedEvent {
  specID: string;  // indexed - bytes32 (formerly 'uid')
  questionId: string;  // indexed - bytes32
  bond: bigint;
}

/**
 * Transaction Result Types - Returned from web3Service methods
 */

export interface CommitResult {
  commitmentId: string;  // bytes32
  revealDeadline: number;  // Unix timestamp
  txHash: string;
  blockNumber?: number;
}

export interface RevealResult {
  specID: string;  // bytes32 - MUST be extracted from LogRevealSpec event
  txHash: string;
  blockNumber?: number;
}

export interface ProposeResult {
  votingID: string;  // bytes32 - MUST be extracted from LogProposeSpec event
  txHash: string;
  blockNumber?: number;
}

/**
 * Contract Typed Interfaces
 *
 * Note: KaiSignContract is defined as a type alias rather than an interface
 * to avoid conflicts with ethers.Contract's index signature
 */

export type KaiSignContract = ethers.Contract;

/**
 * Custom Error Types
 */

export class ContractError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly data?: any
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

/**
 * Error Signature Mapping
 * Maps Solidity error signatures to user-friendly messages
 * TODO: Update with actual error selectors from contract
 */
export const ERROR_SIGNATURES: Record<string, string> = {
  // Placeholder - replace with actual error selectors when available
  // Example: '0x12345678': 'Commitment has expired',
};

/**
 * Helper function to parse contract errors
 */
export function parseContractError(error: any): string {
  if (error?.data) {
    const errorSig = error.data.slice(0, 10);
    return ERROR_SIGNATURES[errorSig] || error.message || 'Unknown contract error';
  }

  if (error?.message) {
    // Extract revert reason from error message
    const revertMatch = error.message.match(/reverted with reason string '(.+?)'/);
    if (revertMatch) {
      return revertMatch[1];
    }

    return error.message;
  }

  return 'Unknown error occurred';
}
