import { ethers } from "ethers";

// ====================================
// TYPE DEFINITIONS
// ====================================

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: Array<any> }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

type ContractWithMethods = ethers.Contract & {
  minBond: () => Promise<bigint>;
  commitSpec: (commitment: string, targetContract: string, targetChainId: number, options: { value: bigint }) => Promise<any>;
  revealSpec: (commitmentId: string, ipfs: string, nonce: bigint) => Promise<any>;
  proposeSpec: (specID: string, options: { value: bigint }) => Promise<any>;
  handleResult: (specID: string) => Promise<any>;
  claimActiveTokenIncentive: (specID: string, token: string) => Promise<any>;
  settleBonds: (specID: string) => Promise<any>;
  getStatus: (ipfsHash: string) => Promise<number>;
  isAccepted: (ipfsHash: string) => Promise<boolean>;
  getCreatedTimestamp: (ipfsHash: string) => Promise<bigint>;
  createIncentive: (targetContract: string, targetChainId: number, amount: bigint, duration: bigint, description: string, options: { value: bigint }) => Promise<any>;
  getSpecsByContract: (targetContract: string, chainId: number) => Promise<string[]>;
  getContractSpecCount: (targetContract: string) => Promise<bigint>;
  specs: (specID: string) => Promise<any>;
  incentives: (incentiveId: string) => Promise<any>;
  commitments: (commitmentId: string) => Promise<any>;
  bondsSettled: (specID: string) => Promise<boolean>;
  realityETH: () => Promise<string>;
  getUserIncentives: (user: string) => Promise<string[]>;
};

type RealityEthContract = ethers.Contract & {
  getBond: (questionId: string) => Promise<bigint>;
  getMinBond: (questionId: string) => Promise<bigint>;
  isFinalized: (questionId: string) => Promise<boolean>;
  resultFor: (questionId: string) => Promise<string>;
  finalize: (questionId: string) => Promise<any>;
  questions: (questionId: string) => Promise<{
    content_hash: string;
    arbitrator: string;
    opening_ts: bigint;
    timeout: bigint;
    finalize_ts: bigint;
    is_pending_arbitration: boolean;
    bounty: bigint;
    best_answer: string;
    history_hash: string;
    bond: bigint;
    min_bond: bigint;
  }>;
};

// ====================================
// CONSTANTS AND CONFIGURATION
// ====================================

const RAW_CONTRACT_ADDRESS = "0x8d82439Fa83153f024e7D3f21fdaf5d4662939B5";
const SEPOLIA_CHAIN_ID = 11155111;
const METADATA_REGISTRY_ADDRESS = "0xE0BDb7d03D572707317d714d57609f35D1699208";

// Valid Sepolia contracts for testing
const VALID_SEPOLIA_CONTRACTS = [
  RAW_CONTRACT_ADDRESS,
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
  "0x779877A7B0D9E8603169DdbD7836e478b4624789", // Another known contract
];

// Contract ABIs
const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "minBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "commitment", "type": "bytes32"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "targetChainId", "type": "uint256"}
    ],
    "name": "commitSpec",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"internalType": "string", "name": "ipfs", "type": "string"},
      {"internalType": "uint256", "name": "nonce", "type": "uint256"}
    ],
    "name": "revealSpec",
    "outputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "proposeSpec",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "targetChainId", "type": "uint256"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint64", "name": "duration", "type": "uint64"},
      {"internalType": "string", "name": "description", "type": "string"}
    ],
    "name": "createIncentive",
    "outputs": [{"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserIncentives",
    "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}],
    "name": "incentives",
    "outputs": [
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint128", "name": "amount", "type": "uint128"},
      {"internalType": "uint64", "name": "deadline", "type": "uint64"},
      {"internalType": "uint64", "name": "createdAt", "type": "uint64"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "bool", "name": "isClaimed", "type": "bool"},
      {"internalType": "bool", "name": "isActive", "type": "bool"},
      {"internalType": "uint80", "name": "reserved", "type": "uint80"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"internalType": "string", "name": "description", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "name": "getSpecsByContract",
    "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specId", "type": "bytes32"}],
    "name": "specs",
    "outputs": [
      {"internalType": "uint64", "name": "createdTimestamp", "type": "uint64"},
      {"internalType": "uint64", "name": "proposedTimestamp", "type": "uint64"},
      {"internalType": "uint8", "name": "status", "type": "uint8"},
      {"internalType": "uint80", "name": "totalBonds", "type": "uint80"},
      {"internalType": "uint32", "name": "reserved", "type": "uint32"},
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "string", "name": "ipfs", "type": "string"},
      {"internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "handleResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "specID", "type": "bytes32"},
      {"internalType": "address", "name": "token", "type": "address"}
    ],
    "name": "claimActiveTokenIncentive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "settleBonds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "getStatus",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "isAccepted",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "getCreatedTimestamp",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "name": "getContractSpecCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "name": "getIncentivePool",
    "outputs": [
      {"internalType": "uint256", "name": "poolAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "contributorCount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}],
    "name": "clawbackIncentive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "realityETH",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const REALITY_ETH_ABI = [
  "function getBond(bytes32 question_id) view returns (uint256)",
  "function getMinBond(bytes32 question_id) view returns (uint256)",
  "function isFinalized(bytes32 question_id) view returns (bool)",
  "function resultFor(bytes32 question_id) view returns (bytes32)",
  "function finalize(bytes32 question_id)",
  "function questions(bytes32) view returns (bytes32, address, uint32, uint32, uint32, bool, uint256, bytes32, bytes32, uint256, uint256)"
];

const METADATA_REGISTRY_ABI = [
  "function attestMetadata(bytes32 metadataHash)",
  "function attestMetadataBatch(bytes32[] calldata metadataHashes)",
  "function trustAttesters(uint256 threshold, address[] calldata attesters, address[] calldata mustIncludeAny, address[] calldata mustIncludeAll)",
  "function approved(bytes32 metadataHash) view returns (bool)",
  "function approvedForAccount(bytes32 metadataHash, address account) view returns (bool)",
  "function hasAttested(bytes32, address) view returns (bool)",
  "function attestationCount(bytes32) view returns (uint256)",
  "function getMetadataAttesters(bytes32 metadataHash) view returns (address[])",
  "function getAccountConfig(address account) view returns (address[] attesters, uint256 threshold, address[] mustIncludeAny, address[] mustIncludeAll, bool isConfigured)"
];

// ====================================
// MAIN WEB3 SERVICE CLASS
// ====================================

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ContractWithMethods | null = null;
  private realityEthContract: RealityEthContract | null = null;

  // ====================================
  // CONNECTION AND INITIALIZATION
  // ====================================

  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error("This function can only be called on the client side.");
    }
    
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please make sure MetaMask is unlocked.");
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      const kaisignContract = new ethers.Contract(
        RAW_CONTRACT_ADDRESS,
        CONTRACT_ABI,
        this.signer
      ) as ContractWithMethods;

      this.contract = kaisignContract;
      return accounts[0];
    } catch (error: any) {
      console.error("Connection failed:", error);
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  async checkNetwork(): Promise<boolean> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const network = await this.provider.getNetwork();
      return network.chainId === BigInt(SEPOLIA_CHAIN_ID);
    } catch (error) {
      console.error("Network check failed:", error);
      return false;
    }
  }

  async getCurrentAccount(): Promise<string | null> {
    if (!this.signer) {
      return null;
    }
    try {
      return await this.signer.getAddress();
    } catch (error) {
      console.error("Failed to get current account:", error);
      return null;
    }
  }

  // ====================================
  // SPEC MANAGEMENT
  // ====================================

  async getMinBond(): Promise<bigint> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const minBond = await this.contract.minBond();
      return minBond;
    } catch (error: any) {
      console.error("Failed to get minimum bond:", error);
      throw new Error(`Failed to get minimum bond: ${error.message}`);
    }
  }

  async commitSpec(ipfsHash: string, targetContract?: string, targetChainId?: number): Promise<{
    commitmentId: string;
    commitTxHash: string;
    revealDeadline: number;
    nonce: number;
    commitment: string;
  }> {
    if (!this.contract || !this.signer || !this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      const commitment = ethers.keccak256(ethers.solidityPacked(
        ["string", "uint256"],
        [ipfsHash, nonce]
      ));

      let target = this.validateTargetContract(targetContract);
      const finalTargetChainId = targetChainId || SEPOLIA_CHAIN_ID;

      console.log("Committing spec with params:", {
        commitment,
        target,
        chainId: finalTargetChainId
      });

      const tx = await this.contract.commitSpec(
        commitment,
        target,
        finalTargetChainId
      );

      console.log("Commit transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Commit transaction confirmed:", receipt?.hash);
      
      // Get the block timestamp for the commitment
      const block = await this.provider.getBlock(receipt!.blockNumber);
      const currentTime = block!.timestamp;
      
      // Calculate the actual commitmentId (must match contract logic)
      const signerAddress = await this.signer.getAddress();
      const commitmentId = ethers.keccak256(ethers.solidityPacked(
        ["bytes32", "address", "address", "uint256", "uint64"],
        [commitment, signerAddress, target, finalTargetChainId, currentTime]
      ));

      const revealDeadline = Date.now() + (60 * 60 * 1000); // 1 hour as per contract

      return {
        commitmentId,
        commitTxHash: tx.hash,
        revealDeadline,
        nonce: Number(nonce),
        commitment
      };
    } catch (error: any) {
      console.error("Commit failed:", error);
      throw new Error(`Failed to commit spec: ${error.message}`);
    }
  }

  async revealSpec(commitmentId: string, ipfsHash: string, nonce: number, bondAmount: bigint): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      console.log("Revealing spec with params:", {
        commitmentId,
        ipfsHash,
        nonce,
        bondAmount: bondAmount.toString()
      });

      const tx = await this.contract.revealSpec(
        commitmentId, 
        ipfsHash, 
        BigInt(nonce),
        { value: bondAmount }
      );
      console.log("Reveal transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Reveal transaction confirmed:", receipt?.hash);

      return tx.hash;
    } catch (error: any) {
      console.error("Reveal failed:", error);
      throw new Error(`Failed to reveal spec: ${error.message}`);
    }
  }
  
  async revealSpecWithContentHash(
    commitmentId: string, 
    ipfsHash: string, 
    nonce: number, 
    contentHash: string,
    bondAmount: bigint
  ): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      console.log("Revealing spec with content hash:", {
        commitmentId,
        ipfsHash,
        nonce,
        contentHash,
        bondAmount: bondAmount.toString()
      });

      const tx = await this.contract.revealSpecWithContentHash(
        commitmentId, 
        ipfsHash, 
        BigInt(nonce),
        contentHash,
        { value: bondAmount }
      );
      console.log("Reveal with content hash transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Reveal with content hash transaction confirmed:", receipt?.hash);

      return tx.hash;
    } catch (error: any) {
      console.error("Reveal with content hash failed:", error);
      throw new Error(`Failed to reveal spec with content hash: ${error.message}`);
    }
  }

  async proposeSpec(specId: string, bondAmount: string): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const bondAmountWei = ethers.parseEther(bondAmount);
      const tx = await this.contract.proposeSpec(specId, { value: bondAmountWei });
      console.log("Propose transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Propose transaction confirmed:", receipt?.hash);
      
      return tx.hash;
    } catch (error: any) {
      console.error("Propose failed:", error);
      throw new Error(`Failed to propose spec: ${error.message}`);
    }
  }

  async handleResult(specId: string): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const tx = await this.contract.handleResult(specId);
      console.log("Handle result transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Handle result transaction confirmed:", receipt?.hash);
      
      return tx.hash;
    } catch (error: any) {
      console.error("Handle result failed:", error);
      throw new Error(`Failed to handle result: ${error.message}`);
    }
  }

  async getSpecStatus(ipfsHash: string): Promise<number> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const status = await this.contract.getStatus(ipfsHash);
      return Number(status);
    } catch (error: any) {
      console.error("Failed to get spec status:", error);
      throw new Error(`Failed to get spec status: ${error.message}`);
    }
  }

  async isSpecAccepted(ipfsHash: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      return await this.contract.isAccepted(ipfsHash);
    } catch (error: any) {
      console.error("Failed to check if spec is accepted:", error);
      throw new Error(`Failed to check if spec is accepted: ${error.message}`);
    }
  }

  async getSpecsByContract(contractAddress: string, chainId: number = SEPOLIA_CHAIN_ID): Promise<string[]> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const specs = await this.contract.getSpecsByContract(contractAddress, chainId);
      return specs;
    } catch (error: any) {
      console.error("Failed to get specs by contract:", error);
      throw new Error(`Failed to get specs by contract: ${error.message}`);
    }
  }

  async getSpecData(specId: string): Promise<any> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const spec = await this.contract.specs(specId);
      return {
        createdTimestamp: spec[0],
        proposedTimestamp: spec[1],
        status: spec[2],
        totalBonds: spec[3],
        reserved: spec[4],
        creator: spec[5],
        targetContract: spec[6],
        ipfs: spec[7],
        questionId: spec[8],
        incentiveId: spec[9],
        chainId: spec[10],
        metadataContentHash: spec[11]
      };
    } catch (error: any) {
      console.error("Failed to get spec data:", error);
      throw new Error(`Failed to get spec data: ${error.message}`);
    }
  }

  async getContractSpecCount(targetContract: string, chainId: number = SEPOLIA_CHAIN_ID): Promise<number> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const count = await this.contract.getContractSpecCount(targetContract, chainId);
      return Number(count);
    } catch (error: any) {
      console.error("Failed to get contract spec count:", error);
      throw new Error(`Failed to get contract spec count: ${error.message}`);
    }
  }

  // Direct commit-reveal pattern for simplified workflow
  async directCommitReveal(ipfsHash: string, bondAmount: bigint, targetContract: string): Promise<string> {
    try {
      console.log("Starting direct commit-reveal process...");
      
      // Step 1: Commit
      const commitResult = await this.commitSpec(ipfsHash, targetContract);
      console.log("Commit successful:", commitResult);
      
      // Step 2: Reveal (in production, this would have a delay)
      const revealTxHash = await this.revealSpec(
        commitResult.commitmentId,
        ipfsHash,
        commitResult.nonce,
        bondAmount
      );
      console.log("Reveal successful:", revealTxHash);
      
      return revealTxHash;
    } catch (error: any) {
      console.error("Direct commit-reveal failed:", error);
      throw new Error(`Direct commit-reveal failed: ${error.message}`);
    }
  }

  // ====================================
  // INCENTIVE MANAGEMENT
  // ====================================

  async createIncentive(
    targetContract: string,
    targetChainId: number,
    amount: bigint,
    duration: bigint,
    description: string
  ): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // For ETH incentives, the value must be sent with the transaction
      const tx = await this.contract.createIncentive(
        targetContract,
        targetChainId,
        amount,
        duration,
        description,
        { value: amount } // ETH amount sent as value
      );

      console.log("Create incentive transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Create incentive transaction confirmed:", receipt?.hash);

      return tx.hash;
    } catch (error: any) {
      console.error("Create incentive failed:", error);
      throw new Error(`Failed to create incentive: ${error.message}`);
    }
  }

  async getUserIncentives(userAddress: string): Promise<string[]> {
    // Auto-connect if not connected
    if (!this.contract) {
      try {
        console.log("Contract not connected, attempting to connect...");
        await this.connect();
      } catch (connectError) {
        console.warn("Failed to auto-connect for getUserIncentives:", connectError);
        // Return empty array instead of throwing to prevent blocking the UI
        return [];
      }
    }

    // Double check after connection attempt
    if (!this.contract) {
      console.warn("Contract still not available after connection attempt, returning empty array");
      return [];
    }

    try {
      const incentiveIds = await this.contract.getUserIncentives(userAddress);
      
      // Convert from ethers result to string array
      const ids = Array.from(incentiveIds);
      
      return ids;
    } catch (error: any) {
      console.error("💥 Error getting user incentives:", error);
      console.error("🔧 Contract address:", this.contract?.target);
      console.error("📝 Function signature: getUserIncentives(address)");
      
      // If function doesn't exist or returns empty data, return empty array instead of throwing
      if (error.code === "BAD_DATA" || error.info?.method === "getUserIncentives") {
        console.warn("⚠️ getUserIncentives function may not exist on this contract, returning empty array");
        return [];
      }
      
      // For other errors, also return empty array to prevent UI blocking
      console.warn("⚠️ getUserIncentives failed, returning empty array to prevent UI blocking");
      return [];
    }
  }

  async getIncentiveData(incentiveId: string): Promise<any> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const incentive = await this.contract.incentives(incentiveId);
      return {
        creator: incentive[0],
        amount: incentive[1],
        reserved1: incentive[2],
        deadline: incentive[3],
        createdAt: incentive[4],
        targetContract: incentive[5],
        isClaimed: incentive[6],
        isActive: incentive[7],
        chainId: incentive[8],
        description: incentive[9]
      };
    } catch (error: any) {
      console.error("Failed to get incentive data:", error);
      throw new Error(`Failed to get incentive data: ${error.message}`);
    }
  }

  async getIncentivePool(targetContract: string, chainId: number = SEPOLIA_CHAIN_ID): Promise<{
    poolAmount: bigint;
    contributorCount: bigint;
  }> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const [poolAmount, contributorCount] = await this.contract.getIncentivePool(targetContract, chainId);
      return {
        poolAmount,
        contributorCount
      };
    } catch (error: any) {
      console.error("Failed to get incentive pool:", error);
      throw new Error(`Failed to get incentive pool: ${error.message}`);
    }
  }
  
  async clawbackIncentive(incentiveId: string): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const tx = await this.contract.clawbackIncentive(incentiveId);
      console.log("Clawback incentive transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Clawback incentive transaction confirmed:", receipt?.hash);
      
      return tx.hash;
    } catch (error: any) {
      console.error("Clawback incentive failed:", error);
      throw new Error(`Failed to clawback incentive: ${error.message}`);
    }
  }

  async getAvailableIncentives(targetContract: string, targetChainId: number = SEPOLIA_CHAIN_ID): Promise<any> {
    try {
      const poolData = await this.getIncentivePool(targetContract, targetChainId);
      return {
        poolAmount: poolData.poolAmount,
        contributorCount: poolData.contributorCount,
        hasIncentives: poolData.poolAmount > 0n
      };
    } catch (error: any) {
      console.error("Failed to get available incentives:", error);
      return {
        poolAmount: 0n,
        contributorCount: 0n,
        hasIncentives: false
      };
    }
  }

  async checkIncentiveForSpec(specId: string): Promise<any> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const specData = await this.getSpecData(specId);
      if (specData.incentiveId && specData.incentiveId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return await this.getIncentiveData(specData.incentiveId);
      }
      return null;
    } catch (error: any) {
      console.error("Failed to check incentive for spec:", error);
      throw new Error(`Failed to check incentive for spec: ${error.message}`);
    }
  }

  // ====================================
  // REALITY.ETH INTEGRATION
  // ====================================

  private async initializeRealityEthContract(): Promise<void> {
    if (!this.contract || !this.provider || this.realityEthContract) {
      return;
    }

    try {
      const realityEthAddress = await this.contract.realityETH();
      this.realityEthContract = new ethers.Contract(
        realityEthAddress,
        REALITY_ETH_ABI,
        this.provider
      ) as RealityEthContract;
    } catch (error) {
      console.error("Failed to initialize Reality.eth contract:", error);
    }
  }

  async getRequiredBondForQuestion(questionId: string): Promise<bigint> {
    await this.initializeRealityEthContract();
    
    if (!this.realityEthContract) {
      throw new Error("Reality.eth contract not initialized");
    }

    try {
      return await this.realityEthContract.getMinBond(questionId);
    } catch (error: any) {
      console.error("Failed to get required bond for question:", error);
      throw new Error(`Failed to get required bond for question: ${error.message}`);
    }
  }

  async isQuestionFinalized(questionId: string): Promise<boolean> {
    await this.initializeRealityEthContract();
    
    if (!this.realityEthContract) {
      throw new Error("Reality.eth contract not initialized");
    }

    try {
      return await this.realityEthContract.isFinalized(questionId);
    } catch (error: any) {
      console.error("Failed to check if question is finalized:", error);
      throw new Error(`Failed to check if question is finalized: ${error.message}`);
    }
  }

  async getBondInfo(): Promise<{
    minBond: bigint;
    currentBond: bigint;
    requiresHigherBond: boolean;
  }> {
    if (!this.contract) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const minBond = await this.getMinBond();
      
      // For now, return basic info - could be enhanced with question-specific logic
      return {
        minBond,
        currentBond: minBond,
        requiresHigherBond: false
      };
    } catch (error: any) {
      console.error("Failed to get bond info:", error);
      throw new Error(`Failed to get bond info: ${error.message}`);
    }
  }

  // ====================================
  // METADATA REGISTRY MANAGEMENT
  // ====================================

  async getMetadataRegistryAddress(): Promise<string> {
    return METADATA_REGISTRY_ADDRESS;
  }

  async attestMetadata(metadataHash: string): Promise<string> {
    if (!this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.signer
      );

      const tx = await metadataRegistry.attestMetadata(metadataHash);
      console.log("Attest metadata transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Attest metadata transaction confirmed:", receipt?.hash);
      
      return tx.hash;
    } catch (error: any) {
      console.error("Failed to attest metadata:", error);
      throw new Error(`Failed to attest metadata: ${error.message}`);
    }
  }

  async hasAttested(metadataHash: string, attesterAddress: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.provider
      );

      return await metadataRegistry.hasAttested(metadataHash, attesterAddress);
    } catch (error: any) {
      console.error("Failed to check attestation:", error);
      throw new Error(`Failed to check attestation: ${error.message}`);
    }
  }

  async getMetadataAttesters(metadataHash: string): Promise<string[]> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.provider
      );

      return await metadataRegistry.getMetadataAttesters(metadataHash);
    } catch (error: any) {
      console.error("Failed to get metadata attesters:", error);
      throw new Error(`Failed to get metadata attesters: ${error.message}`);
    }
  }

  async checkMetadataApproval(metadataHash: string, accountAddress: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.provider
      );

      return await metadataRegistry.approvedForAccount(metadataHash, accountAddress);
    } catch (error: any) {
      console.error("Failed to check metadata approval:", error);
      throw new Error(`Failed to check metadata approval: ${error.message}`);
    }
  }

  async trustAttesters(
    threshold: number,
    attesters: string[],
    mustIncludeAny: string[] = [],
    mustIncludeAll: string[] = []
  ): Promise<string> {
    if (!this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.signer
      );

      const tx = await metadataRegistry.trustAttesters(
        threshold,
        attesters,
        mustIncludeAny,
        mustIncludeAll
      );
      console.log("Trust attesters transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("Trust attesters transaction confirmed:", receipt?.hash);
      
      return tx.hash;
    } catch (error: any) {
      console.error("Failed to trust attesters:", error);
      throw new Error(`Failed to trust attesters: ${error.message}`);
    }
  }

  async getAccountConfig(accountAddress: string): Promise<{
    attesters: string[];
    threshold: number;
    mustIncludeAny: string[];
    mustIncludeAll: string[];
    isConfigured: boolean;
  }> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      const metadataRegistry = new ethers.Contract(
        METADATA_REGISTRY_ADDRESS,
        METADATA_REGISTRY_ABI,
        this.provider
      );

      const config = await metadataRegistry.getAccountConfig(accountAddress);
      return {
        attesters: config[0],
        threshold: Number(config[1]),
        mustIncludeAny: config[2],
        mustIncludeAll: config[3],
        isConfigured: config[4]
      };
    } catch (error: any) {
      console.error("Failed to get account config:", error);
      throw new Error(`Failed to get account config: ${error.message}`);
    }
  }

  // ====================================
  // UTILITY METHODS
  // ====================================

  private validateTargetContract(targetContract?: string): string {
    if (!targetContract || targetContract.trim() === "" || !targetContract.match(/^0x[a-fA-F0-9]{40}$/)) {
      return RAW_CONTRACT_ADDRESS;
    }
    return targetContract;
  }

  private async validateBondAmount(bondAmount: bigint): Promise<void> {
    const contractMinBond = await this.getMinBond();
    const requiredBond = contractMinBond + (contractMinBond / BigInt(10)); // 10% safety margin
    
    if (bondAmount < requiredBond) {
      throw new Error(`Insufficient bond. Required: ${(Number(requiredBond) / 10**18).toFixed(5)} ETH (including safety margin)`);
    }
  }

  async getAllUserSpecsByEvents(): Promise<string[]> {
    if (!this.provider) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // This would require event filtering - simplified implementation
      // In a full implementation, you would filter SpecCommitted, SpecRevealed events
      return [];
    } catch (error: any) {
      console.error("Failed to get user specs by events:", error);
      throw new Error(`Failed to get user specs by events: ${error.message}`);
    }
  }

  async getAllFinalizedSpecs(): Promise<any[]> {
    // This would require event filtering or additional contract methods
    // For now, return empty array as placeholder
    return [];
  }

  async getQuestionId(ipfsHash: string): Promise<string> {
    // This would need to be implemented based on how question IDs are generated
    // For now, return a placeholder
    return ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
  }

}

// ====================================
// SINGLETON EXPORT
// ====================================

export const web3Service = new Web3Service();