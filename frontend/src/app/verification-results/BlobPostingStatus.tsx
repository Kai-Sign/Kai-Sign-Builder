"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle, Copy, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

export type BlobPostingStage =
  | 'idle'
  | 'preparing'
  | 'submitting'
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'error';

export interface BlobPostingStatusData {
  stage: BlobPostingStage;
  message: string;
  txHash?: string;
  blobHash?: string;
  error?: string;
  startTime?: number;
}

interface BlobPostingStatusProps {
  status: BlobPostingStatusData;
  onRetry?: () => void;
  onCancel?: () => void;
  onComplete?: (blobHash: string) => void;
}

const BLOB_SENDER_ADDRESS = "0x49d81a2f1DC42d230927e224c42E8b8E6A7f6f7D";

const STEPS = [
  { key: 'preparing', label: 'Preparing blob data' },
  { key: 'submitting', label: 'Submitting to service' },
  { key: 'pending', label: 'Transaction pending' },
  { key: 'confirmed', label: 'Transaction confirmed' },
];

function getStepIndex(stage: BlobPostingStage): number {
  switch (stage) {
    case 'preparing': return 0;
    case 'submitting': return 1;
    case 'pending':
    case 'confirming': return 2;
    case 'confirmed': return 3;
    case 'error': return -1;
    default: return -1;
  }
}

export default function BlobPostingStatus({
  status,
  onRetry,
  onCancel,
  onComplete
}: BlobPostingStatusProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!status.startTime || status.stage === 'confirmed' || status.stage === 'error' || status.stage === 'idle') {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - status.startTime!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status.startTime, status.stage]);

  // Reset elapsed time when startTime changes
  useEffect(() => {
    if (status.startTime) {
      setElapsedTime(Math.floor((Date.now() - status.startTime) / 1000));
    }
  }, [status.startTime]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
      variant: "default",
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const currentStepIndex = getStepIndex(status.stage);

  if (status.stage === 'idle') {
    return null;
  }

  return (
    <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          {status.stage === 'confirmed' ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : status.stage === 'error' ? (
            <XCircle className="h-5 w-5 text-red-400" />
          ) : (
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          )}
          Blob Posting Status
        </h3>
        {status.startTime && status.stage !== 'confirmed' && status.stage !== 'error' && (
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            {formatTime(elapsedTime)} elapsed
          </div>
        )}
      </div>

      {/* Step indicators */}
      <div className="space-y-2">
        {STEPS.map((step, index) => {
          const isCompleted = currentStepIndex > index;
          const isCurrent = currentStepIndex === index;
          const isPending = currentStepIndex < index;
          const isError = status.stage === 'error' && isCurrent;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-2 rounded ${
                isCurrent ? 'bg-blue-900/30 border border-blue-700' :
                isCompleted ? 'bg-green-900/20' :
                'bg-gray-800/50'
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : isCurrent && !isError ? (
                  <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                ) : isError ? (
                  <XCircle className="h-5 w-5 text-red-400" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-600" />
                )}
              </div>
              <div className="flex-1">
                <span className={`text-sm ${
                  isCompleted ? 'text-green-300' :
                  isCurrent ? 'text-white font-medium' :
                  'text-gray-500'
                }`}>
                  {step.label}
                </span>
                {isCurrent && status.message && (
                  <p className="text-xs text-gray-400 mt-0.5">{status.message}</p>
                )}
                {isCurrent && step.key === 'pending' && elapsedTime > 0 && (
                  <p className="text-xs text-blue-400 mt-0.5">
                    {formatTime(elapsedTime)} elapsed...
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error state */}
      {status.stage === 'error' && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{status.error || 'An error occurred'}</p>
              <div className="flex gap-2 mt-3">
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Retry
                  </Button>
                )}
                {onCancel && (
                  <Button
                    onClick={onCancel}
                    size="sm"
                    variant="outline"
                    className="text-gray-300 border-gray-600 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction details */}
      {(status.txHash || status.blobHash) && (
        <div className="space-y-2 pt-2 border-t border-gray-700">
          {status.txHash && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Transaction:</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400">
                  {status.txHash.substring(0, 10)}...{status.txHash.substring(status.txHash.length - 8)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(status.txHash!, 'Transaction hash')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={`https://sepolia.etherscan.io/tx/${status.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}

          {status.blobHash && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Blob Hash:</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">
                  {status.blobHash.substring(0, 10)}...{status.blobHash.substring(status.blobHash.length - 8)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(status.blobHash!, 'Blob hash')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <a
                  href={`https://sepolia.blobscan.com/blob/${status.blobHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sender address helper - always visible during posting */}
      {status.stage !== 'confirmed' && status.stage !== 'error' && (
        <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
          <div className="text-xs text-blue-200 mb-2">
            <strong>Find your blob on Etherscan:</strong> Look for Type-3 transactions from:
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-blue-400 bg-gray-900 px-2 py-1 rounded">
              {BLOB_SENDER_ADDRESS}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(BLOB_SENDER_ADDRESS, 'Sender address')}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <a
              href={`https://sepolia.etherscan.io/address/${BLOB_SENDER_ADDRESS}#internaltx`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1"
            >
              View all blobs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Success state with continue button */}
      {status.stage === 'confirmed' && status.blobHash && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-300 text-sm">
            <CheckCircle className="h-4 w-4" />
            <span>Blob posted successfully! You can now proceed to the Reveal step.</span>
          </div>
        </div>
      )}

      {/* Cancel button during processing */}
      {status.stage !== 'confirmed' && status.stage !== 'error' && onCancel && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={onCancel}
            size="sm"
            variant="outline"
            className="text-gray-400 border-gray-600 hover:bg-gray-800"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
