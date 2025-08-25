"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Upload, CheckCircle, Loader2, Clock, ArrowRight, ArrowLeft, Copy } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useErc7730Store } from "~/store/erc7730Provider";
import { useToast } from "~/hooks/use-toast";
import { web3Service } from "~/lib/web3Service";
import { useWallet } from "~/contexts/WalletContext";

export default function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("commit");
  const { walletConnected, currentAccount, connectWallet: walletContextConnect } = useWallet();
  const { setErc7730 } = useErc7730Store((state) => state);
  const { toast } = useToast();

  // Commit Step State
  const [targetContract, setTargetContract] = useState<string>("");
  const [targetChainId, setTargetChainId] = useState<string>("1");
  const [commitmentId, setCommitmentId] = useState<string>("");
  const [commitNonce, setCommitNonce] = useState<string>("");
  const [commitTxHash, setCommitTxHash] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [metadataHash, setMetadataHash] = useState<string>("");

  // Blob Step State
  const [blobVersionedHash, setBlobVersionedHash] = useState<string>("");
  const [blobTxHash, setBlobTxHash] = useState<string>("");
  const [isPostingBlob, setIsPostingBlob] = useState(false);
  const [manualBlobHash, setManualBlobHash] = useState<string>("");

  // Reveal Step State
  const [revealCommitmentId, setRevealCommitmentId] = useState<string>("");
  const [revealBlobHash, setRevealBlobHash] = useState<string>("");
  const [revealMetadataHash, setRevealMetadataHash] = useState<string>("");
  const [revealNonce, setRevealNonce] = useState<string>("");
  const [bondAmount, setBondAmount] = useState<string>("0.01");
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealTxHash, setRevealTxHash] = useState<string>("");
  const [specId, setSpecId] = useState<string>("");

  // Auto-populate fields when values are set
  useEffect(() => {
    if (commitmentId) {
      setRevealCommitmentId(commitmentId);
    }
  }, [commitmentId]);

  useEffect(() => {
    if (blobVersionedHash) {
      setRevealBlobHash(blobVersionedHash);
    }
  }, [blobVersionedHash]);

  useEffect(() => {
    if (commitNonce) {
      setRevealNonce(commitNonce);
    }
  }, [commitNonce]);

  useEffect(() => {
    if (metadataHash) {
      setRevealMetadataHash(metadataHash);
    }
  }, [metadataHash]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]!;
      setFile(selectedFile);
      
      // Parse the file and calculate metadata hash
      selectedFile.text().then(content => {
        try {
          const parsed = JSON.parse(content);
          setJsonData(parsed);
          setErc7730(parsed);
          
          // Calculate metadata hash
          import('ethers').then(({ ethers }) => {
            const hash = ethers.keccak256(ethers.toUtf8Bytes(content));
            setMetadataHash(hash);
            setRevealMetadataHash(hash);
            toast({
              title: "File Loaded",
              description: `Metadata hash: ${hash.substring(0, 10)}...`,
              variant: "default",
            });
          });
        } catch (error) {
          toast({
            title: "Invalid JSON",
            description: "The file is not valid JSON",
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleCommit = async () => {
    if (!targetContract || !targetChainId || !jsonData) {
      toast({
        title: "Missing Information",
        description: "Please provide target contract, chain ID, and upload a JSON file",
        variant: "destructive",
      });
      return;
    }

    setIsCommitting(true);
    try {
      if (!walletConnected) {
        await walletContextConnect();
      }

      // Calculate metadata hash if not already done
      const { ethers } = await import('ethers');
      const metaHash = metadataHash || ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(jsonData)));
      setMetadataHash(metaHash);
      setRevealMetadataHash(metaHash);

      // Call contract - commitSpec expects: metadataHash (used as blobHash internally), targetContract, targetChainId
      // Note: web3Service.commitSpec internally generates the nonce and creates the commitment
      const bondData = await web3Service.getBondInfo(metaHash);
      const bondAmount = bondData.requiredNextBond;
      const result = await web3Service.commitSpec(metaHash, bondAmount, targetContract, parseInt(targetChainId));
      
      // Use the nonce returned by commitSpec (it generates it internally)
      setCommitNonce(result.nonce.toString());
      setRevealNonce(result.nonce.toString());
      
      setCommitmentId(result.commitmentId);
      setRevealCommitmentId(result.commitmentId);
      setCommitTxHash(result.commitTxHash);

      toast({
        title: "Commitment Successful",
        description: `TX: ${result.commitTxHash.substring(0, 10)}... | Reveal by: ${new Date(result.revealDeadline * 1000).toLocaleTimeString()}`,
        variant: "default",
      });

      // Auto-advance to blob tab
      setActiveTab("blob");
    } catch (error: any) {
      console.error("Commit error:", error);
      toast({
        title: "Commit Failed",
        description: error.message || "Failed to commit",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePostBlob = async () => {
    if (!jsonData) {
      toast({
        title: "No JSON Data",
        description: "Please upload a JSON file first",
        variant: "destructive",
      });
      return;
    }

    setIsPostingBlob(true);
    try {
      toast({ 
        title: "Posting blob", 
        description: "Submitting blob transaction (may take up to 3 minutes)..." 
      });

      const res = await fetch('/api/blob/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: jsonData }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const result = await res.json();
      const blobHash = result?.blobVersionedHash || result?.blobHash;
      const txHash = result?.txHash || result?.blobTransactionHash;

      if (blobHash) {
        setBlobVersionedHash(blobHash);
        setRevealBlobHash(blobHash);
        setBlobTxHash(txHash);

        toast({ 
          title: "Blob posted successfully", 
          description: `Blob hash: ${blobHash.substring(0, 10)}...`, 
          variant: "default" 
        });

        // Auto-advance to reveal tab
        setActiveTab("reveal");
      } else {
        throw new Error('No blob hash returned');
      }
    } catch (error: any) {
      console.error("Blob post error:", error);
      toast({ 
        title: "Blob post failed", 
        description: error.message || "Could not post blob", 
        variant: "destructive" 
      });
    } finally {
      setIsPostingBlob(false);
    }
  };

  const handleReveal = async () => {
    if (!revealCommitmentId || !revealBlobHash || !revealMetadataHash || !revealNonce || !bondAmount) {
      toast({
        title: "Missing Information",
        description: "Please provide all required fields for reveal",
        variant: "destructive",
      });
      return;
    }

    setIsRevealing(true);
    try {
      if (!walletConnected) {
        await walletContextConnect();
      }

      const { ethers } = await import('ethers');
      const bondWei = ethers.parseEther(bondAmount);

      const txHash = await web3Service.revealSpec(
        revealCommitmentId,
        revealBlobHash,
        revealMetadataHash,
        parseInt(revealNonce),
        bondWei
      );

      setRevealTxHash(txHash);

      // Calculate spec ID (optional, for reference)
      const calculatedSpecId = ethers.keccak256(ethers.solidityPacked(
        ["bytes32", "address", "uint256", "address", "uint64"],
        [revealBlobHash, targetContract, targetChainId, currentAccount, Date.now()]
      ));
      setSpecId(calculatedSpecId);

      toast({
        title: "Reveal Successful",
        description: `TX: ${txHash.substring(0, 10)}...`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Reveal error:", error);
      toast({
        title: "Reveal Failed",
        description: error.message || "Failed to reveal",
        variant: "destructive",
      });
    } finally {
      setIsRevealing(false);
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

  return (
    <Card className="p-6 mb-8 bg-gray-950 border-gray-800">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="border-b border-gray-700 pb-4">
          <h2 className="text-2xl font-medium text-white mb-2">Submit ERC7730 Specification</h2>
          <p className="text-gray-400">
            Complete the commit-reveal process step by step. You can navigate between tabs to input values manually.
          </p>
        </div>

        {/* File Upload Section - Always Visible */}
        <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 p-5 rounded-lg border border-blue-800/50">
          <Label className="text-lg font-medium text-white mb-3 block">
            ERC7730 JSON File (Required for all steps)
          </Label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="jsonFileUpload"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              asChild
              variant="outline"
              className="text-white bg-transparent border-gray-600 hover:bg-gray-800"
            >
              <label htmlFor="jsonFileUpload" className="cursor-pointer flex items-center">
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : "Choose File"}
              </label>
            </Button>
            {metadataHash && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Metadata Hash:</span>
                <code className="text-green-400 bg-gray-900 px-2 py-1 rounded text-xs">
                  {metadataHash.substring(0, 10)}...
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(metadataHash)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Blob Search Helper */}
          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded text-xs">
            <div className="text-blue-200 mb-2">
              <strong>🔍 Find Your Blobs:</strong> KaiSign Blob Sender Address
            </div>
            <div className="flex items-center gap-2">
              <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded">0x49d81a2f1DC42d230927e224c42E8b8E6A7f6f7D</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard("0x49d81a2f1DC42d230927e224c42E8b8E6A7f6f7D")}
                className="h-6 w-6 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <a
                href="https://sepolia.etherscan.io/address/0x49d81a2f1DC42d230927e224c42E8b8E6A7f6f7D#internaltx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline ml-2"
              >
                View on Etherscan →
              </a>
            </div>
            <p className="text-blue-300 mt-2">
              Look for <strong>Type-3 (Blob)</strong> transactions to find your blob hashes
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="commit" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              1. Commit
            </TabsTrigger>
            <TabsTrigger value="blob" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              2. Post Blob
            </TabsTrigger>
            <TabsTrigger value="reveal" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              3. Reveal
            </TabsTrigger>
          </TabsList>

          {/* Commit Tab */}
          <TabsContent value="commit" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="chainId" className="text-white mb-2 block">Target Chain ID</Label>
                <select
                  id="chainId"
                  value={targetChainId}
                  onChange={(e) => setTargetChainId(e.target.value)}
                  className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white"
                >
                  <option value="1">Ethereum Mainnet (1)</option>
                  <option value="11155111">Sepolia Testnet (11155111)</option>
                  <option value="137">Polygon (137)</option>
                  <option value="8453">Base (8453)</option>
                  <option value="42161">Arbitrum (42161)</option>
                  <option value="10">Optimism (10)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="targetContract" className="text-white mb-2 block">Target Contract Address</Label>
                <Input
                  id="targetContract"
                  type="text"
                  placeholder="0x..."
                  value={targetContract}
                  onChange={(e) => setTargetContract(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              {commitmentId && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Commitment ID:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">
                        {commitmentId.substring(0, 16)}...
                      </code>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(commitmentId)} className="h-6 w-6 p-0">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Nonce:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">{commitNonce}</code>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(commitNonce)} className="h-6 w-6 p-0">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {commitTxHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">TX Hash:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${commitTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View on Etherscan
                      </a>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleCommit}
                disabled={isCommitting || !targetContract || !jsonData}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Commit Specification
                  </>
                )}
              </Button>

              <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> After committing, you have 1 hour to complete the reveal. The commitment locks in your
                  specification details without revealing them yet.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Blob Tab */}
          <TabsContent value="blob" className="space-y-4 mt-6">
            <div className="space-y-4">
              {blobVersionedHash && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Blob Hash:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">
                        {blobVersionedHash.substring(0, 16)}...
                      </code>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(blobVersionedHash)} className="h-6 w-6 p-0">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {blobTxHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">TX Hash:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${blobTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View on Etherscan
                      </a>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handlePostBlob}
                disabled={isPostingBlob || !jsonData}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isPostingBlob ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting Blob (up to 3 min)...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Post as Blob
                  </>
                )}
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-950 px-2 text-gray-400">Or enter manually</span>
                </div>
              </div>

              <div>
                <Label htmlFor="manualBlob" className="text-white mb-2 block">
                  Manual Blob Hash (if already posted)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manualBlob"
                    type="text"
                    placeholder="0x01..."
                    value={manualBlobHash}
                    onChange={(e) => setManualBlobHash(e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (manualBlobHash.startsWith('0x01') && manualBlobHash.length === 66) {
                        setBlobVersionedHash(manualBlobHash);
                        setRevealBlobHash(manualBlobHash);
                        toast({
                          title: "Blob Hash Set",
                          description: "You can now proceed to reveal",
                          variant: "default",
                        });
                      } else {
                        toast({
                          title: "Invalid Blob Hash",
                          description: "Blob hash must start with 0x01 and be 66 characters",
                          variant: "destructive",
                        });
                      }
                    }}
                    variant="outline"
                    className="text-white border-gray-600 hover:bg-gray-800"
                  >
                    Set Hash
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
                <p className="text-sm text-purple-300">
                  <strong>Note:</strong> The blob contains your ERC7730 JSON data and will be publicly visible on-chain.
                  Make sure you've committed before posting the blob.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Reveal Tab */}
          <TabsContent value="reveal" className="space-y-4 mt-6">
            <div className="space-y-4">
              {/* Warning for manual entry */}
              {(!commitmentId || revealCommitmentId !== commitmentId) && revealCommitmentId && (
                <div className="p-3 bg-orange-900/30 border border-orange-700 rounded-lg">
                  <p className="text-sm text-orange-300">
                    <strong>⚠️ Manual Entry Mode:</strong> You're entering commitment details manually. 
                    Make sure all values (commitment ID, nonce, metadata hash) match exactly what was used during the commit step.
                    If you're getting errors, try starting fresh with a new commit.
                  </p>
                </div>
              )}
              
              <div>
                <Label htmlFor="revealCommitmentId" className="text-white mb-2 block">Commitment ID</Label>
                <Input
                  id="revealCommitmentId"
                  type="text"
                  placeholder="0x..."
                  value={revealCommitmentId}
                  onChange={(e) => setRevealCommitmentId(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="revealBlobHash" className="text-white mb-2 block">Blob Versioned Hash</Label>
                <Input
                  id="revealBlobHash"
                  type="text"
                  placeholder="0x01..."
                  value={revealBlobHash}
                  onChange={(e) => setRevealBlobHash(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="revealMetadataHash" className="text-white mb-2 block">Metadata Hash</Label>
                <Input
                  id="revealMetadataHash"
                  type="text"
                  placeholder="0x..."
                  value={revealMetadataHash}
                  onChange={(e) => setRevealMetadataHash(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="revealNonce" className="text-white mb-2 block">
                  Nonce <span className="text-xs text-gray-400">(Must match the nonce from commit)</span>
                </Label>
                <Input
                  id="revealNonce"
                  type="text"
                  placeholder="e.g., 123456"
                  value={revealNonce}
                  onChange={(e) => setRevealNonce(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
                {revealNonce && (
                  <p className="text-xs text-gray-400 mt-1">
                    This nonce must be the exact same value that was generated during the commit step.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="bondAmount" className="text-white mb-2 block">Bond Amount (ETH)</Label>
                <Input
                  id="bondAmount"
                  type="text"
                  placeholder="0.01"
                  value={bondAmount}
                  onChange={(e) => setBondAmount(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              {revealTxHash && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Reveal TX:</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${revealTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View on Etherscan
                    </a>
                  </div>
                  {specId && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-300">Spec ID:</span>
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">
                        {specId.substring(0, 16)}...
                      </code>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleReveal}
                disabled={isRevealing || !revealCommitmentId || !revealBlobHash || !revealMetadataHash || !revealNonce}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isRevealing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revealing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Reveal Specification
                  </>
                )}
              </Button>

              <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-sm text-green-300">
                  <strong>Note:</strong> The reveal must be done within 1 hour of commitment. This step requires a bond
                  payment (minimum 0.01 ETH) which can be recovered after the challenge period.
                </p>
                <p className="text-xs text-orange-400 mt-2">
                  <strong>⚠️ Important:</strong> Each commitment can only be revealed once. If you get an "InvalidReveal" error,
                  it usually means the nonce doesn't match what was used during commit, or this commitment has already been revealed.
                  Create a new commitment if needed.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={() => {
              if (activeTab === "blob") setActiveTab("commit");
              else if (activeTab === "reveal") setActiveTab("blob");
            }}
            disabled={activeTab === "commit"}
            className="text-white border-gray-600 hover:bg-gray-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous Step
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (activeTab === "commit") setActiveTab("blob");
              else if (activeTab === "blob") setActiveTab("reveal");
            }}
            disabled={activeTab === "reveal"}
            className="text-white border-gray-600 hover:bg-gray-800"
          >
            Next Step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Help Section */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <h3 className="text-lg font-medium text-blue-100 mb-2">Quick Guide</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-200">
            <li><strong>Commit:</strong> Create a hidden commitment with your contract details</li>
            <li><strong>Post Blob:</strong> Upload your ERC7730 JSON as an EIP-4844 blob</li>
            <li><strong>Reveal:</strong> Reveal your commitment with the blob hash and pay the bond</li>
          </ol>
          <p className="text-xs text-blue-300 mt-3">
            You can navigate between tabs to enter values manually or use the automated flow.
            All values are auto-populated when available.
          </p>
        </div>
      </div>
    </Card>
  );
}