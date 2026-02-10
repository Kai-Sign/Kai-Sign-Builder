// TypeScript interfaces for autonomous metadata submission

export interface MetadataDeployment {
  address: string;
  chainId: number;
}

export interface MetadataContext {
  contract: {
    abi: any[];
    deployments: Record<string, MetadataDeployment>;
  };
}

export interface MetadataFile {
  $schema?: string;
  context: MetadataContext;
  metadata: {
    owner: string;
    info: {
      url: string;
      legalName: string;
      lastUpdate: string;
    };
    token?: {
      standard: string;
    };
  };
  display: {
    formats: Record<string, any>;
  };
}

export interface ManifestFile {
  $schema: string;
  type: string;
  version: string;
  tokens: string[];
  contracts: string[];
  standards: string[];
  eip712: string[];
  registries: Record<string, string>;
}

export interface SubmissionState {
  metadataFile: string;
  metadataPath: string;
  targetContract: string;
  chainId: number;
  metadataHash: string;
  nonce: string;
  commitment: string;
  commitmentId: string;
  commitTxHash: string;
  blobHash: string;
  blobTxHash: string;
  specId: string;
  questionId: string;
  revealTxHash: string;
  voteTxHash: string;
  status: SubmissionStatus;
  error?: string;
  timestamp: number;
}

export type SubmissionStatus =
  | 'pending'
  | 'committing'
  | 'committed'
  | 'uploading_blob'
  | 'blob_uploaded'
  | 'revealing'
  | 'revealed'
  | 'proposed'
  | 'voting'
  | 'voted'
  | 'completed'
  | 'error';

export interface ProcessingResult {
  success: boolean;
  state: SubmissionState;
  error?: string;
}

export interface BlobUploadResult {
  success: boolean;
  txHash: string;
  blobVersionedHash: string;
  metadataHash: string;
  blockNumber?: number;
  wasPadded?: boolean;
  error?: string;
}

export interface CommitResult {
  success: boolean;
  commitmentId: string;
  txHash: string;
  error?: string;
}

export interface RevealResult {
  success: boolean;
  specId: string;
  questionId: string;
  txHash: string;
  error?: string;
}

export interface VoteResult {
  success: boolean;
  txHash: string;
  bondAmount: string;
  error?: string;
}

// Contract ABIs
export const KAISIGN_ABI = [
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
      {"internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"internalType": "bytes32", "name": "incentiveId", "type": "bytes32"},
      {"internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "commitmentId", "type": "bytes32"}],
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
      {"indexed": true, "internalType": "address", "name": "creator", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "specID", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "blobHash", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "commitmentId", "type": "bytes32"},
      {"indexed": false, "internalType": "address", "name": "targetContract", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "chainId", "type": "uint256"}
    ],
    "name": "LogRevealSpec",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "specID", "type": "bytes32"},
      {"indexed": false, "internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "bond", "type": "uint256"}
    ],
    "name": "LogProposeSpec",
    "type": "event"
  }
];

export const REALITY_ETH_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "question_id", "type": "bytes32"},
      {"internalType": "bytes32", "name": "answer", "type": "bytes32"},
      {"internalType": "uint256", "name": "max_previous", "type": "uint256"}
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getBond",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "isFinalized",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "resultFor",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getBestAnswer",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
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

// Contract addresses
export const CONTRACTS = {
  KAISIGN: '0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719',
  REALITY_ETH: '0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA',
  ARBITRATOR: '0x05B942fAEcfB3924970E3A28e0F230910CEDFF45'
};

// Configuration
export const CONFIG = {
  MIN_BOND: BigInt('100000000000000'), // 0.0001 ETH
  SEPOLIA_CHAIN_ID: 11155111,
  COMMIT_REVEAL_TIMEOUT: 3600, // 1 hour in seconds
  DEFAULT_TIMEOUT: 172800, // 48 hours in seconds
  BLOB_MAX_SIZE: 131072, // 128KB
  MIN_BLOB_DATA_SIZE: 24 * 1024, // 24KB minimum for cost efficiency
  PADDING_MARKER: '\n\n/* ERC7730_BLOB_PADDING_START */\n'
};
