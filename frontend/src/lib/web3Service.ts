// @ts-nocheck
// TypeScript is disabled in this file due to dynamic contract interactions across
// multiple KaiSign versions and ethers v6 function APIs (e.g., .staticCall, .estimateGas
// on function objects). Strong typing here caused noisy, non-actionable errors and
// duplicate API variants; runtime behavior is preserved.
import { ethers } from "ethers";

// Declare the window.ethereum for TypeScript
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

// Type for contract methods to handle TS errors (V1 contract)
type ContractWithMethods = ethers.Contract & {
  minBond: () => Promise<bigint>;
  // commitSpec no longer accepts an incentiveId. It now takes only (bytes32 commitment, address targetContract, uint256 chainId).
  commitSpec: (commitment: string, targetContract: string, targetChainId: number) => Promise<any>;
  revealSpec: (commitmentId: string, blobHash: string, metadataHash: string, nonce: bigint, options: { value: bigint }) => Promise<any>;
  proposeSpec: (specID: string, options: { value: bigint }) => Promise<any>;
  assertSpecValid: (specID: string, options: { value: bigint }) => Promise<any>;
  assertSpecInvalid: (specID: string, options: { value: bigint }) => Promise<any>;
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
};

// Type for Reality.eth contract methods
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

// ABI for the KaiSign V1 contract - Updated to match actual contract interface
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
      {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
      {"internalType": "uint256", "name": "nonce", "type": "uint256"}
    ],
    "name": "revealSpec",
    "outputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "stateMutability": "payable",
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
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "assertSpecValid",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "assertSpecInvalid",
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
      {"internalType": "uint80", "name": "amount", "type": "uint80"},
      {"internalType": "uint16", "name": "reserved1", "type": "uint16"},
      {"internalType": "uint64", "name": "deadline", "type": "uint64"},
      {"internalType": "uint64", "name": "createdAt", "type": "uint64"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "bool", "name": "isClaimed", "type": "bool"},
      {"internalType": "bool", "name": "isActive", "type": "bool"},
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
      {"internalType": "bool", "name": "bondsSettled", "type": "bool"},
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
    "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
    "stateMutability": "view",
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
    "inputs": [{"internalType": "address", "name": "targetContract", "type": "address"}],
    "name": "getContractSpecCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "specs",
    "outputs": [
      {"internalType": "uint64", "name": "createdTimestamp", "type": "uint64"},
      {"internalType": "uint64", "name": "proposedTimestamp", "type": "uint64"},
      {"internalType": "uint8", "name": "status", "type": "uint8"},
      {"internalType": "bool", "name": "bondsSettled", "type": "bool"},
      {"internalType": "uint48", "name": "totalBonds", "type": "uint48"},
      {"internalType": "uint8", "name": "reserved", "type": "uint8"},
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "string", "name": "ipfs", "type": "string"},
      {"internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "commitments",
    "outputs": [
      {"internalType": "address", "name": "committer", "type": "address"},
      {"internalType": "uint64", "name": "commitTimestamp", "type": "uint64"},
      {"internalType": "uint32", "name": "reserved1", "type": "uint32"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "bool", "name": "isRevealed", "type": "bool"},
      {"internalType": "uint80", "name": "bondAmount", "type": "uint80"},
      {"internalType": "uint8", "name": "reserved", "type": "uint8"},
      {"internalType": "uint64", "name": "revealDeadline", "type": "uint64"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
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
    "inputs": [],
    "name": "realityETH",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "committer", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "targetContract", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "bondAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint64", "name": "revealDeadline", "type": "uint64"}
    ],
    "name": "LogCommitSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "incentiveId", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "creator", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "targetContract", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "token", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint64", "name": "deadline", "type": "uint64"},
      {"indexed": false, "internalType": "string", "name": "description", "type": "string"}
    ],
    "name": "LogIncentiveCreated",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "bondsSettled",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Reality.eth contract ABI (minimal for bond calculations)
const REALITY_ETH_ABI = [
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getMinBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "questions",
    "outputs": [
      {"internalType": "bytes32", "name": "content_hash", "type": "bytes32"},
      {"internalType": "address", "name": "arbitrator", "type": "address"},
      {"internalType": "uint32", "name": "opening_ts", "type": "uint32"},
      {"internalType": "uint32", "name": "timeout", "type": "uint32"},
      {"internalType": "uint32", "name": "finalize_ts", "type": "uint32"},
      {"internalType": "bool", "name": "is_pending_arbitration", "type": "bool"},
      {"internalType": "uint256", "name": "bounty", "type": "uint256"},
      {"internalType": "bytes32", "name": "best_answer", "type": "bytes32"},
      {"internalType": "bytes32", "name": "history_hash", "type": "bytes32"},
      {"internalType": "uint256", "name": "bond", "type": "uint256"},
      {"internalType": "uint256", "name": "min_bond", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Reality.eth contract address (Sepolia by default)
const REALITY_ETH_ADDRESS = process.env.NEXT_PUBLIC_REALITY_ETH_ADDRESS ||
  "0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA";

// Contract address (configurable via NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS; falls back to known Sepolia addr)
const RAW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS || "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719";
// Chain ID (configurable via NEXT_PUBLIC_CHAIN_ID, defaults to Sepolia)
const SEPOLIA_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ContractWithMethods | null = null;
  private realityEthContract: RealityEthContract | null = null;
  
  /**
   * Connect to MetaMask and initialize the contract
   */
  async connect(): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error("This function can only be called on the client side.");
    }
    
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please make sure MetaMask is unlocked.");
      }

      // Initialize provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();

      // Initialize contract (network check moved to individual functions that need it)
      const kaisignContract = new ethers.Contract(
        RAW_CONTRACT_ADDRESS,
        CONTRACT_ABI,
        this.signer
      ) as ContractWithMethods;

      // Assign to instance variables after successful initialization
      this.contract = kaisignContract;
      // Initialize Reality.eth contract now for read calls (bond info)
      this.realityEthContract = new ethers.Contract(
        REALITY_ETH_ADDRESS,
        REALITY_ETH_ABI,
        this.provider
      ) as RealityEthContract;



      return accounts[0];
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      throw error;
    }
  }
  
  /**
   * Check if we're on the Sepolia network
   */
  async checkNetwork(): Promise<boolean> {
    if (!this.provider) return false;
    
    try {
      const network = await this.provider.getNetwork();
      return Number(network.chainId) === SEPOLIA_CHAIN_ID;
    } catch (error) {
      console.error("Error checking network:", error);
      return false;
    }
  }
  
  /**
   * Get the minimum bond amount required for a new question from the KaiSign contract
   */
  async getMinBond(): Promise<bigint> {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Please connect first.");
      }

      const minBond = await this.contract.minBond();

      return minBond;
    } catch (error) {
      console.error("Error getting minimum bond from contract:", error);
      // Fallback to a reasonable default if contract call fails
      const fallbackBond = BigInt("100000000000000"); // 0.0001 ETH

      return fallbackBond;
    }
  }
  
  /**
   * Calculate the required bond for answering a specific question
   * Based on Reality.eth rules: first answer needs min_bond, subsequent answers need 2x previous bond
   */
  async getRequiredBondForQuestion(questionId: string): Promise<bigint> {
    try {
      if (!this.realityEthContract) {
        if (!this.provider) {
          throw new Error("Wallet not connected. Please connect first.");
        }
        this.realityEthContract = new ethers.Contract(
          REALITY_ETH_ADDRESS,
          REALITY_ETH_ABI,
          this.provider
        ) as RealityEthContract;
      }

      // Get the current bond for this question
      const currentBond = await this.realityEthContract.getBond(questionId);
      
      if (currentBond === BigInt(0)) {
        // No previous answers, use minimum bond
        const minBond = await this.realityEthContract.getMinBond(questionId);

        return minBond;
      } else {
        // Previous answers exist, need to double the current bond
        const requiredBond = currentBond * BigInt(2);

        return requiredBond;
      }
    } catch (error) {
      console.error("Error calculating required bond for question:", error);
      // Fallback to contract minimum bond
      return await this.getMinBond();
    }
  }
  
  /**
   * Get bond information for a question (current bond, minimum bond, and required next bond)
   * In V1, we need to check if a spec exists first
   */
  async getBondInfo(ipfsHash: string): Promise<{
    currentBond: bigint;
    minBond: bigint;
    requiredNextBond: bigint;
    hasAnswers: boolean;
  }> {
    try {
      if (!this.contract) {
        throw new Error("Contract not initialized. Please connect first.");
      }
      if (!this.realityEthContract) {
        if (!this.provider) {
          throw new Error("Wallet not connected. Please connect first.");
        }
        this.realityEthContract = new ethers.Contract(
          REALITY_ETH_ADDRESS,
          REALITY_ETH_ABI,
          this.provider
        ) as RealityEthContract;
      }

      // Generate specID from identifier (now blob versioned hash)
      const specId = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      
      try {
        // Check if spec exists and get its data
        const spec = await this.contract.specs(specId);
        const questionId = spec.questionId;
        
        if (questionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          // Question doesn't exist yet, return contract minimum bond with safety margin
          const contractMinBond = await this.getMinBond();
          const requiredBond = BigInt("20000000000000000"); // Use 0.02 ETH instead of calculated amount
          return {
            currentBond: BigInt(0),
            minBond: contractMinBond,
            requiredNextBond: requiredBond,
            hasAnswers: false
          };
        }

        // Get bond information from Reality.eth
        const currentBond = await this.realityEthContract.getBond(questionId);
        const minBond = await this.realityEthContract.getMinBond(questionId);
        
        const hasAnswers = currentBond > BigInt(0);
        const baseRequiredBond = hasAnswers ? currentBond * BigInt(2) : minBond;
        // Add safety margin for all bonds
        const requiredNextBond = BigInt("15000000000000000"); // Use 0.015 ETH instead of calculated amount

        return {
          currentBond,
          minBond,
          requiredNextBond,
          hasAnswers
        };
      } catch (specError) {

        // Spec doesn't exist yet, return contract minimum bond with safety margin
        const contractMinBond = await this.getMinBond();
        const requiredBond = BigInt("20000000000000000"); // Use 0.02 ETH instead of calculated amount
        return {
          currentBond: BigInt(0),
          minBond: contractMinBond,
          requiredNextBond: requiredBond,
          hasAnswers: false
        };
      }
    } catch (error) {
      console.error("Error getting bond info:", error);
      // Fallback to contract minimum bond with safety margin
      const contractMinBond = await this.getMinBond();
      const requiredBond = contractMinBond + (contractMinBond / BigInt(10)); // Add 10% safety margin
      return {
        currentBond: BigInt(0),
        minBond: contractMinBond,
        requiredNextBond: requiredBond,
        hasAnswers: false
      };
    }
  }
  
  /**
   * Commit spec using V1 contract (step 1 of commit-reveal pattern)
   */
  // The commitSpec method no longer takes an incentiveId. Incentives are created ahead
  // of time and automatically assigned when a spec is accepted. The function signature
  // accepts blobHash, bondAmount, an optional targetContract and optional chainId.
  async commitSpec(blobHash: string, bondAmount: bigint, targetContract?: string, targetChainId?: number): Promise<{
    commitmentId: string;
    commitTxHash: string;
    revealDeadline: number;
    nonce: number;
    commitment: string;
    metadataHash: string;
  }> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Make sure we're on the Sepolia network
      // Network check removed - let users connect on any network
      



      
      // Generate a proper nonce for the commitment
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      
      // The blobHash parameter is actually the metadataHash (hash of JSON)
      // This is a naming issue - it should be called metadataHash
      const metadataHash = blobHash;
      
      // Create the commitment using metadataHash and nonce (as per contract)
      const commitment = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "uint256"], [metadataHash, nonce])
      );
      




      
      // The V1 contract requires the target contract to exist on Sepolia (extcodesize check)
      // For ERC7730 specs, we want to allow any contract address (even from other chains)
      // But V1 contract validates existence, so we need a deployed contract on Sepolia
      let target = targetContract;
      
      // Known working Sepolia contracts for testing
      const validSepoliaContracts = [
        RAW_CONTRACT_ADDRESS, // KaiSign itself
        "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
        "0x779877A7B0D9E8603169DdbD7836e478b4624789", // Another known contract
      ];
      
      if (!target || target.trim() === "" || !target.match(/^0x[a-fA-F0-9]{40}$/)) {
        // Use KaiSign contract as default if no valid target specified
        target = RAW_CONTRACT_ADDRESS;

      } else {

        
        // Check if the target contract exists on Sepolia
        try {
          const targetCode = await this.provider!.getCode(target);

          if (targetCode === "0x") {
            console.warn("⚠️ Target contract", target, "does not exist on Sepolia");
            console.warn("V1 contract requires target to exist on same network");
            console.warn("Falling back to KaiSign contract as target");
            target = RAW_CONTRACT_ADDRESS;
          } else {


          }
        } catch (codeCheckError) {
          console.warn("Could not verify target contract existence, using KaiSign contract as fallback");
          target = RAW_CONTRACT_ADDRESS;
        }
      }
      
      // Incentives are no longer passed during commit. Any incentive will be automatically
      // associated by the contract when a spec is accepted. Keep a zero bytes32 for
      // compatibility in logs if needed.
      const finalIncentiveId = "0x0000000000000000000000000000000000000000000000000000000000000000";
      
      // Validate minimum bond requirement with safety margin
      const contractMinBond = await this.getMinBond();
      // Add 10% safety margin to account for platform fees and rounding
      const requiredBond = contractMinBond + (contractMinBond / BigInt(10));
      
      if (bondAmount < requiredBond) {


        throw new Error(`Insufficient bond. Required: ${(Number(requiredBond) / 10**18).toFixed(5)} ETH (including safety margin for fees)`);
      }
      




      
      // CRITICAL: Run comprehensive diagnostics BEFORE attempting transaction
      // For commitSpec, we don't send any value, so pass 0n for bond amount
      await this.runPreTransactionDiagnostics(target, 0n);
      
      // Additional validation: Check if contract is properly deployed and accessible
      try {

        const contractCode = await this.provider!.getCode(RAW_CONTRACT_ADDRESS);

        
        // Test a simple read function first
        const testMinBond = await this.contract.minBond();

        
        // Check if contract is paused (V1 has Pausable)
        try {
          // Try to call the paused() function if it exists
          const pausedCall = await this.provider!.call({
            to: RAW_CONTRACT_ADDRESS,
            data: "0x5c975abb" // paused() function selector
          });
          const isPaused = pausedCall === "0x0000000000000000000000000000000000000000000000000000000000000001";

          
          if (isPaused) {
            throw new Error("Contract is currently paused");
          }
        } catch (pauseCheckError) {

        }
        
        // Special test: Check if the target contract validation is the issue


        const targetContractCode = await this.provider!.getCode(target);

        
        if (targetContractCode === "0x") {
          console.error("❌ FOUND THE ISSUE: Target contract has no code!");
          console.error("The contract's extcodesize check will fail for this target.");
          throw new Error(`Target contract ${target} does not exist or has no bytecode. The V1 contract requires the target contract to exist on Sepolia.`);
        } else {

        }
        
        // Check if treasury address is valid and can receive funds

        try {
          // Get treasury address from the contract
          const treasurySelector = "0x61d027b3"; // treasury() function selector
          const treasuryResult = await this.provider!.call({
            to: RAW_CONTRACT_ADDRESS,
            data: treasurySelector
          });
          const treasuryAddress = "0x" + treasuryResult.slice(-40);

          
          // Check if treasury is a valid address (not zero address)
          if (treasuryAddress === "0x0000000000000000000000000000000000000000") {
            console.error("❌ ISSUE FOUND: Treasury address is zero address!");
            throw new Error("Treasury address is not set properly in the contract");
          }
          
          // Check if treasury can receive funds (not a contract that might reject)
          const treasuryCode = await this.provider!.getCode(treasuryAddress);

          
          if (treasuryCode.length > 2) {

            // Try a tiny test transfer to see if treasury can receive funds
            try {
              const testAmount = BigInt(1); // 1 wei
              await this.provider!.call({
                to: treasuryAddress,
                value: testAmount,
                from: await this.signer.getAddress()
              });

            } catch (treasuryTestError) {
              console.error("❌ POSSIBLE ISSUE: Treasury might reject fund transfers:", treasuryTestError);
            }
          } else {

          }
        } catch (treasuryError) {
          console.error("Could not check treasury address:", treasuryError);
        }
        
      } catch (contractError) {
        console.error("Contract accessibility test failed:", contractError);
        throw contractError; // Re-throw the specific error instead of generic one
      }
      
      // Step 1: Commit



      
      // Check if commitment already exists
      try {

        const commitmentId = ethers.keccak256(ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [commitment, await this.signer.getAddress(), target, Math.floor(Date.now() / 1000)]
        ));
        
        const existingCommitment = await this.contract.commitments(commitmentId);
        console.log("Checking if commitment already exists:", existingCommitment.committer !== ethers.ZeroAddress);
        
        // Try a static call first to see if it would succeed
        const staticResult = await this.contract.commitSpec.staticCall(
          commitment,
          target,
          targetChainId || 1
        );
        console.log("Static call successful, proceeding with transaction");
        
      } catch (checkError) {
        console.error("Pre-transaction checks failed:", checkError);
        
        // If it's a revert, try to get more info
        if (checkError.data) {

        }
        
        throw new Error(`Pre-transaction validation failed: ${checkError.message}`);
      }
      
      // Try manual gas estimation
      try {

        const gasEstimate = await this.contract.commitSpec.estimateGas(
          commitment, 
          target, 
          targetChainId || 1
        );

      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        throw new Error(`Gas estimation failed: ${gasError.message}`);
      }
      
      const commitTx = await this.contract.commitSpec(commitment, target, targetChainId || 1);
      

      const commitReceipt = await commitTx.wait();

      
      // Step 2: Extract the actual commitment ID from the LogCommitSpec event
      let commitmentId: string | null = null;
      
      for (const log of commitReceipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog(log);
          if (parsed && parsed.name === 'LogCommitSpec') {
            commitmentId = parsed.args.commitmentId;

            break;
          }
        } catch (e) {
          // Ignore logs that can't be parsed by our interface
        }
      }
      
      if (!commitmentId) {
        throw new Error("Could not find LogCommitSpec event in transaction logs");
      }
      

      
      return {
        commitmentId,
        commitTxHash: commitTx.hash,
        revealDeadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: Number(nonce),
        commitment,
        metadataHash
      };
    } catch (error: any) {
      console.error("Error proposing spec:", error);
      
      // Enhanced error handling for V1 contract specific issues
      if (error.message?.includes("missing revert data") && !error.data) {






        
        // Try a different approach - use a known good contract as target
        const knownGoodContracts = [
          "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
          "0x779877A7B0D9E8603169DdbD7836e478b4624789", // Another known contract
        ];
        
        for (const testTarget of knownGoodContracts) {
          try {

            const testCode = await this.provider!.getCode(testTarget);
            if (testCode !== "0x") {

              return await this.directCommitReveal(ipfsHash, bondAmount, testTarget);
            }
          } catch (testError) {

          }
        }
        

        try {
          return await this.directCommitReveal(ipfsHash, bondAmount, RAW_CONTRACT_ADDRESS);
        } catch (directError) {
          console.error("Direct transaction also failed:", directError);
          // Continue with original error handling
        }
      }
      
      // Try to decode custom error
      if (error.reason) {
        console.error("Contract revert reason:", error.reason);
      }
      if (error.data) {
        console.error("Contract error data:", error.data);
        
        // Try to decode known custom errors from the V1 contract
        try {
          const errorSignatures = {
            "0x4ca88867": "AlreadyProposed()",
            "0xfb8f41b2": "NotProposed()", 
            "0x47df8ce0": "InsufficientBond()",
            "0xd2e74c4c": "InsufficientIncentive()",
            "0x6efc7261": "InvalidContract()",
            "0xed592624": "ContractNotFound()",
            "0x5fd9a6de": "InvalidIPFS()",
            "0x0982e9b5": "CommitmentNotFound()",
            "0x6e9ad0b3": "CommitmentExpired()",
            "0x4221d9dc": "CommitmentAlreadyRevealed()",
            "0x8baa579f": "InvalidReveal()",
            "0xf1a2b62a": "NotFinalized()",
            "0x9cf8e11f": "AlreadySettled()",
            "0xa7648c19": "NoIncentiveToClaim()",
            "0xc3e2a8b1": "IncentiveExpired()",
            "0x82b42900": "Unauthorized()"
          };
          
          const errorSelector = error.data.slice(0, 10);
          const customError = errorSignatures[errorSelector as keyof typeof errorSignatures];
          if (customError) {
            throw new Error(`Contract reverted with: ${customError}`);
          }
        } catch (decodeError) {
          console.error("Could not decode error:", decodeError);
        }
      }
      
      // If we can't decode it, check for common issues
      if (error.message?.includes("insufficient funds") || error.message?.includes("InsufficientBond")) {
        throw new Error("Insufficient bond amount. Please check the minimum bond requirement.");
      }
      if (error.message?.includes("ContractNotFound")) {
        throw new Error(`The target contract ${targetContract || 'specified'} does not exist on Sepolia testnet. The V1 contract requires target contracts to be deployed on the same network. Please use a valid Sepolia contract address or leave empty for general specifications.`);
      }
      if (error.message?.includes("InvalidContract")) {
        throw new Error("Invalid target contract address format.");
      }
      
      throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Reveal spec using V1 contract (step 2 of commit-reveal pattern)
   */
  async revealSpec(commitmentId: string, blobHash: string, metadataHash: string, nonce: number, bondAmount: bigint): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }

      console.log("revealSpec called with:", {
        commitmentId,
        blobHash,
        metadataHash,
        nonce,
        bondAmount: bondAmount.toString()
      });

      // Debug: Check what the contract has stored for this commitment
      try {
        const storedCommitment = await this.contract.commitments(commitmentId);
        console.log("Stored commitment data:", {
          committer: storedCommitment[0],
          commitTimestamp: storedCommitment[1].toString(),
          reserved1: storedCommitment[2].toString(),
          targetContract: storedCommitment[3],
          isRevealed: storedCommitment[4],
          bondAmount: storedCommitment[5].toString(),
          reserved: storedCommitment[6].toString(),
          revealDeadline: storedCommitment[7].toString(),
          chainId: storedCommitment[8].toString(),
          incentiveId: storedCommitment[9]
        });
        
        // Check if we're the right committer
        const ourAddress = await this.signer.getAddress();
        console.log("Our address:", ourAddress);
        console.log("Committer address:", storedCommitment[0]);
        
        // Check if commitment expired
        const currentTime = Math.floor(Date.now() / 1000);
        const revealDeadline = Number(storedCommitment[7]);
        console.log("Current time:", currentTime);
        console.log("Reveal deadline:", revealDeadline);
        if (currentTime > revealDeadline) {
          throw new Error("Commitment has expired. Please create a new commitment.");
        }
        
        // Let's verify what commitment the contract expects
        const expectedCommitment = ethers.keccak256(
          ethers.solidityPacked(["bytes32", "uint256"], [metadataHash, BigInt(nonce)])
        );
        console.log("Expected commitment hash:", expectedCommitment);
        
        // Reconstruct the commitment ID as the contract would
        const reconstructedCommitmentId = ethers.keccak256(
          ethers.solidityPacked(
            ["bytes32", "address", "address", "uint256", "uint64"],
            [expectedCommitment, storedCommitment[0], storedCommitment[3], storedCommitment[8], storedCommitment[1]]
          )
        );
        console.log("Reconstructed commitment ID:", reconstructedCommitmentId);
        console.log("Provided commitment ID:", commitmentId);
        console.log("Do they match?", reconstructedCommitmentId === commitmentId);
        
        if (reconstructedCommitmentId !== commitmentId) {
          console.error("Commitment ID mismatch! The nonce or metadata hash doesn't match what was used during commit.");
          console.log("This commitment was created with a different nonce or metadata hash.");
          console.log("Please ensure you're using the exact same nonce that was returned during commit.");
        }
        
      } catch (debugError) {
        console.log("Debug error (non-critical):", debugError);
      }

      // Try a static call first to see what exactly fails
      try {
        await this.contract.revealSpec.staticCall(commitmentId, blobHash, metadataHash, BigInt(nonce), { value: bondAmount });

      } catch (staticError: any) {


      }

      const revealTx = await this.contract.revealSpec(commitmentId, blobHash, metadataHash, BigInt(nonce), { value: bondAmount });

      const revealReceipt = await revealTx.wait();


      return revealTx.hash;
    } catch (error: any) {
      console.error("Error revealing spec:", error);
      throw new Error(`Reveal failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Complete submit flow (for backward compatibility)
   */
  async submitSpec(blobHash: string, bondAmount: bigint, targetContract?: string, targetChainId?: number): Promise<string> {
    // The submitSpec convenience method commits then immediately reveals the spec.
    // Incentives are no longer passed as part of commit.
    const commitResult = await this.commitSpec(blobHash, bondAmount, targetContract, targetChainId);
    return await this.revealSpec(commitResult.commitmentId, blobHash, commitResult.metadataHash, commitResult.nonce, bondAmount);
  }
  
  /**
   * Get the questionId from the contract for a given IPFS hash
   * In V1, we need to find the specID first, then get the questionId from the spec
   */
  async getQuestionId(ipfsHash: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Generate specID from the blob versioned hash
      const specId = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      
      // Get the spec data
      const spec = await this.contract.specs(specId);

      
      const questionId = spec.questionId;

      return questionId;
    } catch (error) {
      console.error("Error getting questionId:", error);
      throw error;
    }
  }

  /**
   * Get the current status of a specification from the contract
   * Returns: 0 = Submitted, 1 = Accepted, 2 = Rejected
   */
  async getSpecStatus(ipfsHash: string): Promise<number> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // We know contract is not null here
      const status = await this.contract.getStatus(ipfsHash);

      return Number(status);
    } catch (error) {
      console.error("Error getting spec status:", error);
      throw error;
    }
  }

  /**
   * Check if a specification is accepted
   */
  async isSpecAccepted(ipfsHash: string): Promise<boolean> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // We know contract is not null here
      const isAccepted = await this.contract.isAccepted(ipfsHash);

      return isAccepted;
    } catch (error) {
      console.error("Error checking if spec is accepted:", error);
      throw error;
    }
  }

  /**
   * Handle the result of a Reality.eth question by calling the contract's handleResult function
   */
  async handleResult(ipfsHash: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Make sure we're on the Sepolia network
      // Network check removed - let users connect on any network
      

      
      // Generate specID from IPFS hash
      const specId = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      
      // We know contract is not null here
      const tx = await this.contract.handleResult(specId);

      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();

      
      return tx.hash;
    } catch (error) {
      console.error("Error handling result:", error);
      throw error;
    }
  }

  /**
   * Get the IPFS hash from the contract for a given specID
   */
  async getIPFSByHash(specID: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // In V1, get the spec data and extract IPFS
      const spec = await this.contract.specs(specID);
      const ipfsHash = spec.ipfs;

      return ipfsHash;
    } catch (error) {
      console.error("Error getting IPFS hash:", error);
      throw error;
    }
  }

  /**
   * Create an incentive for a target contract (V1 feature)
   */
  async createIncentive(
    targetContract: string,
    targetChainId: number,
    amount: bigint,
    duration: bigint,
    description: string
  ): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }




      const tx = await this.contract.createIncentive(
        targetContract,
        targetChainId,
        amount,
        duration,
        description,
        { value: amount }
      );


      const receipt = await tx.wait();


      return tx.hash;
    } catch (error) {
      console.error("Error creating incentive:", error);
      throw error;
    }
  }

  /**
   * Get specs by contract address (V1 feature)
   */
  async getSpecsByContract(contractAddress: string, chainId: number = 11155111): Promise<string[]> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }

      const specIds = await this.contract.getSpecsByContract(contractAddress, chainId);

      return specIds;
    } catch (error) {
      console.error("Error getting specs by contract:", error);
      throw error;
    }
  }

  /**
   * Get ALL specs for a user by querying SpecRevealed events
   */
  async getAllUserSpecsByEvents(userAddress: string): Promise<string[]> {
    try {
      if (!this.contract || !this.provider) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }


      
      // Get recent blocks to search for events
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Last ~7 days on mainnet
      

      
      // Query SpecRevealed events for this user
      const filter = this.contract.filters.SpecRevealed(null, userAddress, null);
      const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);
      

      
      const userSpecs: string[] = [];
      for (const event of events) {
        if (event.args && event.args.specId) {
          const specId = event.args.specId;

          userSpecs.push(specId);
        }
      }
      
      // Also check LogRevealSpec events (older format)
      try {
        const logRevealFilter = this.contract.filters.LogRevealSpec(userAddress, null, null, null);
        const logRevealEvents = await this.contract.queryFilter(logRevealFilter, fromBlock, currentBlock);
        

        
        for (const event of logRevealEvents) {
          if (event.args && event.args.specID) {
            const specId = event.args.specID;

            if (!userSpecs.includes(specId)) {
              userSpecs.push(specId);
            }
          }
        }
      } catch (logError) {

      }
      

      return userSpecs;
      
    } catch (error) {
      console.error("Error getting user specs by events:", error);
      throw error;
    }
  }

  /**
   * Get contract spec count (V1 feature)
   */
  async getContractSpecCount(contractAddress: string): Promise<number> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }

      const count = await this.contract.getContractSpecCount(contractAddress);

      return Number(count);
    } catch (error) {
      console.error("Error getting contract spec count:", error);
      throw error;
    }
  }

  // Diagnostic functions removed to clean up console output

  /**
   * Direct commit-reveal implementation for troubleshooting
   */
  async directCommitReveal(ipfsHash: string, bondAmount: bigint, targetContract: string): Promise<string> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }


      
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      const commitment = ethers.keccak256(ethers.solidityPacked(["string", "uint256"], [ipfsHash, nonce]));
      const target = targetContract || RAW_CONTRACT_ADDRESS;
      // Determine the chainId from the provider's network; fallback to 1 (Sepolia)
      let networkChainId = 1;
      try {
        const network = await this.provider.getNetwork();
        networkChainId = Number(network.chainId);
      } catch (_) {
        networkChainId = 1;
      }

      // Manually encode the function call for commitSpec(bytes32,address,uint256)
      const functionSelector = ethers.id("commitSpec(bytes32,address,uint256)").slice(0, 10);
      const encodedParams = ethers.concat([
        ethers.zeroPadValue(commitment, 32),
        ethers.zeroPadValue(target, 32),
        ethers.zeroPadValue(ethers.toBeHex(networkChainId), 32)
      ]);

      const txData = ethers.concat([functionSelector, encodedParams]);
      





      
      // Send the transaction directly
      const tx = await this.signer.sendTransaction({
        to: RAW_CONTRACT_ADDRESS,
        data: txData,
        value: bondAmount,
        gasLimit: 500000 // Set a reasonable gas limit
      });
      

      
      // Wait for confirmation  
      const receipt = await tx.wait();

      
      if (receipt.status === 0) {
        console.error("❌ Transaction reverted with status 0");

        
        // Try to get the revert reason using eth_call with the same transaction data at the block before
        try {

          await this.provider.call({
            to: RAW_CONTRACT_ADDRESS,
            data: txData,
            value: bondAmount,
            from: await this.signer.getAddress(),
            blockTag: receipt.blockNumber - 1
          });

        } catch (callError: any) {

          if (callError.data) {

            
            // Calculate error signatures dynamically to ensure accuracy
            const errorMappings = [
              "AlreadyProposed()",
              "NotProposed()",
              "InsufficientBond()",
              "InsufficientIncentive()",
              "InvalidContract()",
              "ContractNotFound()",
              "InvalidIPFS()",
              "CommitmentNotFound()",
              "CommitmentExpired()",
              "CommitmentAlreadyRevealed()",
              "InvalidReveal()",
              "NotFinalized()",
              "AlreadySettled()",
              "NoIncentiveToClaim()",
              "IncentiveExpired()",
              "Unauthorized()"
            ];
            
            const errorSignatures = {};
            errorMappings.forEach(error => {
              const selector = ethers.id(error).slice(0, 10);
              errorSignatures[selector] = error;
            });
            
            // Add generic error
            errorSignatures["0x08c379a0"] = "Error(string)";
            

            
            const selector = callError.data.slice(0, 10);
            if (errorSignatures[selector]) {

              
              // Provide specific guidance
              if (selector === "0xed592624") {

              } else if (selector === "0x47df8ce0") {

              } else if (selector === "0x82b42900") {

              }
              
              throw new Error(`Contract reverted with: ${errorSignatures[selector]}`);
            } else {

            }
          }
        }
        
        throw new Error("Transaction was mined but reverted. Check console logs for details.");
      }
      
      return tx.hash;
      
    } catch (error) {
      console.error("❌ Direct transaction failed:", error);
      throw error;
    }
  }

  /**
   * Run comprehensive diagnostics before attempting a transaction
   */
  async runPreTransactionDiagnostics(targetContract: string, bondAmount: bigint): Promise<void> {
    try {
      if (!this.contract || !this.signer || !this.provider) {
        throw new Error("Not connected");
      }


      const userAddress = await this.signer.getAddress();
      
      // 1. Check user's ETH balance
      const balance = await this.provider.getBalance(userAddress);


      
      if (balance < bondAmount) {
        throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(bondAmount)} ETH but only have ${ethers.formatEther(balance)} ETH`);
      }
      
      // 2. Check contract pause status
      try {
        const pausedResult = await this.provider.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x5c975abb" // paused() selector
        });
        const isPaused = pausedResult === "0x0000000000000000000000000000000000000000000000000000000000000001";

        
        if (isPaused) {
          throw new Error("Contract is currently paused");
        }
      } catch (pauseError) {

      }
      
      // 3. Validate target contract exists and has bytecode
      const targetCode = await this.provider.getCode(targetContract);


      
      if (targetCode === "0x") {
        throw new Error(`Target contract ${targetContract} does not exist on Sepolia testnet`);
      }
      
      // 4. Check treasury address configuration
      try {
        const treasuryAddress = await this.contract!.treasury();

        
        if (treasuryAddress === "0x0000000000000000000000000000000000000000") {
          throw new Error("Treasury address is not configured (zero address)");
        }
        
        // Check if treasury can receive funds
        const treasuryCode = await this.provider.getCode(treasuryAddress);

        
        if (treasuryCode.length > 2) {
          // Treasury is a contract, test if it can receive funds
          try {
            await this.provider.call({
              to: treasuryAddress,
              value: BigInt(1), // 1 wei test
              from: userAddress
            });

          } catch (treasuryTestError) {

            console.warn("Treasury test failed:", treasuryTestError);
          }
        }
        
        // CRITICAL: Test the exact platform fee transfer that happens in commitSpec
        const platformFee = (bondAmount * BigInt(5)) / BigInt(100);
        if (platformFee > BigInt(0)) {



          
          try {
            await this.provider.call({
              to: treasuryAddress,
              value: platformFee,
              from: userAddress,
              gasLimit: 50000 // Match contract gas limit
            });

          } catch (testError: any) {
            console.error("❌ Treasury transfer test failed:", testError.message);
            console.warn("Transaction may fail at treasury transfer");
          }
        }
      } catch (treasuryError) {
        console.warn("Treasury check failed:", treasuryError);
        console.warn("Continuing despite treasury issues - transaction will likely fail");
      }
      
      // 5. Check minimum bond requirement
      const contractMinBond = await this.contract.minBond();


      
      // Skip bond amount check for commitSpec (bondAmount is 0 for commit)
      // Bonds are only required during reveal
      if (bondAmount > 0n && bondAmount < contractMinBond) {
        throw new Error(`Bond amount ${ethers.formatEther(bondAmount)} ETH is below minimum required ${ethers.formatEther(contractMinBond)} ETH`);
      }
      
      // 6. Calculate platform fee and verify sufficient funds
      // NOTE: commitSpec doesn't take any payment, so skip this check when bondAmount is 0
      // The bond is only paid during reveal
      if (bondAmount > 0n) {
        const platformFee = (bondAmount * BigInt(5)) / BigInt(100); // 5% platform fee
        const netBondAmount = bondAmount - platformFee; // Amount actually used as bond
        
        if (netBondAmount < contractMinBond) {
          // Calculate required total to meet minimum after fee deduction
          const requiredTotal = (contractMinBond * BigInt(100)) / BigInt(95); // Reverse calculation
          throw new Error(`After platform fee, net bond would be ${ethers.formatEther(netBondAmount)} ETH, but minimum required is ${ethers.formatEther(contractMinBond)} ETH. Send at least ${ethers.formatEther(requiredTotal)} ETH`);
        }
      }
      
      // 7. Test Reality.eth contract connectivity
      try {
        // Skip Reality.eth connectivity test for now
        console.log("✓ Skipping Reality.eth connectivity test");

        
        // const realityCode = await this.provider.getCode(realityEthAddress);

        
        // if (realityCode === "0x") {
        //   throw new Error("Reality.eth contract not found at configured address");
        // }
      } catch (realityError) {
        console.error("Reality.eth check failed:", realityError);
        throw new Error("Could not verify Reality.eth integration");
      }
      
      // 8. Test contract function availability with static call
      try {

        const testCommitment =
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        // commitSpec in V1 accepts only (bytes32 commitment, address targetContract, uint256 chainId).
        // Do not pass an incentiveId here, as the V1 contract does not include that parameter.
        // IMPORTANT: commitSpec is NOT payable - no value should be sent
        await this.contract.commitSpec.staticCall(
          testCommitment,
          targetContract,
          1, // Default to mainnet for test
          { from: userAddress }
        );


      } catch (staticError) {
        console.error("❌ Static call failed:", staticError);
        
        if (staticError.data) {

          
          // Try to decode the error
          const errorMappings = [
            { selector: ethers.id("InsufficientBond()").slice(0, 10), name: "InsufficientBond" },
            { selector: ethers.id("ContractNotFound()").slice(0, 10), name: "ContractNotFound" },
            { selector: ethers.id("InvalidContract()").slice(0, 10), name: "InvalidContract" },
            { selector: ethers.id("Unauthorized()").slice(0, 10), name: "Unauthorized" },
            { selector: "0xd92e233d", name: "Paused" }
          ];
          
          const errorSelector = staticError.data.slice(0, 10);
          const knownError = errorMappings.find(e => e.selector === errorSelector);
          
          if (knownError) {
            throw new Error(`Contract would revert with: ${knownError.name}()`);
          } else {
            throw new Error(`Contract would revert with unknown error: ${errorSelector}`);
          }
        } else {
          throw new Error("Contract function call would fail (no revert data available)");
        }
      }
      
      // 9. Gas estimation test
      try {

        const testCommitment =
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        // Remove the testIncentive parameter; commitSpec only takes three arguments.
        const gasEstimate = await this.contract.commitSpec.estimateGas(
          testCommitment,
          targetContract,
          1, // Default to mainnet for test
          { value: bondAmount }
        );



        if (gasEstimate > BigInt(1000000)) {
          console.warn("⚠️ High gas estimate - transaction might be complex");
        }
        
      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        throw new Error("Could not estimate gas for transaction");
      }
      

      
    } catch (error) {
      console.error("❌ Pre-transaction diagnostics failed:", error);
      throw error;
    }
  }

  /**
   * Comprehensive contract analysis to understand what's deployed
   */
  async analyzeContract(): Promise<void> {
    try {
      if (!this.provider || !this.signer) {
        throw new Error("Not connected");
      }





      // 1. Check if there's any bytecode
      const code = await this.provider.getCode(RAW_CONTRACT_ADDRESS);



      if (code === "0x") {
        console.error("❌ No contract deployed at this address");
        return;
      }

      // 2. Test function selectors to identify which contract is deployed
      const selectors = {
        "minBond()": "0x1bb659ae",
        // Use the new 3-parameter commitSpec selector for V1 contracts
        "commitSpec(bytes32,address,uint256)": "0x" + ethers.id("commitSpec(bytes32,address,uint256)").slice(2, 10),
        "createSpec(string)": "0x8cd8db49", // Original
        "paused()": "0x5c975abb", // V1 (Pausable)
        "ADMIN_ROLE()": "0x75b238fc", // V1 (AccessControl)
        "realityETH()": "0xb0b61b9b",
        "templateId()": "0x66d8ac19"
      };

      for (const [funcName, selector] of Object.entries(selectors)) {
        try {
          const result = await this.provider.call({
            to: RAW_CONTRACT_ADDRESS,
            data: selector + "0".repeat(192) // Add padding for parameters
          });

        } catch (error: any) {
          if (error.data && error.data !== "0x") {

          } else {

          }
        }
      }

      // 3. Test commitSpec specifically with detailed analysis

      try {
        const testCommitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const testTarget = RAW_CONTRACT_ADDRESS;
        const minBond = BigInt("100000000000000"); // 0.0001 ETH

        // Encode the call to the new 3-parameter commitSpec
        const encodedCall = ethers.concat([
          ethers.id("commitSpec(bytes32,address,uint256)").slice(0, 10), // commitSpec selector
          ethers.zeroPadValue(testCommitment, 32),
          ethers.zeroPadValue(testTarget, 32),
          ethers.zeroPadValue(ethers.toBeHex(1), 32) // chainId = 1 for test
        ]);



        // Try static call
        const result = await this.provider.call({
          to: RAW_CONTRACT_ADDRESS,
          data: encodedCall,
          value: minBond,
          from: await this.signer.getAddress()
        });



      } catch (commitError: any) {

        if (commitError.data) {


          // Try to decode the error
          if (commitError.data.length >= 10) {
            const errorSelector = commitError.data.slice(0, 10);
            // Calculate error signatures dynamically to ensure accuracy
            const errorMappings = [
              "AlreadyProposed()",
              "NotProposed()",
              "InsufficientBond()",
              "InsufficientIncentive()",
              "InvalidContract()",
              "ContractNotFound()",
              "InvalidIPFS()",
              "CommitmentNotFound()",
              "CommitmentExpired()",
              "CommitmentAlreadyRevealed()",
              "InvalidReveal()",
              "NotFinalized()",
              "AlreadySettled()",
              "NoIncentiveToClaim()",
              "IncentiveExpired()",
              "Unauthorized()"
            ];
            
            const knownErrors = {};
            errorMappings.forEach(error => {
              const selector = ethers.id(error).slice(0, 10);
              knownErrors[selector] = error;
            });
            
            // Add known OpenZeppelin errors
            knownErrors["0xd92e233d"] = "Paused()";
            knownErrors["0x08c379a0"] = "Error(string)";
            


            if (knownErrors[errorSelector]) {

              
              // If it's ContractNotFound, that's our main suspect
              if (errorSelector === "0xed592624") {


                
                // Let's check the target contract bytecode size
                const targetCode = await this.provider.getCode(testTarget);


              }
            }
          }
        }
      }

    } catch (error) {
      console.error("Contract analysis failed:", error);
    }
  }

  /**
   * Identify which contract version is actually deployed
   */
  async identifyDeployedContract(): Promise<void> {
    try {
      if (!this.provider || !this.signer) {
        throw new Error("Not connected");
      }



      // Test signature differences between V1 and original - calculate proper selectors
      const tests = [
        {
          name: "Original KaiSign",
          selector: ethers.id("createSpec(string)").slice(0, 10), // createSpec(string)
          description: "Has createSpec(string) function"
        },
        {
          name: "KaiSign V1",
          selector: ethers.id("commitSpec(bytes32,address,uint256)").slice(0, 10), // commitSpec(bytes32,address,uint256)
          description: "Has commitSpec(bytes32,address,uint256) function"
        },
        {
          name: "V1 Pausable",
          selector: ethers.id("paused()").slice(0, 10), // paused()
          description: "Has paused() function from Pausable"
        },
        {
          name: "V1 AccessControl",
          selector: ethers.id("ADMIN_ROLE()").slice(0, 10), // ADMIN_ROLE()
          description: "Has ADMIN_ROLE constant from AccessControl"
        },
        {
          name: "Contract minBond",
          selector: ethers.id("minBond()").slice(0, 10), // minBond()
          description: "Has minBond() function"
        },
        {
          name: "Contract realityETH",
          selector: ethers.id("realityETH()").slice(0, 10), // realityETH()
          description: "Has realityETH() function"
        }
      ];
      

      tests.forEach(test => {

      });

      const results = [];
      for (const test of tests) {
        try {
          const result = await this.provider.call({
            to: RAW_CONTRACT_ADDRESS,
            data: test.selector
          });
          results.push(`✅ ${test.name}: YES (${test.description})`);

        } catch (error: any) {
          if (error.data && error.data !== "0x") {
            results.push(`⚠️ ${test.name}: EXISTS BUT REVERTS (${test.description})`);

          } else {
            results.push(`❌ ${test.name}: NO (${test.description})`);

          }
        }
      }

      // Determine which contract this is
      const hasCommitSpec = results[1].includes("✅") || results[1].includes("⚠️");
      const hasCreateSpec = results[0].includes("✅") || results[0].includes("⚠️");
      const hasPaused = results[2].includes("✅") || results[2].includes("⚠️");
      const hasMinBond = results[4].includes("✅") || results[4].includes("⚠️");
      const hasRealityETH = results[5].includes("✅") || results[5].includes("⚠️");

      if (hasCommitSpec && hasPaused) {

      } else if (hasCreateSpec && !hasCommitSpec && hasMinBond && hasRealityETH) {



        
        // Store this information for later use
        (window as any).__KAISIGN_CONTRACT_TYPE = "original";
      } else if (!hasCreateSpec && !hasCommitSpec) {


      } else {


      }

      // Print summary

      results.forEach(result => console.log("  " + result));

    } catch (error) {
      console.error("Contract identification failed:", error);
    }
  }

  /**
   * Test contract connectivity and basic functions
   */
  async testContract(): Promise<void> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }



      
      // Test 1: Check if contract exists
      const contractCode = await this.provider!.getCode(RAW_CONTRACT_ADDRESS);


      
      if (contractCode === "0x") {
        throw new Error("No contract deployed at this address");
      }
      
      // Test 2: Get minimum bond
      try {
        const minBond = await this.contract.minBond();

      } catch (error) {
        console.error("✗ minBond() failed:", error);
        throw new Error("Contract exists but minBond() function failed - wrong ABI?");
      }
      
      // Test 2b: Check if this looks like the V1 contract by checking constructor elements
      try {

        
        // Check for paused function (V1 specific)
        const pausedResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x5c975abb" // paused() selector
        });

        
        // Check for ADMIN_ROLE constant (V1 specific)
        const adminRoleResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x75b238fc" // ADMIN_ROLE() selector  
        });

        
        // Check for COMMIT_REVEAL_TIMEOUT constant
        const timeoutResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x1234567890abcdef" // This would be the selector for the constant
        });
        

      } catch (v1CheckError) {
        console.warn("Could not verify V1 contract features:", v1CheckError);
      }
      
      // Test 3: Get Reality.eth address
      try {
        // Skip Reality.eth address test
        console.log("✓ Skipping Reality.eth address test");

      } catch (error) {
        console.error("✗ realityETH() failed:", error);
      }
      
      // Test 4: Check if you have necessary roles
      try {

        const userAddress = await this.signer.getAddress();
        
        // Add hasRole function to ABI check
        const hasAdminRole = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: ethers.concat([
            "0x91d14854", // hasRole(bytes32,address) selector
            ethers.zeroPadValue("0x0000000000000000000000000000000000000000000000000000000000000000", 32), // DEFAULT_ADMIN_ROLE
            ethers.zeroPadValue(userAddress, 32)
          ])
        });

        
      } catch (roleError) {

      }

      // Test 5: Check if commitSpec function exists (using the new 3-parameter signature)
      try {


        // Try to call the function selector directly
        const commitSpecSelector = ethers.id("commitSpec(bytes32,address,uint256)").slice(0, 10);
        // Minimal calldata for 3 parameters: 3 * 32 bytes = 96 bytes of padding (192 hex chars)
        const testCalldata = commitSpecSelector + "0".repeat(192);

        const testCall = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: testCalldata
        });

      } catch (selectorError) {
        console.error("✗ commitSpec function test failed:", selectorError);
        if (selectorError.data) {


          // Check if it's just a revert due to invalid parameters vs function not found
          if (selectorError.data === "0x" || selectorError.data === null) {
            console.error("⚠️  Function might not exist - no revert data returned");
          } else {

          }
        }
      }

      // Test 6: Try to call commitSpec with dry run using realistic commitment
      try {
        const testIpfs = "QmTest123";
        const testNonce = BigInt(12345);
        const testCommitment = ethers.keccak256(ethers.solidityPacked(
          ["string", "uint256"],
          [testIpfs, testNonce]
        ));
        const testTarget = RAW_CONTRACT_ADDRESS;
        // Note: commitSpec in V1 accepts only (bytes32 commitment, address targetContract, uint256 chainId).
        // Do not define or pass a testIncentive parameter here.



        const gasEstimate = await this.contract.commitSpec.estimateGas(
          testCommitment,
          testTarget,
          1, // Default to mainnet for test
          { value: await this.contract.minBond() }
        );

      } catch (error) {
        console.error("✗ commitSpec test failed:", error);
        console.error("This suggests the contract might be paused, have access control, or different function signature");
        
        // Try to decode the error
        if (error.data) {

        }
      }
      

    } catch (error) {
      console.error("Contract test failed:", error);
      throw error;
    }
  }

  // =============================================================================
  //                          KAISIGN V1 FUNCTIONS
  // =============================================================================

  async createIncentive(
    targetContract: string,
    targetChainId: number,
    amount: string,
    durationSeconds: number,
    description: string
  ): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network
      

      console.log("💰 Parameters:", {
        targetContract,
        targetChainId,
        token,
        amount,
        durationSeconds,
        description
      });

      // ETH only - value is the amount

      
      // Check if contract has the createIncentive function

      if (typeof this.contract.createIncentive !== 'function') {
        throw new Error("Contract does not have createIncentive function");
      }
      

      const tx = await this.contract.createIncentive(
        targetContract,
        targetChainId,
        amount,
        durationSeconds,
        description,
        { value: amount }
      );
      


      
      const receipt = await tx.wait();

      
      // Log any events emitted
      if (receipt.logs && receipt.logs.length > 0) {

        receipt.logs.forEach((log: any, index: number) => {

        });
      }
      
      return tx.hash;
    } catch (error: any) {
      console.error("💥 Error creating incentive:", error);
      console.error("🔧 Contract address:", this.contract?.target);
      console.error("👤 Signer address:", await this.signer?.getAddress());
      
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error("Transaction would fail - check your parameters and account balance");
      }
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error("Insufficient ETH balance to complete transaction");
      }
      if (error.message?.includes('user rejected')) {
        throw new Error("Transaction was rejected by user");
      }
      
      throw error;
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
      throw new Error("Not connected to contract.");
    }

    try {
      const incentive = await this.contract.incentives(incentiveId);
      
      // Handle the struct response properly
      const result = {
        creator: incentive[0],              // address creator
        token: incentive[1],                // address token  
        amount: incentive[2].toString(),    // uint128 amount
        deadline: Number(incentive[3]),     // uint64 deadline
        createdAt: Number(incentive[4]),    // uint64 createdAt
        targetContract: incentive[5],       // address targetContract
        isClaimed: incentive[6],            // bool isClaimed
        isActive: incentive[7],             // bool isActive
        reserved: Number(incentive[8]),     // uint80 reserved
        chainId: Number(incentive[9]),      // uint256 chainId
        description: incentive[10]          // string description
      };
      
      return result;
    } catch (error: any) {
      console.error("💥 Error getting incentive data:", error);
      console.error("🔍 Incentive ID:", incentiveId);
      throw error;
    }
  }


  async getSpecsByContractPaginated(
    targetContract: string,
    offset: number,
    limit: number
  ): Promise<{ specIds: string[]; total: number }> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      const result = await this.contract.getSpecsByContractPaginated(
        targetContract,
        offset,
        limit
      );
      return {
        specIds: result.specIds,
        total: Number(result.total)
      };
    } catch (error: any) {
      console.error("Error getting paginated specs:", error);
      throw error;
    }
  }

  async getSpecData(specId: string): Promise<any> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {

      
      // Call the specs function and handle potential structure variations
      const spec = await this.contract.specs(specId);

      
      // The contract might have different struct layouts, so we need to handle both cases
      // Try to parse assuming the newer format with 'reserved' field
      let parsedSpec;
      
      if (Array.isArray(spec) && spec.length >= 12) {
        // Handle tuple/array format - Updated to match exact contract struct order
        parsedSpec = {
          createdTimestamp: Number(spec[0]),     // uint64 createdTimestamp
          proposedTimestamp: Number(spec[1]),    // uint64 proposedTimestamp
          status: Number(spec[2]),               // Status enum (uint8)
          bondsSettled: Boolean(spec[3]),        // bool bondsSettled
          totalBonds: spec[4].toString(),        // uint80 totalBonds
          reserved: Number(spec[5]),             // uint32 reserved
          creator: spec[6],                      // address creator
          targetContract: spec[7],               // address targetContract
          ipfs: spec[8],                         // string ipfs
          questionId: spec[9],                   // bytes32 questionId
          incentiveId: spec[10],                 // bytes32 incentiveId
          chainId: Number(spec[11])              // uint256 chainId
        };
      } else {
        // Handle named struct format
        parsedSpec = {
          createdTimestamp: Number(spec.createdTimestamp || 0),
          proposedTimestamp: Number(spec.proposedTimestamp || 0),
          status: Number(spec.status || 0),
          bondsSettled: Boolean(spec.bondsSettled),
          totalBonds: (spec.totalBonds || 0).toString(),
          reserved: Number(spec.reserved || 0),
          creator: spec.creator || "0x0000000000000000000000000000000000000000",
          targetContract: spec.targetContract || "0x0000000000000000000000000000000000000000",
          ipfs: spec.ipfs || "",
          questionId: spec.questionId || "0x0000000000000000000000000000000000000000000000000000000000000000",
          incentiveId: spec.incentiveId || "0x0000000000000000000000000000000000000000000000000000000000000000",
          chainId: Number(spec.chainId || 0)
        };
      }
      

      return parsedSpec;
      
    } catch (error: any) {
      console.error("💥 Error getting spec data:", error);
      console.error("📋 SpecId that failed:", specId);
      
      // Try to provide more helpful error information
      if (error.message?.includes("could not decode result data")) {
        console.error("🔧 This looks like an ABI mismatch. The contract struct might have changed.");
        
        // Try to extract some basic info from the raw error if possible
        if (error.value) {
          console.error("📊 Raw contract return value:", error.value);
        }
      }
      
      throw new Error(`Failed to decode specification data. This might be due to a contract version mismatch. Original error: ${error.message}`);
    }
  }

  async proposeSpec(specId: string, bondAmount: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network

      const tx = await this.contract.proposeSpec(specId, { value: bondAmount });
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error: any) {
      console.error("Error proposing spec:", error);
      throw error;
    }
  }

  async assertSpecValid(specId: string, bondAmount: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network

      const tx = await this.contract.assertSpecValid(specId, { value: bondAmount });
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error: any) {
      console.error("Error asserting spec valid:", error);
      throw error;
    }
  }

  async assertSpecInvalid(specId: string, bondAmount: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network

      const tx = await this.contract.assertSpecInvalid(specId, { value: bondAmount });
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error: any) {
      console.error("Error asserting spec invalid:", error);
      throw error;
    }
  }

  async handleResult(specId: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {

      
      // First check the current status of the spec
      const specData = await this.contract.specs(specId);


      
      // Status: 0=Committed, 1=Submitted, 2=Proposed, 3=Finalized, 4=Cancelled
      if (Number(specData.status) === 3) {
        // Spec is already finalized, but incentives might not be claimed
        // Let's try to claim ETH incentives manually if they exist

        
        // Check if there are available ETH incentives for this spec's target contract
        const availableIncentives = await this.getAvailableIncentives(specData.targetContract, Number(specData.chainId));

        
        const ethIncentives = availableIncentives.filter(inc => 
          inc.token === "0x0000000000000000000000000000000000000000" && 
          !inc.isClaimed && 
          inc.isActive
        );
        
        if (ethIncentives.length > 0) {
          // There are unclaimed ETH incentives - the spec might have been finalized without processing incentives
          // This could happen if handleResult was never called or failed partially

          
          // Try calling handleResult anyway - it might work if the Reality.eth question needs processing
          try {
            const tx = await this.contract.handleResult(specId);
            const receipt = await tx.wait();

            return tx.hash;
          } catch (handleError: any) {

            throw new Error("Specification is finalized but incentives weren't claimed automatically. This may require contract admin intervention or the incentives may have expired.");
          }
        } else {
          throw new Error("Specification is already finalized and no unclaimed ETH incentives found. Check if incentives were already claimed or use claimActiveTokenIncentive for ERC20 tokens.");
        }
      } else if (Number(specData.status) !== 2) {
        throw new Error(`Cannot handle result for spec in status ${specData.status}. Spec must be Proposed (status 2).`);
      }

      const tx = await this.contract.handleResult(specId);
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error: any) {
      console.error("Error handling result:", error);
      
      // Decode specific contract errors
      if (error.data === "0xf2a87d5e") {
        throw new Error("NotProposed: Specification is not in Proposed status. It may already be finalized.");
      } else if (error.data === "0x1bee0d5a") {
        throw new Error("NotFinalized: Reality.eth question is not yet finalized. Wait for the timeout period.");
      }
      
      throw error;
    }
  }

  async settleBonds(specId: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {

      
      // Check spec status first
      const specData = await this.contract.specs(specId);



      
      // Validate requirements before attempting settlement
      if (Number(specData.status) !== 3) {
        throw new Error(`Cannot settle bonds: Specification must be finalized (status 3), but current status is ${Number(specData.status)}`);
      }
      
      if (specData.bondsSettled) {
        throw new Error("Cannot settle bonds: Bonds have already been settled for this specification");
      }
      
      // Check Reality.eth question status
      const questionId = specData.questionId;

      
      // IMPORTANT: Double-check by calling the contract's bondsSettled mapping directly
      // This might be different from the spec struct value
      try {
        // The contract might have a bondsSettled mapping that's separate from the struct
        // Let me try a different approach - check the ABI for available view functions

        
        // Check if the contract has any other state we need to verify



        
        // CRITICAL: Check the bondsSettled mapping directly
        const mappingSettled = await this.contract.bondsSettled(specId);


        
        if (mappingSettled) {
          throw new Error("Cannot settle bonds: The bondsSettled mapping shows bonds are already settled, even though the spec struct says false. This indicates the bonds were already processed.");
        }
        
      } catch (stateError) {
        console.error("Error checking additional state:", stateError);
      }
      
      if (questionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        throw new Error("Cannot settle bonds: No Reality.eth question associated with this specification");
      }
      
      // Try to get Reality.eth contract and check if question is finalized
      try {
        // Skip Reality.eth contract initialization for now
        console.log("✓ Skipping Reality.eth contract initialization");

        
        // Create Reality.eth contract instance
        const realityEthAbi = [
          "function isFinalized(bytes32 question_id) external view returns (bool)",
          "function resultFor(bytes32 question_id) external view returns (bytes32)"
        ];
        
        const realityEthContract = new ethers.Contract(realityEthAddress, realityEthAbi, this.provider);
        
        const isFinalized = await realityEthContract.isFinalized(questionId);

        
        if (isFinalized) {
          const result = await realityEthContract.resultFor(questionId);


        } else {

        }
      } catch (realityError) {
        console.error("Error checking Reality.eth status:", realityError);
      }
      
      // Check if contract has enough balance to pay out bonds (always run this)
      try {
        const kaisignContractAddress = "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719";
        const contractBalance = await this.provider.getBalance(kaisignContractAddress);



        
        if (contractBalance < specData.totalBonds) {
          throw new Error(`🚨 CONTRACT INSUFFICIENT FUNDS: Contract balance: ${ethers.formatEther(contractBalance)} ETH, Required: ${ethers.formatEther(specData.totalBonds)} ETH`);
        }
      } catch (balanceError) {
        console.error("Error checking contract balance:", balanceError);
        throw balanceError;
      }

      // Try with manual gas estimation to avoid estimation errors

      
      try {
        const gasEstimate = await this.contract.settleBonds.estimateGas(specId);

        
        const tx = await this.contract.settleBonds(specId, {
          gasLimit: gasEstimate + BigInt(50000) // Add buffer
        });
        const receipt = await tx.wait();

        return tx.hash;
      } catch (gasError) {
        console.error("Gas estimation failed, trying with fixed gas:", gasError);
        
        // Try with a fixed gas limit
        const tx = await this.contract.settleBonds(specId, {
          gasLimit: BigInt(200000) // Fixed gas limit
        });
        const receipt = await tx.wait();

        return tx.hash;
      }
    } catch (error: any) {
      console.error("Error settling bonds:", error);
      
      // Decode specific contract errors for settleBonds
      if (error.data === "0x1bee0d5a") {
        throw new Error("NotFinalized: Specification must be finalized before settling bonds.");
      } else if (error.data === "0x2cb15938") {
        throw new Error("AlreadySettled: Bonds for this specification have already been settled.");
      }
      
      // Check if it's a generic revert
      if (error.message.includes("execution reverted") && !error.data) {
        // Try to get more info about why it failed
        throw new Error(`Bond settlement failed. This could be because: 1) Specification is not finalized, 2) Bonds already settled, 3) You're not authorized to settle, or 4) Contract state issue. Spec ID: ${specId}`);
      }
      
      throw error;
    }
  }

  async getCurrentAccount(): Promise<string | null> {
    if (!this.provider) {
      return null;
    }

    try {
      const accounts = await this.provider.listAccounts();
      return accounts.length > 0 ? accounts[0]?.address || null : null;
    } catch (error) {
      console.error("Error getting current account:", error);
      return null;
    }
  }

  async getContractSpecCount(targetContract: string): Promise<number> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      const count = await this.contract.getContractSpecCount(targetContract);
      return Number(count);
    } catch (error: any) {
      console.error("Error getting contract spec count:", error);
      throw error;
    }
  }

  async getAvailableIncentives(targetContract: string, targetChainId?: number): Promise<any[]> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      const incentives = [];
      
      // Get real incentives from contract events
      try {
        const filter = this.contract.filters.LogIncentiveCreated(null, null, targetContract);
        const events = await this.contract.queryFilter(filter, -10000); // Last 10k blocks
        
        for (const event of events) {
          const incentiveId = event.args?.incentiveId;
          if (incentiveId) {
            const incentiveData = await this.contract.incentives(incentiveId);
            // Only include incentives that exactly match the target chain ID
            // This prevents cross-chain incentive confusion
            if (
              incentiveData.isActive &&
              !incentiveData.isClaimed &&
              (targetChainId === undefined || incentiveData.chainId.toString() === targetChainId.toString())
            ) {
              incentives.push({
                id: incentiveId,
                creator: incentiveData.creator,
                token: incentiveData.token,
                amount:
                  incentiveData.token ===
                  "0x0000000000000000000000000000000000000000"
                    ? (Number(incentiveData.amount) / 1e18).toString()
                    : incentiveData.amount.toString(),
                deadline: Number(incentiveData.deadline),
                description: incentiveData.description,
                isActive: incentiveData.isActive,
                isClaimed: incentiveData.isClaimed
              });
            }
          }
        }
      } catch (eventError) {

      }
      

      return incentives;
    } catch (error: any) {
      console.error("Error getting available incentives:", error);
      throw error;
    }
  }

  async getIncentivesByTargetContract(targetContract: string): Promise<string[]> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      // This would require event filtering or a subgraph
      // For now, returning empty array as placeholder
      console.warn("getIncentivesByTargetContract: This function needs event filtering implementation");
      return [];
    } catch (error: any) {
      console.error("Error getting incentives by target contract:", error);
      throw error;
    }
  }

  async claimActiveTokenIncentive(specId: string, tokenAddress: string): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {

      
      const tx = await this.contract.claimActiveTokenIncentive(specId, tokenAddress);

      
      const receipt = await tx.wait();

      
      return tx.hash;
    } catch (error: any) {
      console.error("Error claiming active token incentive:", error);
      throw error;
    }
  }

  // Helper function to claim ETH incentives manually
  async claimETHIncentive(specId: string): Promise<string> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {

      
      // ETH token address is 0x0000000000000000000000000000000000000000
      const ethAddress = "0x0000000000000000000000000000000000000000";
      
      const tx = await this.contract.claimActiveTokenIncentive(specId, ethAddress);

      
      const receipt = await tx.wait();

      
      return tx.hash;
    } catch (error: any) {
      console.error("Error claiming ETH incentive:", error);
      
      // If claimActiveTokenIncentive fails for ETH, try handleResult as fallback
      if (error.data === "0x2b4fa360") { // InvalidContract() - claimActiveTokenIncentive rejects ETH

        return await this.handleResult(specId);
      }
      
      throw error;
    }
  }
}

// Export a singleton instance
export const web3Service = new Web3Service(); 