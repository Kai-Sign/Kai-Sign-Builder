"use client";

import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Eye, Copy, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { ethStorageService } from "~/lib/ethStorageService";
import { useToast } from "~/hooks/use-toast";

interface BlobViewerProps {
  initialKey?: string;
}

export default function BlobViewer({ initialKey = "" }: BlobViewerProps) {
  const [blobKey, setBlobKey] = useState(initialKey);
  const [blobData, setBlobData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const { toast } = useToast();

  const handleViewBlob = async () => {
    if (!blobKey.trim()) {
      toast({
        title: "Missing Key",
        description: "Please enter a blob key to view",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setBlobData(null);
    setIsVerified(null);

    try {
      const result = await ethStorageService.getBlob(blobKey);
      
      if (result.success && result.data) {
        setBlobData(result.data);
        
        // Verify the blob integrity
        const jsonString = JSON.stringify(result.data);
        const metadataHash = ethStorageService.calculateMetadataHash(jsonString);
        const verified = await ethStorageService.verifyBlob(blobKey, metadataHash);
        setIsVerified(verified);
        
        toast({
          title: "Blob Retrieved",
          description: verified ? "Blob verified successfully" : "Blob retrieved (verification pending)",
          variant: verified ? "default" : "destructive",
        });
      } else {
        setError(result.error || "Failed to retrieve blob");
        toast({
          title: "Retrieval Failed",
          description: result.error || "Could not retrieve blob data",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard",
      variant: "default",
    });
  };

  const getProofLink = () => {
    return ethStorageService.createProofLink(blobKey);
  };

  const getEthStorageExplorer = () => {
    return `http://65.108.236.27:9540/blob/${blobKey}`;
  };

  return (
    <Card className="p-6 bg-gray-950 border-gray-800">
      <div className="space-y-6">
        <div className="border-b border-gray-700 pb-4">
          <h3 className="text-xl font-medium text-white mb-2 flex items-center">
            <Eye className="mr-2 h-5 w-5" />
            EthStorage Blob Viewer
          </h3>
          <p className="text-gray-400">
            View and verify ERC7730 metadata stored on EthStorage
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="blobKey" className="text-white mb-2 block">
              Blob Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="blobKey"
                type="text"
                placeholder="0x..."
                value={blobKey}
                onChange={(e) => setBlobKey(e.target.value)}
                className="bg-gray-900 border-gray-600 text-white flex-1"
              />
              <Button
                onClick={handleViewBlob}
                disabled={isLoading || !blobKey.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                {isLoading ? "Loading..." : "View Blob"}
              </Button>
            </div>
          </div>

          {/* Blob Key Info */}
          {blobKey && (
            <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-200">Blob Key:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400">
                    {blobKey.substring(0, 16)}...
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(blobKey)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(getProofLink(), '_blank')}
                  className="text-blue-400 border-blue-600 hover:bg-blue-900/50"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Proof Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(getEthStorageExplorer(), '_blank')}
                  className="text-blue-400 border-blue-600 hover:bg-blue-900/50"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  EthStorage Explorer
                </Button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-200 text-sm">Error: {error}</span>
              </div>
            </div>
          )}

          {/* Verification Status */}
          {isVerified !== null && (
            <div className={`p-4 border rounded-lg ${
              isVerified 
                ? 'bg-green-900/30 border-green-700' 
                : 'bg-orange-900/30 border-orange-700'
            }`}>
              <div className="flex items-center gap-2">
                {isVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-orange-400" />
                )}
                <span className={`text-sm ${
                  isVerified ? 'text-green-200' : 'text-orange-200'
                }`}>
                  {isVerified 
                    ? "✅ Blob integrity verified" 
                    : "⚠️ Blob verification failed"}
                </span>
              </div>
            </div>
          )}

          {/* Blob Data Display */}
          {blobData && (
            <div className="space-y-4">
              <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
                <h4 className="text-green-100 font-medium mb-2">Retrieved Metadata</h4>
                <div className="bg-gray-900 p-4 rounded border">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(blobData, null, 2)}
                  </pre>
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(blobData, null, 2))}
                    className="text-green-400 border-green-600 hover:bg-green-900/50"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy JSON
                  </Button>
                </div>
              </div>

              {/* Metadata Analysis */}
              {blobData.context && (
                <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
                  <h4 className="text-purple-100 font-medium mb-2">ERC7730 Context</h4>
                  <div className="space-y-2 text-sm text-purple-200">
                    <div><strong>Contract:</strong> {blobData.context.contract?.address || 'N/A'}</div>
                    <div><strong>Chain ID:</strong> {blobData.context.contract?.chainId || 'N/A'}</div>
                    <div><strong>Version:</strong> {blobData.$version || 'N/A'}</div>
                    <div><strong>Fields:</strong> {Object.keys(blobData.display?.definitions || {}).length} defined</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}