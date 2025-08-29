"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import type { Log, EventLog } from "ethers";
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
import { subgraphClient, type SubgraphSpec } from "~/lib/subgraphQueries";
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
  FileText,
  TrendingUp,
  DollarSign,
  RefreshCw
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
  blobHash: string; // Changed from ipfs to blobHash
  status: number; // Status enum
  createdTimestamp: number;
  proposedTimestamp: number;
  totalBonds: string;
  chainId: number;
  questionId: string;
  incentiveId: string;
}

export default function KaiSignV1Page() {
  const { walletConnected, currentAccount, isConnecting, connectWallet } = useWallet();
  const { toast } = useToast();

  // Incentive creation state
  const [targetContract, setTargetContract] = useState("");
  const [selectedChain, setSelectedChain] = useState("1"); // Default to mainnet
  const [incentiveAmount, setIncentiveAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isCreatingIncentive, setIsCreatingIncentive] = useState(false);
  const [contractVerificationStatus, setContractVerificationStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [contractInfo, setContractInfo] = useState<any>(null);

  // Data state
  const [userIncentives, setUserIncentives] = useState<IncentiveData[]>([]);
  const [contractSpecs, setContractSpecs] = useState<SpecData[]>([]);
  const [selectedContract, setSelectedContract] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Contract browsing state (kept for compatibility)
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
        targetContract: spec.targetContract || "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719",
        blobHash: spec.blobHash || "", // Use blobHash if available
        status: 3, // FINALIZED
        createdTimestamp: parseInt(spec.createdTimestamp),
        proposedTimestamp: parseInt(spec.proposedTimestamp || spec.createdTimestamp),
        totalBonds: "0", // Not available in subgraph
        chainId: spec.chainId || 11155111, // Default to Sepolia
        questionId: spec.questionId || "",
        incentiveId: spec.incentiveId || ""
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
        description: `Connected to ${currentAccount?.substring(0, 6)}...${currentAccount?.substring(currentAccount?.length - 4)}`,
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
      // Skip subgraph - go straight to direct queries
      const userSpecs: SpecData[] = [];
      
      // Query ALL specs from EVERYONE using getSpecsByContract
      try {
        const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
        
        type KaiSignSpecsContract = ethers.Contract & {
          getSpecsByContract: (addr: string, chainId: number) => Promise<string[]>;
          specs: (id: string) => Promise<any>;
          commitments: (id: string) => Promise<any>;
          filters: { LogCommitSpec: (...args: any[]) => any };
        };

        const contract = new ethers.Contract(
          "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719",
          [
            "function getSpecsByContract(address,uint256) view returns (bytes32[])",
            "function specs(bytes32) view returns (uint64,uint64,uint8,uint80,uint32,address,address,bytes32,bytes32,bytes32,uint256)",
            "event LogCommitSpec(address indexed committer, bytes32 indexed commitmentId, address indexed targetContract, uint256 chainId, uint256 bondAmount, uint64 revealDeadline)",
            "function commitments(bytes32) view returns (address,uint64,uint32,address,bool,uint80,uint8,uint64,uint256,bytes32)"
          ],
          provider
        ) as unknown as KaiSignSpecsContract;
        
        // Get specs for the contract
        const specIds = await contract.getSpecsByContract("0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719", 11155111);
        console.log("=== LOADING ALL SPECS ===");
        console.log("Found", specIds.length, "specs for contract");
        
        for (const specId of specIds) {
          try {
            const spec = await contract.specs(specId);
            const specData = {
              specId,
              creator: spec[5], // creator address (index 5)
              targetContract: spec[6], // targetContract (index 6)
              blobHash: spec[7] || "", // blobHash (bytes32, index 7)
              status: Number(spec[2]), // status (index 2)
              createdTimestamp: Number(spec[0]), // createdTimestamp (index 0)
              proposedTimestamp: Number(spec[1]), // proposedTimestamp (index 1)
              totalBonds: spec[3]?.toString() || "0", // totalBonds (uint80, index 3)
              chainId: Number(spec[10]), // chainId (index 10)
              questionId: spec[8] || "", // questionId (index 8)
              incentiveId: spec[9] || "" // incentiveId (index 9)
            };
            userSpecs.push(specData);
            console.log("Added spec:", specId);
          } catch (error) {
            console.error(`Error loading spec ${specId}:`, error);
          }
        }
        
        // Also get commitment info to find creators
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 45000, 8840000);
        
        const commitFilter = contract.filters.LogCommitSpec();
        const commitEvents = await contract.queryFilter(commitFilter, fromBlock, "latest");
        
        console.log("Found", commitEvents.length, "commitment events");
        
        // Map commitment creators
        for (const event of commitEvents) {
          if (!("args" in event) || !(event as EventLog).args) continue;
          const { commitmentId, committer } = (event as EventLog).args as any;
          
          // Check if this commitment is revealed and matches any spec
          try {
            const commitment = await contract.commitments(commitmentId);
            if (commitment[4]) { // isRevealed
              // Try to find matching spec (commitment might be the spec ID for revealed ones)
              const spec = userSpecs.find(s => s.specId === commitmentId);
              if (spec) {
                spec.creator = committer;
                console.log("Updated spec creator:", commitmentId, "=>", committer);
              }
            }
          } catch (error) {
            console.error("Error checking commitment:", error instanceof Error ? error.message : String(error));
          }
        }
      } catch (error) {
        console.error("Error loading specs:", error);
      }
      
      console.log("Final userSpecs array before setting:", userSpecs);
      console.log("Total specs to display:", userSpecs.length);
      setContractSpecs(userSpecs);
      
      // Query ALL incentives using events OR by scanning known creators
      const validIncentives: IncentiveData[] = [];
      try {
        const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
        
        type KaiSignIncentivesContract = ethers.Contract & {
          filters: { LogIncentiveCreated: (...args: any[]) => any };
          queryFilter: (filter: any, fromBlock: number, toBlock: number | string) => Promise<(Log | EventLog)[]>;
          getUserIncentives: (addr: string) => Promise<string[]>;
          incentives: (id: string) => Promise<any>;
          incentivePool: (chainId: bigint | number, targetContract: string) => Promise<bigint>;
        };

        const contract = new ethers.Contract(
          "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719",
          [
            "event LogIncentiveCreated(bytes32 indexed incentiveId, address indexed creator, address indexed targetContract, uint256 chainId, address token, uint256 amount, uint64 deadline, string description)",
            "function incentives(bytes32) view returns (address,address,uint128,uint64,uint64,address,bool,bool,uint80,uint256,string)",
            "function getUserIncentives(address) view returns (bytes32[])",
            "function incentivePool(uint256,address) view returns (uint256)"
          ],
          provider
        ) as unknown as KaiSignIncentivesContract;
        
        console.log("=== LOADING ALL INCENTIVES ===");
        
        const allIncentiveIds = new Set<string>();
        
        // Try to get LogIncentiveCreated events in smaller chunks
        const currentBlock = await provider.getBlockNumber();
        const blockRanges = [
          { from: currentBlock - 10000, to: currentBlock },
          { from: currentBlock - 30000, to: currentBlock - 10001 },
          { from: currentBlock - 50000, to: currentBlock - 30001 },
          { from: 8840000, to: 8890000 }
        ];
        
        for (const range of blockRanges) {
          if (range.from < 0) continue;
          try {
            console.log(`Searching blocks ${range.from} to ${range.to} for incentive events...`);
            const filter = contract.filters.LogIncentiveCreated();
            const events = await contract.queryFilter(filter, range.from, range.to);
            
            if (events.length > 0) {
              console.log(`Found ${events.length} incentive event(s)`);
              for (const event of events) {
                if (("args" in event) && (event as EventLog).args) {
                  allIncentiveIds.add(((event as EventLog).args as any).incentiveId);
                }
              }
            }
          } catch (error) {
            // If events fail, we'll fall back to checking known addresses
            console.log("Could not query events in range:", error instanceof Error ? error.message : String(error));
          }
        }
        
        // As a fallback, also check addresses we've seen in specs/commitments
        // Get unique creator addresses from specs
        const creatorAddresses = new Set<string>();
        for (const spec of userSpecs) {
          if (spec.creator && spec.creator !== "0x0000000000000000000000000000000000000000") {
            creatorAddresses.add(spec.creator.toLowerCase());
          }
        }
        
        // Add the current connected account
        if (account) {
          creatorAddresses.add(account.toLowerCase());
        }
        
        console.log(`Checking ${creatorAddresses.size} creator addresses for incentives...`);
        
        // Check each creator for their incentives
        for (const addr of creatorAddresses) {
          try {
            const incentiveIds = await contract.getUserIncentives(addr);
            if (incentiveIds.length > 0) {
              console.log(`  ${addr}: ${incentiveIds.length} incentive(s)`);
              for (const id of incentiveIds) {
                allIncentiveIds.add(id);
              }
            }
          } catch (error) {
            console.error(`Error checking ${addr}:`, error instanceof Error ? error.message : String(error));
          }
        }
        
        console.log(`Total unique incentives found: ${allIncentiveIds.size}`);
        
        // Load each incentive's data
        for (const incentiveId of allIncentiveIds) {
          try {
            const data = await contract.incentives(incentiveId);
            
            // Check if the pool for this contract/chain has already been claimed
            const targetContract = data[5]; // targetContract
            const chainId = data[8]; // chainId (likely bigint)
            const poolAmount = await contract.incentivePool(chainId as bigint, targetContract);
            
            console.log(`Incentive ${incentiveId}: pool=${poolAmount}, isActive=${data[7]}`);
            
            // Only add if incentive exists, is active, AND pool hasn't been claimed (pool > 0)
            if (data[0] !== "0x0000000000000000000000000000000000000000" && 
                data[7] && // isActive
                poolAmount > 0n) { // Pool not yet claimed
              validIncentives.push({
                incentiveId: incentiveId,
                creator: data[0], // creator address
                amount: data[1].toString(), // amount (index 1)
                deadline: Number(data[3]), // deadline (index 3)
                createdAt: Number(data[4]), // createdAt (index 4)
                targetContract: data[5], // targetContract (index 5)
                isActive: data[7], // isActive (index 7)
                isClaimed: data[6], // isClaimed (index 6)
                description: data[9] || "Incentive for ERC7730 spec creation", // description (index 9)
                token: "0x0000000000000000000000000000000000000000" // No token field in current contract
              });
              console.log("Loaded incentive from:", data[0]);
            }
          } catch (error) {
            console.error(`Error loading incentive ${incentiveId}:`, error);
          }
        }
        
      } catch (error) {
        console.error("Error loading incentives:", error);
      }
      
      console.log("=== SETTING STATE ===");
      console.log("Setting incentives:", validIncentives.length);
      setUserIncentives(validIncentives);
      console.log("Setting specs:", userSpecs.length);
      
      // Show results
      const totalItems = validIncentives.length + userSpecs.length;
      if (totalItems > 0) {
        toast({
          title: "Data Loaded",
          description: `Found ${validIncentives.length} incentive(s) and ${userSpecs.length} spec(s)`,
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
        title: "Error",
        description: error.message || "Failed to load data",
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
    if (!walletConnected || !targetContract || !incentiveAmount) {
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
      const durationSeconds = 30 * 24 * 60 * 60; // 30 days in seconds (max allowed by contract)
      const amountWei = (parseFloat(incentiveAmount) * 10**18).toString();
      
      // Create the incentive on-chain with enhanced description
      const enhancedDescription = `${description} [Chain: ${contractInfo?.chainName || 'Unknown'}, Contract: ${targetContract}]`;
      
      const txHash = await web3Service.createIncentive(
        targetContract,
        parseInt(selectedChain),
        BigInt(amountWei),
        BigInt(durationSeconds),
        enhancedDescription
      );
      
      toast({
        title: "Incentive Created! 🎉",
        description: `Transaction confirmed: ${txHash.substring(0, 10)}... Check Etherscan for details.`,
        variant: "default",
      });


      // Reload data
      if (currentAccount) await loadUserData(currentAccount);
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
    // Disabled - browse functionality removed but keeping for compatibility
    toast({
      title: "Browse Disabled",
      description: "Browse functionality has been removed",
      variant: "default",
    });
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
          <p className="text-gray-400">
            Connected: {currentAccount?.substring(0, 6)}...{currentAccount?.substring(currentAccount?.length - 4)}
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
          <TabsList className="grid w-full grid-cols-3 bg-gray-900 border-gray-800">
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
                      Amount in ETH
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
                <h2 className="text-xl font-medium mb-4">All Incentives</h2>
                
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
                          <div className="text-xs text-gray-500">
                            <p>Creator: {incentive.creator.substring(0, 6)}...{incentive.creator.substring(incentive.creator.length - 4)}</p>
                            <p>Target: {incentive.targetContract.substring(0, 8)}...</p>
                            <p>Expires: {new Date(incentive.deadline * 1000).toISOString().split('T')[0]}</p>
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
                                blobHash: specData.blobHash || "",
                                status: specData.status,
                                createdTimestamp: specData.createdTimestamp,
                                proposedTimestamp: specData.proposedTimestamp,
                                totalBonds: specData.totalBonds,
                                chainId: specData.chainId || 11155111,
                        questionId: specData.questionId || "",
                        incentiveId: specData.incentiveId || ""
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
                            console.log(`🔍 Searching specs for target contract: ${specSearchContract} using subgraph`);
                            
                            // Query subgraph for specs targeting this contract
                            const specsFromSubgraph = await subgraphClient.getContractSpecs(specSearchContract);
                            console.log(`📋 Found ${specsFromSubgraph.length} specs from subgraph`);
                            
                            // Filter for user's specs
                            const userSpecsFromSearch: SpecData[] = [];
                            const statusMap: { [key: string]: number } = {
                              'COMMITTED': 0,
                              'SUBMITTED': 1,
                              'PROPOSED': 2,
                              'FINALIZED': 3,
                              'CANCELLED': 4
                            };
                            
                            for (const spec of specsFromSubgraph) {
                              if (spec.user.toLowerCase() === currentAccount?.toLowerCase()) {
                                userSpecsFromSearch.push({
                                  specId: spec.id,
                                  creator: spec.user,
                                  targetContract: spec.targetContract || specSearchContract,
                                  blobHash: spec.ipfs || "",
                                  status: statusMap[spec.status] || 0,
                                  createdTimestamp: parseInt(spec.blockTimestamp),
                                  proposedTimestamp: parseInt(spec.proposedTimestamp || spec.blockTimestamp),
                                  totalBonds: "0",
                                  chainId: parseInt(spec.chainID || "11155111"),
                                  questionId: spec.questionId || "",
                                  incentiveId: spec.incentiveId || ""
                                });
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
                          <div className="flex flex-col">
                            <span className="font-medium font-mono text-sm">
                              Spec: {spec.specId.substring(0, 10)}...{spec.specId.substring(spec.specId.length - 4)}
                            </span>
                            {spec.blobHash && spec.blobHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                              <span className="text-xs text-gray-500">
                                Blob: {spec.blobHash.substring(0, 10)}...
                              </span>
                            )}
                          </div>
                          {getStatusBadge(spec.status)}
                        </div>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${spec.specId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                        <span>Creator: {spec.creator.substring(0, 6)}...{spec.creator.substring(spec.creator.length - 4)}</span>
                        <span>Target: {spec.targetContract.substring(0, 10)}...</span>
                        <span>Bonds: {Number(spec.totalBonds) / 10**18} ETH</span>
                        <span>Created: {spec.createdTimestamp > 0 ? new Date(spec.createdTimestamp * 1000).toLocaleDateString() : "Pending"}</span>
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
                                  if (currentAccount) await loadUserData(currentAccount);
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
                <p>• <strong>Bonds are settled</strong> at reality.eth during the finalization process</p>
                <p>• <strong>ETH incentives</strong> are claimed automatically at proposed stage</p>
                <p>• <strong>ERC20 claims</strong> will be supported soon for token incentives</p>
              </div>
              
              {/* Reality.eth Navigation Instructions */}
              <div className="mt-4 p-3 bg-purple-950/40 border border-purple-700 rounded">
                <h4 className="text-sm font-medium text-purple-200 mb-2">🌐 How to Access Reality.eth</h4>
                <div className="text-xs text-purple-300 space-y-1">
                  <p><strong>Step 1:</strong> Open a new browser tab</p>
                  <p><strong>Step 2:</strong> Go to: <code className="bg-purple-900/50 px-1 rounded">reality.eth.limo/app/</code></p>
                  <p><strong>Step 3:</strong> Connect your wallet on Reality.eth</p>
                  <p><strong>Step 4:</strong> Look for your questions related to ERC7730 specifications</p>
                  <p className="text-purple-400 mt-2"><strong>💡 Alternative URL:</strong> You can also try <code className="bg-purple-900/50 px-1 rounded">reality.eth.link</code> if the first doesn't work</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 bg-gray-950 border-gray-800">
              <h2 className="text-xl font-medium mb-4">Your Specifications</h2>

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
                          // Query subgraph for specs targeting this contract
                          const contractSpecsFromSubgraph = await subgraphClient.getContractSpecs(specSearchContract);
                          const userSpecsFromSearch: SpecData[] = [];
                          
                          const statusMap: { [key: string]: number } = {
                            'COMMITTED': 0,
                            'SUBMITTED': 1,
                            'PROPOSED': 2,
                            'FINALIZED': 3,
                            'CANCELLED': 4
                          };
                          
                          for (const spec of contractSpecsFromSubgraph) {
                            if (currentAccount && spec.user.toLowerCase() === currentAccount.toLowerCase()) {
                              userSpecsFromSearch.push({
                                specId: spec.id,
                                creator: spec.user,
                                targetContract: spec.targetContract || specSearchContract,
                                blobHash: spec.ipfs || "",
                                status: statusMap[spec.status] || 0,
                                createdTimestamp: parseInt(spec.blockTimestamp),
                                proposedTimestamp: parseInt(spec.proposedTimestamp || spec.blockTimestamp),
                                totalBonds: "0",
                                chainId: parseInt(spec.chainID || "11155111"),
                                questionId: spec.questionId || "",
                                incentiveId: spec.incentiveId || ""
                              });
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
                                <p className="text-xs text-gray-400 mb-1">Blob Hash</p>
                                <p className="text-sm font-mono text-gray-300">
                                  {spec.blobHash && spec.blobHash.length > 20 
                                    ? `${spec.blobHash.substring(0, 20)}...`
                                    : spec.blobHash || 'No blob hash'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Total Bonds</p>
                                <p className="text-sm font-medium">{Number(spec.totalBonds) / 10**18} ETH</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Finalized Date</p>
                                <p className="text-sm">{new Date(spec.proposedTimestamp * 1000).toISOString().split('T')[0]}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Bonds Status</p>
                                <p className="text-sm">
                                  {spec.totalBonds && Number(spec.totalBonds) > 0 ? (
                                    <span className="text-green-400">✅ Settled</span>
                                  ) : (
                                    <span className="text-yellow-400">⏳ Available to Settle</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                              <a
                                href={`https://sepolia.etherscan.io/blob/${spec.blobHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View Blob
                              </a>
                              
                              <Button
                                onClick={() => window.open(`https://reality.eth.limo/app/`, '_blank')}
                                size="sm"
                                variant="outline"
                                className="text-xs bg-purple-600 hover:bg-purple-700 border-purple-600 text-white"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Reality.eth
                              </Button>
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