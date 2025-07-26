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
import { createKaiSignClient } from "~/lib/graphClient";
import { useWallet } from "~/contexts/WalletContext";
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
  const { walletConnected, currentAccount, isConnecting, connectWallet } = useWallet();
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

  // Add a method to load finalized specs specifically from subgraph
  const loadFinalizedSpecs = async (account: string) => {
    try {
      console.log(`🔍 Loading finalized specs for user: ${account}`);
      const graphClient = createKaiSignClient('sepolia');
      const finalizedSpecs = await graphClient.getUserFinalizedSpecs(account);
      
      console.log(`📋 Found ${finalizedSpecs.length} finalized specs from subgraph`);
      
      const convertedSpecs: SpecData[] = finalizedSpecs.map(spec => ({
        specId: spec.id,
        creator: spec.creator,
        targetContract: spec.targetContract || "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf",
        ipfs: spec.ipfsCID,
        status: 3, // FINALIZED
        createdTimestamp: parseInt(spec.createdTimestamp),
        proposedTimestamp: parseInt(spec.proposedTimestamp || spec.createdTimestamp),
        totalBonds: "0", // Not available in subgraph
        bondsSettled: false // Not available in subgraph
      }));
      
      // Add finalized specs to existing list (avoid duplicates)
      const existingSpecIds = contractSpecs.map(s => s.specId);
      const newSpecs = convertedSpecs.filter(s => !existingSpecIds.includes(s.specId));
      
      if (newSpecs.length > 0) {
        setContractSpecs([...contractSpecs, ...newSpecs]);
        toast({
          title: "Finalized Specs Found! 🎉",
          description: `Found ${newSpecs.length} finalized specification(s)`,
          variant: "default",
        });
      }
      
      return newSpecs.length;
    } catch (error) {
      console.error("Error loading finalized specs from subgraph:", error);
      return 0;
    }
  };

  useEffect(() => {
    if (walletConnected && currentAccount) {
      loadUserData(currentAccount);
    }
  }, [walletConnected, currentAccount]);

  const handleConnect = async () => {
    try {
      await connectWallet();
      toast({
        title: "Wallet Connected",
        description: `Connected to ${currentAccount?.substring(0, 6)}...${currentAccount?.substring(currentAccount.length - 4)}`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  const loadUserData = async (account: string) => {
    setIsLoadingData(true);
    try {
      // Load user's incentive IDs
      const incentiveIds = await web3Service.getUserIncentives(account);
      
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
      
      // Load user's specifications from the subgraph (much more reliable!)
      const userSpecs: SpecData[] = [];
      
      try {
        console.log(`🔍 Querying subgraph for user specs: ${account}`);
        
        // Create subgraph client
        const graphClient = createKaiSignClient('sepolia');
        
        // Get all user specs from subgraph
        const subgraphSpecs = await graphClient.getUserSpecs(account);
        console.log(`📋 Found ${subgraphSpecs.length} specs from subgraph`);
        
        // Convert subgraph data to our SpecData format
        for (const spec of subgraphSpecs) {
          const statusMap: { [key: string]: number } = {
            'COMMITTED': 0,
            'SUBMITTED': 1, 
            'PROPOSED': 2,
            'FINALIZED': 3,
            'CANCELLED': 4
          };
          
          const specData: SpecData = {
            specId: spec.id,
            creator: spec.creator,
            targetContract: spec.targetContract || "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf",
            ipfs: spec.ipfsCID,
            status: statusMap[spec.status] || 0,
            createdTimestamp: parseInt(spec.createdTimestamp),
            proposedTimestamp: parseInt(spec.proposedTimestamp || spec.createdTimestamp),
            totalBonds: "0", // Not available in subgraph
            bondsSettled: false // Not available in subgraph
          };
          
          userSpecs.push(specData);
          console.log(`✅ Added spec: ${spec.id.substring(0, 8)}... status: ${spec.status} (${spec.status === 'FINALIZED' ? 'FINALIZED' : 'other'})`);
        }
        
        console.log(`📋 Total user specs loaded from subgraph: ${userSpecs.length}`);
        
        // Always run fallback contract query if subgraph returned 0 specs or had errors
        if (userSpecs.length === 0) {
          console.log("🔄 Subgraph returned 0 specs, running direct contract queries...");
        }
        
      } catch (error) {
        console.error("Error loading user specifications from subgraph:", error);
        console.log("🔄 Falling back to direct contract queries...");
      }
      
      // Always run direct contract queries as fallback (either due to error or 0 results)
      if (userSpecs.length === 0) {
        try {
          console.log("🔍 Running comprehensive user spec discovery...");
          
          // Get all user incentives to find target contracts
          const contractsFromIncentives = new Set<string>();
          validIncentives.forEach(incentive => {
            contractsFromIncentives.add(incentive.targetContract);
          });
          
          // Add common KaiSign contract addresses
          const knownKaiSignContracts = [
            "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf", // Current known address
            // Add more known KaiSign deployments here as needed
          ];
          
          const contractsToCheck = new Set([
            ...contractsFromIncentives,
            ...knownKaiSignContracts
          ]);
          
          console.log(`🔍 Checking ${contractsToCheck.size} contracts for user specs:`, Array.from(contractsToCheck));
          
          for (const targetContract of contractsToCheck) {
            try {
              console.log(`🔍 Checking contract: ${targetContract}`);
              const specIds = await web3Service.getSpecsByContract(targetContract, 11155111);
              console.log(`📋 Found ${specIds.length} specs in contract:`, specIds);
              
              for (const specId of specIds) {
                try {
                  console.log(`🔍 Getting data for spec: ${specId}`);
                  const specData = await web3Service.getSpecData(specId);
                  console.log(`📋 Spec data:`, specData);
                  
                  if (specData.creator.toLowerCase() === account.toLowerCase()) {
                    console.log(`✅ FOUND YOUR SPEC: ${specId}`);
                    if (!userSpecs.find(s => s.specId === specId)) {
                      userSpecs.push({
                        specId,
                        creator: specData.creator,
                        targetContract: specData.targetContract,
                        ipfs: specData.ipfs,
                        status: specData.status,
                        createdTimestamp: specData.createdTimestamp,
                        proposedTimestamp: specData.proposedTimestamp,
                        totalBonds: specData.totalBonds,
                        bondsSettled: specData.bondsSettled
                      });
                    }
                  } else {
                    console.log(`❌ Not your spec. Creator: ${specData.creator}, You: ${account}`);
                  }
                } catch (error) {
                  console.error(`Error loading spec ${specId}:`, error);
                }
              }
            } catch (error) {
              console.error(`Error loading specs for contract ${targetContract}:`, error);
            }
          }
          
          console.log(`📋 Total specs found via contract query: ${userSpecs.length}`);
        } catch (fallbackError) {
          console.error("Contract query fallback also failed:", fallbackError);
        }
      }
      
      console.log(`🔄 Final userSpecs array being set to state (${userSpecs.length} specs):`, userSpecs);
      setContractSpecs(userSpecs);
      
      // Show success toast with combined results
      const totalItems = validIncentives.length + userSpecs.length;
      if (totalItems > 0) {
        toast({
          title: "Data Loaded Successfully! 🎉",
          description: `Found ${validIncentives.length} incentive(s) and ${userSpecs.length} specification(s)`,
          variant: "default",
        });
      } else {
        toast({
          title: "No Data Found",
          description: "You haven't created any incentives or specifications yet.",
          variant: "default",
        });
      }
      
    } catch (error: any) {
      console.error("Error loading user data:", error);
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load your data. Please try refreshing.",
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
        parseInt(selectedChain),
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
              onClick={handleConnect}
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
          <TabsList className="grid w-full grid-cols-5 bg-gray-900 border-gray-800">
            <TabsTrigger value="incentives" className="data-[state=active]:bg-gray-800">
              <Gift className="mr-2 h-4 w-4" />
              Incentives
            </TabsTrigger>
            <TabsTrigger value="specifications" className="data-[state=active]:bg-gray-800">
              <FileText className="mr-2 h-4 w-4" />
              Specifications
            </TabsTrigger>
            <TabsTrigger value="finalized" className="data-[state=active]:bg-gray-800">
              <CheckCircle className="mr-2 h-4 w-4" />
              Finalized
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
                <p>• <strong>Cross-chain support:</strong> Target contracts on any blockchain with chain ID specification</p>
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
                    <p>• Chain ID {selectedChain} is stored with your incentive</p>
                    <p>• The ERC7730 spec will contain the real contract details and chain ID</p>
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
                              Expires: {new Date(incentive.deadline * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}
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
              
              <div className="mb-4 space-y-4">
                <div className="flex gap-2">
                  <Link href="/verification-results">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <FileText className="mr-2 h-4 w-4" />
                      Create New Specification
                    </Button>
                  </Link>
                </div>
                
                {/* Manual Search */}
                <div className="space-y-4">
                  {/* Search by Spec ID */}
                  <div className="p-4 bg-yellow-950/30 border border-yellow-700 rounded">
                    <h3 className="text-sm font-medium text-yellow-200 mb-2">🔍 Add Spec by ID</h3>
                    <p className="text-xs text-yellow-300 mb-3">
                      Paste a spec ID directly if you know it:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={selectedContract}
                        onChange={(e) => setSelectedContract(e.target.value)}
                        placeholder="0x7f3da9d8b0a35a8114c93ca6c1e265af7e1a13948bfbbdfab10fdc3b4ca7340e..."
                        className="bg-gray-900 border-gray-700 text-xs font-mono"
                      />
                      <Button
                        onClick={async () => {
                          if (!selectedContract) return;
                          
                          setIsSearchingSpecs(true);
                          try {
                            console.log(`🔍 Adding spec by ID: ${selectedContract}`);
                            const specData = await web3Service.getSpecData(selectedContract);
                            
                            if (specData.creator.toLowerCase() === currentAccount?.toLowerCase()) {
                              const newSpec: SpecData = {
                                specId: selectedContract,
                                creator: specData.creator,
                                targetContract: specData.targetContract,
                                ipfs: specData.ipfs,
                                status: specData.status,
                                createdTimestamp: specData.createdTimestamp,
                                proposedTimestamp: specData.proposedTimestamp,
                                totalBonds: specData.totalBonds,
                                bondsSettled: specData.bondsSettled
                              };
                              
                              // Check if already exists
                              const existingSpecIds = contractSpecs.map(s => s.specId);
                              if (!existingSpecIds.includes(selectedContract)) {
                                setContractSpecs([...contractSpecs, newSpec]);
                                toast({
                                  title: "Specification Added! 🎉",
                                  description: `Status: ${specData.status === 2 ? 'PROPOSED - Ready to finalize!' : specData.status === 3 ? 'FINALIZED' : 'Status ' + specData.status}`,
                                  variant: "default",
                                });
                                setSelectedContract(""); // Clear input
                              } else {
                                toast({
                                  title: "Already Added",
                                  description: `This specification is already in your list`,
                                  variant: "default",
                                });
                              }
                            } else {
                              toast({
                                title: "Not Your Specification",
                                description: `This specification was created by ${specData.creator.substring(0, 8)}..., not you`,
                                variant: "destructive",
                              });
                            }
                          } catch (error: any) {
                            toast({
                              title: "Invalid Spec ID",
                              description: error.message || "Specification not found",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSearchingSpecs(false);
                          }
                        }}
                        disabled={isSearchingSpecs || !selectedContract}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-xs"
                      >
                        {isSearchingSpecs ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Add Spec"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Search by Target Contract */}
                  <div className="p-4 bg-blue-950/30 border border-blue-700 rounded">
                    <h3 className="text-sm font-medium text-blue-200 mb-2">🔍 Find Specs by Target Contract</h3>
                    <p className="text-xs text-blue-300 mb-3">
                      Search for your specs targeting a specific contract address:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={specSearchContract}
                        onChange={(e) => setSpecSearchContract(e.target.value)}
                        placeholder="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238..."
                        className="bg-gray-900 border-gray-700 text-xs font-mono"
                      />
                      <Button
                        onClick={async () => {
                          if (!specSearchContract) return;
                          
                          setIsSearchingSpecs(true);
                          try {
                            console.log(`🔍 Searching specs for target contract: ${specSearchContract}`);
                            const specIds = await web3Service.getSpecsByContract(specSearchContract, 11155111);
                            console.log(`📋 Found ${specIds.length} specs targeting ${specSearchContract}`);
                            
                            const userSpecsFromSearch: SpecData[] = [];
                            
                            for (const specId of specIds) {
                              try {
                                const specData = await web3Service.getSpecData(specId);
                                if (specData.creator.toLowerCase() === currentAccount?.toLowerCase()) {
                                  userSpecsFromSearch.push({
                                    specId,
                                    creator: specData.creator,
                                    targetContract: specData.targetContract,
                                    ipfs: specData.ipfs,
                                    status: specData.status,
                                    createdTimestamp: specData.createdTimestamp,
                                    proposedTimestamp: specData.proposedTimestamp,
                                    totalBonds: specData.totalBonds,
                                    bondsSettled: specData.bondsSettled
                                  });
                                }
                              } catch (error) {
                                console.error(`Error loading spec ${specId}:`, error);
                              }
                            }
                            
                            // Add new specs to existing ones (avoid duplicates)
                            const existingSpecIds = contractSpecs.map(s => s.specId);
                            const newSpecs = userSpecsFromSearch.filter(s => !existingSpecIds.includes(s.specId));
                            
                            if (newSpecs.length > 0) {
                              setContractSpecs([...contractSpecs, ...newSpecs]);
                              toast({
                                title: "Specs Found! 🎉",
                                description: `Found ${newSpecs.length} specification(s) targeting ${specSearchContract.substring(0, 8)}...`,
                                variant: "default",
                              });
                              
                              // Check if any are ready to finalize
                              const proposedSpecs = newSpecs.filter(s => s.status === 2);
                              if (proposedSpecs.length > 0) {
                                toast({
                                  title: "Ready to Finalize! 🚀",
                                  description: `${proposedSpecs.length} spec(s) are PROPOSED and ready for handleResult`,
                                  variant: "default",
                                });
                              }
                            } else {
                              toast({
                                title: "No New Specs Found",
                                description: `No specifications created by you targeting ${specSearchContract.substring(0, 8)}...`,
                                variant: "default",
                              });
                            }
                          } catch (error: any) {
                            toast({
                              title: "Search Failed",
                              description: error.message || "Failed to search contract",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSearchingSpecs(false);
                          }
                        }}
                        disabled={isSearchingSpecs || !specSearchContract}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs"
                      >
                        {isSearchingSpecs ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Search Contract"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              
                <Button
                  onClick={async () => {
                    setIsLoadingData(true);
                    try {
                      console.log("🔍 === COMPREHENSIVE SPEC DEBUG ===");
                      console.log("Current account:", currentAccount);
                      
                      // Get all contracts to check from incentives and known contracts
                      const contractsFromIncentives = new Set<string>();
                      userIncentives.forEach(incentive => {
                        contractsFromIncentives.add(incentive.targetContract);
                      });
                      
                      const knownKaiSignContracts = [
                        "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf", // Current known address
                        // Add more known KaiSign deployments here
                      ];
                      
                      const allContractsToCheck = new Set([
                        ...contractsFromIncentives,
                        ...knownKaiSignContracts
                      ]);
                      
                      console.log(`🔍 Checking ${allContractsToCheck.size} contracts:`, Array.from(allContractsToCheck));
                      
                      let allSpecIds: string[] = [];
                      
                      // First try event-based discovery (most reliable)
                      try {
                        console.log("🔍 Trying event-based spec discovery...");
                        const eventBasedSpecs = await web3Service.getAllUserSpecsByEvents(currentAccount);
                        allSpecIds.push(...eventBasedSpecs);
                        console.log(`📋 Found ${eventBasedSpecs.length} specs via events`);
                      } catch (eventError) {
                        console.error("Event-based discovery failed:", eventError);
                      }
                      
                      // Then try contract-based discovery as fallback
                      for (const contractAddress of allContractsToCheck) {
                        try {
                          console.log(`🔍 Getting specs from contract: ${contractAddress}`);
                          const contractSpecs = await web3Service.getSpecsByContract(contractAddress, 11155111);
                          console.log(`📋 Found ${contractSpecs.length} specs in ${contractAddress}`);
                          
                          // Add specs that aren't already found via events
                          for (const specId of contractSpecs) {
                            if (!allSpecIds.includes(specId)) {
                              allSpecIds.push(specId);
                            }
                          }
                        } catch (error) {
                          console.error(`Error getting specs from ${contractAddress}:`, error);
                        }
                      }
                      console.log(`📋 ALL specs in contract (${allSpecIds.length}):`, allSpecIds);
                      
                      // Check each spec to see if it belongs to you
                      const yourSpecs: SpecData[] = [];
                      for (let i = 0; i < allSpecIds.length; i++) {
                        try {
                          console.log(`🔍 Checking spec ${i + 1}/${allSpecIds.length}: ${allSpecIds[i]}`);
                          const specData = await web3Service.getSpecData(allSpecIds[i]);
                          console.log(`📋 Spec data:`, specData);
                          
                          if (specData.creator.toLowerCase() === currentAccount.toLowerCase()) {
                            console.log(`✅ FOUND YOUR SPEC!`, specData);
                            yourSpecs.push({
                              specId: allSpecIds[i],
                              creator: specData.creator,
                              targetContract: specData.targetContract,
                              ipfs: specData.ipfs,
                              status: specData.status,
                              createdTimestamp: specData.createdTimestamp,
                              proposedTimestamp: specData.proposedTimestamp,
                              totalBonds: specData.totalBonds,
                              bondsSettled: specData.bondsSettled
                            });
                          } else {
                            console.log(`❌ Not your spec. Creator: ${specData.creator}`);
                          }
                        } catch (error) {
                          console.error(`❌ Failed to get data for spec ${allSpecIds[i]}:`, error);
                        }
                      }
                      
                      console.log(`📋 Your specs found: ${yourSpecs.length}`, yourSpecs);
                      
                      // Update state with found specs
                      if (yourSpecs.length > 0) {
                        setContractSpecs(yourSpecs);
                        toast({
                          title: `Found ${yourSpecs.length} Spec(s)! 🎉`,
                          description: `Found your specifications in the contract`,
                          variant: "default",
                        });
                      } else {
                        toast({
                          title: "No Specs Found",
                          description: `No specifications found for your address ${currentAccount.substring(0, 8)}...`,
                          variant: "default",
                        });
                      }
                      
                    } catch (error: any) {
                      console.error("❌ Debug failed:", error);
                      toast({
                        title: "Debug Failed",
                        description: error.message || "Failed to debug specs",
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoadingData(false);
                    }
                  }}
                  disabled={isLoadingData}
                  variant="outline"
                  className="text-xs"
                >
                  {isLoadingData ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Debugging...
                    </>
                  ) : (
                    <>
                      🔍 Debug: Find My Specs
                    </>
                  )}
                </Button>
              </div>
              
              {(() => {
                console.log(`🎨 UI Render: contractSpecs.length = ${contractSpecs.length}`);
                console.log(`🎨 UI Render: contractSpecs =`, contractSpecs);
                return contractSpecs.length === 0;
              })() ? (
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                        <span>Target: {spec.targetContract.substring(0, 10)}...</span>
                        <span>Bonds: {Number(spec.totalBonds) / 10**18} ETH</span>
                        <span>Created: {new Date(spec.createdTimestamp * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                        <span>Settled: {spec.bondsSettled ? "Yes" : "No"}</span>
                      </div>
                      
                      {/* Action buttons based on status */}
                      <div className="flex gap-2 pt-2 border-t border-gray-700">
                        {spec.status === 2 && ( // PROPOSED - ready for handleResult
                          <Button
                            onClick={async () => {
                              try {
                                console.log(`🎯 Calling handleResult for spec: ${spec.specId}`);
                                const txHash = await web3Service.handleResult(spec.specId);
                                toast({
                                  title: "HandleResult Called! 🎉",
                                  description: `Transaction: ${txHash.substring(0, 10)}... Spec will be finalized.`,
                                  variant: "default",
                                });
                                // Refresh data after handling result
                                setTimeout(async () => {
                                  await loadUserData(currentAccount);
                                  toast({
                                    title: "Data Refreshed",
                                    description: "Spec status updated after handleResult",
                                    variant: "default",
                                  });
                                }, 2000); // Wait 2 seconds for blockchain to update
                              } catch (error: any) {
                                console.error("handleResult failed:", error);
                                toast({
                                  title: "HandleResult Failed",
                                  description: `${error.message || "Failed to handle result"}. Check if Reality.eth question is finalized.`,
                                  variant: "destructive",
                                });
                              }
                            }}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-xs"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Finalize Spec
                          </Button>
                        )}
                        
                        {/* Debug button to check spec status and incentives after handleResult */}
                        <Button
                          onClick={async () => {
                            try {
                              console.log("🔍 === POST-HANDLERESULT DEBUG ===");
                              console.log("Spec ID:", spec.specId);
                              
                              // Check current spec status
                              const currentSpecData = await web3Service.getSpecData(spec.specId);
                              console.log("Current spec data:", currentSpecData);
                              
                              // Check available incentives for the target contract
                              const availableIncentives = await web3Service.getAvailableIncentives(spec.targetContract, 11155111);
                              console.log("Available incentives:", availableIncentives);
                              
                              // Check specifically for ETH incentives
                              const ethIncentives = availableIncentives.filter(inc => 
                                inc.token === "0x0000000000000000000000000000000000000000"
                              );
                              console.log("ETH incentives:", ethIncentives);
                              
                              // Check if any incentives match this target contract
                              const matchingIncentives = availableIncentives.filter(inc => 
                                inc.targetContract.toLowerCase() === spec.targetContract.toLowerCase()
                              );
                              console.log("Incentives for this contract:", matchingIncentives);
                              
                              toast({
                                title: "Debug Complete",
                                description: `Spec status: ${currentSpecData.status}, ETH incentives: ${ethIncentives.length}, Contract incentives: ${matchingIncentives.length}`,
                                variant: "default",
                              });
                              
                            } catch (error: any) {
                              console.error("Debug failed:", error);
                              toast({
                                title: "Debug Failed",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          🔍 Debug Status
                        </Button>
                        
                        <Button
                          onClick={async () => {
                            try {
                              console.log("🔄 Force refreshing spec data...");
                              await loadUserData(currentAccount);
                              toast({
                                title: "Data Refreshed! 🔄",
                                description: "Spec data has been reloaded from contract",
                                variant: "default",
                              });
                            } catch (error: any) {
                              toast({
                                title: "Refresh Failed",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                        >
                          🔄 Refresh
                        </Button>
                        
                        {spec.status === 3 && !spec.bondsSettled && ( // FINALIZED but bonds not settled
                          <Button
                            onClick={async () => {
                              try {
                                const txHash = await web3Service.settleBonds(spec.specId);
                                toast({
                                  title: "Bond Settlement Initiated",
                                  description: `Transaction: ${txHash.substring(0, 10)}...`,
                                  variant: "default",
                                });
                                await loadUserData(currentAccount);
                              } catch (error: any) {
                                toast({
                                  title: "Settlement Failed",
                                  description: error.message || "Failed to settle bonds",
                                  variant: "destructive",
                                });
                              }
                            }}
                            size="sm"
                            className="bg-yellow-600 hover:bg-yellow-700 text-xs"
                          >
                            <Coins className="mr-1 h-3 w-3" />
                            Settle Bonds
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Finalized Contracts Tab */}
          <TabsContent value="finalized" className="space-y-6">
            <Card className="p-4 bg-green-950/30 border-green-800">
              <h3 className="text-lg font-medium text-green-100 mb-2 flex items-center">
                <CheckCircle className="mr-2 h-5 w-5" />
                Finalized Contracts & Incentive Claims
              </h3>
              <div className="text-sm text-green-200 space-y-1">
                <p>• <strong>View finalized contracts</strong> where specifications have been validated</p>
                <p>• <strong>Claim incentives</strong> for validated specifications you created</p>
                <p>• <strong>Settle bonds</strong> for finalized specifications</p>
                <p>• <strong>Automatic rewards:</strong> Incentives are distributed when specifications are accepted</p>
              </div>
            </Card>
            
            <Card className="p-6 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">Finalized Contracts</h2>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      setIsLoadingData(true);
                      try {
                        const count = await loadFinalizedSpecs(currentAccount);
                        if (count === 0 && contractSpecs.filter(s => s.status === 3).length === 0) {
                          toast({
                            title: "No Finalized Specs",
                            description: "No finalized specifications found for your account",
                            variant: "default",
                          });
                        }
                      } catch (error) {
                        console.error("Error loading finalized specs:", error);
                      } finally {
                        setIsLoadingData(false);
                      }
                    }}
                    disabled={isLoadingData}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs"
                  >
                    {isLoadingData ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Load Finalized
                      </>
                    )}
                  </Button>
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
                      "Refresh All"
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      console.log("🗑️ Clearing all state data");
                      setContractSpecs([]);
                      setUserIncentives([]);
                      toast({
                        title: "Data Cleared",
                        description: "All cached data has been cleared",
                        variant: "default",
                      });
                    }}
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                  >
                    Clear Data
                  </Button>
                </div>
              </div>
              
              {/* Subgraph Debug Section */}
              <div className="mb-4 p-4 bg-red-950/30 border border-red-700 rounded">
                <h3 className="text-sm font-medium text-red-200 mb-2">🔍 Debug: Check Subgraph Data</h3>
                <p className="text-xs text-red-300 mb-3">
                  Let's see if the subgraph can see ANY specifications at all:
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      setIsSearchingSpecs(true);
                      try {
                        // Check contract directly for ANY specs
                        console.log("🔍 Checking KaiSign contract for ANY specs...");
                        const kaisignContract = "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf";
                        
                        // First, let's try to get recent events
                        console.log("🔍 Checking recent contract events...");
                        try {
                          const { ethers } = await import('ethers');
                          const provider = new ethers.BrowserProvider(window.ethereum);
                          const contract = new ethers.Contract(kaisignContract, [
                            "event SpecCommitted(bytes32 indexed commitmentId, address indexed user, address indexed targetContract)",
                            "event SpecRevealed(bytes32 indexed specId, address indexed user, string ipfs)",
                            "event SpecFinalized(bytes32 indexed specId, address indexed user, bool isValid)",
                            "event IncentiveCreated(bytes32 indexed incentiveId, address indexed creator, address indexed targetContract)"
                          ], provider);
                          
                          // Get recent events (last 1000 blocks)
                          const currentBlock = await provider.getBlockNumber();
                          const fromBlock = Math.max(0, currentBlock - 1000);
                          
                          console.log(`🔍 Searching events from block ${fromBlock} to ${currentBlock}`);
                          
                          const events = await contract.queryFilter("*", fromBlock, currentBlock);
                          console.log(`📋 Found ${events.length} recent events:`, events);
                          
                          // Look for your address in events
                          const yourEvents = events.filter(event => 
                            event.args && event.args.some((arg: any) => 
                              typeof arg === 'string' && arg.toLowerCase() === currentAccount.toLowerCase()
                            )
                          );
                          
                          console.log(`📋 Your events (${yourEvents.length}):`, yourEvents);
                          
                          if (yourEvents.length > 0) {
                            toast({
                              title: `Found ${yourEvents.length} Events For You!`,
                              description: `Check console for event details`,
                              variant: "default",
                            });
                          }
                        } catch (eventError) {
                          console.error("Error fetching events:", eventError);
                        }
                        
                        const specIds = await web3Service.getSpecsByContract(kaisignContract, 11155111);
                        
                        console.log(`📋 CONTRACT SPECS for ${kaisignContract}:`, specIds);
                        
                        if (specIds.length > 0) {
                          toast({
                            title: `Found ${specIds.length} Specs in Contract!`,
                            description: `Check console for spec IDs. Your address: ${currentAccount.substring(0, 8)}...`,
                            variant: "default",
                          });
                          
                          // Try to get data for each spec
                          for (let i = 0; i < Math.min(specIds.length, 3); i++) {
                            try {
                              console.log(`🔍 Getting data for spec ${i + 1}/${specIds.length}: ${specIds[i]}`);
                              const specData = await web3Service.getSpecData(specIds[i]);
                              console.log(`📋 Spec ${specIds[i].substring(0, 8)}... data:`, specData);
                              
                              if (specData.creator.toLowerCase() === currentAccount.toLowerCase()) {
                                console.log(`✅ FOUND YOUR SPEC! ID: ${specIds[i]}, Status: ${specData.status}, IPFS: ${specData.ipfs}`);
                                
                                toast({
                                  title: "🎉 Found Your Specification!",
                                  description: `Status: ${specData.status === 3 ? 'FINALIZED' : specData.status}, IPFS: ${specData.ipfs.substring(0, 20)}...`,
                                  variant: "default",
                                });
                              }
                            } catch (error) {
                              console.error(`Error getting spec data for ${specIds[i]}:`, error);
                              
                              console.log(`❌ Failed to decode spec ${specIds[i]}: ${error.message}`);
                            }
                          }
                        } else {
                          toast({
                            title: "No Specs Found",
                            description: "No specifications found in the KaiSign contract",
                            variant: "default",
                          });
                        }
                        
                      } catch (error: any) {
                        console.error("❌ Contract query failed:", error);
                        toast({
                          title: "Contract Query Failed",
                          description: error.message || "Could not query contract",
                          variant: "destructive",
                        });
                      } finally {
                        setIsSearchingSpecs(false);
                      }
                    }}
                    disabled={isSearchingSpecs}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-xs"
                  >
                    {isSearchingSpecs ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "🔍 Debug: Query ALL Specs"
                    )}
                  </Button>
                </div>
              </div>

              {/* Manual Spec Search */}
              <div className="mb-4 space-y-4">
                {/* Contract Search */}
                <div className="p-4 bg-blue-950/30 border border-blue-700 rounded">
                  <h3 className="text-sm font-medium text-blue-200 mb-2">🔍 Search by Contract Address</h3>
                  <p className="text-xs text-blue-300 mb-3">
                    If you know the contract address where you created specifications:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={specSearchContract}
                      onChange={(e) => setSpecSearchContract(e.target.value)}
                      placeholder="0x... contract address"
                      className="bg-gray-900 border-gray-700 text-xs"
                    />
                    <Button
                      onClick={async () => {
                        if (!specSearchContract) return;
                        
                        setIsSearchingSpecs(true);
                        try {
                          const specIds = await web3Service.getSpecsByContract(specSearchContract, 11155111);
                          const userSpecsFromSearch: SpecData[] = [];
                          
                          for (const specId of specIds) {
                            try {
                              const specData = await web3Service.getSpecData(specId);
                              if (specData.creator.toLowerCase() === currentAccount.toLowerCase()) {
                                userSpecsFromSearch.push({
                                  specId,
                                  creator: specData.creator,
                                  targetContract: specData.targetContract,
                                  ipfs: specData.ipfs,
                                  status: specData.status,
                                  createdTimestamp: specData.createdTimestamp,
                                  proposedTimestamp: specData.proposedTimestamp,
                                  totalBonds: specData.totalBonds,
                                  bondsSettled: specData.bondsSettled
                                });
                              }
                            } catch (error) {
                              console.error(`Error loading spec ${specId}:`, error);
                            }
                          }
                          
                          // Add new specs to existing ones (avoid duplicates)
                          const existingSpecIds = contractSpecs.map(s => s.specId);
                          const newSpecs = userSpecsFromSearch.filter(s => !existingSpecIds.includes(s.specId));
                          
                          if (newSpecs.length > 0) {
                            setContractSpecs([...contractSpecs, ...newSpecs]);
                            toast({
                              title: "Specs Found! 🎉",
                              description: `Found ${newSpecs.length} specification(s) in contract ${specSearchContract.substring(0, 8)}...`,
                              variant: "default",
                            });
                          } else {
                            toast({
                              title: "No New Specs Found",
                              description: `No specifications created by you in contract ${specSearchContract.substring(0, 8)}...`,
                              variant: "default",
                            });
                          }
                        } catch (error: any) {
                          toast({
                            title: "Search Failed",
                            description: error.message || "Failed to search contract",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSearchingSpecs(false);
                        }
                      }}
                      disabled={isSearchingSpecs || !specSearchContract}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-xs"
                    >
                      {isSearchingSpecs ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>

                {/* IPFS Hash Search */}
                <div className="p-4 bg-purple-950/30 border border-purple-700 rounded">
                  <h3 className="text-sm font-medium text-purple-200 mb-2">🔍 Search by IPFS Hash</h3>
                  <p className="text-xs text-purple-300 mb-3">
                    If you have the IPFS hash of your submitted specification:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={selectedContract}
                      onChange={(e) => setSelectedContract(e.target.value)}
                      placeholder="Qm... or baf... IPFS hash"
                      className="bg-gray-900 border-gray-700 text-xs"
                    />
                    <Button
                      onClick={async () => {
                        if (!selectedContract) return;
                        
                        setIsSearchingSpecs(true);
                        try {
                          // Generate specId from IPFS hash (same way contract does it)
                          const { ethers } = await import('ethers');
                          const specId = ethers.keccak256(ethers.toUtf8Bytes(selectedContract));
                          
                          console.log(`🔍 Searching for specId: ${specId} from IPFS: ${selectedContract}`);
                          
                          const specData = await web3Service.getSpecData(specId);
                          
                          if (specData.creator.toLowerCase() === currentAccount.toLowerCase()) {
                            const newSpec: SpecData = {
                              specId,
                              creator: specData.creator,
                              targetContract: specData.targetContract,
                              ipfs: specData.ipfs,
                              status: specData.status,
                              createdTimestamp: specData.createdTimestamp,
                              proposedTimestamp: specData.proposedTimestamp,
                              totalBonds: specData.totalBonds,
                              bondsSettled: specData.bondsSettled
                            };
                            
                            // Check if already exists
                            const existingSpecIds = contractSpecs.map(s => s.specId);
                            if (!existingSpecIds.includes(specId)) {
                              setContractSpecs([...contractSpecs, newSpec]);
                              toast({
                                title: "Specification Found! 🎉",
                                description: `Found spec with status: ${specData.status === 3 ? 'FINALIZED' : 'Status ' + specData.status}`,
                                variant: "default",
                              });
                            } else {
                              toast({
                                title: "Already Added",
                                description: `This specification is already in your list`,
                                variant: "default",
                              });
                            }
                          } else {
                            toast({
                              title: "Not Your Specification",
                              description: `This specification was created by ${specData.creator.substring(0, 8)}..., not you`,
                              variant: "destructive",
                            });
                          }
                        } catch (error: any) {
                          toast({
                            title: "Search Failed",
                            description: error.message || "Specification not found or invalid IPFS hash",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSearchingSpecs(false);
                        }
                      }}
                      disabled={isSearchingSpecs || !selectedContract}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-xs"
                    >
                      {isSearchingSpecs ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div>
                  {/* Filter finalized specs */}
                  {(() => {
                    const finalizedSpecs = contractSpecs.filter(spec => spec.status === 3);
                    
                    if (finalizedSpecs.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-400">
                          <CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                          <p>No finalized contracts yet</p>
                          <p className="text-sm mt-2">Finalized contracts will appear here when specifications are validated</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        {finalizedSpecs.map((spec) => (
                          <div
                            key={spec.specId}
                            className="p-6 bg-green-900/20 border border-green-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <div>
                                  <h3 className="font-medium text-green-100">Finalized Contract</h3>
                                  <p className="text-sm text-gray-400 font-mono">
                                    {spec.targetContract.substring(0, 10)}...{spec.targetContract.substring(spec.targetContract.length - 8)}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="default" className="bg-green-600">
                                Finalized
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-gray-400 mb-1">IPFS Hash</p>
                                <p className="text-sm font-mono text-gray-300">{spec.ipfs.substring(0, 20)}...</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Total Bonds</p>
                                <p className="text-sm font-medium">{Number(spec.totalBonds) / 10**18} ETH</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Finalized Date</p>
                                <p className="text-sm">{new Date(spec.proposedTimestamp * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Bonds Status</p>
                                <p className="text-sm">
                                  {spec.bondsSettled ? (
                                    <span className="text-green-400">✅ Settled</span>
                                  ) : (
                                    <span className="text-yellow-400">⏳ Available to Settle</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                              <a
                                href={`https://gateway.ipfs.io/ipfs/${spec.ipfs}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View Spec
                              </a>
                              
                              {!spec.bondsSettled && (
                                <Button
                                  onClick={async () => {
                                    try {
                                      const txHash = await web3Service.settleBonds(spec.specId);
                                      toast({
                                        title: "Bonds Settlement Initiated",
                                        description: `Transaction: ${txHash.substring(0, 10)}...`,
                                        variant: "default",
                                      });
                                      // Refresh data after settlement
                                      await loadUserData(currentAccount);
                                    } catch (error: any) {
                                      toast({
                                        title: "Settlement Failed",
                                        description: error.message || "Failed to settle bonds",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  size="sm"
                                  className="bg-yellow-600 hover:bg-yellow-700 text-xs"
                                >
                                  <Coins className="mr-1 h-3 w-3" />
                                  Settle Bonds
                                </Button>
                              )}
                              
                              {/* Check for available incentives */}
                              {(() => {
                                const availableIncentives = userIncentives.filter(
                                  incentive => incentive.targetContract.toLowerCase() === spec.targetContract.toLowerCase() 
                                    && !incentive.isClaimed && incentive.isActive
                                );
                                
                                if (availableIncentives.length > 0) {
                                  return (
                                    <div className="w-full mt-2 p-3 bg-green-800/30 border border-green-600 rounded">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-green-300">
                                          🎉 <strong>Incentives Available to Claim:</strong>
                                        </p>
                                        <Button
                                          onClick={async () => {
                                            try {
                                              console.log("=== INCENTIVE DEBUG INFO ===");
                                              console.log("Spec ID:", spec.specId);
                                              console.log("Spec Status:", spec.status);
                                              console.log("Target Contract:", spec.targetContract);
                                              console.log("Available Incentives:", availableIncentives);
                                              
                                              // Check contract state directly
                                              const specData = await web3Service.getSpecData(spec.specId);
                                              console.log("Contract Spec Data:", specData);
                                              
                                              // Query all specs for the target contract to see what actually exists
                                              try {
                                                console.log("🔍 Querying all specs for target contract...");
                                                // The specs should be for Sepolia (chainId 11155111) since the contract is deployed there
                                                const allSpecs = await web3Service.getSpecsByContract(spec.targetContract, 11155111);
                                                console.log("All specs in contract for Sepolia:", allSpecs);
                                                
                                                // Check first few specs to see their data
                                                for (let i = 0; i < Math.min(allSpecs.length, 3); i++) {
                                                  const existingSpecData = await web3Service.getSpecData(allSpecs[i]);
                                                  console.log(`Existing spec ${allSpecs[i]}:`, existingSpecData);
                                                }
                                              } catch (contractError) {
                                                console.error("Failed to query contract specs:", contractError);
                                              }
                                              
                                              for (const incentive of availableIncentives) {
                                                console.log(`Fetching data for incentive ID: ${incentive.incentiveId}`);
                                                const incentiveData = await web3Service.getIncentiveData(incentive.incentiveId);
                                                console.log(`Incentive ${incentive.incentiveId}:`, incentiveData);
                                              }
                                              
                                              toast({
                                                title: "Debug Info Logged",
                                                description: "Check console for detailed incentive information",
                                                variant: "default",
                                              });
                                            } catch (error: any) {
                                              console.error("Debug failed:", error);
                                              toast({
                                                title: "Debug Failed",
                                                description: error.message,
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-6"
                                        >
                                          🔍 Debug
                                        </Button>
                                      </div>
                                      {availableIncentives.map((incentive) => (
                                        <div key={incentive.incentiveId} className="flex items-center justify-between text-xs text-green-200 mb-2">
                                          <span>
                                            {incentive.token === "0x0000000000000000000000000000000000000000" 
                                              ? `${(Number(incentive.amount) / 10**18).toFixed(4)} ETH`
                                              : `${incentive.amount} Tokens`
                                            }
                                          </span>
                                          <div className="flex gap-1">
                                            {/* Check if incentive is actually claimed */}
                                            {incentive.token === "0x0000000000000000000000000000000000000000" ? (
                                              incentive.isClaimed ? (
                                                <div className="text-xs text-green-400">
                                                  ✅ ETH incentive claimed
                                                </div>
                                              ) : (
                                                <Button
                                                  onClick={async () => {
                                                    try {
                                                      // Try calling handleResult - this should claim ETH incentives
                                                      const txHash = await web3Service.handleResult(spec.specId);
                                                      toast({
                                                        title: "ETH Incentive Claim Initiated",
                                                        description: `Transaction: ${txHash.substring(0, 10)}... ETH incentive will be claimed automatically`,
                                                        variant: "default",
                                                      });
                                                      // Refresh data after claiming
                                                      await loadUserData(currentAccount);
                                                    } catch (error: any) {
                                                      console.error("handleResult failed:", error);
                                                      toast({
                                                        title: "Claim Failed",
                                                        description: `${error.message || "Failed to claim ETH incentive"}. Check console for details.`,
                                                        variant: "destructive",
                                                      });
                                                    }
                                                  }}
                                                  size="sm"
                                                  className="bg-green-600 hover:bg-green-700 text-xs"
                                                >
                                                  <Gift className="mr-1 h-3 w-3" />
                                                  Claim ETH
                                                </Button>
                                              )
                                            ) : (
                                              <Button
                                                onClick={async () => {
                                                  try {
                                                    // Call claimActiveTokenIncentive for ERC20 tokens
                                                    const txHash = await web3Service.claimActiveTokenIncentive(spec.specId, incentive.token);
                                                    toast({
                                                      title: "Token Incentive Claim Initiated",
                                                      description: `Transaction: ${txHash.substring(0, 10)}... Token incentive will be transferred`,
                                                      variant: "default",
                                                    });
                                                    // Refresh data after claiming
                                                    await loadUserData(currentAccount);
                                                  } catch (error: any) {
                                                    toast({
                                                      title: "Token Claim Failed",
                                                      description: error.message || "Failed to claim token incentive",
                                                      variant: "destructive",
                                                    });
                                                  }
                                                }}
                                                size="sm"
                                                className="bg-purple-600 hover:bg-purple-700 text-xs"
                                              >
                                                <Gift className="mr-1 h-3 w-3" />
                                                Claim Token
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                        <span>Created: {new Date(spec.createdTimestamp * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Bonds Tab */}
          <TabsContent value="bonds" className="space-y-6">
            <Card className="p-4 bg-yellow-950/30 border-yellow-800">
              <h3 className="text-lg font-medium text-yellow-100 mb-2 flex items-center">
                <Gavel className="mr-2 h-5 w-5" />
                Bond Settlement System
              </h3>
              <div className="text-sm text-yellow-200 space-y-1">
                <p>• <strong>Settle bonds</strong> for finalized specifications to release locked funds</p>
                <p>• <strong>Bond amounts</strong> are determined by the Reality.eth oracle system</p>
                <p>• <strong>Settlement required:</strong> Bonds must be settled after spec finalization</p>
                <p>• <strong>Only creators</strong> can settle bonds for their specifications</p>
              </div>
            </Card>
            
            <Card className="p-6 bg-gray-950 border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium">Bond Settlement</h2>
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
              ) : (
                <div>
                  {/* Filter user's finalized specs with unsettled bonds */}
                  {(() => {
                    const unsettledSpecs = contractSpecs.filter(spec => 
                      spec.status === 3 && !spec.bondsSettled && spec.creator.toLowerCase() === currentAccount.toLowerCase()
                    );
                    
                    if (unsettledSpecs.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-400">
                          <Gavel className="mx-auto h-12 w-12 mb-4 opacity-50" />
                          <p>No bonds to settle</p>
                          <p className="text-sm mt-2">
                            {contractSpecs.filter(spec => spec.status === 3).length > 0 
                              ? "All your finalized specification bonds have been settled"
                              : "Create and finalize specifications to see bond settlement options"
                            }
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm text-yellow-200">
                          <p><strong>⚠️ Important:</strong> You have unsettled bonds from finalized specifications.</p>
                          <p>Settle these bonds to release your locked funds and complete the process.</p>
                        </div>
                        
                        {unsettledSpecs.map((spec) => (
                          <div
                            key={spec.specId}
                            className="p-6 bg-yellow-900/20 border border-yellow-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-2">
                                <Gavel className="h-5 w-5 text-yellow-400" />
                                <div>
                                  <h3 className="font-medium text-yellow-100">Bonds to Settle</h3>
                                  <p className="text-sm text-gray-400 font-mono">
                                    {spec.targetContract.substring(0, 10)}...{spec.targetContract.substring(spec.targetContract.length - 8)}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-yellow-600">
                                Settlement Required
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Bond Amount</p>
                                <p className="text-sm font-medium text-yellow-300">
                                  {Number(spec.totalBonds) / 10**18} ETH
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">IPFS Hash</p>
                                <p className="text-sm font-mono text-gray-300">{spec.ipfs.substring(0, 20)}...</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Finalized Date</p>
                                <p className="text-sm">{new Date(spec.proposedTimestamp * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                              <div className="text-sm text-gray-400">
                                <p>Status: <span className="text-green-400">Specification Finalized</span></p>
                                <p>Action Required: <span className="text-yellow-400">Settle Bonds</span></p>
                              </div>
                              
                              <div className="flex gap-2">
                                <a
                                  href={`https://gateway.ipfs.io/ipfs/${spec.ipfs}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  View Spec
                                </a>
                                
                                <Button
                                  onClick={async () => {
                                    try {
                                      const txHash = await web3Service.settleBonds(spec.specId);
                                      toast({
                                        title: "Bond Settlement Initiated! 🎉",
                                        description: `Transaction: ${txHash.substring(0, 10)}... Your bonds are being released.`,
                                        variant: "default",
                                      });
                                      // Refresh data after settlement
                                      await loadUserData(currentAccount);
                                    } catch (error: any) {
                                      toast({
                                        title: "Settlement Failed",
                                        description: error.message || "Failed to settle bonds",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="bg-yellow-600 hover:bg-yellow-700"
                                >
                                  <Coins className="mr-2 h-4 w-4" />
                                  Settle Bonds ({Number(spec.totalBonds) / 10**18} ETH)
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}