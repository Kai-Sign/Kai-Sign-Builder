import { ethers } from 'ethers';
import axios from 'axios';
import { AccountPool, PooledAccount } from '../keystore/account-pool.js';
import { RealityEthClient, Question } from './reality-eth-client.js';
import { KaiSignClient } from '../submission/kaisign-client.js';
import { ChainConfig, getChainConfig } from '../config/chains.js';
import { botLogger, PerformanceTimer } from '../utils/logger.js';

export interface VerificationTask {
  id: string;
  questionId: string;
  specId: string;
  contractAddress: string;
  chainId: number;
  blobHash: string;
  
  status: 'pending' | 'analyzing' | 'voting' | 'monitoring' | 'completed' | 'failed';
  analysis?: SpecAnalysis;
  vote?: boolean; // true = valid, false = invalid
  accounts?: PooledAccount[];
  
  // Timing
  discoveredAt: Date;
  timeoutAt?: Date;
  finalizedAt?: Date;
  
  // Economic tracking
  totalBondUsed: string;
  estimatedReward: string;
  
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface SpecAnalysis {
  isValidSpec: boolean;
  confidence: number; // 0-1
  issues: string[];
  recommendations: string[];
  analysisTime: Date;
}

export interface ConsensusDecision {
  vote: boolean;
  confidence: number;
  bondAmount: string;
  participatingBots: number;
  reasoning: string;
}

export class VerificationBot {
  private accountPool: AccountPool;
  private activeTasks: Map<string, VerificationTask> = new Map();
  private realityClients: Map<number, RealityEthClient> = new Map();
  private kaisignClients: Map<number, KaiSignClient> = new Map();
  
  private readonly MAX_CONCURRENT_VERIFICATIONS = parseInt(process.env.MAX_CONCURRENT_VERIFICATIONS || '10');
  private readonly VERIFICATION_DELAY_MS = parseInt(process.env.VERIFICATION_DELAY_MS || '60000');
  private readonly MIN_CONFIDENCE_THRESHOLD = parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD || '0.8');

  constructor(accountPool: AccountPool) {
    this.accountPool = accountPool;
  }

  async initialize(chains: ChainConfig[]): Promise<void> {
    for (const chain of chains) {
      if (chain.enabled && chain.rpc) {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        
        // Initialize Reality.eth client
        if (chain.realityEthAddress) {
          const realityClient = new RealityEthClient(provider, chain.realityEthAddress, chain);
          this.realityClients.set(chain.id, realityClient);
        }
        
        // Initialize KaiSign client
        if (chain.kaisignAddress) {
          const kaisignClient = new KaiSignClient(provider, chain.kaisignAddress, chain);
          this.kaisignClients.set(chain.id, kaisignClient);
        }

        botLogger.verification(`Initialized verification bot for ${chain.name}`, { chainId: chain.id });
      }
    }

    botLogger.verification('Verification bot fully initialized');
  }

  /**
   * Monitor and verify new proposals
   */
  async monitorProposals(chainId: number): Promise<void> {
    const timer = new PerformanceTimer(`Proposal monitoring ${chainId}`);

    try {
      const kaisignClient = this.kaisignClients.get(chainId);
      if (!kaisignClient) {
        throw new Error(`No KaiSign client for chain ${chainId}`);
      }

      // TODO: Query KaiSign for recently proposed specs
      // For now, we'll simulate finding new proposals
      
      timer.end({ chainId, success: true });

    } catch (error) {
      timer.end({ chainId, success: false, error: error.message });
      botLogger.error(`Failed to monitor proposals on chain ${chainId}`, error);
    }
  }

  /**
   * Verify a specific proposal
   */
  async verifyProposal(
    specId: string,
    questionId: string,
    contractAddress: string,
    chainId: number,
    blobHash?: string
  ): Promise<VerificationTask> {
    const timer = new PerformanceTimer('Proposal verification');

    try {
      const task = this.createVerificationTask(
        specId,
        questionId,
        contractAddress,
        chainId,
        blobHash
      );

      this.activeTasks.set(task.id, task);

      botLogger.verification(`Starting verification of proposal`, {
        taskId: task.id,
        specId: specId.substring(0, 10) + '...',
        questionId: questionId.substring(0, 10) + '...',
        contractAddress
      });

      // Execute verification pipeline
      await this.executeVerification(task);

      timer.end({ taskId: task.id, success: true });
      return task;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Verification failed', error);
      throw error;
    }
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(): {
    total: number;
    pending: number;
    analyzing: number;
    voting: number;
    monitoring: number;
    completed: number;
    failed: number;
    totalBondUsed: string;
    averageConfidence: number;
  } {
    const tasks = Array.from(this.activeTasks.values());
    
    let totalBondUsed = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      analyzing: tasks.filter(t => t.status === 'analyzing').length,
      voting: tasks.filter(t => t.status === 'voting').length,
      monitoring: tasks.filter(t => t.status === 'monitoring').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      totalBondUsed: '0',
      averageConfidence: 0
    };

    for (const task of tasks) {
      totalBondUsed += parseFloat(task.totalBondUsed || '0');
      
      if (task.analysis?.confidence !== undefined) {
        totalConfidence += task.analysis.confidence;
        confidenceCount++;
      }
    }

    stats.totalBondUsed = totalBondUsed.toFixed(6);
    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return stats;
  }

  /**
   * Get active verification tasks
   */
  getActiveTasks(): VerificationTask[] {
    return Array.from(this.activeTasks.values());
  }

  private createVerificationTask(
    specId: string,
    questionId: string,
    contractAddress: string,
    chainId: number,
    blobHash?: string
  ): VerificationTask {
    const taskId = `verify-${chainId}-${specId.substring(0, 8)}-${Date.now()}`;

    return {
      id: taskId,
      questionId,
      specId,
      contractAddress,
      chainId,
      blobHash: blobHash || '',
      status: 'pending',
      discoveredAt: new Date(),
      totalBondUsed: '0',
      estimatedReward: '0',
      retryCount: 0,
      maxRetries: 2
    };
  }

  private async executeVerification(task: VerificationTask): Promise<void> {
    try {
      // Step 1: Analyze the specification
      await this.analyzeSpecification(task);

      // Step 2: Make consensus decision
      const decision = await this.makeConsensusDecision(task);

      // Step 3: Submit verification votes
      await this.submitVerificationVotes(task, decision);

      // Step 4: Monitor until finalization
      await this.monitorUntilFinalization(task);

      task.status = 'completed';
      botLogger.verification(`Verification completed`, {
        taskId: task.id,
        vote: task.vote,
        bondUsed: task.totalBondUsed
      });

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      
      botLogger.error(`Verification task ${task.id} failed`, error);

      // Auto-retry if under retry limit
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'pending';
        task.error = undefined;

        setTimeout(() => {
          this.executeVerification(task).catch(retryError => {
            botLogger.error(`Verification retry failed for task ${task.id}`, retryError);
          });
        }, 300000); // Wait 5 minutes before retry
      }
    } finally {
      // Release accounts
      if (task.accounts) {
        for (const account of task.accounts) {
          await this.accountPool.releaseAccount(account.account.id);
        }
      }
    }
  }

  private async analyzeSpecification(task: VerificationTask): Promise<void> {
    task.status = 'analyzing';

    botLogger.verification(`Analyzing specification`, {
      taskId: task.id,
      contractAddress: task.contractAddress
    });

    // Get the ERC7730 JSON from blob
    const erc7730Json = await this.fetchSpecFromBlob(task.blobHash);
    
    // Analyze the specification
    const analysis = await this.performSpecAnalysis(erc7730Json, task.contractAddress, task.chainId);
    
    task.analysis = analysis;

    botLogger.verification(`Specification analysis complete`, {
      taskId: task.id,
      isValid: analysis.isValidSpec,
      confidence: analysis.confidence,
      issueCount: analysis.issues.length
    });
  }

  private async fetchSpecFromBlob(blobHash: string): Promise<any> {
    if (!blobHash) {
      throw new Error('No blob hash provided');
    }

    try {
      // Use blobscan API to fetch blob data
      const response = await axios.get(`https://api.blobscan.com/blobs/${blobHash}`, {
        timeout: 30000
      });

      if (!response.data?.data) {
        throw new Error('No blob data found');
      }

      // Decode the blob data (this is simplified)
      const decodedData = Buffer.from(response.data.data, 'hex').toString('utf8');
      return JSON.parse(decodedData);

    } catch (error) {
      botLogger.error(`Failed to fetch spec from blob ${blobHash}`, error);
      throw new Error(`Blob fetch failed: ${error.message}`);
    }
  }

  private async performSpecAnalysis(
    erc7730Json: any,
    contractAddress: string,
    chainId: number
  ): Promise<SpecAnalysis> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let confidence = 0.5; // Start neutral

    try {
      // Validate JSON structure
      if (!erc7730Json.context || !erc7730Json.display || !erc7730Json.metadata) {
        issues.push('Invalid ERC7730 structure - missing required sections');
        confidence = 0.1;
      } else {
        confidence += 0.2;
      }

      // Check context matches
      if (erc7730Json.context?.contract?.deploymentAddress !== contractAddress.toLowerCase()) {
        issues.push('Contract address mismatch in context');
        confidence -= 0.3;
      } else {
        confidence += 0.2;
      }

      if (erc7730Json.context?.contract?.deployedOn !== chainId) {
        issues.push('Chain ID mismatch in context');
        confidence -= 0.2;
      } else {
        confidence += 0.1;
      }

      // Validate display formats
      const formats = erc7730Json.display?.formats || {};
      if (Object.keys(formats).length === 0) {
        issues.push('No display formats defined');
        confidence -= 0.2;
      } else {
        confidence += 0.1;
        
        // Check format quality
        let validFormats = 0;
        for (const [key, format] of Object.entries(formats)) {
          if (this.validateFormat(format as any)) {
            validFormats++;
          }
        }
        
        const formatQuality = validFormats / Object.keys(formats).length;
        confidence += formatQuality * 0.2;
        
        if (formatQuality < 0.5) {
          issues.push('Many formats have validation issues');
        }
      }

      // Check for completeness
      if (Object.keys(formats).length < 3) {
        recommendations.push('Consider adding more function formats for completeness');
      }

      // Ensure confidence is within bounds
      confidence = Math.max(0, Math.min(1, confidence));

      return {
        isValidSpec: issues.length === 0 && confidence >= this.MIN_CONFIDENCE_THRESHOLD,
        confidence,
        issues,
        recommendations,
        analysisTime: new Date()
      };

    } catch (error) {
      botLogger.error('Spec analysis failed', error);
      return {
        isValidSpec: false,
        confidence: 0,
        issues: [`Analysis failed: ${error.message}`],
        recommendations: [],
        analysisTime: new Date()
      };
    }
  }

  private validateFormat(format: any): boolean {
    if (!format.intent || typeof format.intent !== 'string') return false;
    if (!format.fields || !Array.isArray(format.fields)) return false;
    
    for (const field of format.fields) {
      if (!field.path || !field.label || !field.format) return false;
    }
    
    return true;
  }

  private async makeConsensusDecision(task: VerificationTask): Promise<ConsensusDecision> {
    if (!task.analysis) {
      throw new Error('No analysis available for consensus decision');
    }

    const analysis = task.analysis;
    
    // Determine vote based on analysis
    const vote = analysis.isValidSpec && analysis.confidence >= this.MIN_CONFIDENCE_THRESHOLD;
    
    // Calculate bond amount based on confidence
    const baseBond = 0.01; // Base bond in ETH
    const confidenceMultiplier = analysis.confidence;
    const bondAmount = (baseBond * confidenceMultiplier).toFixed(4);
    
    // Determine number of bots to participate
    const participatingBots = analysis.confidence > 0.9 ? 3 : analysis.confidence > 0.7 ? 2 : 1;
    
    const reasoning = vote 
      ? `Valid spec with ${analysis.confidence.toFixed(2)} confidence`
      : `Invalid spec: ${analysis.issues.join(', ')}`;

    return {
      vote,
      confidence: analysis.confidence,
      bondAmount,
      participatingBots,
      reasoning
    };
  }

  private async submitVerificationVotes(task: VerificationTask, decision: ConsensusDecision): Promise<void> {
    task.status = 'voting';
    task.vote = decision.vote;

    // Get verification accounts
    const accounts = await this.accountPool.getMultipleAccounts(
      'verifier',
      task.chainId,
      decision.participatingBots,
      task.id
    );

    if (accounts.length === 0) {
      throw new Error('No verification accounts available');
    }

    task.accounts = accounts;

    const realityClient = this.realityClients.get(task.chainId);
    if (!realityClient) {
      throw new Error(`No Reality.eth client for chain ${task.chainId}`);
    }

    // Submit votes from multiple accounts
    let totalBondUsed = 0;
    
    for (const account of accounts) {
      try {
        botLogger.verification(`Submitting vote: ${decision.vote ? 'VALID' : 'INVALID'}`, {
          taskId: task.id,
          account: account.account.address,
          bondAmount: decision.bondAmount,
          confidence: decision.confidence
        });

        await realityClient.submitAnswer(
          account.wallet,
          task.questionId,
          decision.vote,
          decision.bondAmount
        );

        totalBondUsed += parseFloat(decision.bondAmount);

        // Small delay between votes
        await new Promise(resolve => setTimeout(resolve, 30000));

      } catch (error) {
        botLogger.error(`Failed to submit vote from ${account.account.address}`, error);
        // Continue with other accounts
      }
    }

    task.totalBondUsed = totalBondUsed.toFixed(4);

    botLogger.verification(`All votes submitted`, {
      taskId: task.id,
      participatingBots: accounts.length,
      totalBondUsed: task.totalBondUsed,
      vote: decision.vote
    });
  }

  private async monitorUntilFinalization(task: VerificationTask): Promise<void> {
    task.status = 'monitoring';

    const realityClient = this.realityClients.get(task.chainId);
    if (!realityClient) {
      throw new Error(`No Reality.eth client for chain ${task.chainId}`);
    }

    // Get question timeout
    const timeoutDate = await realityClient.getQuestionTimeout(task.questionId);
    if (timeoutDate) {
      task.timeoutAt = timeoutDate;
    }

    // Monitor until finalization
    while (true) {
      const isFinalized = await realityClient.isFinalized(task.questionId);
      
      if (isFinalized) {
        const result = await realityClient.getResult(task.questionId);
        task.finalizedAt = new Date();
        
        botLogger.verification(`Question finalized`, {
          taskId: task.id,
          result: result ? 'VALID' : 'INVALID',
          ourVote: task.vote ? 'VALID' : 'INVALID',
          correctPrediction: result === task.vote
        });
        
        break;
      }

      // Check if we can finalize
      const canFinalize = await realityClient.canFinalize(task.questionId);
      if (canFinalize && task.accounts && task.accounts.length > 0) {
        try {
          await realityClient.finalize(task.accounts[0].wallet, task.questionId);
          botLogger.verification(`Question finalized by our bot`, { taskId: task.id });
        } catch (error) {
          // Someone else might have finalized it
          botLogger.verification(`Failed to finalize, possibly already finalized`, { taskId: task.id });
        }
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
    }
  }
}