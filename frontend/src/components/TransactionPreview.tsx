'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { KaiSignGraphClient, type FunctionMetadata } from '~/lib/graphClient';

interface TransactionPreviewProps {
  /** The contract address */
  contractAddress: string;
  /** The transaction data (calldata) */
  data: string;
  /** The chain ID */
  chainID: string;
  /** Graph endpoint URL */
  graphEndpoint: string;
  /** Optional value being sent */
  value?: string;
  /** Optional gas limit */
  gasLimit?: string;
  /** Custom CSS classes */
  className?: string;
  /** Whether to show raw transaction data */
  showRawData?: boolean;
}

interface TransactionData {
  selector: string;
  params: string;
}

export function TransactionPreview({
  contractAddress,
  data,
  chainID,
  graphEndpoint,
  value,
  gasLimit,
  className,
  showRawData = false
}: TransactionPreviewProps) {
  const [client] = useState(() => new KaiSignGraphClient(graphEndpoint));
  const [metadata, setMetadata] = useState<FunctionMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);

  useEffect(() => {
    if (contractAddress && data && chainID) {
      analyzeTransaction();
    }
  }, [contractAddress, data, chainID]);

  const analyzeTransaction = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Extract function selector from calldata
      if (data.length < 10) {
        throw new Error('Invalid transaction data');
      }
      
      const selector = data.slice(0, 10); // First 4 bytes (8 hex chars + 0x)
      const params = data.slice(10);
      
      setTransactionData({ selector, params });
      
      // Query metadata for this function
      const result = await client.getTransactionMetadata(contractAddress, selector, chainID);
      setMetadata(result);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze transaction');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatValue = (value: string) => {
    if (!value || value === '0') return null;
    // Simple ETH formatting (you might want to use a proper library like ethers)
    const eth = BigInt(value) / BigInt(10**18);
    return `${eth} ETH`;
  };

  const getExplorerUrl = (address: string) => {
    const explorers = {
      '1': 'https://etherscan.io',
      '11155111': 'https://sepolia.etherscan.io',
      '137': 'https://polygonscan.com',
      // Add more networks as needed
    };
    
    const baseUrl = explorers[chainID as keyof typeof explorers] || 'https://etherscan.io';
    return `${baseUrl}/address/${address}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing transaction...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Transaction Preview</CardTitle>
            <CardDescription>
              To: {formatAddress(contractAddress)}
              <Button variant="ghost" size="sm" asChild className="ml-2 h-auto p-0">
                <a 
                  href={getExplorerUrl(contractAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardDescription>
          </div>
          {metadata && (
            <Badge variant="secondary">
              <CheckCircle className="h-3 w-3 mr-1" />
              Recognized
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : metadata ? (
          <>
            {/* Human-readable description */}
            <div>
              <h3 className="font-medium mb-2">Action</h3>
              <p className="text-sm bg-muted p-3 rounded-lg italic">
                "{metadata.intent}"
              </p>
            </div>
            
            {/* Function details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Function</h4>
                <p className="text-sm text-muted-foreground">{metadata.name}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Selector</h4>
                <p className="text-sm font-mono text-muted-foreground">
                  {transactionData?.selector}
                </p>
              </div>
            </div>
            
            {/* Parameter types */}
            {metadata.parameterTypes.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Parameters</h4>
                <div className="flex flex-wrap gap-1">
                  {metadata.parameterTypes.map((type, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This contract function is not recognized. Transaction will be shown as raw data.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Transaction details */}
        <div className="space-y-2 pt-2 border-t">
          {value && formatValue(value) && (
            <div className="flex justify-between text-sm">
              <span>Value:</span>
              <span className="font-medium">{formatValue(value)}</span>
            </div>
          )}
          
          {gasLimit && (
            <div className="flex justify-between text-sm">
              <span>Gas Limit:</span>
              <span className="font-mono">{gasLimit}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span>Chain ID:</span>
            <span>{chainID}</span>
          </div>
        </div>
        
        {/* Raw data (optional) */}
        {showRawData && (
          <details className="pt-2 border-t">
            <summary className="cursor-pointer text-sm font-medium mb-2">
              Raw Transaction Data
            </summary>
            <div className="space-y-2">
              <div>
                <h5 className="text-xs font-medium mb-1">Call Data:</h5>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {data}
                </p>
              </div>
              {transactionData && (
                <div>
                  <h5 className="text-xs font-medium mb-1">Parameters (hex):</h5>
                  <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {transactionData.params || 'None'}
                  </p>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default TransactionPreview;
