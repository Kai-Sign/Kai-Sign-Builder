import { ContractScanner, ScanResult } from '../discovery/contract-scanner.js';
import { TargetPrioritizer, TargetContract } from '../discovery/target-prioritizer.js';
import { SubmissionBot, SubmissionTask } from '../submission/submission-bot.js';
import { VerificationBot, VerificationTask } from '../verification/verification-bot.js';
import { AccountPool } from '../keystore/account-pool.js';
import { WalletManager } from '../keystore/wallet-manager.js';
import { ChainConfig, getEnabledChains } from '../config/chains.js';
import { botLogger, PerformanceTimer } from '../utils/logger.js';

export interface Campaign {
  id: string;
  name: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  
  // Target configuration
  targetChains: number[];
  maxTargetsPerChain: number;
  priorityThreshold: number;
  
  // Economic parameters
  maxBondPerSubmission: string; // ETH
  totalBudget: string; // ETH
  budgetUsed: string; // ETH
  estimatedRewards: string; // ETH
  
  // Timing
  startTime: Date;
  endTime?: Date;
  duration?: number; // hours
  
  // Progress tracking
  targets: TargetContract[];
  submissions: SubmissionTask[];
  verifications: VerificationTask[];
  
  // Results
  successfulSubmissions: number;
  failedSubmissions: number;
  correctVerifications: number;
  totalRewardsEarned: string; // ETH
  
  // Configuration
  config: CampaignConfig;
  
  error?: string;
}

export interface CampaignConfig {
  discoveryConfig: {
    maxContractsPerChain: number;
    minTxCount: number;
    includeUnverified: boolean;
    targetTypes: string[]; // 'defi', 'erc20', etc.
  };
  
  submissionConfig: {
    maxConcurrent: number;
    delayBetweenSubmissions: number; // ms
    retryAttempts: number;
    bondStrategy: 'minimal' | 'optimal' | 'aggressive';
  };
  
  verificationConfig: {
    participationRate: number; // 0-1, fraction of proposals to verify
    confidenceThreshold: number; // 0-1
    maxBotsPerVerification: number;
    enableChallenger: boolean;
  };
  
  riskLimits: {
    maxBondPerHour: string; // ETH
    maxFailureRate: number; // 0-1
    stopOnConsecutiveFailures: number;
    emergencyStopLoss: string; // ETH
  };
}

export class CampaignManager {
  private walletManager: WalletManager;
  private accountPool: AccountPool;
  private contractScanner: ContractScanner;
  private targetPrioritizer: TargetPrioritizer;
  private submissionBot: SubmissionBot;
  private verificationBot: VerificationBot;
  
  private campaigns: Map<string, Campaign> = new Map();
  private activeCampaignId?: string;
  
  constructor(
    walletManager: WalletManager,
    accountPool: AccountPool,
    contractScanner: ContractScanner,
    targetPrioritizer: TargetPrioritizer,
    submissionBot: SubmissionBot,
    verificationBot: VerificationBot
  ) {
    this.walletManager = walletManager;
    this.accountPool = accountPool;
    this.contractScanner = contractScanner;
    this.targetPrioritizer = targetPrioritizer;
    this.submissionBot = submissionBot;
    this.verificationBot = verificationBot;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(
    name: string,
    config: CampaignConfig,
    targetChains?: number[],
    duration?: number // hours
  ): Promise<Campaign> {
    const timer = new PerformanceTimer('Campaign creation');

    try {
      const campaignId = `camp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const campaign: Campaign = {
        id: campaignId,
        name,
        status: 'planning',
        targetChains: targetChains || getEnabledChains().map(c => c.id),
        maxTargetsPerChain: config.discoveryConfig.maxContractsPerChain,
        priorityThreshold: 5, // Default priority threshold
        maxBondPerSubmission: '0.1',
        totalBudget: '1.0', // Default budget
        budgetUsed: '0',
        estimatedRewards: '0',
        startTime: new Date(),
        endTime: duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : undefined,
        duration,
        targets: [],
        submissions: [],
        verifications: [],
        successfulSubmissions: 0,
        failedSubmissions: 0,
        correctVerifications: 0,
        totalRewardsEarned: '0',
        config
      };

      this.campaigns.set(campaignId, campaign);

      botLogger.submission(`Campaign created: ${name}`, {
        campaignId,
        targetChains: campaign.targetChains,
        duration: duration ? `${duration}h` : 'indefinite'
      });

      timer.end({ campaignId, success: true });
      return campaign;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error('Failed to create campaign', error);
      throw error;
    }
  }

  /**
   * Start a campaign
   */
  async startCampaign(campaignId: string): Promise<void> {
    const timer = new PerformanceTimer('Campaign start');

    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (campaign.status !== 'planning') {
        throw new Error(`Campaign ${campaignId} is not in planning state`);
      }

      // Pre-flight checks
      await this.performPreflightChecks(campaign);

      campaign.status = 'running';
      campaign.startTime = new Date();
      this.activeCampaignId = campaignId;

      botLogger.submission(`Campaign started: ${campaign.name}`, {
        campaignId,
        targetChains: campaign.targetChains.length,
        budget: campaign.totalBudget
      });

      // Start campaign execution pipeline
      this.executeCampaign(campaign).catch(error => {
        botLogger.error(`Campaign ${campaignId} execution failed`, error);
        campaign.status = 'failed';
        campaign.error = error.message;
      });

      timer.end({ campaignId, success: true });

    } catch (error) {
      timer.end({ success: false, error: error.message });
      botLogger.error(`Failed to start campaign ${campaignId}`, error);
      throw error;
    }
  }

  /**
   * Pause a running campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status === 'running') {
      campaign.status = 'paused';
      botLogger.submission(`Campaign paused: ${campaign.name}`, { campaignId });
    }
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status === 'paused') {
      campaign.status = 'running';
      botLogger.submission(`Campaign resumed: ${campaign.name}`, { campaignId });

      // Resume execution
      this.executeCampaign(campaign).catch(error => {
        botLogger.error(`Campaign ${campaignId} execution failed after resume`, error);
        campaign.status = 'failed';
        campaign.error = error.message;
      });
    }
  }

  /**
   * Stop a campaign
   */
  async stopCampaign(campaignId: string): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    campaign.status = 'completed';
    campaign.endTime = new Date();

    if (this.activeCampaignId === campaignId) {
      this.activeCampaignId = undefined;
    }

    // Calculate final results
    await this.finalizeCampaignResults(campaign);

    botLogger.submission(`Campaign stopped: ${campaign.name}`, {
      campaignId,
      duration: this.formatDuration(campaign.startTime, campaign.endTime),
      submissions: campaign.submissions.length,
      successRate: campaign.submissions.length > 0 
        ? (campaign.successfulSubmissions / campaign.submissions.length * 100).toFixed(1) + '%'
        : '0%'
    });
  }

  /**
   * Get campaign status
   */
  getCampaign(campaignId: string): Campaign | undefined {
    return this.campaigns.get(campaignId);
  }

  /**
   * Get all campaigns
   */
  getAllCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get active campaign
   */
  getActiveCampaign(): Campaign | undefined {
    return this.activeCampaignId ? this.campaigns.get(this.activeCampaignId) : undefined;
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(campaignId: string): {
    duration: string;
    targetsFound: number;
    submissionsAttempted: number;
    submissionSuccessRate: number;
    verificationsAttempted: number;
    verificationAccuracy: number;
    budgetUtilization: number;
    estimatedROI: number;
    averageSubmissionTime: number;
  } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const duration = this.formatDuration(campaign.startTime, campaign.endTime || new Date());
    const submissionSuccessRate = campaign.submissions.length > 0 
      ? campaign.successfulSubmissions / campaign.submissions.length * 100 
      : 0;
    
    const verificationAccuracy = campaign.verifications.length > 0
      ? campaign.correctVerifications / campaign.verifications.length * 100
      : 0;

    const budgetUtilization = parseFloat(campaign.totalBudget) > 0
      ? parseFloat(campaign.budgetUsed) / parseFloat(campaign.totalBudget) * 100
      : 0;

    const estimatedROI = parseFloat(campaign.budgetUsed) > 0
      ? (parseFloat(campaign.totalRewardsEarned) - parseFloat(campaign.budgetUsed)) / parseFloat(campaign.budgetUsed) * 100
      : 0;

    // Calculate average submission time
    const completedSubmissions = campaign.submissions.filter(s => s.status === 'completed');
    const averageSubmissionTime = completedSubmissions.length > 0
      ? completedSubmissions.reduce((sum, s) => {
          const duration = new Date().getTime() - s.startTime.getTime();
          return sum + duration;
        }, 0) / completedSubmissions.length / 1000 / 60 // Convert to minutes
      : 0;

    return {
      duration,
      targetsFound: campaign.targets.length,
      submissionsAttempted: campaign.submissions.length,
      submissionSuccessRate,
      verificationsAttempted: campaign.verifications.length,
      verificationAccuracy,
      budgetUtilization,
      estimatedROI,
      averageSubmissionTime
    };
  }

  private async performPreflightChecks(campaign: Campaign): Promise<void> {
    botLogger.submission('Performing pre-flight checks', { campaignId: campaign.id });

    // Check account availability
    const accountStats = this.accountPool.getPoolStats('submitter');
    if (accountStats.available === 0) {
      throw new Error('No submitter accounts available');
    }

    const verifierStats = this.accountPool.getPoolStats('verifier');
    if (verifierStats.available === 0) {
      throw new Error('No verifier accounts available');
    }

    // Check account balances
    await this.checkAccountBalances(campaign);

    // Validate configuration
    this.validateCampaignConfig(campaign.config);

    botLogger.submission('Pre-flight checks passed', { 
      campaignId: campaign.id,
      submitterAccounts: accountStats.available,
      verifierAccounts: verifierStats.available
    });
  }

  private async checkAccountBalances(campaign: Campaign): Promise<void> {
    // TODO: Implement balance checking for all accounts
    // This would involve checking ETH balances on each target chain
    
    const minBalance = parseFloat(campaign.totalBudget) * 0.1; // Require at least 10% of budget per account
    
    botLogger.submission('Account balance check (simulated)', {
      campaignId: campaign.id,
      requiredMinBalance: minBalance.toFixed(4) + ' ETH'
    });
  }

  private validateCampaignConfig(config: CampaignConfig): void {
    if (config.discoveryConfig.maxContractsPerChain < 1) {
      throw new Error('Max contracts per chain must be at least 1');
    }

    if (config.submissionConfig.maxConcurrent < 1) {
      throw new Error('Max concurrent submissions must be at least 1');
    }

    if (config.verificationConfig.confidenceThreshold < 0 || config.verificationConfig.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }

    if (config.riskLimits.maxFailureRate < 0 || config.riskLimits.maxFailureRate > 1) {
      throw new Error('Max failure rate must be between 0 and 1');
    }
  }

  private async executeCampaign(campaign: Campaign): Promise<void> {
    botLogger.submission(`Executing campaign: ${campaign.name}`, { campaignId: campaign.id });

    try {
      // Phase 1: Discovery
      await this.executeDiscoveryPhase(campaign);

      // Phase 2: Submission
      await this.executeSubmissionPhase(campaign);

      // Phase 3: Verification (runs in parallel)
      this.executeVerificationPhase(campaign).catch(error => {
        botLogger.error('Verification phase failed', error);
      });

      // Monitor campaign progress
      await this.monitorCampaignProgress(campaign);

    } catch (error) {
      campaign.status = 'failed';
      campaign.error = error.message;
      throw error;
    }
  }

  private async executeDiscoveryPhase(campaign: Campaign): Promise<void> {
    botLogger.submission('Starting discovery phase', { campaignId: campaign.id });

    const allTargets: TargetContract[] = [];

    for (const chainId of campaign.targetChains) {
      if (campaign.status !== 'running') break;

      try {
        // Scan chain for contracts
        const scanResult = await this.contractScanner.scanChain(chainId, {
          maxContracts: campaign.config.discoveryConfig.maxContractsPerChain,
          minTxCount: campaign.config.discoveryConfig.minTxCount,
          skipVerifiedOnly: !campaign.config.discoveryConfig.includeUnverified
        });

        // Filter by contract types
        const filteredContracts = scanResult.contracts.filter(contract =>
          campaign.config.discoveryConfig.targetTypes.includes(contract.contractType)
        );

        // Prioritize targets
        const targets = await this.targetPrioritizer.prioritizeContracts(filteredContracts);
        allTargets.push(...targets);

        botLogger.discovery(`Chain ${chainId} discovery complete`, {
          contractsFound: scanResult.contracts.length,
          filtered: filteredContracts.length,
          priorityTargets: targets.length
        });

      } catch (error) {
        botLogger.error(`Discovery failed for chain ${chainId}`, error);
        // Continue with other chains
      }
    }

    campaign.targets = allTargets;
    campaign.estimatedRewards = allTargets
      .reduce((sum, target) => sum + parseFloat(target.expectedReward), 0)
      .toFixed(6);

    botLogger.submission('Discovery phase complete', {
      campaignId: campaign.id,
      totalTargets: allTargets.length,
      estimatedRewards: campaign.estimatedRewards + ' ETH'
    });
  }

  private async executeSubmissionPhase(campaign: Campaign): Promise<void> {
    botLogger.submission('Starting submission phase', { campaignId: campaign.id });

    // Submit targets in batches
    const batchSize = campaign.config.submissionConfig.maxConcurrent;
    
    for (let i = 0; i < campaign.targets.length; i += batchSize) {
      if (campaign.status !== 'running') break;

      const batch = campaign.targets.slice(i, i + batchSize);
      
      try {
        const submissionTasks = await this.submissionBot.submitBatch(batch);
        campaign.submissions.push(...submissionTasks);

        // Wait between batches
        if (i + batchSize < campaign.targets.length) {
          await new Promise(resolve => 
            setTimeout(resolve, campaign.config.submissionConfig.delayBetweenSubmissions)
          );
        }

      } catch (error) {
        botLogger.error('Batch submission failed', error);
        // Continue with next batch
      }

      // Check risk limits
      await this.checkRiskLimits(campaign);
    }

    botLogger.submission('Submission phase complete', {
      campaignId: campaign.id,
      submissionsStarted: campaign.submissions.length
    });
  }

  private async executeVerificationPhase(campaign: Campaign): Promise<void> {
    botLogger.verification('Starting verification phase', { campaignId: campaign.id });

    // Monitor for new proposals and verify them
    // This runs continuously in the background
    while (campaign.status === 'running') {
      try {
        // Check for new proposals to verify
        // This is a simplified implementation
        await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute

      } catch (error) {
        botLogger.error('Verification monitoring failed', error);
        await new Promise(resolve => setTimeout(resolve, 300000)); // Wait 5 minutes before retry
      }
    }
  }

  private async monitorCampaignProgress(campaign: Campaign): Promise<void> {
    while (campaign.status === 'running') {
      // Update campaign statistics
      this.updateCampaignProgress(campaign);

      // Check if campaign should end
      if (this.shouldEndCampaign(campaign)) {
        await this.stopCampaign(campaign.id);
        break;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 30000)); // Check every 30 seconds
    }
  }

  private updateCampaignProgress(campaign: Campaign): void {
    // Count successful and failed submissions
    campaign.successfulSubmissions = campaign.submissions.filter(s => s.status === 'completed').length;
    campaign.failedSubmissions = campaign.submissions.filter(s => s.status === 'failed').length;

    // Calculate budget used
    campaign.budgetUsed = campaign.submissions
      .reduce((sum, task) => sum + parseFloat(task.totalBondUsed || '0'), 0)
      .toFixed(6);

    // TODO: Calculate rewards earned from finalized verifications
    // This would require checking Reality.eth results and KaiSign bond settlements
  }

  private shouldEndCampaign(campaign: Campaign): boolean {
    // Check time limit
    if (campaign.endTime && new Date() >= campaign.endTime) {
      return true;
    }

    // Check if all targets have been processed
    const completedSubmissions = campaign.submissions.filter(s => 
      s.status === 'completed' || s.status === 'failed'
    ).length;

    if (completedSubmissions >= campaign.targets.length) {
      return true;
    }

    // Check budget exhaustion
    if (parseFloat(campaign.budgetUsed) >= parseFloat(campaign.totalBudget) * 0.95) {
      botLogger.submission('Campaign stopping due to budget exhaustion', {
        campaignId: campaign.id,
        budgetUsed: campaign.budgetUsed,
        totalBudget: campaign.totalBudget
      });
      return true;
    }

    return false;
  }

  private async checkRiskLimits(campaign: Campaign): Promise<void> {
    const config = campaign.config.riskLimits;

    // Check failure rate
    if (campaign.submissions.length > 10) { // Only check after enough samples
      const failureRate = campaign.failedSubmissions / campaign.submissions.length;
      if (failureRate > config.maxFailureRate) {
        throw new Error(`Failure rate ${(failureRate * 100).toFixed(1)}% exceeds limit ${(config.maxFailureRate * 100).toFixed(1)}%`);
      }
    }

    // Check emergency stop loss
    const totalLoss = parseFloat(campaign.budgetUsed);
    if (totalLoss > parseFloat(config.emergencyStopLoss)) {
      throw new Error(`Emergency stop loss triggered at ${totalLoss} ETH`);
    }

    // Check consecutive failures
    const recentTasks = campaign.submissions.slice(-config.stopOnConsecutiveFailures);
    if (recentTasks.length === config.stopOnConsecutiveFailures &&
        recentTasks.every(task => task.status === 'failed')) {
      throw new Error(`${config.stopOnConsecutiveFailures} consecutive failures detected`);
    }
  }

  private async finalizeCampaignResults(campaign: Campaign): Promise<void> {
    // Final update of all statistics
    this.updateCampaignProgress(campaign);

    // TODO: Calculate final rewards earned
    // This would involve checking all finalized Reality.eth questions and KaiSign settlements

    botLogger.submission('Campaign finalized', {
      campaignId: campaign.id,
      duration: this.formatDuration(campaign.startTime, campaign.endTime!),
      targets: campaign.targets.length,
      submissions: campaign.submissions.length,
      successRate: campaign.submissions.length > 0 
        ? (campaign.successfulSubmissions / campaign.submissions.length * 100).toFixed(1) + '%'
        : '0%',
      budgetUsed: campaign.budgetUsed + ' ETH',
      rewardsEarned: campaign.totalRewardsEarned + ' ETH'
    });
  }

  private formatDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}