'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Textarea } from '~/components/ui/textarea';
import { Upload, Loader2, ExternalLink, Copy, CheckCircle } from 'lucide-react';

interface BlobPostResponse {
  success: boolean;
  confirmed: boolean;
  blobTransactionHash: string;
  ethTransferHash?: string;
  blobDeploymentAddress: string;
  blobHash: string;
  transactionStatus: string;
  signerAddress: string;
  dataSize: number;
  kmsKeyId: string;
  trackingUrls: {
    etherscan: string;
    blobscan: string;
    blobTx: string;
  };
  pollingData: {
    transactionHash: string;
    deploymentAddress: string;
    blobHash: string;
    chainId: number;
    rpcUrl: string;
  };
}

export default function BlobDemo() {
  const [jsonData, setJsonData] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [blobResponse, setBlobResponse] = useState<BlobPostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!jsonData.trim()) {
      setError('Please enter some JSON data');
      return;
    }

    setIsUploading(true);
    setError(null);
    setBlobResponse(null);

    try {
      // Parse JSON to validate
      JSON.parse(jsonData);

      // Call your Lambda function
      const response = await fetch('YOUR_LAMBDA_ENDPOINT_HERE', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: jsonData
        })
      });

      const result = await response.json();

      if (result.success) {
        setBlobResponse(result);
      } else {
        setError(result.error || 'Failed to post blob');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Blob Data Upload</CardTitle>
          <CardDescription className="text-slate-300">
            Submit JSON data to be stored as a blob on Sepolia testnet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              JSON Data
            </label>
            <Textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder='{"example": "data", "timestamp": 1234567890}'
              className="min-h-32 bg-slate-800 border-slate-600 text-white"
            />
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 p-3 rounded-lg">
              <div className="text-red-100 text-sm">❌ {error}</div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isUploading || !jsonData.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting to Blob...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Post to Blob
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Blob Results Display */}
      {blobResponse && (
        <div className="space-y-4">
          {/* Success Banner */}
          <Card className="bg-green-950 border-green-700">
            <CardHeader>
              <CardTitle className="text-green-100 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Blob Posted Successfully!
              </CardTitle>
              <CardDescription className="text-green-200">
                Your data has been stored on Sepolia testnet and is immediately accessible
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Key Addresses for Verification */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">🔍 Verification Details</CardTitle>
              <CardDescription className="text-slate-300">
                Use these addresses to verify your blob data on blockchain explorers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Blob Deployment Address */}
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-300">
                    📍 Blob Deployment Address (EOA)
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(blobResponse.blobDeploymentAddress, 'deployment')}
                    className="h-6 px-2 text-xs"
                  >
                    {copiedAddress === 'deployment' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="font-mono text-xs text-white break-all bg-slate-900 p-2 rounded">
                  {blobResponse.blobDeploymentAddress}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  This is the EOA that posted the blob transaction
                </div>
              </div>

              {/* Blob Hash */}
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-purple-300">
                    🔗 Blob Hash (Versioned Hash)
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(blobResponse.blobHash, 'blob')}
                    className="h-6 px-2 text-xs"
                  >
                    {copiedAddress === 'blob' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="font-mono text-xs text-white break-all bg-slate-900 p-2 rounded">
                  {blobResponse.blobHash}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Use this hash to verify the blob data content
                </div>
              </div>

              {/* Transaction Hash */}
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-amber-300">
                    📋 Transaction Hash
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(blobResponse.blobTransactionHash, 'tx')}
                    className="h-6 px-2 text-xs"
                  >
                    {copiedAddress === 'tx' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="font-mono text-xs text-white break-all bg-slate-900 p-2 rounded">
                  {blobResponse.blobTransactionHash}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Blob transaction hash for network confirmation
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Direct Access Links */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">🌐 Direct Access</CardTitle>
              <CardDescription className="text-slate-300">
                Click to verify your blob data on blockchain explorers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Primary Blobscan Link */}
              <div className="bg-blue-950 border border-blue-700 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-blue-100 font-medium mb-1">
                      🔍 View Blob Data (Primary)
                    </h4>
                    <p className="text-blue-200 text-sm">
                      Access your blob data directly on Blobscan explorer
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <a 
                      href={blobResponse.trackingUrls.blobscan}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Blob
                    </a>
                  </Button>
                </div>
              </div>

              {/* Alternative Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  asChild
                  className="border-slate-600 hover:bg-slate-800 h-auto p-3"
                >
                  <a 
                    href={blobResponse.trackingUrls.etherscan}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Etherscan</div>
                      <div className="text-xs text-slate-400">Transaction details</div>
                    </div>
                  </a>
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="border-slate-600 hover:bg-slate-800 h-auto p-3"
                >
                  <a 
                    href={blobResponse.trackingUrls.blobTx}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">Blobscan Tx</div>
                      <div className="text-xs text-slate-400">Transaction view</div>
                    </div>
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">📊 Technical Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">KMS Signer:</span>
                  <div className="font-mono text-xs text-white break-all">
                    {blobResponse.signerAddress.slice(0, 6)}...{blobResponse.signerAddress.slice(-4)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Data Size:</span>
                  <div className="text-white">
                    {blobResponse.dataSize.toLocaleString()} bytes
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Network:</span>
                  <div className="text-white">Sepolia</div>
                </div>
                <div>
                  <span className="text-slate-400">KMS Key:</span>
                  <div className="text-white">
                    {blobResponse.kmsKeyId.slice(0, 8)}...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}