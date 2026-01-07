/**
 * React hook for transaction decoding
 * Provides lazy-loaded decoder with state management
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  TransactionInput,
  DecodedTransaction,
  RecursiveDecodeResult,
} from '~/lib/decoder/types';

interface DecoderState {
  isLoading: boolean;
  error: string | null;
}

interface UseTransactionDecoderReturn {
  /**
   * Decode a full transaction (raw calldata, RLP, or parsed)
   */
  decodeTransaction: (input: TransactionInput) => Promise<DecodedTransaction>;

  /**
   * Decode raw calldata with recursive nested call analysis
   */
  decodeCalldata: (
    data: string,
    contractAddress: string,
    chainId: number
  ) => Promise<RecursiveDecodeResult>;

  /**
   * Detect input type (json, rlp, calldata)
   */
  detectInputType: (input: string) => 'json' | 'rlp' | 'calldata' | null;

  /**
   * Current loading state
   */
  isLoading: boolean;

  /**
   * Current error (if any)
   */
  error: string | null;

  /**
   * Clear error state
   */
  clearError: () => void;
}

type Decoder = {
  decodeTransaction: (input: TransactionInput) => Promise<DecodedTransaction>;
  decodeCalldata: (data: string, contractAddress: string, chainId: number) => Promise<RecursiveDecodeResult>;
  detectInputType: (input: string) => 'json' | 'rlp' | 'calldata' | null;
};

/**
 * Hook for using the transaction decoder
 */
export function useTransactionDecoder(): UseTransactionDecoderReturn {
  const [state, setState] = useState<DecoderState>({
    isLoading: false,
    error: null,
  });

  const decoderRef = useRef<Decoder | null>(null);

  /**
   * Lazy-load the decoder module
   */
  const getDecoder = useCallback(async (): Promise<Decoder> => {
    if (decoderRef.current) {
      return decoderRef.current;
    }

    // Dynamic import for code splitting
    const { createDecoder } = await import('~/lib/decoder');
    decoderRef.current = createDecoder();
    return decoderRef.current;
  }, []);

  /**
   * Decode a full transaction
   */
  const decodeTransaction = useCallback(
    async (input: TransactionInput): Promise<DecodedTransaction> => {
      setState({ isLoading: true, error: null });

      try {
        const decoder = await getDecoder();
        const result = await decoder.decodeTransaction(input);
        setState({ isLoading: false, error: null });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to decode transaction';
        setState({ isLoading: false, error: errorMessage });
        return {
          success: false,
          txType: 'unknown',
          chainId: 'chainId' in input ? input.chainId || 1 : 1,
          intent: 'Decode failed',
          error: errorMessage,
        };
      }
    },
    [getDecoder]
  );

  /**
   * Decode raw calldata
   */
  const decodeCalldata = useCallback(
    async (
      data: string,
      contractAddress: string,
      chainId: number
    ): Promise<RecursiveDecodeResult> => {
      setState({ isLoading: true, error: null });

      try {
        const decoder = await getDecoder();
        const result = await decoder.decodeCalldata(data, contractAddress, chainId);
        setState({ isLoading: false, error: null });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to decode calldata';
        setState({ isLoading: false, error: errorMessage });
        return {
          success: false,
          selector: '0x',
          params: {},
          formatted: {},
          intent: 'Decode failed',
          error: errorMessage,
          depth: 0,
        };
      }
    },
    [getDecoder]
  );

  /**
   * Detect input type
   */
  const detectInputType = useCallback(
    (input: string): 'json' | 'rlp' | 'calldata' | null => {
      // This is synchronous, so we can call it directly
      const trimmed = input.trim();

      // Try JSON first
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(trimmed);
          return 'json';
        } catch {
          // Not valid JSON
        }
      }

      // Check for hex
      if (trimmed.startsWith('0x')) {
        const firstByte = parseInt(trimmed.slice(2, 4), 16);

        // Type 1, 2, 4 transactions
        if (firstByte === 0x01 || firstByte === 0x02 || firstByte === 0x04) {
          return 'rlp';
        }

        // RLP long list prefix (legacy tx)
        if (firstByte >= 0xf8) {
          return 'rlp';
        }

        // Otherwise assume raw calldata
        if (trimmed.length >= 10) {
          return 'calldata';
        }
      }

      return null;
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    decodeTransaction,
    decodeCalldata,
    detectInputType,
    isLoading: state.isLoading,
    error: state.error,
    clearError,
  };
}
