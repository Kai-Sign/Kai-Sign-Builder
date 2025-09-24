'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BlobTrackingData {
  transactionHash: string;
  deploymentAddress: string;
  blobHash: string;
  chainId: number;
  rpcUrl: string;
}

interface BlobTrackerProps {
  trackingData: BlobTrackingData;
  onConfirmed?: (receipt: ethers.TransactionReceipt) => void;
  onFailed?: (error: string) => void;
}

interface PollingStatus {
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'TIMEOUT';
  attempts: number;
  blockNumber?: number;
  gasUsed?: string;
  blobGasUsed?: string;
  error?: string;
  receipt?: ethers.TransactionReceipt;
}

export default function BlobTracker({ trackingData, onConfirmed, onFailed }: BlobTrackerProps) {
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>({
    status: 'PENDING',
    attempts: 0
  });
  const [isPolling, setIsPolling] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Track time elapsed
  useEffect(() => {
    if (!isPolling) return;
    
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPolling]);

  const startPolling = async () => {
    setIsPolling(true);
    setTimeElapsed(0);
    setPollingStatus({ status: 'PENDING', attempts: 0 });

    try {
      const provider = new ethers.JsonRpcProvider(trackingData.rpcUrl);
      const maxAttempts = 120; // 10 minutes (120 * 5 seconds)
      let attempts = 0;

      const pollForConfirmation = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const poll = async () => {
            attempts++;
            
            try {
              const receipt = await provider.getTransactionReceipt(trackingData.transactionHash);
              
              if (receipt) {
                console.log('✅ Blob transaction confirmed!', receipt);
                
                setPollingStatus({
                  status: 'CONFIRMED',
                  attempts,
                  blockNumber: receipt.blockNumber,
                  gasUsed: receipt.gasUsed?.toString(),
                  blobGasUsed: receipt.blobGasUsed?.toString(),
                  receipt
                });
                
                setIsPolling(false);
                onConfirmed?.(receipt);
                resolve();
                return;
              }
              
              // Update attempts counter
              setPollingStatus(prev => ({
                ...prev,
                attempts
              }));
              
              if (attempts >= maxAttempts) {
                const error = 'Transaction not confirmed within timeout period (10 minutes)';
                setPollingStatus({
                  status: 'TIMEOUT',
                  attempts,
                  error
                });
                setIsPolling(false);
                onFailed?.(error);
                reject(new Error(error));
                return;
              }
              
              // Continue polling every 5 seconds
              setTimeout(poll, 5000);
              
            } catch (error) {
              console.error('Error checking transaction:', error);
              
              // Continue polling on RPC errors (they're usually temporary)
              if (attempts < maxAttempts) {
                setTimeout(poll, 5000);
              } else {
                const errorMsg = `Failed to check transaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
                setPollingStatus({
                  status: 'FAILED',
                  attempts,
                  error: errorMsg
                });
                setIsPolling(false);
                onFailed?.(errorMsg);
                reject(new Error(errorMsg));
              }
            }
          };
          
          poll();
        });
      };

      await pollForConfirmation();
      
    } catch (error) {
      console.error('Polling error:', error);
      setIsPolling(false);
    }
  };

  const stopPolling = () => {
    setIsPolling(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (pollingStatus.status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'CONFIRMED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
      case 'TIMEOUT':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (pollingStatus.status) {
      case 'PENDING':
        return 'bg-yellow-500';
      case 'CONFIRMED':
        return 'bg-green-500';
      case 'FAILED':
      case 'TIMEOUT':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-2xl bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {getStatusIcon()}
          Blob Transaction Tracker
        </CardTitle>
        <CardDescription className="text-slate-300">
          Monitor your blob transaction confirmation in real-time
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Transaction Details */}
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400">Deployment Address:</span>
              <div className="font-mono text-xs break-all text-white">
                {trackingData.deploymentAddress}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Blob Hash:</span>
              <div className="font-mono text-xs break-all text-white">
                {trackingData.blobHash}
              </div>
            </div>
          </div>
          
          <div>
            <span className="text-slate-400">Transaction Hash:</span>
            <div className="font-mono text-xs break-all text-white">
              {trackingData.transactionHash}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={`${getStatusColor()} text-white border-0`}
          >
            {pollingStatus.status}
          </Badge>
          
          {pollingStatus.attempts > 0 && (
            <span className="text-sm text-slate-400">
              Attempt {pollingStatus.attempts} • {formatTime(timeElapsed)}
            </span>
          )}
        </div>

        {/* Progress Information */}
        {isPolling && (
          <div className="bg-slate-800 p-3 rounded-lg">
            <div className="text-sm text-slate-300">
              🔄 Checking transaction every 5 seconds...
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Timeout after 10 minutes ({120 - pollingStatus.attempts} attempts remaining)
            </div>
          </div>
        )}

        {/* Success Details */}
        {pollingStatus.status === 'CONFIRMED' && pollingStatus.receipt && (
          <div className="bg-green-900 p-3 rounded-lg border border-green-700">
            <div className="text-green-100 font-medium mb-2">✅ Transaction Confirmed!</div>
            <div className="space-y-1 text-sm text-green-200">
              <div>Block: #{pollingStatus.blockNumber}</div>
              {pollingStatus.gasUsed && (
                <div>Gas Used: {parseInt(pollingStatus.gasUsed).toLocaleString()}</div>
              )}
              {pollingStatus.blobGasUsed && (
                <div>Blob Gas Used: {parseInt(pollingStatus.blobGasUsed).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        {/* Error Details */}
        {(pollingStatus.status === 'FAILED' || pollingStatus.status === 'TIMEOUT') && (
          <div className="bg-red-900 p-3 rounded-lg border border-red-700">
            <div className="text-red-100 font-medium mb-2">❌ Transaction Failed</div>
            <div className="text-sm text-red-200">
              {pollingStatus.error}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isPolling ? (
            <Button 
              onClick={startPolling}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={pollingStatus.status === 'CONFIRMED'}
            >
              {pollingStatus.status === 'CONFIRMED' ? 'Confirmed' : 'Start Tracking'}
            </Button>
          ) : (
            <Button 
              onClick={stopPolling}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900"
            >
              Stop Tracking
            </Button>
          )}
        </div>

        {/* Explorer Links */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-xs border-slate-600 hover:bg-slate-800"
          >
            <a 
              href={`https://sepolia.etherscan.io/tx/${trackingData.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Etherscan
            </a>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-xs border-slate-600 hover:bg-slate-800"
          >
            <a 
              href={`https://sepolia.blobscan.com/blob/${trackingData.blobHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Blobscan
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}