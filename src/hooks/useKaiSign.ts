'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { KaiSignGraphClient, type ContractMetadata, type FunctionMetadata, type SpecHistory } from '~/lib/graphClient';

export interface UseKaiSignOptions {
  /** Graph endpoint URL */
  graphEndpoint: string;
  /** Chain ID to query */
  chainID: string;
  /** Enable automatic refetching */
  autoRefetch?: boolean;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
}

export interface UseKaiSignReturn {
  /** Graph client instance */
  client: KaiSignGraphClient;
  /** Loading states */
  loading: {
    contracts: boolean;
    functions: boolean;
    metadata: boolean;
  };
  /** Error states */
  error: string | null;
  /** All contracts with metadata */
  contracts: ContractMetadata[];
  /** Functions for selected contract */
  functions: FunctionMetadata[];
  /** Current contract metadata */
  currentContract: ContractMetadata | null;
  /** Spec history for current contract */
  specHistory: SpecHistory[];
  /** Actions */
  actions: {
    loadContracts: () => Promise<void>;
    loadFunctions: (contractAddress: string) => Promise<void>;
    getTransactionMetadata: (contractAddress: string, selector: string) => Promise<FunctionMetadata | null>;
    getSpecHistory: (contractAddress: string) => Promise<void>;
    searchContracts: (searchTerm: string) => Promise<ContractMetadata[]>;
    setCurrentContract: (contract: ContractMetadata | null) => void;
  };
}

/**
 * React hook for easy integration with KaiSign metadata
 */
export function useKaiSign({
  graphEndpoint,
  chainID,
  autoRefetch = false,
  refetchInterval = 30000
}: UseKaiSignOptions): UseKaiSignReturn {
  // Client instance (memoized)
  const client = useMemo(() => new KaiSignGraphClient(graphEndpoint), [graphEndpoint]);

  // State
  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [functions, setFunctions] = useState<FunctionMetadata[]>([]);
  const [currentContract, setCurrentContract] = useState<ContractMetadata | null>(null);
  const [specHistory, setSpecHistory] = useState<SpecHistory[]>([]);
  
  // Loading states
  const [contractsLoading, setContractsLoading] = useState(false);
  const [functionsLoading, setFunctionsLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load contracts
  const loadContracts = useCallback(async () => {
    setContractsLoading(true);
    setError(null);
    
    try {
      const result = await client.getContractsWithMetadata(chainID);
      setContracts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setContractsLoading(false);
    }
  }, [client, chainID]);

  // Load functions for a contract
  const loadFunctions = useCallback(async (contractAddress: string) => {
    setFunctionsLoading(true);
    setError(null);
    
    try {
      const result = await client.getContractFunctions(contractAddress, chainID);
      setFunctions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load functions');
      setFunctions([]);
    } finally {
      setFunctionsLoading(false);
    }
  }, [client, chainID]);

  // Get transaction metadata with retry logic for slow server startup
  const getTransactionMetadata = useCallback(async (
    contractAddress: string, 
    selector: string
  ): Promise<FunctionMetadata | null> => {
    setMetadataLoading(true);
    setError(null);
    
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await client.getTransactionMetadata(contractAddress, selector, chainID);
        setMetadataLoading(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        
        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    setError(lastError ? lastError.message : 'Failed to get transaction metadata after multiple attempts');
    setMetadataLoading(false);
    return null;
  }, [client, chainID]);

  // Get spec history
  const getSpecHistory = useCallback(async (contractAddress: string) => {
    setError(null);
    
    try {
      const result = await client.getContractSpecHistory(contractAddress, chainID);
      setSpecHistory(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spec history');
      setSpecHistory([]);
    }
  }, [client, chainID]);

  // Search contracts
  const searchContracts = useCallback(async (searchTerm: string): Promise<ContractMetadata[]> => {
    setError(null);
    
    try {
      return await client.searchContracts(searchTerm, chainID);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search contracts');
      return [];
    }
  }, [client, chainID]);

  // Auto-load contracts on mount or chainID change
  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // Auto-refetch if enabled
  useEffect(() => {
    if (!autoRefetch) return;
    
    const interval = setInterval(() => {
      if (!contractsLoading) {
        loadContracts();
      }
    }, refetchInterval);
    
    return () => clearInterval(interval);
  }, [autoRefetch, refetchInterval, contractsLoading, loadContracts]);

  // Load functions when current contract changes
  useEffect(() => {
    if (currentContract) {
      loadFunctions(currentContract.address);
      getSpecHistory(currentContract.address);
    } else {
      setFunctions([]);
      setSpecHistory([]);
    }
  }, [currentContract, loadFunctions, getSpecHistory]);

  return {
    client,
    loading: {
      contracts: contractsLoading,
      functions: functionsLoading,
      metadata: metadataLoading
    },
    error,
    contracts,
    functions,
    currentContract,
    specHistory,
    actions: {
      loadContracts,
      loadFunctions,
      getTransactionMetadata,
      getSpecHistory,
      searchContracts,
      setCurrentContract
    }
  };
}

/**
 * Hook for transaction preview functionality
 */
export function useTransactionPreview(
  graphEndpoint: string,
  chainID: string
) {
  const client = useMemo(() => new KaiSignGraphClient(graphEndpoint), [graphEndpoint]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTransaction = useCallback(async (
    contractAddress: string,
    data: string
  ): Promise<{
    metadata: FunctionMetadata | null;
    selector: string;
    isRecognized: boolean;
  }> => {
    setLoading(true);
    setError(null);

    try {
      if (data.length < 10) {
        throw new Error('Invalid transaction data');
      }

      const selector = data.slice(0, 10);
      
      // Retry logic for slow server startup
      const maxRetries = 3;
      let metadata: FunctionMetadata | null = null;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          metadata = await client.getTransactionMetadata(contractAddress, selector, chainID);
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error');
          
          // If not the last attempt, wait before retrying
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      return {
        metadata,
        selector,
        isRecognized: metadata !== null
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview transaction');
      return {
        metadata: null,
        selector: data.slice(0, 10),
        isRecognized: false
      };
    } finally {
      setLoading(false);
    }
  }, [client, chainID]);

  return {
    previewTransaction,
    loading,
    error
  };
}

export default useKaiSign;
