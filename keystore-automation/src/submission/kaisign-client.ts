import { ethers } from 'ethers';
import { ChainConfig } from '../config/chains.js';
import { botLogger, PerformanceTimer } from '../utils/logger.js';

export interface CommitResult {
  commitmentId: string;
  commitTxHash: string;
  revealDeadline: Date;
  nonce: string;
  metadataHash: string;
}

export interface RevealResult {
  specId: string;
  revealTxHash: string;
  bondAmount: string;
}

export interface ProposeResult {
  questionId: string;
  proposeTxHash: string;
  totalBond: string;
}

export interface SubmissionStatus {
  stage: 'committed' | 'revealed' | 'proposed' | 'finalized' | 'failed';
  commitmentId?: string;
  specId?: string;
  questionId?: string;
  txHashes: string[];
  lastUpdate: Date;
  error?: string;
}

export class KaiSignClient {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private chain: ChainConfig;

  private readonly CONTRACT_ABI = [
    // Commit function
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
    // Reveal function
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
    // Propose function
    {
      "inputs": [{"internalType": "bytes32", "name": "specID", "type": "bytes32"}],
      "name": "proposeSpec",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    // Query functions
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
      "inputs": [],
      "name": "minBond",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    // Events
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
    }
  ];

  constructor(provider: ethers.Provider, contractAddress: string, chain: ChainConfig) {
    this.provider = provider;
    this.chain = chain;
    this.contract = new ethers.Contract(contractAddress, this.CONTRACT_ABI, provider);
  }

  /**
   * Execute the commit step of the commit-reveal process
   */
  async commitSpec(
    wallet: ethers.Wallet,
    metadataHash: string,
    targetContract: string,
    targetChainId: number
  ): Promise<CommitResult> {
    const timer = new PerformanceTimer('KaiSign commit');

    try {
      // Generate nonce for commit-reveal
      const nonce = Math.floor(Math.random() * 1000000000);
      const nonceHex = ethers.zeroPadValue(ethers.toBeHex(nonce), 32);

      // Create commitment hash
      const commitment = ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'uint256'], [metadataHash, nonce])
      );

      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;

      // Estimate gas
      const gasEstimate = await contractWithSigner.commitSpec.estimateGas(
        commitment,
        targetContract,
        targetChainId
      );

      // Execute transaction
      const tx = await contractWithSigner.commitSpec(
        commitment,
        targetContract,
        targetChainId,
        {
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
          gasPrice: await this.getOptimalGasPrice()
        }
      );

      botLogger.transaction(`Commit transaction sent: ${tx.hash}`, {
        targetContract,
        targetChainId,
        wallet: wallet.address
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      // Calculate commitment ID
      const commitmentId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'address', 'address', 'uint256', 'uint64'],
          [
            commitment,
            wallet.address,
            targetContract,
            targetChainId,
            Math.floor(Date.now() / 1000) // Approximate timestamp
          ]
        )
      );

      const result: CommitResult = {
        commitmentId,
        commitTxHash: tx.hash,
        revealDeadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        nonce: nonce.toString(),
        metadataHash
      };

      timer.end({
        success: true,
        gasUsed: receipt.gasUsed.toString(),
        commitmentId
      });

      return result;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Commit failed', error, {
        targetContract,
        targetChainId,
        wallet: wallet.address
      });
      throw error;
    }
  }

  /**
   * Execute the reveal step of the commit-reveal process
   */
  async revealSpec(
    wallet: ethers.Wallet,
    commitmentId: string,
    blobHash: string,
    metadataHash: string,
    nonce: string,
    bondAmountEth: string
  ): Promise<RevealResult> {
    const timer = new PerformanceTimer('KaiSign reveal');

    try {
      const bondAmount = ethers.parseEther(bondAmountEth);
      const nonceNum = parseInt(nonce);

      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;

      // Verify commitment exists and is valid
      await this.verifyCommitment(commitmentId, wallet.address);

      // Estimate gas
      const gasEstimate = await contractWithSigner.revealSpec.estimateGas(
        commitmentId,
        blobHash,
        metadataHash,
        nonceNum,
        { value: bondAmount }
      );

      // Execute transaction
      const tx = await contractWithSigner.revealSpec(
        commitmentId,
        blobHash,
        metadataHash,
        nonceNum,
        {
          value: bondAmount,
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
          gasPrice: await this.getOptimalGasPrice()
        }
      );

      botLogger.transaction(`Reveal transaction sent: ${tx.hash}`, {
        commitmentId,
        blobHash: blobHash.substring(0, 10) + '...',
        bondAmountEth,
        wallet: wallet.address
      });

      // Wait for confirmation and get spec ID from logs
      const receipt = await tx.wait();
      const specId = await this.extractSpecIdFromReceipt(receipt);

      const result: RevealResult = {
        specId,
        revealTxHash: tx.hash,
        bondAmount: bondAmountEth
      };

      timer.end({
        success: true,
        gasUsed: receipt.gasUsed.toString(),
        specId
      });

      return result;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Reveal failed', error, {
        commitmentId,
        bondAmountEth,
        wallet: wallet.address
      });
      throw error;
    }
  }

  /**
   * Propose a spec for verification (if not auto-proposed during reveal)
   */
  async proposeSpec(
    wallet: ethers.Wallet,
    specId: string,
    additionalBondEth?: string
  ): Promise<ProposeResult> {
    const timer = new PerformanceTimer('KaiSign propose');

    try {
      const bondAmount = additionalBondEth ? ethers.parseEther(additionalBondEth) : 0;

      // Connect wallet to contract
      const contractWithSigner = this.contract.connect(wallet) as ethers.Contract;

      // Verify spec exists and is in submitted state
      await this.verifySpecStatus(specId);

      // Estimate gas
      const gasEstimate = await contractWithSigner.proposeSpec.estimateGas(
        specId,
        { value: bondAmount }
      );

      // Execute transaction
      const tx = await contractWithSigner.proposeSpec(
        specId,
        {
          value: bondAmount,
          gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
          gasPrice: await this.getOptimalGasPrice()
        }
      );

      botLogger.transaction(`Propose transaction sent: ${tx.hash}`, {
        specId,
        additionalBondEth: additionalBondEth || '0',
        wallet: wallet.address
      });

      // Wait for confirmation and extract question ID
      const receipt = await tx.wait();
      const questionId = await this.extractQuestionIdFromReceipt(receipt);

      const result: ProposeResult = {
        questionId,
        proposeTxHash: tx.hash,
        totalBond: (await this.getSpecTotalBond(specId)).toString()
      };

      timer.end({
        success: true,
        gasUsed: receipt.gasUsed.toString(),
        questionId
      });

      return result;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Propose failed', error, {
        specId,
        wallet: wallet.address
      });
      throw error;
    }
  }

  /**
   * Get the minimum required bond amount
   */
  async getMinBond(): Promise<bigint> {
    try {
      return await this.contract.minBond();
    } catch (error) {
      botLogger.error('Failed to get min bond', error);
      throw error;
    }
  }

  /**
   * Check commitment status
   */
  async getCommitment(commitmentId: string): Promise<any> {
    try {
      return await this.contract.commitments(commitmentId);
    } catch (error) {
      botLogger.error(`Failed to get commitment ${commitmentId}`, error);
      throw error;
    }
  }

  /**
   * Get spec information
   */
  async getSpec(specId: string): Promise<any> {
    try {
      return await this.contract.specs(specId);
    } catch (error) {
      botLogger.error(`Failed to get spec ${specId}`, error);
      throw error;
    }
  }

  /**
   * Get submission status for tracking
   */
  async getSubmissionStatus(
    commitmentId?: string,
    specId?: string
  ): Promise<SubmissionStatus> {
    try {
      if (specId) {
        const spec = await this.getSpec(specId);
        return this.parseSpecStatus(spec, specId);
      }

      if (commitmentId) {
        const commitment = await this.getCommitment(commitmentId);
        return this.parseCommitmentStatus(commitment, commitmentId);
      }

      throw new Error('Must provide either commitmentId or specId');

    } catch (error) {
      return {
        stage: 'failed',
        lastUpdate: new Date(),
        txHashes: [],
        error: error.message
      };
    }
  }

  private async verifyCommitment(commitmentId: string, expectedCommitter: string): Promise<void> {
    const commitment = await this.getCommitment(commitmentId);
    
    if (commitment.committer === ethers.ZeroAddress) {
      throw new Error('Commitment not found');
    }

    if (commitment.committer.toLowerCase() !== expectedCommitter.toLowerCase()) {
      throw new Error('Commitment belongs to different address');
    }

    if (commitment.isRevealed) {
      throw new Error('Commitment already revealed');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > Number(commitment.revealDeadline)) {
      throw new Error('Reveal deadline has passed');
    }
  }

  private async verifySpecStatus(specId: string): Promise<void> {
    const spec = await this.getSpec(specId);
    
    if (spec.createdTimestamp === 0n) {
      throw new Error('Spec not found');
    }

    // Status: 0=Committed, 1=Submitted, 2=Proposed, 3=Finalized, 4=Cancelled
    if (spec.status !== 1) {
      throw new Error(`Spec is not in submitted state (status: ${spec.status})`);
    }
  }

  private async extractSpecIdFromReceipt(receipt: ethers.ContractTransactionReceipt): Promise<string> {
    // Look for LogRevealSpec event
    for (const log of receipt.logs) {
      try {
        const parsedLog = this.contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });

        if (parsedLog?.name === 'LogRevealSpec') {
          return parsedLog.args.specID;
        }
      } catch (error) {
        // Skip logs that don't parse
        continue;
      }
    }

    throw new Error('Could not extract spec ID from transaction receipt');
  }

  private async extractQuestionIdFromReceipt(receipt: ethers.ContractTransactionReceipt): Promise<string> {
    // Look for LogProposeSpec event
    for (const log of receipt.logs) {
      try {
        const parsedLog = this.contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });

        if (parsedLog?.name === 'LogProposeSpec') {
          return parsedLog.args.questionId;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('Could not extract question ID from transaction receipt');
  }

  private async getSpecTotalBond(specId: string): Promise<bigint> {
    const spec = await this.getSpec(specId);
    return spec.totalBonds;
  }

  private parseSpecStatus(spec: any, specId: string): SubmissionStatus {
    const status = Number(spec.status);
    
    let stage: SubmissionStatus['stage'];
    switch (status) {
      case 0: stage = 'committed'; break;
      case 1: stage = 'revealed'; break;
      case 2: stage = 'proposed'; break;
      case 3: stage = 'finalized'; break;
      default: stage = 'failed';
    }

    return {
      stage,
      specId,
      lastUpdate: new Date(),
      txHashes: [] // Would need to track these separately
    };
  }

  private parseCommitmentStatus(commitment: any, commitmentId: string): SubmissionStatus {
    if (commitment.isRevealed) {
      return {
        stage: 'revealed',
        commitmentId,
        lastUpdate: new Date(),
        txHashes: []
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > Number(commitment.revealDeadline)) {
      return {
        stage: 'failed',
        commitmentId,
        lastUpdate: new Date(),
        txHashes: [],
        error: 'Reveal deadline passed'
      };
    }

    return {
      stage: 'committed',
      commitmentId,
      lastUpdate: new Date(),
      txHashes: []
    };
  }

  private async getOptimalGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      
      // Use EIP-1559 if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        return feeData.maxFeePerGas;
      }

      // Fallback to legacy gas price with small premium
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      return gasPrice * BigInt(110) / BigInt(100); // 10% premium
      
    } catch (error) {
      botLogger.error('Failed to get optimal gas price', error);
      return ethers.parseUnits('20', 'gwei'); // Conservative fallback
    }
  }
}