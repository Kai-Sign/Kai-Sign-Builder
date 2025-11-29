import { ethers } from 'ethers';
import axios from 'axios';
import { TargetContract } from '../discovery/target-prioritizer.js';
import { AccountPool, PooledAccount } from '../keystore/account-pool.js';
import { KaiSignClient, CommitResult, RevealResult, SubmissionStatus } from './kaisign-client.js';
import { ERC7730Generator } from './erc7730-generator.js';
import { ChainConfig, getChainConfig } from '../config/chains.js';
import { botLogger, PerformanceTimer } from '../utils/logger.js';

export interface SubmissionTask {
  id: string;
  target: TargetContract;
  status: 'pending' | 'committing' | 'uploading_blob' | 'revealing' | 'completed' | 'failed';
  account?: PooledAccount;
  
  // Commit-reveal data
  commitResult?: CommitResult;
  blobHash?: string;
  revealResult?: RevealResult;
  
  // Timing and retry
  startTime: Date;
  lastAttempt?: Date;
  retryCount: number;
  maxRetries: number;
  
  // Economic tracking
  totalBondUsed: string;
  estimatedReward: string;
  gasUsed: string;
  
  error?: string;
}

export interface BlobUploadResult {
  blobVersionedHash: string;
  blobTxHash: string;
}

export class SubmissionBot {
  private accountPool: AccountPool;
  private erc7730Generator: ERC7730Generator;
  private activeTasks: Map<string, SubmissionTask> = new Map();
  private clients: Map<number, KaiSignClient> = new Map();
  private providers: Map<number, ethers.Provider> = new Map();
  
  private readonly BLOB_API_URL = process.env.BLOB_API_URL || 'http://localhost:3000/api/blob/submit';
  private readonly MAX_CONCURRENT_SUBMISSIONS = parseInt(process.env.MAX_CONCURRENT_SUBMISSIONS || '5');
  private readonly SUBMISSION_DELAY_MS = parseInt(process.env.SUBMISSION_DELAY_MS || '30000');

  constructor(accountPool: AccountPool) {
    this.accountPool = accountPool;
    this.erc7730Generator = new ERC7730Generator();
  }

  async initialize(chains: ChainConfig[]): Promise<void> {
    for (const chain of chains) {
      if (chain.enabled && chain.rpc && chain.kaisignAddress) {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        this.providers.set(chain.id, provider);

        // Initialize KaiSign client
        const client = new KaiSignClient(provider, chain.kaisignAddress, chain);
        this.clients.set(chain.id, client);

        botLogger.submission(`Initialized submission bot for ${chain.name}`, { chainId: chain.id });
      }
    }

    await this.erc7730Generator.initialize();
    botLogger.submission('Submission bot fully initialized');
  }

  /**
   * Submit multiple contracts as a batch
   */
  async submitBatch(targets: TargetContract[]): Promise<SubmissionTask[]> {
    const timer = new PerformanceTimer('Batch submission');
    const tasks: SubmissionTask[] = [];

    try {
      botLogger.submission(`Starting batch submission of ${targets.length} contracts`);

      // Create submission tasks
      for (const target of targets) {
        if (this.activeTasks.size >= this.MAX_CONCURRENT_SUBMISSIONS) {
          botLogger.submission('Max concurrent submissions reached, queuing remaining targets');
          break;
        }

        const task = this.createSubmissionTask(target);
        tasks.push(task);
        this.activeTasks.set(task.id, task);
        
        // Start submission (non-blocking)
        this.executeSubmission(task).catch(error => {
          botLogger.error(`Submission task ${task.id} failed`, error);
        });

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.SUBMISSION_DELAY_MS));
      }

      timer.end({ tasksCreated: tasks.length });
      return tasks;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Batch submission failed', error);
      throw error;
    }
  }

  /**
   * Submit a single contract
   */
  async submitSingle(target: TargetContract): Promise<SubmissionTask> {
    const timer = new PerformanceTimer('Single submission');

    try {
      const task = this.createSubmissionTask(target);
      this.activeTasks.set(task.id, task);

      botLogger.submission(`Starting single submission for ${target.contract.address}`, {
        chainId: target.contract.chainId,
        taskId: task.id
      });

      await this.executeSubmission(task);

      timer.end({ taskId: task.id, success: true });
      return task;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Single submission failed', error);
      throw error;
    }
  }

  /**
   * Get status of all active submissions
   */
  getActiveSubmissions(): SubmissionTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get submission statistics
   */
  getSubmissionStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    totalBondUsed: string;
    totalGasUsed: string;
  } {
    const tasks = Array.from(this.activeTasks.values());
    
    let totalBondUsed = 0;
    let totalGasUsed = 0;

    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => ['committing', 'uploading_blob', 'revealing'].includes(t.status)).length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      totalBondUsed: '0',
      totalGasUsed: '0'
    };

    for (const task of tasks) {
      totalBondUsed += parseFloat(task.totalBondUsed || '0');
      totalGasUsed += parseFloat(task.gasUsed || '0');
    }

    stats.totalBondUsed = totalBondUsed.toFixed(6);
    stats.totalGasUsed = totalGasUsed.toFixed(9);

    return stats;
  }

  /**
   * Cancel a submission task
   */
  async cancelSubmission(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = 'Cancelled by user';
      
      // Release account if allocated
      if (task.account) {
        await this.accountPool.releaseAccount(task.account.account.id);
      }

      this.activeTasks.delete(taskId);
      botLogger.submission(`Cancelled submission task ${taskId}`);
    }
  }

  /**
   * Retry a failed submission
   */
  async retrySubmission(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task || task.status !== 'failed') {
      throw new Error('Task not found or not in failed state');
    }

    if (task.retryCount >= task.maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    task.retryCount++;
    task.status = 'pending';
    task.error = undefined;
    task.lastAttempt = new Date();

    botLogger.submission(`Retrying submission task ${taskId}`, { retryCount: task.retryCount });

    await this.executeSubmission(task);
  }

  private createSubmissionTask(target: TargetContract): SubmissionTask {
    const taskId = `sub-${target.contract.chainId}-${target.contract.address}-${Date.now()}`;

    return {
      id: taskId,
      target,
      status: 'pending',
      startTime: new Date(),
      retryCount: 0,
      maxRetries: 3,
      totalBondUsed: '0',
      estimatedReward: target.expectedReward,
      gasUsed: '0'
    };
  }

  private async executeSubmission(task: SubmissionTask): Promise<void> {
    const timer = new PerformanceTimer(`Submission ${task.id}`);

    try {
      // Get account for submission
      const account = await this.accountPool.getAccount(
        'submitter',
        task.target.contract.chainId,
        task.id
      );

      if (!account) {
        throw new Error('No available submission accounts');
      }

      task.account = account;
      task.lastAttempt = new Date();

      botLogger.submission(`Executing submission with account ${account.account.address}`, {
        taskId: task.id,
        targetContract: task.target.contract.address
      });

      // Step 1: Generate ERC7730 specification
      const erc7730Spec = await this.generateERC7730(task);

      // Step 2: Commit specification
      await this.executeCommit(task, erc7730Spec);

      // Step 3: Upload blob
      await this.uploadBlob(task, erc7730Spec);

      // Step 4: Reveal specification
      await this.executeReveal(task);

      task.status = 'completed';
      botLogger.submission(`Submission completed successfully`, {
        taskId: task.id,
        totalBondUsed: task.totalBondUsed,
        gasUsed: task.gasUsed
      });

      timer.end({ success: true, taskId: task.id });

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      
      botLogger.error(`Submission task ${task.id} failed`, error, {
        retryCount: task.retryCount,
        targetContract: task.target.contract.address
      });

      timer.end({ success: false, error: error.message });

      // Auto-retry if under retry limit
      if (task.retryCount < task.maxRetries) {
        setTimeout(() => {
          this.retrySubmission(task.id).catch(retryError => {
            botLogger.error(`Auto-retry failed for task ${task.id}`, retryError);
          });
        }, 60000); // Wait 1 minute before retry
      }

    } finally {
      // Release account
      if (task.account) {
        await this.accountPool.releaseAccount(task.account.account.id);
      }
    }
  }

  private async generateERC7730(task: SubmissionTask): Promise<any> {
    botLogger.submission(`Generating ERC7730 for ${task.target.contract.address}`);

    return await this.erc7730Generator.generateForContract(
      task.target.contract.address,
      task.target.contract.chainId
    );
  }

  private async executeCommit(task: SubmissionTask, erc7730Spec: any): Promise<void> {
    task.status = 'committing';

    const client = this.clients.get(task.target.contract.chainId);
    if (!client) {
      throw new Error(`No client for chain ${task.target.contract.chainId}`);
    }

    // Calculate metadata hash
    const specJson = JSON.stringify(erc7730Spec);
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(specJson));

    botLogger.submission(`Committing spec for ${task.target.contract.address}`, {
      taskId: task.id,
      metadataHash: metadataHash.substring(0, 10) + '...'
    });

    task.commitResult = await client.commitSpec(
      task.account!.wallet,
      metadataHash,
      task.target.contract.address,
      task.target.contract.chainId
    );

    botLogger.submission(`Commit successful`, {
      taskId: task.id,
      commitmentId: task.commitResult.commitmentId.substring(0, 10) + '...',
      revealDeadline: task.commitResult.revealDeadline
    });
  }

  private async uploadBlob(task: SubmissionTask, erc7730Spec: any): Promise<void> {
    task.status = 'uploading_blob';

    botLogger.submission(`Uploading blob for ${task.target.contract.address}`, {
      taskId: task.id
    });

    try {
      const response = await axios.post(this.BLOB_API_URL, {
        json: erc7730Spec
      }, {
        timeout: 180000, // 3 minutes
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.data.blobVersionedHash) {
        throw new Error('No blob hash returned from upload service');
      }

      task.blobHash = response.data.blobVersionedHash;

      botLogger.submission(`Blob upload successful`, {
        taskId: task.id,
        blobHash: task.blobHash.substring(0, 10) + '...'
      });

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Blob upload timeout - service may be overloaded');
      }
      throw new Error(`Blob upload failed: ${error.message}`);
    }
  }

  private async executeReveal(task: SubmissionTask): Promise<void> {
    task.status = 'revealing';

    if (!task.commitResult || !task.blobHash) {
      throw new Error('Missing commit result or blob hash');
    }

    const client = this.clients.get(task.target.contract.chainId);
    if (!client) {
      throw new Error(`No client for chain ${task.target.contract.chainId}`);
    }

    botLogger.submission(`Revealing spec for ${task.target.contract.address}`, {
      taskId: task.id,
      bondAmount: task.target.targetBond
    });

    task.revealResult = await client.revealSpec(
      task.account!.wallet,
      task.commitResult.commitmentId,
      task.blobHash,
      task.commitResult.metadataHash,
      task.commitResult.nonce,
      task.target.targetBond
    );

    task.totalBondUsed = task.target.targetBond;

    botLogger.submission(`Reveal successful`, {
      taskId: task.id,
      specId: task.revealResult.specId.substring(0, 10) + '...',
      bondUsed: task.totalBondUsed
    });
  }
}