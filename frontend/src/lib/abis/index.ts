/**
 * ABI Module - Public exports
 *
 * Provides access to:
 * - Contract ABIs from v1-core
 * - TypeScript type definitions
 * - Event parsing utilities
 * - Contract service helpers
 */

// Export all types and ABIs
export * from './types';

// Export contract service
export { ContractService, contractService } from './contracts';

// Re-export commonly used types for convenience
export type {
  SpecStruct,
  CommitmentStruct,
  IncentiveStruct,
  LogCommitSpecEvent,
  LogRevealSpecEvent,
  LogProposeSpecEvent,
  QuestionCreatedEvent,
  CommitResult,
  RevealResult,
  ProposeResult,
  KaiSignContract,
} from './types';

// Re-export ABIs for direct access
export {
  KAISIGN_ABI,
  KAIARBITRATION_ABI,
  KAITOKEN_ABI,
} from './types';

// Re-export enums
export {
  SpecStatus,
  CommitmentStatus,
  IncentiveStatus,
} from './types';
