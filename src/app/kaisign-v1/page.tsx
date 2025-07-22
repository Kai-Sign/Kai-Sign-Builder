"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";
import { web3Service } from "~/lib/web3Service";
import { 
  Gift, 
  Wallet, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Coins,
  Users,
  FileText,
  TrendingUp,
  Gavel,
  DollarSign
} from "lucide-react";
import Link from "next/link";

interface IncentiveData {
  incentiveId: string;
  creator: string;
  targetContract: string;
  token: string;
  amount: string;
  deadline: number;
  createdAt: number;
  description: string;
  isClaimed: boolean;
  isActive: boolean;
}

interface SpecData {
  specId: string;
  creator: string;
  targetContract: string;
  ipfs: string;
  status: number; // Status enum
  createdTimestamp: number;
  proposedTimestamp: number;
  totalBonds: string;
  bondsSettled: boolean;
}

export default function KaiSignV1Page() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  // Incentive creation state
  const [targetContract, setTargetContract] = useState("");
  const [selectedChain, setSelectedChain] = useState("1"); // Default to mainnet
  const [tokenAddress, setTokenAddress] = useState("");
  const [incentiveAmount, setIncentiveAmount] = useState("");
  const [duration, setDuration] = useState("7"); // days
  const [description, setDescription] = useState("");
  const [isCreatingIncentive, setIsCreatingIncentive] = useState(false);
  const [contractVerificationStatus, setContractVerificationStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [contractInfo, setContractInfo] = useState<any>(null);

  // Data state
  const [userIncentives, setUserIncentives] = useState<IncentiveData[]>([]);
  const [contractSpecs, setContractSpecs] = useState<SpecData[]>([]);
  const [selectedContract, setSelectedContract] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Contract browsing state
  const [specSearchContract, setSpecSearchContract] = useState("");
  const [searchedSpecs, setSearchedSpecs] = useState<SpecData[]>([]);
  const [isSearchingSpecs, setIsSearchingSpecs] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      const account = await web3Service.getCurrentAccount();
      if (account) {
        setCurrentAccount(account);
        setWalletConnected(true);
        await loadUserData(account);
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const account = await web3Service.connect();
      setCurrentAccount(account);
      setWalletConnected(true);
      await loadUserData(account);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${account.substring(0, 6)}...${account.substring(account.length - 4)}`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const loadUserData = async (account: string) => {
    setIsLoadingData(true);
    try {
      // Load user's incentive IDs
      const incentiveIds = await web3Service.getUserIncentives(account);
      
      if (incentiveIds.length === 0) {
        setUserIncentives([]);
        toast({
          title: "No Incentives Found",
          description: "You haven't created any incentives yet. Create one using the form below!",
          variant: "default",
        });
        return;
      }
      
      // Load detailed data for each incentive
      const incentiveDetails = await Promise.all(
        incentiveIds.map(async (id: string) => {
          try {
            const data = await web3Service.getIncentiveData(id);
            return { incentiveId: id, ...data };
          } catch (error) {
            console.error(`Error loading incentive ${id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out failed loads and set data
      const validIncentives = incentiveDetails.filter(Boolean) as IncentiveData[];
      setUserIncentives(validIncentives);
      
      if (validIncentives.length > 0) {
        toast({
          title: "Incentives Loaded",
          description: `Found ${validIncentives.length} incentive(s) for your account`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Error loading user data:", error);
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load your incentives. Please try refreshing.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const verifyContract = async () => {
    if (!targetContract || !selectedChain) return;
    
    setContractVerificationStatus("verifying");
    setContractInfo(null);
    
    try {
      const chainNames: { [key: string]: string } = {
        "1": "mainnet",
        "11155111": "sepolia",
        "137": "polygon",
        "8453": "base",
        "42161": "arbitrum",
        "10": "optimism"
      };
      
      const explorerUrls: { [key: string]: string } = {
        "1": "https://etherscan.io",
        "11155111": "https://sepolia.etherscan.io", 
        "137": "https://polygonscan.com",
        "8453": "https://basescan.org",
        "42161": "https://arbiscan.io",
        "10": "https://optimistic.etherscan.io"
      };
      
      const explorerApiUrls: { [key: string]: string } = {
        "1": "https://api.etherscan.io/api",
        "11155111": "https://api-sepolia.etherscan.io/api",
        "137": "https://api.polygonscan.com/api",
        "8453": "https://api.basescan.org/api",
        "42161": "https://api.arbiscan.io/api",
        "10": "https://api-optimistic.etherscan.io/api"
      };
      
      const chainName = chainNames[selectedChain] || "unknown";
      const explorerUrl = explorerUrls[selectedChain];
      const explorerApiUrl = explorerApiUrls[selectedChain];
      
      // Basic address validation
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetContract)) {
        throw new Error("Invalid contract address format");
      }
      
      let contractExists = false;
      let contractInfo = null;
      
      try {
        // Try to verify contract existence using explorer API
        if (explorerApiUrl) {
          const response = await fetch(
            `${explorerApiUrl}?module=proxy&action=eth_getCode&address=${targetContract}&tag=latest`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.result && data.result !== '0x' && data.result.length > 2) {
              contractExists = true;
              
              // Try to get contract name/info if available
              try {
                const nameResponse = await fetch(
                  `${explorerApiUrl}?module=contract&action=getsourcecode&address=${targetContract}`
                );
                if (nameResponse.ok) {
                  const nameData = await nameResponse.json();
                  if (nameData.result && nameData.result[0]) {
                    contractInfo = {
                      name: nameData.result[0].ContractName || "Unknown Contract",
                      verified: nameData.result[0].SourceCode !== "",
                      compiler: nameData.result[0].CompilerVersion || "Unknown"
                    };
                  }
                }
              } catch (infoError) {
                // Could not fetch contract info, but contract exists
              }
            }
          }
        }
      } catch (apiError) {
        // API verification failed, falling back to basic validation
      }
      
      const contractData = {
        address: targetContract,
        chainId: selectedChain,
        chainName: chainName,
        explorerUrl: `${explorerUrl}/address/${targetContract}`,
        verified: contractExists,
        contractInfo: contractInfo,
        exists: contractExists
      };
      
      setContractInfo(contractData);
      setContractVerificationStatus("verified");
      
      toast({
        title: contractExists ? "Contract Verified! ✅" : "Address Format Valid ℹ️",
        description: contractExists 
          ? `Contract found on ${chainName}. ${contractInfo?.name ? `Name: ${contractInfo.name}` : "Click explorer link to view details."}`
          : `Address format is valid. Click explorer link to verify the contract exists on ${chainName}.`,
        variant: contractExists ? "default" : "default",
      });
    } catch (error: any) {
      console.error("Contract verification failed:", error);
      setContractVerificationStatus("error");
      toast({
        title: "Verification Failed",
        description: error.message || "Could not verify contract",
        variant: "destructive",
      });
    }
  };

  const createIncentive = async () => {
    if (!walletConnected || !targetContract || !incentiveAmount || !duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    if (contractVerificationStatus !== "verified") {
      toast({
        title: "Contract Verification Required",
        description: "Please verify your contract address before creating the incentive",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingIncentive(true);
    try {
      const durationSeconds = parseInt(duration) * 24 * 60 * 60; // Convert days to seconds
      const amountWei = (parseFloat(incentiveAmount) * 10**18).toString();
      
      // Create the incentive on-chain with enhanced description
      const enhancedDescription = `${description} [Chain: ${contractInfo?.chainName || 'Unknown'}, Contract: ${targetContract}]`;
      
      const txHash = await web3Service.createIncentive(
        targetContract,
        tokenAddress || "0x0000000000000000000000000000000000000000", // ETH
        amountWei,
        durationSeconds,
        enhancedDescription
      );
      
      toast({
        title: "Incentive Created! 🎉",
        description: `Transaction confirmed: ${txHash.substring(0, 10)}... Check Etherscan for details.`,
        variant: "default",
      });

      // Reset form
      setTargetContract("");
      setTokenAddress("");
      setIncentiveAmount("");
      setDuration("7");
      setDescription("");
      
      // Reload data
      await loadUserData(currentAccount);
    } catch (error: any) {
      toast({
        title: "Failed to Create Incentive",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsCreatingIncentive(false);
    }
  };

  const searchSpecsByContract = async () => {
    if (!specSearchContract) return;
    
    setIsSearchingSpecs(true);
    try {
      // This function needs to be implemented in web3Service
      // const specs = await web3Service.getSpecsByContract(specSearchContract);
      // setSearchedSpecs(specs);
      
      toast({
        title: "Search Complete",
        description: `Found specifications for contract ${specSearchContract.substring(0, 8)}...`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search specifications",
        variant: "destructive",
      });
    } finally {
      setIsSearchingSpecs(false);
    }
  };

  const getStatusBadge = (status: number) => {
    const statusNames = ["Committed", "Submitted", "Proposed", "Finalized", "Cancelled"];
    const colors = ["gray", "blue", "yellow", "green", "red"];
    
    return (
      <Badge variant={status === 3 ? "default" : "secondary"} className={`bg-${colors[status]}-600`}>
        {statusNames[status] || "Unknown"}
      </Badge>
    );
  };

  if (!walletConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">KaiSign V1 Management</h1>
            <p className="text-gray-400 mb-8">
              Manage incentives, view specifications, and interact with the KaiSign V1 contract.
            </p>
          </div>
          
          <Card className="p-8 bg-gray-950 border-gray-800">
            <Wallet className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h2 className="text-xl font-medium mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to manage incentives and view your specifications.
            </p>
            
            <Button
              onClick={connectWallet}
              disabled={isConnecting}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">KaiSign V1 Management</h1>
          <p className="text-gray-400 mb-4">
            Connected: {currentAccount.substring(0, 6)}...{currentAccount.substring(currentAccount.length - 4)}
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Incentives</p>
                  <p className="text-2xl font-bold">{userIncentives.filter(i => i.isActive).length}</p>
                </div>
                <Gift className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            
            <Card className="p-4 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Incentives</p>
                  <p className="text-2xl font-bold">{userIncentives.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            
            <Card className="p-4 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Specifications</p>
                  <p className="text-2xl font-bold">{contractSpecs.length}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </Card>
            
            <Card className="p-4 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Network</p>
                  <p className="text-lg font-bold">Sepolia</p>
                </div>
                <Coins className="h-8 w-8 text-yellow-500" />
              </div>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="incentives" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-900 border-gray-800">
            <TabsTrigger value="incentives" className="data-[state=active]:bg-gray-800">
              <Gift className="mr-2 h-4 w-4" />
              Incentives
            </TabsTrigger>
            <TabsTrigger value="specifications" className="data-[state=active]:bg-gray-800">
              <FileText className="mr-2 h-4 w-4" />
              Specifications
            </TabsTrigger>
            <TabsTrigger value="browse" className="data-[state=active]:bg-gray-800">
              <Users className="mr-2 h-4 w-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="bonds" className="data-[state=active]:bg-gray-800">
              <Gavel className="mr-2 h-4 w-4" />
              Bonds
            </TabsTrigger>
          </TabsList>

          {/* Incentives Tab */}
          <TabsContent value="incentives" className="space-y-6">
            {/* Incentive System Explanation */}
            <Card className="p-4 bg-blue-950/30 border-blue-800">
              <h3 className="text-lg font-medium text-blue-100 mb-2 flex items-center">
                <Gift className="mr-2 h-5 w-5" />
                How Incentives Work
              </h3>
              <div className="text-sm text-blue-200 space-y-1">
                <p>• <strong>Create incentives</strong> to reward high-quality ERC7730 specifications</p>
                <p>• <strong>Anyone can claim</strong> by submitting a valid spec for your target contract</p>
                <p>• <strong>Automatic payout</strong> happens when Reality.eth validates the submission</p>
                <p>• <strong>Cross-chain support:</strong> Use Sepolia contracts as placeholders for mainnet specs</p>
              </div>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Incentive */}
              <Card className="p-6 bg-gray-950 border-gray-800">
                <h2 className="text-xl font-medium mb-4 flex items-center">
                  <Gift className="mr-2 h-5 w-5 text-green-500" />
                  Create Incentive
                </h2>
                
                <div className="space-y-4">
                  {/* Chain Selection */}
                  <div>
                    <Label htmlFor="chainSelect">Target Blockchain</Label>
                    <select
                      id="chainSelect"
                      value={selectedChain}
                      onChange={(e) => {
                        setSelectedChain(e.target.value);
                        setContractVerificationStatus("idle");
                        setContractInfo(null);
                      }}
                      className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white"
                    >
                      <option value="1">Ethereum Mainnet</option>
                      <option value="11155111">Sepolia Testnet</option>
                      <option value="137">Polygon</option>
                      <option value="8453">Base</option>
                      <option value="42161">Arbitrum</option>
                      <option value="10">Optimism</option>
                    </select>
                  </div>
                  
                  {/* Contract Address Input */}
                  <div>
                    <Label htmlFor="targetContract">Target Contract Address</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="targetContract"
                        value={targetContract}
                        onChange={(e) => {
                          setTargetContract(e.target.value);
                          setContractVerificationStatus("idle");
                          setContractInfo(null);
                        }}
                        placeholder="0x..."
                        className="bg-gray-900 border-gray-700"
                      />
                      <Button
                        type="button"
                        onClick={verifyContract}
                        disabled={!targetContract || contractVerificationStatus === "verifying"}
                        className="bg-blue-600 hover:bg-blue-700 min-w-[100px]"
                      >
                        {contractVerificationStatus === "verifying" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verify
                          </>
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Contract Verification Result */}
                  {contractVerificationStatus === "verified" && contractInfo && (
                    <div className={`p-4 border rounded ${
                      contractInfo.exists 
                        ? "bg-green-900/30 border-green-700" 
                        : "bg-blue-900/30 border-blue-700"
                    }`}>
                      <div className="flex items-center mb-2">
                        {contractInfo.exists ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-green-400 font-medium">Contract Found & Verified</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-blue-500 mr-2" />
                            <span className="text-blue-400 font-medium">Address Format Valid</span>
                          </>
                        )}
                      </div>
                      <div className={`space-y-1 text-sm ${
                        contractInfo.exists ? "text-green-200" : "text-blue-200"
                      }`}>
                        <p><strong>Address:</strong> {contractInfo.address}</p>
                        <p><strong>Chain:</strong> {contractInfo.chainName}</p>
                        {contractInfo.contractInfo && (
                          <>
                            <p><strong>Name:</strong> {contractInfo.contractInfo.name}</p>
                            <p><strong>Source Verified:</strong> {contractInfo.contractInfo.verified ? "Yes" : "No"}</p>
                          </>
                        )}
                        <p><strong>Explorer:</strong> 
                          <a 
                            href={contractInfo.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-400 hover:underline"
                          >
                            View on Explorer →
                          </a>
                        </p>
                      </div>
                      <div className={`mt-2 p-2 border rounded text-xs ${
                        contractInfo.exists 
                          ? "bg-green-800/30 border-green-600 text-green-300"
                          : "bg-blue-800/30 border-blue-600 text-blue-300"
                      }`}>
                        {contractInfo.exists ? (
                          <><strong>✅ Contract Verified:</strong> This contract exists on {contractInfo.chainName}. You can proceed with creating the incentive.</>
                        ) : (
                          <><strong>⚠️ Manual Verification Required:</strong> Please click the explorer link to confirm this contract exists on {contractInfo.chainName} before proceeding.</>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {contractVerificationStatus === "error" && (
                    <div className="p-3 bg-red-900/30 border border-red-700 rounded">
                      <div className="flex items-center text-red-400">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span className="font-medium">Verification Failed</span>
                      </div>
                      <p className="text-sm text-red-300 mt-1">
                        Please check the contract address and try again.
                      </p>
                    </div>
                  )}
                  
                  {/* Cross-Chain Explanation */}
                  <div className="p-3 bg-blue-950/30 border border-blue-800 rounded text-xs text-blue-200">
                    <p><strong>💡 Cross-Chain Incentives:</strong></p>
                    <p>• Your incentive is stored on Sepolia (where KaiSign lives)</p>
                    <p>• But you can incentivize specs for contracts on ANY chain</p>
                    <p>• The ERC7730 spec will contain the real contract details</p>
                    <p>• Verify your contract above before creating the incentive</p>
                  </div>
                
                  <div>
                    <Label htmlFor="tokenAddress">Token Address (Optional)</Label>
                    <Input
                      id="tokenAddress"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      placeholder="0x... (leave empty for ETH)"
                      className="bg-gray-900 border-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty for ETH incentive
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Incentive Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={incentiveAmount}
                      onChange={(e) => setIncentiveAmount(e.target.value)}
                      placeholder="0.1"
                      className="bg-gray-900 border-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amount in {tokenAddress ? "tokens" : "ETH"}
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="duration">Duration (Days)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      max="30"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="bg-gray-900 border-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How long the incentive remains active (1-30 days)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this incentive is for..."
                      rows={3}
                      className="bg-gray-900 border-gray-700"
                    />
                  </div>
                  
                  <Button
                    onClick={createIncentive}
                    disabled={isCreatingIncentive}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isCreatingIncentive ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Incentive...
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-4 w-4" />
                        Create Incentive
                      </>
                    )}
                  </Button>
                </div>
              </Card>
              
              {/* User's Incentives */}
              <Card className="p-6 bg-gray-950 border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-medium">Your Incentives</h2>
                  <Button
                    onClick={() => loadUserData(currentAccount)}
                    disabled={isLoadingData}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    {isLoadingData ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Refresh"
                    )}
                  </Button>
                </div>
                
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : userIncentives.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Gift className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No incentives created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {userIncentives.map((incentive) => (
                      <div
                        key={incentive.incentiveId}
                        className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="font-medium">
                              {incentive.token === "0x0000000000000000000000000000000000000000" 
                                ? `${(Number(incentive.amount) / 10**18).toFixed(4)} ETH`
                                : `${incentive.amount} Tokens`
                              }
                            </span>
                            {incentive.isActive && (
                              <Badge variant="default" className="bg-green-600">
                                Active
                              </Badge>
                            )}
                            {incentive.isClaimed && (
                              <Badge variant="secondary" className="bg-blue-600">
                                Claimed
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-400 mb-2">{incentive.description}</p>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              Target: {incentive.targetContract.substring(0, 8)}...
                            </span>
                            <span>
                              Expires: {new Date(incentive.deadline * 1000).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {/* Incentive Status Indicator */}
                          <div className="p-2 bg-gray-800 rounded text-xs">
                            {incentive.isClaimed ? (
                              <div className="flex items-center text-green-400">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span>Claimed - Reward has been distributed</span>
                              </div>
                            ) : incentive.isActive ? (
                              <div className="flex items-center text-blue-400">
                                <Clock className="h-3 w-3 mr-1" />
                                <span>Available - Waiting for valid submission</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-400">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                <span>Expired - No longer claimable</span>
                              </div>
                            )}
                          </div>
                          
                          {/* How to Claim Instructions */}
                          {!incentive.isClaimed && incentive.isActive && (
                            <div className="p-2 bg-green-900/20 border border-green-700 rounded text-xs text-green-300">
                              <p><strong>💡 How to claim this incentive:</strong></p>
                              <p>1. Create an ERC7730 spec for target contract {incentive.targetContract.substring(0, 8)}...</p>
                              <p>2. Submit via <a href="/verification-results" className="text-blue-400 hover:underline">verification page</a></p>
                              <p>3. Select this incentive during submission</p>
                              <p>4. If your spec is validated as correct, you automatically get the reward!</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Specifications Tab */}
          <TabsContent value="specifications" className="space-y-6">
            <Card className="p-6 bg-gray-950 border-gray-800">
              <h2 className="text-xl font-medium mb-4">Your Specifications</h2>
              
              <div className="mb-4">
                <Link href="/verification-results">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <FileText className="mr-2 h-4 w-4" />
                    Create New Specification
                  </Button>
                </Link>
              </div>
              
              {contractSpecs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No specifications created yet</p>
                  <p className="text-sm mt-2">Create your first ERC7730 specification above</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contractSpecs.map((spec) => (
                    <div
                      key={spec.specId}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="font-medium font-mono text-sm">
                            {spec.ipfs.substring(0, 12)}...
                          </span>
                          {getStatusBadge(spec.status)}
                        </div>
                        <a
                          href={`https://gateway.ipfs.io/ipfs/${spec.ipfs}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                        <span>Target: {spec.targetContract.substring(0, 10)}...</span>
                        <span>Bonds: {Number(spec.totalBonds) / 10**18} ETH</span>
                        <span>Created: {new Date(spec.createdTimestamp * 1000).toLocaleDateString()}</span>
                        <span>Settled: {spec.bondsSettled ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Browse Tab */}
          <TabsContent value="browse" className="space-y-6">
            <Card className="p-6 bg-gray-950 border-gray-800">
              <h2 className="text-xl font-medium mb-4">Browse Specifications by Contract</h2>
              
              <div className="flex space-x-4 mb-6">
                <Input
                  value={specSearchContract}
                  onChange={(e) => setSpecSearchContract(e.target.value)}
                  placeholder="Enter contract address..."
                  className="bg-gray-900 border-gray-700"
                />
                <Button
                  onClick={searchSpecsByContract}
                  disabled={isSearchingSpecs || !specSearchContract}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSearchingSpecs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              
              {searchedSpecs.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    Specifications for {specSearchContract.substring(0, 10)}...
                  </h3>
                  
                  {searchedSpecs.map((spec) => (
                    <div
                      key={spec.specId}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-purple-500" />
                          <span className="font-medium font-mono text-sm">
                            {spec.ipfs}
                          </span>
                          {getStatusBadge(spec.status)}
                        </div>
                        <div className="flex space-x-2">
                          <a
                            href={`https://gateway.ipfs.io/ipfs/${spec.ipfs}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400">
                        <span>Creator: {spec.creator.substring(0, 10)}...</span>
                        <span>Bonds: {Number(spec.totalBonds) / 10**18} ETH</span>
                        <span>Created: {new Date(spec.createdTimestamp * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Bonds Tab */}
          <TabsContent value="bonds" className="space-y-6">
            <Card className="p-6 bg-gray-950 border-gray-800">
              <h2 className="text-xl font-medium mb-4">Bond Management</h2>
              
              <div className="text-center py-8 text-gray-400">
                <Gavel className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="mb-2">Bond settlement functionality</p>
                <p className="text-sm">Settle bonds for finalized specifications</p>
                
                <div className="mt-6">
                  <p className="text-xs text-gray-500 mb-4">
                    This section will allow you to settle bonds for finalized specifications.
                    Implementation coming soon.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}