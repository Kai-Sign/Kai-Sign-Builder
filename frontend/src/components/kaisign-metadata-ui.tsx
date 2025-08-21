/**
 * KaiSign Contract Metadata Modal
 * A reusable React component that developers can import and use to display contract metadata
 */

"use client";

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Copy, Check, Loader2, AlertCircle } from 'lucide-react';

// Types for the component
export interface ContractMetadata {
  success: boolean;
  contractAddress: string;
  chainId: number;
  metadata: {
    address: string;
    chainId: number;
    functions?: any;
    recognized?: boolean;
    ipfs?: any;
    erc7730?: any;
  };
  sources: {
    graph: boolean;
    ipfs: boolean;
  };
  timestamp: string;
}

export interface KaiSignModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Contract address to fetch metadata for */
  contractAddress: string;
  /** Chain ID where the contract is deployed */
  chainId: number;
  /** Optional API endpoint override */
  apiEndpoint?: string;
  /** Optional styling overrides */
  className?: string;
  /** Optional theme */
  theme?: 'light' | 'dark';
}

/**
 * KaiSign Contract Metadata Modal Component
 * 
 * @example
 * ```tsx
 * import { KaiSignModal } from 'kaisign-metadata-ui';
 * 
 * function MyApp() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   
 *   return (
 *     <div>
 *       <button onClick={() => setIsOpen(true)}>
 *         View Contract Metadata
 *       </button>
 *       
 *       <KaiSignModal
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         contractAddress="0x123..."
 *         chainId={1}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function KaiSignModal({
  isOpen,
  onClose,
  contractAddress,
  chainId,
  apiEndpoint = '/api/contract-metadata',
  className = '',
  theme = 'dark'
}: KaiSignModalProps) {
  const [metadata, setMetadata] = useState<ContractMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch metadata when modal opens
  useEffect(() => {
    if (isOpen && contractAddress && chainId) {
      fetchMetadata();
    }
  }, [isOpen, contractAddress, chainId]);

  const fetchMetadata = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiEndpoint}?address=${contractAddress}&chainId=${chainId}`);
      const data = await response.json();
      
      if (data.success) {
        setMetadata(data);
      } else {
        setError(data.message || 'Failed to fetch metadata');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getChainName = (chainId: number): string => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      10: 'Optimism',
      42161: 'Arbitrum',
      8453: 'Base',
      11155111: 'Sepolia'
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  const themeClasses = theme === 'dark' 
    ? 'bg-gray-900 text-white border-gray-700' 
    : 'bg-white text-gray-900 border-gray-300';

  const buttonClasses = theme === 'dark'
    ? 'bg-gray-800 hover:bg-gray-700 border-gray-600'
    : 'bg-gray-100 hover:bg-gray-200 border-gray-300';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg border p-6 shadow-xl ${themeClasses} ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Contract Metadata</h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${buttonClasses}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin mr-2" size={24} />
            <span>Fetching metadata...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertCircle className="mr-2 text-red-400" size={20} />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Empty State (no error, no loading, no data) */}
        {!loading && !error && !metadata && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-3 text-gray-400" size={24} />
            <span className="text-gray-400 mb-4">No metadata loaded yet. Click retry to fetch.</span>
            <button
              onClick={fetchMetadata}
              className={`px-4 py-2 rounded border ${buttonClasses}`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {metadata && !loading && !error && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className={`p-4 rounded-lg border ${buttonClasses}`}>
              <h3 className="font-semibold mb-2">Contract Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Address:</span>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-gray-800 rounded text-blue-400">
                      {contractAddress}
                    </code>
                    <button
                      onClick={() => copyToClipboard(contractAddress)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span>{getChainName(chainId)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status:</span>
                  <div className="flex gap-2">
                    {metadata.sources.graph && (
                      <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">
                        Graph ✓
                      </span>
                    )}
                    {metadata.sources.ipfs && (
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                        IPFS ✓
                      </span>
                    )}
                    {metadata.metadata.recognized && (
                      <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-xs">
                        Recognized ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ERC7730 Metadata */}
            {metadata.metadata.erc7730 && (
              <div className={`p-4 rounded-lg border ${buttonClasses}`}>
                <h3 className="font-semibold mb-2">ERC7730 Metadata</h3>
                <div className="space-y-2 text-sm">
                  {metadata.metadata.erc7730.owner && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Owner:</span>
                      <span>{metadata.metadata.erc7730.owner}</span>
                    </div>
                  )}
                  {metadata.metadata.erc7730.info?.legalName && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Legal Name:</span>
                      <span>{metadata.metadata.erc7730.info.legalName}</span>
                    </div>
                  )}
                  {metadata.metadata.erc7730.info?.url && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">URL:</span>
                      <a 
                        href={metadata.metadata.erc7730.info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {metadata.metadata.erc7730.info.url}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Functions Info */}
            {metadata.metadata.functions && (
              <div className={`p-4 rounded-lg border ${buttonClasses}`}>
                <h3 className="font-semibold mb-2">Available Functions</h3>
                <div className="text-sm">
                  <code className="block p-2 bg-gray-800 rounded text-xs overflow-x-auto">
                    {JSON.stringify(metadata.metadata.functions, null, 2)}
                  </code>
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <details className={`p-4 rounded-lg border ${buttonClasses}`}>
              <summary className="font-semibold cursor-pointer">Raw JSON Data</summary>
              <div className="mt-2">
                <code className="block p-2 bg-gray-800 rounded text-xs overflow-x-auto max-h-40">
                  {JSON.stringify(metadata, null, 2)}
                </code>
              </div>
            </details>

            {/* Footer */}
            <div className="text-xs text-gray-500 text-center">
              Last updated: {new Date(metadata.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple hook for fetching contract metadata
 * 
 * @example
 * ```tsx
 * import { useContractMetadata } from 'kaisign-metadata-ui';
 * 
 * function MyComponent() {
 *   const { data, loading, error } = useContractMetadata({
 *     contractAddress: '0x123...',
 *     chainId: 1
 *   });
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   
 *   return <div>Contract: {data?.contractAddress}</div>;
 * }
 * ```
 */
export function useContractMetadata({
  contractAddress,
  chainId,
  apiEndpoint = '/api/contract-metadata'
}: {
  contractAddress: string;
  chainId: number;
  apiEndpoint?: string;
}) {
  const [data, setData] = useState<ContractMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractAddress || !chainId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${apiEndpoint}?address=${contractAddress}&chainId=${chainId}`);
        const result = await response.json();
        
        if (result.success) {
          setData(result);
        } else {
          setError(result.message || 'Failed to fetch metadata');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractAddress, chainId, apiEndpoint]);

  return { data, loading, error };
}

// Export types for external use
export type { ContractMetadata as KaiSignContractMetadata };
