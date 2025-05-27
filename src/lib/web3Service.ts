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

// Type for contract methods to handle TS errors
type ContractWithMethods = ethers.Contract & {
  minBond: () => Promise<bigint>;
  createSpec: (ipfsHash: string) => Promise<any>;
  proposeSpec: (ipfsHash: string, options: { value: bigint }) => Promise<any>;
  handleResult: (ipfsHash: string) => Promise<any>;
  getQuestionId: (ipfsHash: string) => Promise<string>;
  getStatus: (ipfsHash: string) => Promise<number>;
  isAccepted: (ipfsHash: string) => Promise<boolean>;
  getIPFSByHash: (specID: string) => Promise<string>;
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

// ABI for the KaiSign contract (based on the contract functions we need)
const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "_minBond", "type": "uint256"}],
    "name": "setMinBond",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "createSpec",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "proposeSpec",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "ipfs", "type": "string"}],
    "name": "getQuestionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
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
    "name": "handleResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "id", "type": "bytes32"}],
    "name": "getIPFSByHash",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
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

// Fixed contract address on Sepolia - all lowercase for safety
const RAW_CONTRACT_ADDRESS = "0x2d2f90786a365a2044324f6861697e9EF341F858";
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

      // Check if we're on the correct network
      const isCorrectNetwork = await this.checkNetwork();
      if (!isCorrectNetwork) {
        throw new Error("Please switch to the Sepolia network to continue.");
      }

      // Initialize contract
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
      console.log("Contract address:", RAW_CONTRACT_ADDRESS);
      console.log("Reality.eth address:", realityEthAddress);

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

      // Get the question ID for this IPFS hash
      const questionId = await this.contract.getQuestionId(ipfsHash);
      
      if (questionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        // Question doesn't exist yet, return contract minimum bond
        const contractMinBond = await this.getMinBond();
        return {
          currentBond: BigInt(0),
          minBond: contractMinBond,
          requiredNextBond: contractMinBond,
          hasAnswers: false
        };
      }

      // Get bond information from Reality.eth
      const currentBond = await this.realityEthContract.getBond(questionId);
      const minBond = await this.realityEthContract.getMinBond(questionId);
      
      const hasAnswers = currentBond > BigInt(0);
      const requiredNextBond = hasAnswers ? currentBond * BigInt(2) : minBond;

      return {
        currentBond,
        minBond,
        requiredNextBond,
        hasAnswers
      };
    } catch (error) {
      console.error("Error getting bond info:", error);
      // Fallback to contract minimum bond
      const contractMinBond = await this.getMinBond();
      return {
        currentBond: BigInt(0),
        minBond: contractMinBond,
        requiredNextBond: contractMinBond,
        hasAnswers: false
      };
    }
  }
  
  /**
   * Submit an IPFS hash to the contract with a bond
   */
  async proposeSpec(ipfsHash: string, bondAmount: bigint): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // Make sure we're on the Sepolia network
      const isCorrectNetwork = await this.checkNetwork();
      if (!isCorrectNetwork) {
        throw new Error("Please switch to the Sepolia network to continue.");
      }
      
      console.log("Creating spec with IPFS hash:", ipfsHash);
      console.log("Bond amount:", bondAmount.toString());
      
      try {
        // Create the spec first - we know contract is not null here
        const createTx = await this.contract.createSpec(ipfsHash);
        console.log("Create transaction sent:", createTx.hash);
        await createTx.wait();
        console.log("Create transaction confirmed");
      } catch (createError) {
        console.error("Error in createSpec:", createError);
        console.log("Proceeding to proposeSpec anyway - spec might already exist");
      }
      
      // Then propose with a bond - we know contract is not null here
      const proposeTx = await this.contract.proposeSpec(ipfsHash, { 
        value: bondAmount,
      });
      
      console.log("Propose transaction sent:", proposeTx.hash);
      const receipt = await proposeTx.wait();
      console.log("Propose transaction confirmed:", receipt);
      
      return proposeTx.hash;
    } catch (error) {
      console.error("Error proposing spec:", error);
      throw error;
    }
  }
  
  /**
   * Get the questionId from the contract for a given IPFS hash
   */
  async getQuestionId(ipfsHash: string): Promise<string> {
    try {
      if (!this.contract || !this.signer) {
        throw new Error("Not connected to MetaMask. Please connect first.");
      }
      
      // We know contract is not null here
      const questionId = await this.contract.getQuestionId(ipfsHash);
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
      const isCorrectNetwork = await this.checkNetwork();
      if (!isCorrectNetwork) {
        throw new Error("Please switch to the Sepolia network to continue.");
      }
      
      console.log("Handling result for IPFS hash:", ipfsHash);
      
      // We know contract is not null here
      const tx = await this.contract.handleResult(ipfsHash);
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
      
      // We know contract is not null here
      const ipfsHash = await this.contract.getIPFSByHash(specID);
      console.log("IPFS hash for specID:", specID, "is", ipfsHash);
      return ipfsHash;
    } catch (error) {
      console.error("Error getting IPFS hash:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const web3Service = new Web3Service(); 