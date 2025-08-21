"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowLeft, ExternalLink, RotateCcw, Clock, FileText } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { web3Service } from "~/lib/web3Service";
import { getQuestionData, hasFinalizationTimePassed, getTimeRemainingUntilFinalization, formatFinalizationTime, getQuestionsByUser } from "~/lib/realityEthService";
import { fetchIPFSMetadata, formatContractAddress, getChainName, type ERC7730Metadata } from "~/lib/ipfsMetadataService";
import Link from "next/link";

function VerificationStatusContent() {
  const searchParams = useSearchParams();
  const ipfsHash = searchParams?.get("ipfsHash");
  const questionId = searchParams?.get("questionId");
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizationTimestamp, setFinalizationTimestamp] = useState<string | null>(null);
  const [timeoutValue, setTimeoutValue] = useState<string | null>(null);
  const [createdTimestampValue, setCreatedTimestampValue] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [canFinalize, setCanFinalize] = useState(false);
  const [isProcessingResult, setIsProcessingResult] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const isValidTxHash = (h: string | null) => !!h && /^0x[a-fA-F0-9]{64}$/.test(h);
  const [specStatus, setSpecStatus] = useState<number>(-1);
  const [lastPolledTimestamp, setLastPolledTimestamp] = useState<string | null>(null);
  const [ipfsMetadata, setIpfsMetadata] = useState<ERC7730Metadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    // Update time remaining every second if we have a timestamp or createdTimestamp
    if (finalizationTimestamp || createdTimestampValue) {
      // Initial update
      const updateTimeRemaining = () => {
        const remaining = getTimeRemainingUntilFinalization(
          finalizationTimestamp || undefined,
          timeoutValue || undefined,
          createdTimestampValue || undefined
        );
        setTimeRemaining(remaining);
        
        // Also check if finalization time has passed
        const now = Date.now();
        let finalizationTime: number;
        
        if (finalizationTimestamp) {
          finalizationTime = parseInt(finalizationTimestamp) * 1000;
          console.log("Using finalizationTimestamp for calculation:", new Date(finalizationTime).toISOString());
        } else if (timeoutValue && createdTimestampValue) {
          finalizationTime = (parseInt(createdTimestampValue) + parseInt(timeoutValue)) * 1000;
          console.log("Using timeout + createdTimestamp for calculation:", new Date(finalizationTime).toISOString());
        } else if (createdTimestampValue) {
          finalizationTime = (parseInt(createdTimestampValue) + 172800) * 1000;
          console.log("Using default timeout + createdTimestamp for calculation:", new Date(finalizationTime).toISOString());
        } else {
          console.log("No timing data available for finalization check");
          return;
        }
        
        const newCanFinalize = now > finalizationTime;
        
        // Log detailed timing info when the value changes
        if (newCanFinalize !== canFinalize) {
          console.log("Finalization status changed to:", newCanFinalize);
          console.log("- Current time:", new Date(now).toISOString());
          console.log("- Finalization time:", new Date(finalizationTime).toISOString());
          console.log("- Time difference (ms):", now - finalizationTime);
        }
        
        setCanFinalize(newCanFinalize);
      };
      
      // Initial update
      updateTimeRemaining();
      
      const interval = setInterval(updateTimeRemaining, 1000); // Update every second
      
      return () => clearInterval(interval);
    }
  }, [finalizationTimestamp, timeoutValue, createdTimestampValue]);
  
  // Add periodic polling to check for challenges
  useEffect(() => {
    if (!ipfsHash || !questionId) return;
    
    // Store the initial finalization timestamp for comparison
    setLastPolledTimestamp(finalizationTimestamp);
    
    // Check for challenges every 30 seconds
    const pollInterval = setInterval(async () => {
      try {
        console.log("Polling for challenges...");
        const questionData = await getQuestionData(questionId);
        
        if (questionData && questionData.currentScheduledFinalizationTimestamp) {
          // If the timestamp has changed and is later than before, a challenge might have occurred
          if (lastPolledTimestamp && 
              questionData.currentScheduledFinalizationTimestamp !== lastPolledTimestamp &&
              parseInt(questionData.currentScheduledFinalizationTimestamp) > parseInt(lastPolledTimestamp)) {
            
            console.log("Challenge detected! Finalization time has changed:");
            console.log("- Previous time:", new Date(parseInt(lastPolledTimestamp) * 1000).toLocaleString());
            console.log("- New time:", new Date(parseInt(questionData.currentScheduledFinalizationTimestamp) * 1000).toLocaleString());
            
            // Update the UI with new data
            setFinalizationTimestamp(questionData.currentScheduledFinalizationTimestamp);
            setTimeoutValue(questionData.timeout || null);
            setCreatedTimestampValue(questionData.createdTimestamp || null);
            
            // Recalculate time remaining based on new data
            const remaining = getTimeRemainingUntilFinalization(
              questionData.currentScheduledFinalizationTimestamp,
              questionData.timeout,
              questionData.createdTimestamp
            );
            setTimeRemaining(remaining);
            
            // Update finalization status
            const now = Date.now();
            const newFinalizationTime = parseInt(questionData.currentScheduledFinalizationTimestamp) * 1000;
            setCanFinalize(now > newFinalizationTime);
            
            // Notify the user
            toast({
              title: "Verification Challenge Detected",
              description: "The verification time has been extended due to a challenge.",
              variant: "default",
            });
          }
          
          // Update the last polled timestamp
          setLastPolledTimestamp(questionData.currentScheduledFinalizationTimestamp);
        }
      } catch (error) {
        console.error("Error polling for challenges:", error);
      }
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(pollInterval);
  }, [ipfsHash, questionId, lastPolledTimestamp, toast]);
  
  useEffect(() => {
    if (ipfsHash && questionId) {
      fetchData();
    }
  }, [ipfsHash, questionId]);
  
  const fetchIPFSMetadataData = async () => {
    if (!ipfsHash) return;
    
    setIsLoadingMetadata(true);
    
    try {
      console.log("Fetching IPFS metadata for hash:", ipfsHash);
      const metadata = await fetchIPFSMetadata(ipfsHash);
      setIpfsMetadata(metadata);
      
      console.log("Successfully fetched IPFS metadata:", metadata);
    } catch (error: any) {
      console.error("Error fetching IPFS metadata:", error);
      // Don't set error state for metadata fetch failures, just log them
      toast({
        title: "IPFS Metadata Warning",
        description: "Could not fetch IPFS metadata. The file might still be propagating across the network.",
        variant: "default",
      });
    } finally {
      setIsLoadingMetadata(false);
    }
  };
  
  const fetchData = async () => {
    if (!ipfsHash || !questionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch IPFS metadata in parallel
      fetchIPFSMetadataData();
      
      // Get question data from Reality.eth
      try {
        console.log("Trying to get question data for ID:", questionId);
        const questionData = await getQuestionData(questionId);
        
        if (!questionData) {
          console.warn("Question data is null in verification status page");
          
          // Use estimated values instead of throwing an error
          const defaultCreatedTimestamp = Math.floor(Date.now() / 1000 - 172800).toString(); // 2 days ago
          setCreatedTimestampValue(defaultCreatedTimestamp);
          setTimeoutValue("172800"); // 2 day timeout as default
          
          // Calculate time with defaults
          const remaining = getTimeRemainingUntilFinalization(
            undefined,
            "172800",
            defaultCreatedTimestamp
          );
          setTimeRemaining(remaining);
          
          // Direct calculation for finalization status
          const now = Date.now();
          const estimatedFinalizationTime = (parseInt(defaultCreatedTimestamp) + 172800) * 1000;
          const directCanFinalize = now > estimatedFinalizationTime;
          
          console.log("Fallback calculation of canFinalize:", directCanFinalize);
          console.log("- Current time:", new Date(now).toISOString());
          console.log("- Estimated finalization time:", new Date(estimatedFinalizationTime).toISOString());
          console.log("- Time difference (seconds):", (now - estimatedFinalizationTime) / 1000);
          
          // We trust the direct calculation for fallback case
          setCanFinalize(directCanFinalize);
          
          // Also check using the service
          try {
            // This will likely return false since there's no question data
            const serviceCanFinalize = await hasFinalizationTimePassed(questionId);
            console.log("Service hasFinalizationTimePassed returned:", serviceCanFinalize);
            
            // If there's a mismatch, log it but still use our direct calculation
            if (serviceCanFinalize !== directCanFinalize) {
              console.warn("Mismatch between service and direct calculation in fallback");
            }
          } catch (finalizeError) {
            console.error("Error checking finalization with service:", finalizeError);
          }
          
          // Get spec status from contract
          try {
            const status = await web3Service.getSpecStatus(ipfsHash);
            setSpecStatus(status);
          } catch (statusError) {
            console.error("Error getting spec status:", statusError);
            // Don't set an error as the status might not be available yet
          }
          
          return;
        }
        
        console.log("Received question data in status page:", questionData);
        
        // Set state with available data, handling optional fields
        setFinalizationTimestamp(questionData.currentScheduledFinalizationTimestamp || null);
        setTimeoutValue(questionData.timeout || null);
        setCreatedTimestampValue(questionData.createdTimestamp || null);
        
        // Calculate time remaining based on available data
        const remaining = getTimeRemainingUntilFinalization(
          questionData.currentScheduledFinalizationTimestamp,
          questionData.timeout,
          questionData.createdTimestamp
        );
        setTimeRemaining(remaining);
        
        // Check if finalization time has passed
        const canFinalize = await hasFinalizationTimePassed(questionId);
        setCanFinalize(canFinalize);
        
        // Log why canFinalize is set the way it is for debugging
        console.log("Initial canFinalize value set to:", canFinalize);
        
        // Double check with direct calculation
        let calculatedFinalizationTime: number | null = null;
        if (questionData.currentScheduledFinalizationTimestamp) {
          calculatedFinalizationTime = parseInt(questionData.currentScheduledFinalizationTimestamp) * 1000;
        } else if (questionData.timeout && questionData.createdTimestamp) {
          calculatedFinalizationTime = (parseInt(questionData.createdTimestamp) + parseInt(questionData.timeout)) * 1000;
        } else if (questionData.createdTimestamp) {
          calculatedFinalizationTime = (parseInt(questionData.createdTimestamp) + 172800) * 1000;
        }
        
        if (calculatedFinalizationTime) {
          const now = Date.now();
          const directlyCalculated = now > calculatedFinalizationTime;
          console.log("Direct calculation of canFinalize:", directlyCalculated);
          console.log("- Current time:", new Date(now).toISOString());
          console.log("- Calculated finalization time:", new Date(calculatedFinalizationTime).toISOString());
          console.log("- Time difference (seconds):", (now - calculatedFinalizationTime) / 1000);
          
          // If there's a mismatch, use the direct calculation as it's more reliable
          if (directlyCalculated !== canFinalize) {
            console.warn("Mismatch between hasFinalizationTimePassed and direct calculation, using direct calculation");
            setCanFinalize(directlyCalculated);
          }
        }
        
        // Get spec status from contract
        try {
          const status = await web3Service.getSpecStatus(ipfsHash);
          setSpecStatus(status);
        } catch (statusError) {
          console.error("Error getting spec status:", statusError);
          // Don't set an error as the status might not be available yet
        }
      } catch (questionError: any) {
        console.error("Error fetching question data:", questionError);
        
        // Handle question not found errors specifically
        if (questionError.message.includes("Question not found") || questionError.message.includes("No question data found")) {
          setError("This question hasn't been registered in Reality.eth yet. Please wait a few minutes for the transaction to be processed and try again.");
        } else {
          setError(questionError.message || "Failed to fetch verification data. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Error fetching verification data:", err);
      setError(err.message || "Failed to fetch verification data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResult = async () => {
    if (!ipfsHash || !canFinalize) {
      toast({
        title: "Action Required",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessingResult(true);
    
    try {
      // Call handleResult on the contract
      const txHash = await web3Service.handleResult(ipfsHash);
      setTransactionHash(txHash);
      
      toast({
        title: "Transaction Submitted",
        description: `Successfully submitted transaction to fetch the verification result.`,
        variant: "default",
      });
      
      // Wait a bit and then fetch the new status
      setTimeout(async () => {
        try {
          const newStatus = await web3Service.getSpecStatus(ipfsHash);
          setSpecStatus(newStatus);
        } catch (statusError) {
          console.error("Error getting updated spec status:", statusError);
        }
      }, 3000);
    } catch (error: any) {
      console.error("Error handling result:", error);
      toast({
        title: "Error Processing Result",
        description: error.message || "Failed to process verification result. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingResult(false);
    }
  };
  
  const refreshStatus = async () => {
    if (!ipfsHash) return;
    
    setIsLoading(true);
    
    try {
      // Refresh IPFS metadata
      await fetchIPFSMetadataData();
      
      // Get the latest question data
      if (questionId) {
        const questionData = await getQuestionData(questionId);
        
        if (questionData && questionData.currentScheduledFinalizationTimestamp) {
          setFinalizationTimestamp(questionData.currentScheduledFinalizationTimestamp);
          setLastPolledTimestamp(questionData.currentScheduledFinalizationTimestamp);
        }
        
        // Check if finalization time has passed
        const canFinalizeCheck = await hasFinalizationTimePassed(questionId);
        setCanFinalize(canFinalizeCheck);
      }
      
      // Get spec status if available
      const status = await web3Service.getSpecStatus(ipfsHash);
      setSpecStatus(status);
      
      toast({
        title: "Status Refreshed",
        description: "The verification status has been updated.",
        variant: "default",
      });
    } catch (err: any) {
      console.error("Error refreshing status:", err);
      toast({
        title: "Error Refreshing Status",
        description: err.message || "Failed to refresh status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusDisplay = () => {
    if (specStatus === null) {
      return (
        <div className="flex items-center p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
          <span className="text-yellow-500">Status not yet available</span>
        </div>
      );
    }
    
    switch (specStatus) {
      case 0: // Submitted
        return (
          <div className="flex items-center p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-500 mr-2" />
            <span className="text-blue-500">Submitted - Waiting for verification</span>
          </div>
        );
      case 1: // Accepted
        return (
          <div className="flex items-center p-3 bg-green-900/30 border border-green-700 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-500">Accepted - Specification verified as valid</span>
          </div>
        );
      case 2: // Rejected
        return (
          <div className="flex items-center p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-500">Rejected - Specification deemed invalid</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center p-3 bg-gray-900/30 border border-gray-700 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-gray-500 mr-2" />
            <span className="text-gray-500">Unknown status</span>
          </div>
        );
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Loading Verification Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-400">Fetching verification data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Error</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg mb-6">
              <p className="text-red-500">{error}</p>
            </div>
            <Link href="/verification-results">
              <Button variant="outline" className="flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Upload
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Verification Status</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={isProcessingResult}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">IPFS Hash</h3>
            <div className="flex items-center">
              <code className="font-mono text-sm bg-gray-800 px-3 py-2 rounded break-all">{ipfsHash}</code>
              <a 
                href={`https://ipfs.io/ipfs/${ipfsHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          
          {/* IPFS Metadata Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              ERC7730 Specification Details
            </h3>
            {isLoadingMetadata ? (
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400 mr-2" />
                  <span className="text-gray-300">Loading specification metadata...</span>
                </div>
              </div>
            ) : ipfsMetadata ? (
              <div className="p-4 bg-gray-800 rounded-lg space-y-3">
                {ipfsMetadata.contractAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Contract Address:</label>
                    <div className="flex items-center mt-1">
                      <code className="font-mono text-sm bg-gray-700 px-2 py-1 rounded text-green-400">
                        {formatContractAddress(ipfsMetadata.contractAddress)}
                      </code>
                      {ipfsMetadata.chainId === 1 && (
                        <a 
                          href={`https://etherscan.io/address/${formatContractAddress(ipfsMetadata.contractAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {ipfsMetadata.chainId && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Chain ID:</label>
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded text-sm bg-blue-900/30 text-blue-400 border border-blue-700">
                        {ipfsMetadata.chainId} - {getChainName(ipfsMetadata.chainId)}
                      </span>
                    </div>
                  </div>
                )}
                
                {ipfsMetadata.domain?.name && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Domain Name:</label>
                    <div className="mt-1">
                      <span className="text-gray-300">{ipfsMetadata.domain.name}</span>
                    </div>
                  </div>
                )}
                
                {ipfsMetadata.metadata?.owner && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Owner:</label>
                    <div className="mt-1">
                      <span className="text-gray-300">{ipfsMetadata.metadata.owner}</span>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-400">IPFS Link:</label>
                  <div className="mt-1">
                    <a 
                      href={ipfsMetadata.ipfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center"
                    >
                      {ipfsMetadata.ipfsUrl}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
                
                {ipfsMetadata.deployments && ipfsMetadata.deployments.length > 1 && (
                  <div>
                    <label className="text-sm font-medium text-gray-400">Additional Deployments:</label>
                    <div className="mt-1 space-y-1">
                      {ipfsMetadata.deployments.slice(1).map((deployment, index) => (
                        <div key={index} className="text-sm text-gray-300">
                          <span className="text-blue-400">{getChainName(deployment.chainId)}</span>: {formatContractAddress(deployment.address)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                  <span className="text-gray-300">Specification metadata not available</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  The IPFS content might still be propagating across the network.
                </p>
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Question ID</h3>
            <div className="flex items-center">
              <code className="font-mono text-sm bg-gray-800 px-3 py-2 rounded break-all">{questionId}</code>
              <a 
                href={`https://reality.eth.limo/app/#!/question/0xaf33dcb6e8c5c4d9ddf579f53031b514d19449ca-${questionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Verification Status</h3>
            {getStatusDisplay()}
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Verification Timing</h3>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-blue-400 mr-3" />
                <div>
                  {finalizationTimestamp ? (
                    <>
                      <p className="text-gray-300 font-medium">
                        Finalization Time: {new Date(parseInt(finalizationTimestamp) * 1000).toLocaleString()}
                      </p>
                      <p className={`mt-1 text-sm font-bold ${canFinalize ? "text-green-500" : "text-amber-500"}`}>
                        {canFinalize ? "Finalization time has passed" : timeRemaining}
                      </p>
                    </>
                  ) : createdTimestampValue ? (
                    <>
                      <p className="text-gray-300 font-medium">
                        Estimated Finalization Time: {new Date((parseInt(createdTimestampValue) + (parseInt(timeoutValue || '172800'))) * 1000).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Based on creation time ({new Date(parseInt(createdTimestampValue) * 1000).toLocaleString()}) + 
                        {timeoutValue ? ` timeout (${Math.round(parseInt(timeoutValue) / 3600)} hours)` : " default timeout (2 days)"}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-300">Timing information unavailable</p>
                  )}
                </div>
              </div>
              
              {canFinalize && (
                <div className="mt-3 p-3 bg-green-900/30 border border-green-600 rounded-lg">
                  <p className="text-green-400 font-medium flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verification period has ended. You can now fetch the result.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between mt-8">
            <Link href="/verification-results">
              <Button variant="outline" className="flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Upload
              </Button>
            </Link>
            
            {canFinalize && specStatus !== 1 && specStatus !== 2 && (
              <Button 
                onClick={handleResult}
                disabled={isProcessingResult || !canFinalize}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessingResult ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Fetch Verification Result"
                )}
              </Button>
            )}
          </div>
          
          {transactionHash && (
            <div className="mt-6 p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <p className="text-green-500 font-medium mb-1">Transaction Submitted!</p>
              <div className="flex justify-between items-center">
                <code className="font-mono text-xs text-gray-400 truncate max-w-xs">{transactionHash}</code>
                {isValidTxHash(transactionHash) ? (
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline ml-2 flex items-center"
                  >
                    View on Etherscan
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                ) : (
                  <span className="text-sm text-gray-400 ml-2">Awaiting valid transaction hash…</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerificationStatusPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Loading Verification Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-400">Fetching verification data...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VerificationStatusContent />
    </Suspense>
  );
} 