/**
 * KaiSign Decoder - Main entry point
 * Exports all decoder functionality for raw bytecode and transaction decoding
 */

// Types
export * from './types';

// Utilities
export { keccak256, keccak256Bytes, calculateSelector, extractSelector } from './utils/keccak';
export { AbiDecoder, decodeAbiParameters } from './utils/abiDecoder';
export {
  formatTokenAmount,
  formatEther,
  formatAddress,
  formatValue,
  toTitleCase,
  camelToTitle,
  hexToString,
  hexToUtf8,
  isValidAddress,
  looksLikeCalldata,
  decodeAbiString,
  truncateHex,
} from './utils/formatters';

// Metadata Service
export {
  MetadataService,
  getMetadataService,
  resolveJsonPath,
  resolveFieldPath,
} from './metadataService';

// Core Decoder
export {
  CalldataDecoder,
  getCalldataDecoder,
  decodeCalldata,
} from './decode';

// Advanced Decoder
export {
  AdvancedTransactionDecoder,
  getAdvancedDecoder,
  decodeTransaction,
} from './advancedDecoder';

// RLP Decoder
export {
  decodeRlpTransaction,
  detectTransactionType,
  detectInputType,
} from './rlpDecoder';

// Recursive Decoder
export {
  RecursiveCalldataDecoder,
  getRecursiveDecoder,
  decodeCalldataRecursive,
} from './recursiveDecoder';

// Format Conversion (backward compatibility)
export {
  convertToLegacyFormat,
  hasValidDecodedData,
  type LegacyDecodedTransaction,
  type LegacyParam,
} from './formatConversion';

// Convenience factory function
import type { TransactionInput, DecodedTransaction, DecodedCall, RecursiveDecodeResult } from './types';
import { getAdvancedDecoder } from './advancedDecoder';
import { getRecursiveDecoder } from './recursiveDecoder';
import { detectInputType } from './rlpDecoder';

/**
 * Create a configured decoder instance
 */
export function createDecoder(options?: { maxDepth?: number; maxBytecodeNesting?: number }) {
  const advancedDecoder = getAdvancedDecoder(options);
  const recursiveDecoder = getRecursiveDecoder({ maxDepth: options?.maxDepth });

  return {
    /**
     * Decode a full transaction (supports raw calldata, RLP, or parsed)
     */
    decodeTransaction: (input: TransactionInput): Promise<DecodedTransaction> => {
      return advancedDecoder.decodeTransaction(input);
    },

    /**
     * Decode raw calldata with recursive nested call analysis
     */
    decodeCalldata: (
      data: string,
      contractAddress: string,
      chainId: number
    ): Promise<RecursiveDecodeResult> => {
      return recursiveDecoder.decode(data, contractAddress, chainId);
    },

    /**
     * Detect input type (json, rlp, calldata)
     */
    detectInputType: (input: string): 'json' | 'rlp' | 'calldata' | null => {
      return detectInputType(input);
    },
  };
}
