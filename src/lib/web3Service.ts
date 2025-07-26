import { ethers } from "ethers";

// Declare the window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: Array<any> }) => Promise<any>;
    };
  }
}

// Type for contract methods to handle TS errors (V1 contract)
type ContractWithMethods = ethers.Contract & {
  minBond: () => Promise<bigint>;
  commitSpec: (commitment: string, targetContract: string, incentiveId: string, options: { value: bigint }) => Promise<any>;
  revealSpec: (commitmentId: string, ipfs: string, nonce: bigint) => Promise<any>;
  proposeSpec: (specID: string, options: { value: bigint }) => Promise<any>;
  assertSpecValid: (specID: string, options: { value: bigint }) => Promise<any>;
  assertSpecInvalid: (specID: string, options: { value: bigint }) => Promise<any>;
  handleResult: (specID: string) => Promise<any>;
  getStatus: (ipfsHash: string) => Promise<number>;
  isAccepted: (ipfsHash: string) => Promise<boolean>;
  getCreatedTimestamp: (ipfsHash: string) => Promise<bigint>;
  createIncentive: (targetContract: string, token: string, amount: bigint, duration: bigint, description: string, options: { value: bigint }) => Promise<any>;
  getSpecsByContract: (targetContract: string) => Promise<string[]>;
  getContractSpecCount: (targetContract: string) => Promise<bigint>;
  specs: (specID: string) => Promise<any>;
  incentives: (incentiveId: string) => Promise<any>;
  commitments: (commitmentId: string) => Promise<any>;
  realityETH: () => Promise<string>;
};

// Type for Reality.eth contract methods
type RealityEthContract = ethers.Contract & {
  getBond: (questionId: string) => Promise<bigint>;
  getMinBond: (questionId: string) => Promise<bigint>;
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
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"}
    ],
    "name": "commitSpec",
    "outputs": [],
    "stateMutability": "payable",
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
      {"internalType": "address", "name": "token", "type": "address"},
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
      {"internalType": "string", "name": "description", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "targetContract", "type": "address"}],
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
      {"internalType": "uint48", "name": "totalBonds", "type": "uint48"},
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
    "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
    "name": "handleResult",
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
      {"internalType": "address", "name": "token", "type": "address"},
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
    "inputs": [{"internalType": "address", "name": "targetContract", "type": "address"}],
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
      {"internalType": "uint32", "name": "revealDeadline", "type": "uint32"},
      {"internalType": "address", "name": "targetContract", "type": "address"},
      {"internalType": "bool", "name": "isRevealed", "type": "bool"},
      {"internalType": "uint80", "name": "bondAmount", "type": "uint80"},
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

// Fixed contract address on Sepolia - V1 contract address
const RAW_CONTRACT_ADDRESS = "0x79D0e06350CfCE33A7a73A7549248fd6AeD774f2";
// Sepolia chain ID
const SEPOLIA_CHAIN_ID = 11155111;

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ContractWithMethods | null = null;
  private realityEthContract: RealityEthContract | null = null;
  
  /**
   * Connect to MetaMask and initialize the contract
   */
  async connect(): Promise<string> {
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

      // Initialize Reality.eth contract
      const realityEthAddress = await kaisignContract.realityETH();
      const realityContract = new ethers.Contract(
        realityEthAddress,
        REALITY_ETH_ABI,
        this.signer
      ) as RealityEthContract;

      // Assign to instance variables after successful initialization
      this.contract = kaisignContract;
      this.realityEthContract = realityContract;

      console.log("Connected to account:", accounts[0]);

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
      console.log("Contract minimum bond:", minBond.toString());
      return minBond;
    } catch (error) {
      console.error("Error getting minimum bond from contract:", error);
      // Fallback to a reasonable default if contract call fails
      const fallbackBond = BigInt("100000000000000"); // 0.0001 ETH
      console.log("Using fallback bond amount:", fallbackBond.toString());
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
        throw new Error("Reality.eth contract not initialized. Please connect first.");
      }

      // Get the current bond for this question
      const currentBond = await this.realityEthContract.getBond(questionId);
      
      if (currentBond === BigInt(0)) {
        // No previous answers, use minimum bond
        const minBond = await this.realityEthContract.getMinBond(questionId);
        console.log("No previous answers, using min bond:", minBond.toString());
        return minBond;
      } else {
        // Previous answers exist, need to double the current bond
        const requiredBond = currentBond * BigInt(2);
        console.log("Previous bond exists:", currentBond.toString(), "Required bond:", requiredBond.toString());
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
      if (!this.contract || !this.realityEthContract) {
        throw new Error("Contracts not initialized. Please connect first.");
      }

      // Generate specID from IPFS hash (simplified approach)
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
        const requiredNextBond = BigInt("20000000000000000"); // Use 0.02 ETH instead of calculated amount

        return {
          currentBond,
          minBond,
          requiredNextBond,
          hasAnswers
        };
      } catch (specError) {
        console.log("Spec doesn't exist yet, returning contract minimum bond with safety margin");
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
   * Submit spec using V1 contract's commit-reveal pattern
   * This properly implements the two-step process: commitSpec -> revealSpec
   */
  async submitSpec(ipfsHash: string, bondAmount: bigint, targetContract?: string, incentiveId?: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Make sure we're on the Sepolia network
      // Network check removed - let users connect on any network
      
      console.log("Proposing spec with IPFS hash:", ipfsHash);
      console.log("Bond amount:", bondAmount.toString());
      console.log("Target contract:", targetContract || "none specified");
      
      // Generate a proper nonce for the commitment
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      
      // Create the commitment hash to match Solidity: keccak256(abi.encodePacked(ipfs, nonce))
      // Use ethers.solidityPacked which should match Solidity's abi.encodePacked exactly
      const commitment = ethers.keccak256(ethers.solidityPacked(
        ["string", "uint256"],
        [ipfsHash, nonce]
      ));
      
      console.log("Commitment generation:");
      console.log("- IPFS Hash:", ipfsHash);
      console.log("- Nonce:", nonce.toString());
      console.log("- Commitment:", commitment);
      
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
        console.log("Using KaiSign contract as default target");
      } else {
        console.log("User specified target contract:", target);
        
        // Check if the target contract exists on Sepolia
        try {
          const targetCode = await this.provider!.getCode(target);
          console.log("Target contract code check for", target, ":", targetCode.length > 2 ? "EXISTS" : "NOT FOUND");
          if (targetCode === "0x") {
            console.warn("⚠️ Target contract", target, "does not exist on Sepolia");
            console.warn("V1 contract requires target to exist on same network");
            console.warn("Falling back to KaiSign contract as target");
            target = RAW_CONTRACT_ADDRESS;
          } else {
            console.log("✅ Target contract exists on Sepolia, using:", target);
            console.log("Contract code length:", targetCode.length);
          }
        } catch (codeCheckError) {
          console.warn("Could not verify target contract existence, using KaiSign contract as fallback");
          target = RAW_CONTRACT_ADDRESS;
        }
      }
      
      const finalIncentiveId = incentiveId || "0x0000000000000000000000000000000000000000000000000000000000000000";
      
      // Validate minimum bond requirement with safety margin
      const contractMinBond = await this.getMinBond();
      // Add 10% safety margin to account for platform fees and rounding
      const requiredBond = contractMinBond + (contractMinBond / BigInt(10));
      
      if (bondAmount < requiredBond) {
        console.log(`⚠️ Bond amount ${bondAmount.toString()} is less than required: ${requiredBond.toString()}`);
        console.log(`Contract minimum: ${contractMinBond.toString()}, with 10% safety margin: ${requiredBond.toString()}`);
        throw new Error(`Insufficient bond. Required: ${(Number(requiredBond) / 10**18).toFixed(5)} ETH (including safety margin for fees)`);
      }
      
      console.log("Validation passed:");
      console.log("- Target contract:", target);
      console.log("- Bond amount:", bondAmount.toString());
      console.log("- Minimum bond:", contractMinBond.toString());
      
      // CRITICAL: Run comprehensive diagnostics BEFORE attempting transaction
      await this.runPreTransactionDiagnostics(target, bondAmount);
      
      // Additional validation: Check if contract is properly deployed and accessible
      try {
        console.log("Testing contract accessibility...");
        const contractCode = await this.provider!.getCode(RAW_CONTRACT_ADDRESS);
        console.log("Contract code length:", contractCode.length);
        
        // Test a simple read function first
        const testMinBond = await this.contract.minBond();
        console.log("Contract minBond test successful:", testMinBond.toString());
        
        // Check if contract is paused (V1 has Pausable)
        try {
          // Try to call the paused() function if it exists
          const pausedCall = await this.provider!.call({
            to: RAW_CONTRACT_ADDRESS,
            data: "0x5c975abb" // paused() function selector
          });
          const isPaused = pausedCall === "0x0000000000000000000000000000000000000000000000000000000000000001";
          console.log("Contract paused status:", isPaused);
          
          if (isPaused) {
            throw new Error("Contract is currently paused");
          }
        } catch (pauseCheckError) {
          console.log("Could not check pause status (might not have paused function):", pauseCheckError);
        }
        
        // Special test: Check if the target contract validation is the issue
        console.log("=== TARGET CONTRACT VALIDATION TEST ===");
        console.log("Testing if target contract", target, "passes contract validation...");
        const targetContractCode = await this.provider!.getCode(target);
        console.log("Target contract code length:", targetContractCode.length);
        
        if (targetContractCode === "0x") {
          console.error("❌ FOUND THE ISSUE: Target contract has no code!");
          console.error("The contract's extcodesize check will fail for this target.");
          throw new Error(`Target contract ${target} does not exist or has no bytecode. The V1 contract requires the target contract to exist on Sepolia.`);
        } else {
          console.log("✅ Target contract validation should pass - contract has bytecode");
        }
        
        // Check if treasury address is valid and can receive funds
        console.log("=== TREASURY VALIDATION TEST ===");
        try {
          // Get treasury address from the contract
          const treasurySelector = "0x61d027b3"; // treasury() function selector
          const treasuryResult = await this.provider!.call({
            to: RAW_CONTRACT_ADDRESS,
            data: treasurySelector
          });
          const treasuryAddress = "0x" + treasuryResult.slice(-40);
          console.log("Treasury address:", treasuryAddress);
          
          // Check if treasury is a valid address (not zero address)
          if (treasuryAddress === "0x0000000000000000000000000000000000000000") {
            console.error("❌ ISSUE FOUND: Treasury address is zero address!");
            throw new Error("Treasury address is not set properly in the contract");
          }
          
          // Check if treasury can receive funds (not a contract that might reject)
          const treasuryCode = await this.provider!.getCode(treasuryAddress);
          console.log("Treasury code length:", treasuryCode.length);
          
          if (treasuryCode.length > 2) {
            console.log("⚠️ Treasury is a contract - checking if it can receive funds...");
            // Try a tiny test transfer to see if treasury can receive funds
            try {
              const testAmount = BigInt(1); // 1 wei
              await this.provider!.call({
                to: treasuryAddress,
                value: testAmount,
                from: await this.signer.getAddress()
              });
              console.log("✅ Treasury can receive funds");
            } catch (treasuryTestError) {
              console.error("❌ POSSIBLE ISSUE: Treasury might reject fund transfers:", treasuryTestError);
            }
          } else {
            console.log("✅ Treasury is an EOA - should be able to receive funds");
          }
        } catch (treasuryError) {
          console.error("Could not check treasury address:", treasuryError);
        }
        
      } catch (contractError) {
        console.error("Contract accessibility test failed:", contractError);
        throw contractError; // Re-throw the specific error instead of generic one
      }
      
      // Step 1: Commit
      console.log("Committing spec with commitment:", commitment);
      console.log("Target contract:", target);
      console.log("Incentive ID:", finalIncentiveId);
      console.log("Bond amount:", bondAmount.toString());
      
      // Check if commitment already exists
      try {
        console.log("Checking commitment existence...");
        const commitmentId = ethers.keccak256(ethers.solidityPacked(
          ["bytes32", "address", "address", "uint256"],
          [commitment, await this.signer.getAddress(), target, Math.floor(Date.now() / 1000)]
        ));
        
        const existingCommitment = await this.contract.commitments(commitmentId);
        console.log("Existing commitment check:", existingCommitment);
        
        // Try a raw call to see if the function exists
        console.log("Trying raw contract call...");
        const calldata = ethers.concat([
          "0x1349f73f", // commitSpec selector
          ethers.zeroPadValue(commitment, 32),
          ethers.zeroPadValue(target, 32),
          ethers.zeroPadValue(incentiveId, 32)
        ]);
        
        console.log("Calldata breakdown:");
        console.log("- Selector:", "0x1349f73f");
        console.log("- Commitment (32 bytes):", ethers.hexlify(ethers.zeroPadValue(commitment, 32)));
        console.log("- Target (32 bytes):", ethers.hexlify(ethers.zeroPadValue(target, 32)));
        console.log("- Incentive (32 bytes):", ethers.hexlify(ethers.zeroPadValue(incentiveId, 32)));
        
        console.log("Raw calldata:", ethers.hexlify(calldata));
        
        try {
          const rawResult = await this.provider!.call({
            to: RAW_CONTRACT_ADDRESS,
            data: calldata,
            value: bondAmount,
            from: await this.signer.getAddress()
          });
          console.log("Raw call successful:", rawResult);
        } catch (rawError) {
          console.error("Raw call failed:", rawError);
          if (rawError.data) {
            console.log("Raw call error data:", rawError.data);
          }
        }
        
        // Try a static call first to see if it would succeed
        console.log("Trying static call...");
        const staticResult = await this.contract.commitSpec.staticCall(
          commitment,
          target,
          incentiveId,
          { value: bondAmount }
        );
        console.log("Static call successful:", staticResult);
        
      } catch (checkError) {
        console.error("Pre-transaction checks failed:", checkError);
        
        // If it's a revert, try to get more info
        if (checkError.data) {
          console.log("Check error data:", checkError.data);
        }
        
        throw new Error(`Pre-transaction validation failed: ${checkError.message}`);
      }
      
      // Try manual gas estimation
      try {
        console.log("Estimating gas manually...");
        const gasEstimate = await this.contract.commitSpec.estimateGas(
          commitment, 
          target, 
          incentiveId,
          { value: bondAmount }
        );
        console.log("Gas estimate successful:", gasEstimate.toString());
      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        throw new Error(`Gas estimation failed: ${gasError.message}`);
      }
      
      const commitTx = await this.contract.commitSpec(commitment, target, finalIncentiveId, {
        value: bondAmount
      });
      
      console.log("Commit transaction sent:", commitTx.hash);
      const commitReceipt = await commitTx.wait();
      console.log("Commit transaction confirmed:", commitReceipt);
      
      // Get the commitment timestamp from the transaction
      const block = await this.provider!.getBlock(commitReceipt.blockNumber);
      const commitTimestamp = block!.timestamp;
      
      // Step 2: Generate the commitment ID as the contract does
      // commitmentId = keccak256(abi.encodePacked(commitment, msg.sender, targetContract, block.timestamp))
      const commitmentId = ethers.keccak256(ethers.solidityPacked(
        ["bytes32", "address", "address", "uint256"],
        [commitment, await this.signer.getAddress(), target, commitTimestamp]
      ));
      
      console.log("Generated commitment ID:", commitmentId);
      console.log("Revealing spec with IPFS:", ipfsHash, "and nonce:", nonce.toString());
      
      const revealTx = await this.contract.revealSpec(commitmentId, ipfsHash, nonce);
      console.log("Reveal transaction sent:", revealTx.hash);
      const revealReceipt = await revealTx.wait();
      console.log("Reveal transaction confirmed:", revealReceipt);
      
      return revealTx.hash;
    } catch (error: any) {
      console.error("Error proposing spec:", error);
      
      // Enhanced error handling for V1 contract specific issues
      if (error.message?.includes("missing revert data") && !error.data) {
        console.log("🔄 Missing revert data - contract likely reverted with require()");
        console.log("🔍 Most likely causes:");
        console.log("   1. ContractNotFound - target contract doesn't exist");
        console.log("   2. InvalidContract - target contract address is invalid");
        console.log("   3. InsufficientBond - bond amount too low");
        console.log("   4. Contract is paused");
        
        // Try a different approach - use a known good contract as target
        const knownGoodContracts = [
          "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
          "0x779877A7B0D9E8603169DdbD7836e478b4624789", // Another known contract
        ];
        
        for (const testTarget of knownGoodContracts) {
          try {
            console.log(`🧪 Testing with known good contract: ${testTarget}`);
            const testCode = await this.provider!.getCode(testTarget);
            if (testCode !== "0x") {
              console.log(`✅ Found working target contract: ${testTarget}`);
              return await this.directCommitReveal(ipfsHash, bondAmount, testTarget);
            }
          } catch (testError) {
            console.log(`❌ Test with ${testTarget} failed:`, testError.message);
          }
        }
        
        console.log("🔄 All alternatives failed, trying direct transaction approach as last resort...");
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
   * Get the questionId from the contract for a given IPFS hash
   * In V1, we need to find the specID first, then get the questionId from the spec
   */
  async getQuestionId(ipfsHash: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Generate specID - this should match how the contract generates it
      // For now, using the IPFS hash as specID (may need adjustment based on actual contract logic)
      const specId = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      
      // Get the spec data
      const spec = await this.contract.specs(specId);
      console.log("Spec data for IPFS hash:", ipfsHash, "is", spec);
      
      const questionId = spec.questionId;
      console.log("Question ID for IPFS hash:", ipfsHash, "is", questionId);
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
      console.log("Status for IPFS hash:", ipfsHash, "is", status);
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
      console.log("Acceptance status for IPFS hash:", ipfsHash, "is", isAccepted);
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
      
      console.log("Handling result for IPFS hash:", ipfsHash);
      
      // Generate specID from IPFS hash
      const specId = ethers.keccak256(ethers.toUtf8Bytes(ipfsHash));
      
      // We know contract is not null here
      const tx = await this.contract.handleResult(specId);
      console.log("Handle result transaction sent:", tx.hash);
      
      // Wait for transaction to be confirmed
      const receipt = await tx.wait();
      console.log("Handle result transaction confirmed:", receipt);
      
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
      console.log("IPFS hash for specID:", specID, "is", ipfsHash);
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
    token: string, // address(0) for ETH
    amount: bigint,
    duration: bigint,
    description: string
  ): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }

      console.log("Creating incentive for contract:", targetContract);
      console.log("Token:", token, "Amount:", amount.toString(), "Duration:", duration.toString());

      const tx = await this.contract.createIncentive(
        targetContract,
        token,
        amount,
        duration,
        description,
        { value: token === "0x0000000000000000000000000000000000000000" ? amount : BigInt(0) }
      );

      console.log("Create incentive transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Create incentive transaction confirmed:", receipt);

      return tx.hash;
    } catch (error) {
      console.error("Error creating incentive:", error);
      throw error;
    }
  }

  /**
   * Get specs by contract address (V1 feature)
   */
  async getSpecsByContract(contractAddress: string): Promise<string[]> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }

      const specIds = await this.contract.getSpecsByContract(contractAddress);
      console.log("Specs for contract:", contractAddress, "are", specIds);
      return specIds;
    } catch (error) {
      console.error("Error getting specs by contract:", error);
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
      console.log("Spec count for contract:", contractAddress, "is", count.toString());
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

      console.log("=== DIRECT COMMIT-REVEAL IMPLEMENTATION ===");
      
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      const commitment = ethers.keccak256(ethers.solidityPacked(["string", "uint256"], [ipfsHash, nonce]));
      const target = targetContract || RAW_CONTRACT_ADDRESS;
      const incentiveId = "0x0000000000000000000000000000000000000000000000000000000000000000";

      // Manually encode the function call
      const functionSelector = "0x1349f73f"; // commitSpec(bytes32,address,bytes32)
      const encodedParams = ethers.concat([
        ethers.zeroPadValue(commitment, 32),
        ethers.zeroPadValue(target, 32), 
        ethers.zeroPadValue(incentiveId, 32)
      ]);
      
      const txData = ethers.concat([functionSelector, encodedParams]);
      
      console.log("Direct transaction data:");
      console.log("- To:", RAW_CONTRACT_ADDRESS);
      console.log("- Data:", ethers.hexlify(txData));
      console.log("- Value:", bondAmount.toString());
      console.log("- From:", await this.signer.getAddress());
      
      // Send the transaction directly
      const tx = await this.signer.sendTransaction({
        to: RAW_CONTRACT_ADDRESS,
        data: txData,
        value: bondAmount,
        gasLimit: 500000 // Set a reasonable gas limit
      });
      
      console.log("✅ Direct transaction sent:", tx.hash);
      
      // Wait for confirmation  
      const receipt = await tx.wait();
      console.log("✅ Direct transaction confirmed:", receipt);
      
      if (receipt.status === 0) {
        console.error("❌ Transaction reverted with status 0");
        console.log("Receipt:", receipt);
        
        // Try to get the revert reason using eth_call with the same transaction data at the block before
        try {
          console.log("Attempting to get revert reason...");
          await this.provider.call({
            to: RAW_CONTRACT_ADDRESS,
            data: txData,
            value: bondAmount,
            from: await this.signer.getAddress(),
            blockTag: receipt.blockNumber - 1
          });
          console.log("⚠️ eth_call succeeded, which is unexpected for a reverted transaction");
        } catch (callError: any) {
          console.log("✅ Got revert reason from eth_call:", callError.message);
          if (callError.data) {
            console.log("Revert data:", callError.data);
            
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
            
            console.log("Calculated error signatures:", errorSignatures);
            
            const selector = callError.data.slice(0, 10);
            if (errorSignatures[selector]) {
              console.log("🔍 Decoded error:", errorSignatures[selector]);
              
              // Provide specific guidance
              if (selector === "0xed592624") {
                console.log("💡 ContractNotFound: The target contract doesn't exist on Sepolia");
              } else if (selector === "0x47df8ce0") {
                console.log("💡 InsufficientBond: Not enough ETH sent as bond");
              } else if (selector === "0x82b42900") {
                console.log("💡 Unauthorized: You don't have permission to call this function");
              }
              
              throw new Error(`Contract reverted with: ${errorSignatures[selector]}`);
            } else {
              console.log("❓ Unknown error selector:", selector);
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

      console.log("=== PRE-TRANSACTION DIAGNOSTICS ===");
      const userAddress = await this.signer.getAddress();
      
      // 1. Check user's ETH balance
      const balance = await this.provider.getBalance(userAddress);
      console.log("User ETH balance:", ethers.formatEther(balance), "ETH");
      console.log("Required bond:", ethers.formatEther(bondAmount), "ETH");
      
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
        console.log("Contract paused:", isPaused);
        
        if (isPaused) {
          throw new Error("Contract is currently paused");
        }
      } catch (pauseError) {
        console.log("Could not check pause status");
      }
      
      // 3. Validate target contract exists and has bytecode
      const targetCode = await this.provider.getCode(targetContract);
      console.log("Target contract bytecode length:", targetCode.length);
      console.log("Target contract exists:", targetCode !== "0x");
      
      if (targetCode === "0x") {
        throw new Error(`Target contract ${targetContract} does not exist on Sepolia testnet`);
      }
      
      // 4. Check treasury address configuration
      try {
        const treasuryAddress = await this.contract!.treasury();
        console.log("Treasury address:", treasuryAddress);
        
        if (treasuryAddress === "0x0000000000000000000000000000000000000000") {
          throw new Error("Treasury address is not configured (zero address)");
        }
        
        // Check if treasury can receive funds
        const treasuryCode = await this.provider.getCode(treasuryAddress);
        console.log("Treasury is contract:", treasuryCode.length > 2);
        
        if (treasuryCode.length > 2) {
          // Treasury is a contract, test if it can receive funds
          try {
            await this.provider.call({
              to: treasuryAddress,
              value: BigInt(1), // 1 wei test
              from: userAddress
            });
            console.log("Treasury can receive funds: YES");
          } catch (treasuryTestError) {
            console.log("Treasury can receive funds: UNKNOWN");
            console.warn("Treasury test failed:", treasuryTestError);
          }
        }
        
        // CRITICAL: Test the exact platform fee transfer that happens in commitSpec
        const platformFee = (bondAmount * BigInt(5)) / BigInt(100);
        if (platformFee > BigInt(0)) {
          console.log("Testing treasury transfer with sufficient gas...");
          console.log("Platform fee amount:", ethers.formatEther(platformFee), "ETH");
          console.log("Treasury is a proxy contract - testing with higher gas limit");
          
          try {
            await this.provider.call({
              to: treasuryAddress,
              value: platformFee,
              from: userAddress,
              gasLimit: 50000 // Match contract gas limit
            });
            console.log("✅ Treasury transfer test: SUCCESS");
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
      console.log("Contract minimum bond:", ethers.formatEther(contractMinBond), "ETH");
      console.log("Provided bond:", ethers.formatEther(bondAmount), "ETH");
      
      if (bondAmount < contractMinBond) {
        throw new Error(`Bond amount ${ethers.formatEther(bondAmount)} ETH is below minimum required ${ethers.formatEther(contractMinBond)} ETH`);
      }
      
      // 6. Calculate platform fee and verify sufficient funds
      // Contract deducts 5% platform fee in commitSpec(), so we need to ensure 
      // the net amount after fee meets minimum bond requirement
      const platformFee = (bondAmount * BigInt(5)) / BigInt(100); // 5% platform fee
      const netBondAmount = bondAmount - platformFee; // Amount actually used as bond
      console.log("Platform fee (5%):", ethers.formatEther(platformFee), "ETH");
      console.log("Net bond after fee:", ethers.formatEther(netBondAmount), "ETH");
      
      if (netBondAmount < contractMinBond) {
        // Calculate required total to meet minimum after fee deduction
        const requiredTotal = (contractMinBond * BigInt(100)) / BigInt(95); // Reverse calculation
        throw new Error(`After platform fee, net bond would be ${ethers.formatEther(netBondAmount)} ETH, but minimum required is ${ethers.formatEther(contractMinBond)} ETH. Send at least ${ethers.formatEther(requiredTotal)} ETH`);
      }
      
      // 7. Test Reality.eth contract connectivity
      try {
        const realityEthAddress = await this.contract.realityETH();
        console.log("Reality.eth address:", realityEthAddress);
        
        const realityCode = await this.provider.getCode(realityEthAddress);
        console.log("Reality.eth contract exists:", realityCode !== "0x");
        
        if (realityCode === "0x") {
          throw new Error("Reality.eth contract not found at configured address");
        }
      } catch (realityError) {
        console.error("Reality.eth check failed:", realityError);
        throw new Error("Could not verify Reality.eth integration");
      }
      
      // 8. Test contract function availability with static call
      try {
        console.log("Testing commitSpec with static call...");
        const testCommitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const testIncentive = "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        await this.contract.commitSpec.staticCall(
          testCommitment,
          targetContract,
          testIncentive,
          { value: bondAmount, from: userAddress }
        );
        console.log("✅ Static call succeeded - function should work");
        
      } catch (staticError) {
        console.error("❌ Static call failed:", staticError);
        
        if (staticError.data) {
          console.log("Static call error data:", staticError.data);
          
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
        console.log("Testing gas estimation...");
        const testCommitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const testIncentive = "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        const gasEstimate = await this.contract.commitSpec.estimateGas(
          testCommitment,
          targetContract,
          testIncentive,
          { value: bondAmount }
        );
        
        console.log("Gas estimate:", gasEstimate.toString());
        
        if (gasEstimate > BigInt(1000000)) {
          console.warn("⚠️ High gas estimate - transaction might be complex");
        }
        
      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        throw new Error("Could not estimate gas for transaction");
      }
      
      console.log("✅ All pre-transaction diagnostics passed");
      
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

      console.log("=== COMPREHENSIVE CONTRACT ANALYSIS ===");
      console.log("Contract address:", RAW_CONTRACT_ADDRESS);
      console.log("User address:", await this.signer.getAddress());

      // 1. Check if there's any bytecode
      const code = await this.provider.getCode(RAW_CONTRACT_ADDRESS);
      console.log("Bytecode length:", code.length);
      console.log("Has bytecode:", code !== "0x");

      if (code === "0x") {
        console.error("❌ No contract deployed at this address");
        return;
      }

      // 2. Test function selectors to identify which contract is deployed
      const selectors = {
        "minBond()": "0x1bb659ae",
        "commitSpec(bytes32,address,bytes32)": "0x1349f73f", // V1
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
          console.log(`✅ ${funcName}: exists (returned ${result.slice(0, 10)}...)`);
        } catch (error: any) {
          if (error.data && error.data !== "0x") {
            console.log(`✅ ${funcName}: exists but reverted (${error.data.slice(0, 10)}...)`);
          } else {
            console.log(`❌ ${funcName}: not found`);
          }
        }
      }

      // 3. Test commitSpec specifically with detailed analysis
      console.log("\n=== COMMITSPEC ANALYSIS ===");
      try {
        const testCommitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const testTarget = RAW_CONTRACT_ADDRESS;
        const testIncentive = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const minBond = BigInt("100000000000000"); // 0.0001 ETH

        // Encode the call
        const encodedCall = ethers.concat([
          "0x1349f73f", // commitSpec selector
          ethers.zeroPadValue(testCommitment, 32),
          ethers.zeroPadValue(testTarget, 32),
          ethers.zeroPadValue(testIncentive, 32)
        ]);

        console.log("Test call data:", ethers.hexlify(encodedCall));

        // Try static call
        const result = await this.provider.call({
          to: RAW_CONTRACT_ADDRESS,
          data: encodedCall,
          value: minBond,
          from: await this.signer.getAddress()
        });

        console.log("✅ commitSpec static call succeeded:", result);

      } catch (commitError: any) {
        console.log("❌ commitSpec failed:", commitError.message);
        if (commitError.data) {
          console.log("Error data:", commitError.data);

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
            
            console.log("Calculated error signatures:", knownErrors);

            if (knownErrors[errorSelector]) {
              console.log("🔍 Decoded error:", knownErrors[errorSelector]);
              
              // If it's ContractNotFound, that's our main suspect
              if (errorSelector === "0xed592624") {
                console.log("💡 This confirms the issue: The contract checks if the target contract exists using extcodesize");
                console.log("   The target address", testTarget, "is being validated and failing the existence check");
                
                // Let's check the target contract bytecode size
                const targetCode = await this.provider.getCode(testTarget);
                console.log("Target contract bytecode size:", targetCode.length);
                console.log("Target has bytecode:", targetCode !== "0x");
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

      console.log("=== IDENTIFYING DEPLOYED CONTRACT ===");

      // Test signature differences between V1 and original - calculate proper selectors
      const tests = [
        {
          name: "Original KaiSign",
          selector: ethers.id("createSpec(string)").slice(0, 10), // createSpec(string)
          description: "Has createSpec(string) function"
        },
        {
          name: "KaiSign V1", 
          selector: ethers.id("commitSpec(bytes32,address,bytes32)").slice(0, 10), // commitSpec(bytes32,address,bytes32)
          description: "Has commitSpec(bytes32,address,bytes32) function"
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
      
      console.log("Calculated function selectors:");
      tests.forEach(test => {
        console.log(`- ${test.name}: ${test.selector}`);
      });

      const results = [];
      for (const test of tests) {
        try {
          const result = await this.provider.call({
            to: RAW_CONTRACT_ADDRESS,
            data: test.selector
          });
          results.push(`✅ ${test.name}: YES (${test.description})`);
          console.log(`✅ ${test.name}: Function exists`);
        } catch (error: any) {
          if (error.data && error.data !== "0x") {
            results.push(`⚠️ ${test.name}: EXISTS BUT REVERTS (${test.description})`);
            console.log(`⚠️ ${test.name}: Function exists but reverted`);
          } else {
            results.push(`❌ ${test.name}: NO (${test.description})`);
            console.log(`❌ ${test.name}: Function not found`);
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
        console.log("🎯 CONCLUSION: This appears to be KaiSign V1 contract");
      } else if (hasCreateSpec && !hasCommitSpec && hasMinBond && hasRealityETH) {
        console.log("🎯 CONCLUSION: This appears to be the ORIGINAL KaiSign contract");
        console.log("⚠️ CRITICAL WARNING: You're trying to use V1 frontend with original contract!");
        console.log("💡 SOLUTION: Use createSpec(string) instead of commitSpec()!");
        
        // Store this information for later use
        (window as any).__KAISIGN_CONTRACT_TYPE = "original";
      } else if (!hasCreateSpec && !hasCommitSpec) {
        console.log("❌ CONCLUSION: This doesn't appear to be a KaiSign contract at all");
        console.log("📋 Available functions:", results.filter(r => r.includes("✅") || r.includes("⚠️")));
      } else {
        console.log("❓ CONCLUSION: Contract type is unclear");
        console.log("📋 Function availability:", results);
      }

      // Print summary
      console.log("Function availability summary:");
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

      console.log("Testing contract connectivity...");
      console.log("Contract address:", RAW_CONTRACT_ADDRESS);
      
      // Test 1: Check if contract exists
      const contractCode = await this.provider!.getCode(RAW_CONTRACT_ADDRESS);
      console.log("✓ Contract code exists:", contractCode !== "0x");
      console.log("  Code length:", contractCode.length);
      
      if (contractCode === "0x") {
        throw new Error("No contract deployed at this address");
      }
      
      // Test 2: Get minimum bond
      try {
        const minBond = await this.contract.minBond();
        console.log("✓ Min bond:", minBond.toString());
      } catch (error) {
        console.error("✗ minBond() failed:", error);
        throw new Error("Contract exists but minBond() function failed - wrong ABI?");
      }
      
      // Test 2b: Check if this looks like the V1 contract by checking constructor elements
      try {
        console.log("Checking if this is the V1 contract...");
        
        // Check for paused function (V1 specific)
        const pausedResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x5c975abb" // paused() selector
        });
        console.log("✓ Contract has paused() function");
        
        // Check for ADMIN_ROLE constant (V1 specific)
        const adminRoleResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x75b238fc" // ADMIN_ROLE() selector  
        });
        console.log("✓ Contract has ADMIN_ROLE constant");
        
        // Check for COMMIT_REVEAL_TIMEOUT constant
        const timeoutResult = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: "0x1234567890abcdef" // This would be the selector for the constant
        });
        
        console.log("This appears to be the V1 contract");
      } catch (v1CheckError) {
        console.warn("Could not verify V1 contract features:", v1CheckError);
      }
      
      // Test 3: Get Reality.eth address
      try {
        const realityEth = await this.contract.realityETH();
        console.log("✓ Reality.eth address:", realityEth);
      } catch (error) {
        console.error("✗ realityETH() failed:", error);
      }
      
      // Test 4: Check if you have necessary roles
      try {
        console.log("Checking access control roles...");
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
        console.log("Has DEFAULT_ADMIN_ROLE:", hasAdminRole !== "0x0000000000000000000000000000000000000000000000000000000000000000");
        
      } catch (roleError) {
        console.log("Could not check roles:", roleError);
      }

      // Test 5: Check if commitSpec function exists
      try {
        console.log("Checking if commitSpec function exists...");
        
        // Try to call the function selector directly
        const commitSpecSelector = "0x1349f73f";
        const testCalldata = commitSpecSelector + "0".repeat(192); // Minimal calldata
        
        const testCall = await this.provider!.call({
          to: RAW_CONTRACT_ADDRESS,
          data: testCalldata
        });
        console.log("✓ commitSpec function exists (call succeeded or returned data)");
      } catch (selectorError) {
        console.error("✗ commitSpec function test failed:", selectorError);
        if (selectorError.data) {
          console.log("Function selector error data:", selectorError.data);
          
          // Check if it's just a revert due to invalid parameters vs function not found
          if (selectorError.data === "0x" || selectorError.data === null) {
            console.error("⚠️  Function might not exist - no revert data returned");
          } else {
            console.log("Function exists but reverted with:", selectorError.data);
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
        const testIncentive = "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        console.log("Testing commitSpec function signature...");
        console.log("Test commitment:", testCommitment);
        
        const gasEstimate = await this.contract.commitSpec.estimateGas(
          testCommitment,
          testTarget, 
          testIncentive,
          { value: await this.contract.minBond() }
        );
        console.log("✓ commitSpec gas estimate:", gasEstimate.toString());
      } catch (error) {
        console.error("✗ commitSpec test failed:", error);
        console.error("This suggests the contract might be paused, have access control, or different function signature");
        
        // Try to decode the error
        if (error.data) {
          console.log("Error data:", error.data);
        }
      }
      
      console.log("Contract connectivity test completed!");
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
    token: string, // address(0) for ETH
    amount: string,
    durationSeconds: number,
    description: string
  ): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network
      
      console.log("🎯 Creating incentive on contract:", this.contract.target);
      console.log("💰 Parameters:", {
        targetContract,
        token,
        amount,
        durationSeconds,
        description
      });

      const value = token === "0x0000000000000000000000000000000000000000" ? amount : "0";
      console.log("💸 ETH value to send:", value);
      
      // Check if contract has the createIncentive function
      console.log("🔍 Checking if contract has createIncentive function...");
      if (typeof this.contract.createIncentive !== 'function') {
        throw new Error("Contract does not have createIncentive function");
      }
      
      console.log("📝 Calling createIncentive...");
      const tx = await this.contract.createIncentive(
        targetContract,
        token,
        amount,
        durationSeconds,
        description,
        { value }
      );
      
      console.log("✅ Transaction sent:", tx.hash);
      console.log("⏳ Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log("🎉 Incentive created successfully! Receipt:", receipt);
      
      // Log any events emitted
      if (receipt.logs && receipt.logs.length > 0) {
        console.log("📡 Events emitted:", receipt.logs.length);
        receipt.logs.forEach((log: any, index: number) => {
          console.log(`📋 Event ${index + 1}:`, log);
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
    if (!this.contract) {
      throw new Error("Not connected to contract.");
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
      throw error;
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
        description: incentive[9]           // string description
      };
      
      return result;
    } catch (error: any) {
      console.error("💥 Error getting incentive data:", error);
      console.error("🔍 Incentive ID:", incentiveId);
      throw error;
    }
  }

  async getSpecsByContract(targetContract: string): Promise<string[]> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      const specs = await this.contract.getSpecsByContract(targetContract);
      return specs;
    } catch (error: any) {
      console.error("Error getting specs by contract:", error);
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
      const spec = await this.contract.specs(specId);
      return {
        createdTimestamp: Number(spec.createdTimestamp),
        proposedTimestamp: Number(spec.proposedTimestamp),
        status: Number(spec.status),
        bondsSettled: spec.bondsSettled,
        totalBonds: spec.totalBonds.toString(),
        creator: spec.creator,
        targetContract: spec.targetContract,
        ipfs: spec.ipfs,
        questionId: spec.questionId,
        incentiveId: spec.incentiveId
      };
    } catch (error: any) {
      console.error("Error getting spec data:", error);
      throw error;
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
      console.log("Spec proposed:", receipt);
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
      console.log("Spec asserted valid:", receipt);
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
      console.log("Spec asserted invalid:", receipt);
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
      // Network check removed - let users connect on any network

      const tx = await this.contract.handleResult(specId);
      const receipt = await tx.wait();
      console.log("Result handled:", receipt);
      return tx.hash;
    } catch (error: any) {
      console.error("Error handling result:", error);
      throw error;
    }
  }

  async settleBonds(specId: string): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected to MetaMask. Please connect first.");
    }

    try {
      // Network check removed - let users connect on any network

      const tx = await this.contract.settleBonds(specId);
      const receipt = await tx.wait();
      console.log("Bonds settled:", receipt);
      return tx.hash;
    } catch (error: any) {
      console.error("Error settling bonds:", error);
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

  async getAvailableIncentives(targetContract: string): Promise<any[]> {
    if (!this.contract) {
      throw new Error("Not connected to contract.");
    }

    try {
      // In production, you would use event filtering or a subgraph to get incentives
      // For now, we'll use a hybrid approach: mock data + any real incentives created
      
      const incentives = [];
      
      // Add mock incentives for KaiSign contract for testing
      const kaisignContract = "0x79d0e06350cfce33a7a73a7549248fd6aed774f2".toLowerCase();
      if (targetContract.toLowerCase() === kaisignContract) {
        incentives.push({
          id: "0x1234567890123456789012345678901234567890123456789012345678901234",
          creator: "0xAbcDef1234567890123456789012345678901234Ab",
          token: "0x0000000000000000000000000000000000000000", // ETH
          amount: "0.05",
          deadline: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now
          description: "🚀 Mock ETH Reward for high-quality ERC7730 specification",
          isActive: true,
          isClaimed: false
        });
        
        incentives.push({
          id: "0x5678901234567890123456789012345678901234567890123456789012345678",
          creator: "0x1234567890123456789012345678901234567890",
          token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC Sepolia
          amount: "100",
          deadline: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), // 14 days from now
          description: "💰 Mock USDC reward for comprehensive contract specification",
          isActive: true,
          isClaimed: false
        });
      }
      
      // TODO: Add real event filtering here
      // const filter = this.contract.filters.LogIncentiveCreated(null, null, targetContract);
      // const events = await this.contract.queryFilter(filter);
      // Process events and add real incentives...
      
      console.log(`Found ${incentives.length} incentives for contract: ${targetContract}`);
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
}

// Export a singleton instance
export const web3Service = new Web3Service(); 