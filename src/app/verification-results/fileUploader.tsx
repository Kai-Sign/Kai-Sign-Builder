"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { FileJson, Upload, CheckCircle, AlertCircle, Loader2, ExternalLink, Gift, DollarSign, Clock, Gavel } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import Link from "next/link";
import { useErc7730Store } from "~/store/erc7730Provider";
import { useToast } from "~/hooks/use-toast";
import { uploadToIPFS } from "~/lib/ipfsService";
import { web3Service } from "~/lib/web3Service";
import { useRouter } from "next/navigation";
import { getQuestionData, hasFinalizationTimePassed, getTimeRemainingUntilFinalization } from "~/lib/realityEthService";

export default function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");
  const [jsonData, setJsonData] = useState<any>(null);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [currentWalletAddress, setCurrentWalletAddress] = useState<string | null>(null);
  const [minBond, setMinBond] = useState<string | null>(null);
  const [bondInfo, setBondInfo] = useState<{
    currentBond: bigint;
    minBond: bigint;
    requiredNextBond: bigint;
    hasAnswers: boolean;
  } | null>(null);
  const [targetContract, setTargetContract] = useState<string>("");
  const [selectedIncentiveId, setSelectedIncentiveId] = useState<string>("");
  const [availableIncentives, setAvailableIncentives] = useState<any[]>([]);
  const [isLoadingIncentives, setIsLoadingIncentives] = useState(false);
  const { setErc7730, shouldAutoSubmit, setShouldAutoSubmit } = useErc7730Store((state) => state);
  const erc7730Data = useErc7730Store((state) => state.finalErc7730);
  const { toast } = useToast();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [finalizationTimestamp, setFinalizationTimestamp] = useState<string | null>(null);
  const [timeout, setTimeoutValue] = useState<string | null>(null);
  const [createdTimestamp, setCreatedTimestamp] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isCheckingResult, setIsCheckingResult] = useState(false);
  const router = useRouter();

  // Auto-submit effect when coming from review page
  useEffect(() => {
    if (shouldAutoSubmit && erc7730Data) {
      // Reset the auto-submit flag
      setShouldAutoSubmit(false);
      
      // Create a virtual file from the ERC7730 data
      const jsonString = JSON.stringify(erc7730Data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const virtualFile = new File([blob], "erc7730-specification.json", { type: "application/json" });
      
      // Set the file and trigger verification
      setFile(virtualFile);
      setVerificationStatus("idle");
      setIpfsHash(null);
      setTransactionHash(null);
      
      // Automatically start the verification process
      setTimeout(() => {
        void handleAutoVerification(erc7730Data);
      }, 100); // Small delay to ensure state is updated
    }
  }, [shouldAutoSubmit, erc7730Data, setShouldAutoSubmit]);

  const handleAutoVerification = async (data: any) => {
    setIsVerifying(true);
    
    try {
      // Basic validation - check if it has the expected ERC7730 structure
      const isValidFormat = 
        data && 
        typeof data === "object" &&
        "context" in data &&
        "metadata" in data;
      
      if (isValidFormat) {
        // Add $schema field if missing (required by ERC7730 spec)
        if (!("$schema" in data)) {
          data.$schema = "https://eips.ethereum.org/assets/eip-7730/erc7730-v1.schema.json";
          toast({
            title: "Schema Field Added",
            description: "Added missing $schema field as required by ERC7730 specification.",
            variant: "default",
          });
        }
        
        setVerificationStatus("success");
        setJsonData(data);
        setErc7730(data);
        toast({
          title: "Auto-Verification Started",
          description: "Processing your ERC7730 JSON file automatically. Uploading to IPFS...",
          variant: "default",
        });
        
        // Upload to IPFS
        await uploadToIpfs(data);
      } else {
        setVerificationStatus("error");
        toast({
          title: "Invalid File Format",
          description: "The ERC7730 data does not appear to be valid.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setVerificationStatus("error");
      toast({
        title: "Error Processing Data",
        description: "Failed to process the ERC7730 data.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Use a non-null assertion since we already checked length > 0
      const selectedFile = e.target.files[0]!;
      setFile(selectedFile);
      setVerificationStatus("idle");
      setIpfsHash(null);
      setTransactionHash(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsVerifying(true);
    
    try {
      const fileContent = await file.text();
      const parsedData = JSON.parse(fileContent);
      
      // Basic validation - check if it has the expected ERC7730 structure
      const isValidFormat = 
        parsedData && 
        typeof parsedData === "object" &&
        "context" in parsedData &&
        "metadata" in parsedData;
      
      if (isValidFormat) {
        // Add $schema field if missing (required by ERC7730 spec)
        if (!("$schema" in parsedData)) {
          parsedData.$schema = "https://eips.ethereum.org/assets/eip-7730/erc7730-v1.schema.json";
          toast({
            title: "Schema Field Added",
            description: "Added missing $schema field as required by ERC7730 specification.",
            variant: "default",
          });
        }
        
        setVerificationStatus("success");
        setJsonData(parsedData);
        setErc7730(parsedData);
        toast({
          title: "File Verification Process Started",
          description: "The ERC7730 JSON file is valid. Uploading to IPFS...",
          variant: "default",
        });
        
        // Upload to IPFS
        await uploadToIpfs(parsedData);
      } else {
        setVerificationStatus("error");
        toast({
          title: "Invalid File Format",
          description: "The uploaded file does not appear to be a valid ERC7730 JSON specification.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setVerificationStatus("error");
      toast({
        title: "Error Parsing JSON",
        description: "The file could not be parsed as valid JSON.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const uploadToIpfs = async (data: any) => {
    setIsUploading(true);
    
    try {
      // Upload to IPFS
      toast({
        title: "Uploading to IPFS",
        description: "Sending your file to IPFS storage. This may take a moment...",
        variant: "default",
      });
      
      const hash = await uploadToIPFS(data);
      setIpfsHash(hash);
      
      toast({
        title: "Uploaded to IPFS Successfully",
        description: `Your file is now stored on IPFS with hash: ${hash.substring(0, 8)}...${hash.substring(hash.length - 4)}`,
        variant: "default",
      });
      
      // Connect wallet after IPFS upload
      await connectWallet();
      
      // Load available incentives for the target contract
      await loadAvailableIncentives();
    } catch (error) {
      console.error("Error uploading to IPFS:", error);
      toast({
        title: "IPFS Upload Failed",
        description: "Failed to upload file to IPFS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const connectWallet = async () => {
    setIsConnectingWallet(true);
    
    try {
      // Connect to MetaMask
      const account = await web3Service.connect();
      setCurrentWalletAddress(account);
      setWalletConnected(true);
      
      // Get bond information - if we have an IPFS hash, get specific info, otherwise get general minimum
      if (ipfsHash) {
        const bondData = await web3Service.getBondInfo(ipfsHash);
        setBondInfo(bondData);
        setMinBond(bondData.requiredNextBond.toString());
      } else {
        const minBondAmount = await web3Service.getMinBond();
        setMinBond(minBondAmount.toString());
      }
      
      toast({
        title: "Wallet Connected",
        description: `Connected to wallet: ${account.substring(0, 6)}...${account.substring(account.length - 4)}`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      toast({
        title: "Wallet Connection Failed",
        description: error.message || "Failed to connect to wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const loadAvailableIncentives = async () => {
    if (!targetContract) return;
    
    setIsLoadingIncentives(true);
    try {
      // Get available incentives for this target contract
      const incentives = await web3Service.getAvailableIncentives(targetContract);
      setAvailableIncentives(incentives);
      
      if (incentives.length > 0) {
        toast({
          title: "Incentives Available",
          description: `Found ${incentives.length} available incentive(s) for this contract!`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Error loading incentives:", error);
      // Don't show error toast as this is not critical
    } finally {
      setIsLoadingIncentives(false);
    }
  };
  
  const submitToBlockchain = async () => {
    if (!ipfsHash || !walletConnected) return;
    
    setIsSendingTransaction(true);
    
    try {
      // Get the current required bond amount for this specific question
      const bondData = await web3Service.getBondInfo(ipfsHash);
      setBondInfo(bondData);
      const bondAmount = bondData.requiredNextBond;
      
      // Submit to blockchain using V1 contract (commit-reveal pattern)
      // Convert selectedIncentiveId to bytes32, or use zero bytes if none selected
      const incentiveId = selectedIncentiveId || "0x0000000000000000000000000000000000000000000000000000000000000000";
      const txHash = await web3Service.submitSpec(ipfsHash, bondAmount, targetContract || undefined, incentiveId);
      setTransactionHash(txHash);
      
      toast({
        title: "Transaction Submitted",
        description: `Successfully submitted transaction with hash: ${txHash.substring(0, 10)}...`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Error submitting to blockchain:", error);
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to submit transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTransaction(false);
    }
  };

  const checkVerificationStatus = async () => {
    if (!ipfsHash || !walletConnected) {
      toast({
        title: "Action Required",
        description: "Please upload a file and connect your wallet first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCheckingStatus(true);
    
    try {
      // Connect to wallet if not already connected
      if (!walletConnected) {
        await connectWallet();
      }
      
      // Get the questionId from the contract
      console.log("Getting questionId from contract for IPFS hash:", ipfsHash);
      const questionId = await web3Service.getQuestionId(ipfsHash);
      console.log("Received questionId from contract:", questionId);
      setQuestionId(questionId);
      
      if (questionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast({
          title: "No Question Found",
          description: "This specification hasn't been proposed with a bond yet.",
          variant: "destructive",
        });
        setIsCheckingStatus(false);
        return;
      }
      
      try {
        // Log subgraph URL for debugging
        console.log("Using KaiSign subgraph URL:", process.env.NEXT_PUBLIC_KAISIGN_GRAPH_URL || 
          "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.3");
        
        // Add a simple direct request to test connectivity
        try {
          const testResponse = await fetch(process.env.NEXT_PUBLIC_KAISIGN_GRAPH_URL || 
            "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.3", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              query: `{ _meta { block { number } } }` 
            }),
          });
          
          const testData = await testResponse.json();
          console.log("Basic connectivity test response:", testData);
        } catch (testError) {
          console.error("Basic connectivity test failed:", testError);
        }
        
        // Get question data from Reality.eth
        console.log("Trying to get question data for ID:", questionId);
        const questionData = await getQuestionData(questionId);
        
        if (!questionData) {
          console.warn("Question data is null");
          
          // Show a more informative error message
          toast({
            title: "Question Data Unavailable",
            description: "The question exists in the contract but could not be retrieved from Reality.eth API. Check the console for more details.",
            variant: "default",
          });
          
          // Continue anyway but with minimal data
          const defaultData = {
            id: questionId,
            createdTimestamp: Math.floor(Date.now() / 1000 - 172800).toString(), // 2 days ago
          };
          
          setFinalizationTimestamp(null);
          setTimeoutValue(null);
          setCreatedTimestamp(defaultData.createdTimestamp);
          
          const timeRemaining = getTimeRemainingUntilFinalization(
            undefined,
            "172800", // 2 day timeout
            defaultData.createdTimestamp
          );
          setTimeRemaining(timeRemaining);
          
          // Navigate to the verification status page
          router.push(`/verification-status?ipfsHash=${ipfsHash}&questionId=${questionId}`);
          return;
        }
        
        console.log("Received question data:", questionData);
        
        // Set state with available data, handling optional fields
        setFinalizationTimestamp(questionData.currentScheduledFinalizationTimestamp || null);
        setTimeoutValue(questionData.timeout || null);
        setCreatedTimestamp(questionData.createdTimestamp || null);
        
        // Calculate time remaining based on available data
        const timeRemaining = getTimeRemainingUntilFinalization(
          questionData.currentScheduledFinalizationTimestamp,
          questionData.timeout,
          questionData.createdTimestamp
        );
        setTimeRemaining(timeRemaining);
        
        // Check if finalization time has passed
        const canFinalize = await hasFinalizationTimePassed(questionId);
        
        if (canFinalize) {
          toast({
            title: "Finalization Available",
            description: "The waiting period has ended. You can now fetch the verification result.",
            variant: "default",
          });
        } else {
          toast({
            title: "Waiting Period",
            description: `Verification is still in the waiting period. ${timeRemaining}`,
            variant: "default",
          });
        }
        
        // Navigate to the verification status page
        router.push(`/verification-status?ipfsHash=${ipfsHash}&questionId=${questionId}`);
      } catch (error: any) {
        console.error("Error fetching question data:", error);
        
        // Handle question not found errors specifically
        if (error.message?.includes("Question not found") || error.message?.includes("No question data found")) {
          toast({
            title: "Question Not Registered Yet",
            description: "This question hasn't been registered in Reality.eth yet. Please wait a few minutes for the transaction to be processed and try again.",
            variant: "default",
          });
        } else {
          toast({
            title: "Error Checking Status",
            description: `${error.message || "Failed to check verification status. Please try again."}`,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Error checking verification status:", error);
      toast({
        title: "Error Checking Status",
        description: `${error.message || "Failed to check verification status. Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };
  
  useEffect(() => {
    // Update time remaining every minute if we have a finalization timestamp
    if (finalizationTimestamp) {
      const interval = setInterval(() => {
        const remaining = getTimeRemainingUntilFinalization(
          finalizationTimestamp || '', 
          timeout || undefined, 
          createdTimestamp || undefined
        );
        setTimeRemaining(remaining);
      }, 60000); // Update every minute
      
      return () => clearInterval(interval);
    }
  }, [finalizationTimestamp, timeout, createdTimestamp]);

  // Load incentives when target contract changes
  useEffect(() => {
    if (walletConnected && targetContract) {
      loadAvailableIncentives();
    }
  }, [walletConnected, targetContract]);

  return (
    <Card className="p-6 mb-8 bg-gray-950 border-gray-800">
      <div className="flex flex-col gap-6">
        {/* Enhanced Header with Process Information */}
        <div className="border-b border-gray-700 pb-4">
          <h2 className="text-2xl font-medium text-white mb-2">Submit ERC7730 Specification</h2>
          <p className="text-gray-400">
            Upload your ERC7730 JSON file to the decentralized verification system using a 
            <strong className="text-blue-400"> commit-reveal scheme</strong> with a 
            <strong className="text-green-400"> 2-day challenge period</strong>.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="h-4 w-4" />
              <span>2-day verification period</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <Gavel className="h-4 w-4" />
              <span>Commit-reveal protection</span>
            </div>
          </div>
        </div>

        {/* Step 1: Target Contract Input - Make this prominent and first */}
        <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 p-5 rounded-lg border border-blue-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <Label htmlFor="targetContract" className="text-lg font-medium text-white">
                Target Contract Address
              </Label>
              <p className="text-sm text-gray-400 mt-1">
                Specify the contract this ERC7730 metadata describes (can be from any chain)
              </p>
            </div>
          </div>
          <Input
            id="targetContract"
            type="text"
            placeholder="0x... (Required: Enter the contract address for this specification)"
            value={targetContract}
            onChange={(e) => setTargetContract(e.target.value)}
            className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 h-12 text-base"
          />
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertCircle className="h-4 w-4" />
                <strong>V1 Contract Limitation</strong>
              </div>
              <p className="text-amber-300 text-sm">
                For verification purposes, the contract must exist on <strong>Sepolia testnet</strong>. 
                If your target contract is on another chain, the system will use KaiSign as a proxy for verification.
              </p>
            </div>
            <details className="group">
              <summary className="text-blue-400 cursor-pointer hover:text-blue-300 text-sm flex items-center gap-2">
                <span>📋 Show example Sepolia contracts</span>
                <span className="text-xs text-gray-500 group-open:hidden">(click to expand)</span>
              </summary>
              <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">KaiSign V1:</span>
                    <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded text-xs">0x79D0e06350CfCE33A7a73A7549248fd6AeD774f2</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">USDC Sepolia:</span>
                    <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded text-xs">0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Wrapped ETH:</span>
                    <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded text-xs">0xfff9976782d46cc05630d1f6ebab18b2324d6b14</code>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Step 2: File Upload */}
        <div className="bg-gradient-to-r from-purple-950/50 to-green-950/50 p-5 rounded-lg border border-purple-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <Label className="text-lg font-medium text-white">
                Upload ERC7730 JSON File
              </Label>
              <p className="text-sm text-gray-400 mt-1">
                Upload your ERC7730 specification file for verification
              </p>
            </div>
          </div>
        
        <div className="flex flex-col items-center justify-center gap-6 border-2 border-dashed border-gray-600 rounded-lg p-8">
          <FileJson size={52} className="text-gray-400" />
          <p className="text-sm text-gray-400 text-center">
            {file ? `Selected: ${file.name}` : "Drag and drop your JSON file here or click to browse"}
          </p>
          
          <input
            type="file"
            id="jsonFileUpload"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {!file ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="px-8 py-6 min-w-[220px] text-white bg-transparent border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors"
            >
              <label htmlFor="jsonFileUpload" className="cursor-pointer flex items-center justify-center text-base">
                <Upload className="mr-2 h-5 w-5" />
                Browse Files
              </label>
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full px-8 py-6 text-white bg-transparent border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors"
              >
                <label htmlFor="jsonFileUpload" className="cursor-pointer flex items-center justify-center text-base">
                  <Upload className="mr-2 h-5 w-5" />
                  Change File
                </label>
              </Button>
              
              {!ipfsHash ? (
                <Button
                  onClick={handleUpload}
                  disabled={isVerifying || isUploading || !targetContract.trim()}
                  size="lg"
                  className="w-full px-8 py-6 mt-2 text-base bg-white text-black hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying || isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isVerifying ? "Verifying JSON..." : "Uploading to IPFS..."}
                    </>
                  ) : !targetContract.trim() ? (
                    "Enter Contract Address First"
                  ) : (
                    "Verify & Upload to IPFS"
                  )}
                </Button>
              ) : !walletConnected ? (
                <Button
                  onClick={connectWallet}
                  disabled={isConnectingWallet}
                  size="lg"
                  className="w-full px-8 py-6 mt-2 text-base bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isConnectingWallet ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting Wallet...
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </Button>
              ) : !transactionHash ? (
                <Button
                  onClick={submitToBlockchain}
                  disabled={isSendingTransaction}
                  size="lg"
                  className="w-full px-8 py-6 mt-2 text-base bg-green-600 text-white hover:bg-green-700"
                >
                  {isSendingTransaction ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Transaction...
                    </>
                  ) : (
                    <>
                      {bondInfo?.hasAnswers 
                        ? `Challenge Answer (${bondInfo ? (Number(bondInfo.requiredNextBond) / 10**18).toFixed(5) : "..."} ETH)`
                        : `Submit with Bond (${bondInfo ? (Number(bondInfo.requiredNextBond) / 10**18).toFixed(5) : minBond ? (Number(minBond) / 10**18).toFixed(5) : "..."} ETH)`
                      }
                    </>
                  )}
                </Button>
              ) : (
                <div className="w-full p-4 bg-green-900/30 border border-green-700 rounded-lg text-center">
                  <p className="text-green-500 font-medium mb-1">Transaction Submitted!</p>
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    View on Etherscan
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        
        {/* Available Incentives Section */}
        {walletConnected && targetContract && (
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-300 flex items-center">
                <Gift className="mr-2 h-4 w-4 text-green-500" />
                Available Incentives for this Contract
                {isLoadingIncentives && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </Label>
              <Button
                onClick={loadAvailableIncentives}
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={isLoadingIncentives}
              >
                Refresh
              </Button>
            </div>
            
            {availableIncentives.length > 0 ? (
              <div className="space-y-2">
                <div className="grid gap-2">
                  <div 
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedIncentiveId === "" 
                        ? "border-blue-500 bg-blue-900/20" 
                        : "border-gray-700 bg-gray-900 hover:border-gray-600"
                    }`}
                    onClick={() => setSelectedIncentiveId("")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">No Incentive (Standard Submission)</span>
                      {selectedIncentiveId === "" && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                  
                  {availableIncentives.map((incentive: any) => (
                    <div 
                      key={incentive.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedIncentiveId === incentive.id 
                          ? "border-green-500 bg-green-900/20" 
                          : "border-gray-700 bg-gray-900 hover:border-gray-600"
                      }`}
                      onClick={() => setSelectedIncentiveId(incentive.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">
                            {incentive.amount} {incentive.token === "0x0000000000000000000000000000000000000000" ? "ETH" : "Tokens"}
                          </span>
                          <Badge variant="secondary" className="bg-green-600">
                            Active
                          </Badge>
                        </div>
                        {selectedIncentiveId === incentive.id && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{incentive.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>Creator: {incentive.creator?.substring(0, 8)}...</span>
                        <span>Expires: {new Date(incentive.deadline * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded text-xs text-green-400">
                  <strong>💡 Tip:</strong> Select an incentive to earn additional rewards if your submission is accepted!
                  The incentive will be automatically claimed when your specification is finalized.
                </div>
              </div>
            ) : !isLoadingIncentives ? (
              <div className="p-3 bg-gray-800 border border-gray-700 rounded text-center">
                <Gift className="mx-auto h-6 w-6 text-gray-400 mb-2" />
                <p className="text-sm text-gray-400">No incentives available for this contract</p>
                <p className="text-xs text-gray-500 mt-1">
                  Be the first to create an incentive in the <Link href="/kaisign-v1" className="text-blue-400 hover:underline">V1 Manager</Link>
                </p>
              </div>
            ) : (
              <div className="p-3 bg-gray-800 border border-gray-700 rounded text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400 mb-2" />
                <p className="text-sm text-gray-400">Loading available incentives...</p>
              </div>
            )}
          </div>
        )}
        
        {verificationStatus === "success" && !ipfsHash && (
          <div className="flex items-center gap-2 text-green-500 mt-4">
            <CheckCircle className="h-5 w-5" />
            <span>File verification process started!</span>
          </div>
        )}
        
        {ipfsHash && (
          <div className="flex flex-col gap-2 text-green-500 mt-4">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5" />
                <span className="ml-2">
                  IPFS Hash: <span className="font-mono text-xs bg-gray-800 px-2 py-1 rounded">{ipfsHash}</span>
                </span>
              </div>
              <Button
                onClick={checkVerificationStatus}
                size="lg"
                className="ml-auto bg-blue-600 hover:bg-blue-700 px-8 py-6"
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Verification Status"
                )}
              </Button>
            </div>
            
            {bondInfo && (
              <div className="mt-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-white mb-2">Bond Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Minimum Bond:</span>
                    <div className="text-white font-mono">{(Number(bondInfo.minBond) / 10**18).toFixed(5)} ETH</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Current Bond:</span>
                    <div className="text-white font-mono">
                      {bondInfo.hasAnswers 
                        ? `${(Number(bondInfo.currentBond) / 10**18).toFixed(5)} ETH`
                        : "No answers yet"
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Required Next Bond:</span>
                    <div className="text-white font-mono">{(Number(bondInfo.requiredNextBond) / 10**18).toFixed(5)} ETH</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {bondInfo.hasAnswers 
                    ? "⚠️ This question has existing answers. Your bond must be double the current bond to challenge."
                    : "✅ This is the first answer. You only need to meet the minimum bond requirement."
                  }
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-400">
              View on: 
              <a 
                href={`https://gateway.ipfs.io/ipfs/${ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 hover:underline"
              >
                IPFS Gateway
              </a>
              <span className="mx-1">|</span>
              <a 
                href={`https://ipfs.io/ipfs/${ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                IPFS.io
              </a>
              <span className="mx-1">|</span>
              <a 
                href={`https://w3s.link/ipfs/${ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                web3.storage
              </a>
            </div>
            {timeRemaining && (
              <div className="mt-1 p-2 bg-gray-800 rounded-md text-sm">
                <p className="text-amber-500">Verification Status: <span className="font-medium">In Progress</span></p>
                <p className="text-gray-300 mt-1">{timeRemaining}</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Note: IPFS content may take a few minutes to propagate across the network. If one gateway doesn't work, try another.
            </p>
          </div>
        )}
        
        {verificationStatus === "error" && (
          <div className="flex items-center gap-2 text-red-500 mt-4">
            <AlertCircle className="h-5 w-5" />
            <span>Invalid JSON format. Please upload a valid ERC7730 specification.</span>
          </div>
        )}
      </div>
    </Card>
  );
} 