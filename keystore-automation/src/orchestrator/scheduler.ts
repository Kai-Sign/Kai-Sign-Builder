import * as cron from 'node-cron';
import { CampaignManager, Campaign, CampaignConfig } from './campaign-manager.js';
import { AccountPool } from '../keystore/account-pool.js';
import { botLogger } from '../utils/logger.js';

export interface ScheduledCampaign {
  id: string;
  name: string;
  schedule: string; // Cron expression
  config: CampaignConfig;
  targetChains?: number[];
  duration?: number; // hours
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  totalRewardsEarned: string;
  averageROI: number;
}

export interface SchedulerConfig {
  timezone: string;
  maxConcurrentCampaigns: number;
  enableAutoOptimization: boolean;
  performanceThresholds: {
    minSuccessRate: number; // 0-1
    minROI: number; // percentage
    maxConsecutiveFailures: number;
  };
}

export class Scheduler {
  private campaignManager: CampaignManager;
  private accountPool: AccountPool;
  private scheduledCampaigns: Map<string, ScheduledCampaign> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private config: SchedulerConfig;

  constructor(
    campaignManager: CampaignManager,
    accountPool: AccountPool,
    config: SchedulerConfig = {
      timezone: 'UTC',
      maxConcurrentCampaigns: 2,
      enableAutoOptimization: true,
      performanceThresholds: {
        minSuccessRate: 0.7,
        minROI: 10, // 10%
        maxConsecutiveFailures: 3
      }
    }
  ) {
    this.campaignManager = campaignManager;
    this.accountPool = accountPool;
    this.config = config;
  }

  /**
   * Schedule a recurring campaign
   */
  async scheduleCampaign(
    name: string,
    schedule: string, // Cron expression
    config: CampaignConfig,
    targetChains?: number[],
    duration?: number
  ): Promise<ScheduledCampaign> {
    try {
      // Validate cron expression
      if (!cron.validate(schedule)) {
        throw new Error(`Invalid cron expression: ${schedule}`);
      }

      const scheduledCampaign: ScheduledCampaign = {
        id: `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        schedule,
        config,
        targetChains,
        duration,
        enabled: true,
        runCount: 0,
        totalRewardsEarned: '0',
        averageROI: 0,
        nextRun: this.getNextRunTime(schedule)
      };

      this.scheduledCampaigns.set(scheduledCampaign.id, scheduledCampaign);

      // Create cron job
      const task = cron.schedule(schedule, async () => {
        await this.executeCampaign(scheduledCampaign.id);
      }, {
        scheduled: false,
        timezone: this.config.timezone
      });

      this.cronJobs.set(scheduledCampaign.id, task);
      task.start();

      botLogger.submission(`Campaign scheduled: ${name}`, {
        scheduleId: scheduledCampaign.id,
        cronExpression: schedule,
        nextRun: scheduledCampaign.nextRun?.toISOString()
      });

      return scheduledCampaign;

    } catch (error) {
      botLogger.error('Failed to schedule campaign', error);
      throw error;
    }
  }

  /**
   * Create default campaign schedules
   */
  async createDefaultSchedules(): Promise<void> {
    try {
      // Daily discovery and submission campaign
      const dailyConfig: CampaignConfig = {
        discoveryConfig: {
          maxContractsPerChain: 20,
          minTxCount: 5000,
          includeUnverified: false,
          targetTypes: ['defi', 'erc20', 'governance']
        },
        submissionConfig: {
          maxConcurrent: 3,
          delayBetweenSubmissions: 30000,
          retryAttempts: 2,
          bondStrategy: 'optimal'
        },
        verificationConfig: {
          participationRate: 0.8,
          confidenceThreshold: 0.75,
          maxBotsPerVerification: 2,
          enableChallenger: true
        },
        riskLimits: {
          maxBondPerHour: '0.5',
          maxFailureRate: 0.3,
          stopOnConsecutiveFailures: 3,
          emergencyStopLoss: '1.0'
        }
      };

      await this.scheduleCampaign(
        'Daily Discovery & Submission',
        '0 9 * * *', // 9 AM UTC daily
        dailyConfig,
        undefined, // All enabled chains
        8 // 8 hours duration
      );

      // Weekly comprehensive campaign
      const weeklyConfig: CampaignConfig = {
        ...dailyConfig,
        discoveryConfig: {
          ...dailyConfig.discoveryConfig,
          maxContractsPerChain: 50,
          minTxCount: 1000,
          includeUnverified: true
        },
        submissionConfig: {
          ...dailyConfig.submissionConfig,
          maxConcurrent: 5
        }
      };

      await this.scheduleCampaign(
        'Weekly Comprehensive Scan',
        '0 6 * * 1', // 6 AM UTC on Mondays
        weeklyConfig,
        undefined,
        12 // 12 hours duration
      );

      // High-frequency mainnet campaign
      const mainnetnConfig: CampaignConfig = {
        ...dailyConfig,
        discoveryConfig: {
          ...dailyConfig.discoveryConfig,
          maxContractsPerChain: 10,
          minTxCount: 50000,
          targetTypes: ['defi']
        },
        submissionConfig: {
          ...dailyConfig.submissionConfig,
          bondStrategy: 'aggressive'
        }
      };

      await this.scheduleCampaign(
        'Mainnet DeFi Focus',
        '0 */6 * * *', // Every 6 hours
        mainnetnConfig,
        [1], // Ethereum mainnet only
        2 // 2 hours duration
      );

      botLogger.submission('Default campaign schedules created');

    } catch (error) {
      botLogger.error('Failed to create default schedules', error);
      throw error;
    }
  }

  /**
   * Enable/disable a scheduled campaign
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<void> {
    const scheduled = this.scheduledCampaigns.get(scheduleId);
    const task = this.cronJobs.get(scheduleId);

    if (!scheduled || !task) {
      throw new Error(`Scheduled campaign ${scheduleId} not found`);
    }

    scheduled.enabled = enabled;

    if (enabled) {
      task.start();
      scheduled.nextRun = this.getNextRunTime(scheduled.schedule);
      botLogger.submission(`Schedule enabled: ${scheduled.name}`, { scheduleId });
    } else {
      task.stop();
      scheduled.nextRun = undefined;
      botLogger.submission(`Schedule disabled: ${scheduled.name}`, { scheduleId });
    }
  }

  /**
   * Delete a scheduled campaign
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    const scheduled = this.scheduledCampaigns.get(scheduleId);
    const task = this.cronJobs.get(scheduleId);

    if (!scheduled || !task) {
      throw new Error(`Scheduled campaign ${scheduleId} not found`);
    }

    task.destroy();
    this.cronJobs.delete(scheduleId);
    this.scheduledCampaigns.delete(scheduleId);

    botLogger.submission(`Schedule deleted: ${scheduled.name}`, { scheduleId });
  }

  /**
   * Update a scheduled campaign configuration
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<ScheduledCampaign, 'name' | 'schedule' | 'config' | 'targetChains' | 'duration'>>
  ): Promise<void> {
    const scheduled = this.scheduledCampaigns.get(scheduleId);
    if (!scheduled) {
      throw new Error(`Scheduled campaign ${scheduleId} not found`);
    }

    // If schedule changed, recreate cron job
    if (updates.schedule && updates.schedule !== scheduled.schedule) {
      if (!cron.validate(updates.schedule)) {
        throw new Error(`Invalid cron expression: ${updates.schedule}`);
      }

      const oldTask = this.cronJobs.get(scheduleId);
      if (oldTask) {
        oldTask.destroy();
      }

      const newTask = cron.schedule(updates.schedule, async () => {
        await this.executeCampaign(scheduleId);
      }, {
        scheduled: scheduled.enabled,
        timezone: this.config.timezone
      });

      this.cronJobs.set(scheduleId, newTask);
      scheduled.schedule = updates.schedule;
      scheduled.nextRun = this.getNextRunTime(updates.schedule);
    }

    // Update other fields
    if (updates.name) scheduled.name = updates.name;
    if (updates.config) scheduled.config = updates.config;
    if (updates.targetChains) scheduled.targetChains = updates.targetChains;
    if (updates.duration) scheduled.duration = updates.duration;

    botLogger.submission(`Schedule updated: ${scheduled.name}`, { scheduleId });
  }

  /**
   * Get all scheduled campaigns
   */
  getScheduledCampaigns(): ScheduledCampaign[] {
    return Array.from(this.scheduledCampaigns.values());
  }

  /**
   * Get scheduler statistics
   */
  getSchedulerStats(): {
    totalSchedules: number;
    activeSchedules: number;
    totalRuns: number;
    totalRewards: string;
    averageROI: number;
    upcomingRuns: Array<{ name: string; nextRun: Date }>;
  } {
    const schedules = Array.from(this.scheduledCampaigns.values());
    const activeSchedules = schedules.filter(s => s.enabled).length;
    const totalRuns = schedules.reduce((sum, s) => sum + s.runCount, 0);
    const totalRewards = schedules.reduce((sum, s) => sum + parseFloat(s.totalRewardsEarned), 0);
    const averageROI = schedules.length > 0
      ? schedules.reduce((sum, s) => sum + s.averageROI, 0) / schedules.length
      : 0;

    const upcomingRuns = schedules
      .filter(s => s.enabled && s.nextRun)
      .map(s => ({ name: s.name, nextRun: s.nextRun! }))
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, 5);

    return {
      totalSchedules: schedules.length,
      activeSchedules,
      totalRuns,
      totalRewards: totalRewards.toFixed(6),
      averageROI,
      upcomingRuns
    };
  }

  /**
   * Optimize schedule performance
   */
  async optimizeSchedules(): Promise<void> {
    if (!this.config.enableAutoOptimization) {
      return;
    }

    botLogger.submission('Running schedule optimization');

    for (const [scheduleId, scheduled] of this.scheduledCampaigns.entries()) {
      if (!scheduled.enabled || scheduled.runCount < 3) {
        continue; // Need enough data for optimization
      }

      try {
        await this.optimizeSchedule(scheduleId, scheduled);
      } catch (error) {
        botLogger.error(`Failed to optimize schedule ${scheduleId}`, error);
      }
    }
  }

  private async executeCampaign(scheduleId: string): Promise<void> {
    const scheduled = this.scheduledCampaigns.get(scheduleId);
    if (!scheduled || !scheduled.enabled) {
      return;
    }

    try {
      // Check if we're within concurrent campaign limits
      const activeCampaigns = this.campaignManager.getAllCampaigns()
        .filter(c => c.status === 'running').length;

      if (activeCampaigns >= this.config.maxConcurrentCampaigns) {
        botLogger.submission(`Skipping scheduled campaign due to concurrent limit`, {
          scheduleId,
          name: scheduled.name,
          activeCampaigns,
          limit: this.config.maxConcurrentCampaigns
        });
        return;
      }

      // Check account availability
      const submitterStats = this.accountPool.getPoolStats('submitter');
      const verifierStats = this.accountPool.getPoolStats('verifier');

      if (submitterStats.available === 0 || verifierStats.available === 0) {
        botLogger.submission(`Skipping scheduled campaign due to insufficient accounts`, {
          scheduleId,
          name: scheduled.name,
          submitters: submitterStats.available,
          verifiers: verifierStats.available
        });
        return;
      }

      // Performance check
      if (scheduled.runCount > 0) {
        const shouldSkip = await this.performanceCheck(scheduled);
        if (shouldSkip) {
          botLogger.submission(`Skipping scheduled campaign due to poor performance`, {
            scheduleId,
            name: scheduled.name,
            averageROI: scheduled.averageROI
          });
          return;
        }
      }

      botLogger.submission(`Executing scheduled campaign: ${scheduled.name}`, {
        scheduleId,
        runCount: scheduled.runCount + 1
      });

      // Create and start campaign
      const campaignName = `${scheduled.name} - Run ${scheduled.runCount + 1}`;
      const campaign = await this.campaignManager.createCampaign(
        campaignName,
        scheduled.config,
        scheduled.targetChains,
        scheduled.duration
      );

      await this.campaignManager.startCampaign(campaign.id);

      // Update schedule metadata
      scheduled.runCount++;
      scheduled.lastRun = new Date();
      scheduled.nextRun = this.getNextRunTime(scheduled.schedule);

      // Schedule results update after campaign completes
      this.scheduleResultsUpdate(scheduleId, campaign.id);

    } catch (error) {
      botLogger.error(`Failed to execute scheduled campaign ${scheduleId}`, error);
    }
  }

  private async performanceCheck(scheduled: ScheduledCampaign): Promise<boolean> {
    const thresholds = this.config.performanceThresholds;

    // Check ROI threshold
    if (scheduled.averageROI < thresholds.minROI) {
      return true; // Skip due to low ROI
    }

    // TODO: Check success rate from recent campaigns
    // This would require tracking campaign outcomes

    return false; // Don't skip
  }

  private async optimizeSchedule(scheduleId: string, scheduled: ScheduledCampaign): Promise<void> {
    // Simple optimization: adjust frequency based on performance
    if (scheduled.averageROI < 5) {
      // Reduce frequency for poor performing schedules
      const newSchedule = this.reduceFrequency(scheduled.schedule);
      if (newSchedule !== scheduled.schedule) {
        await this.updateSchedule(scheduleId, { schedule: newSchedule });
        botLogger.submission(`Reduced schedule frequency for poor performance`, {
          scheduleId,
          oldSchedule: scheduled.schedule,
          newSchedule
        });
      }
    } else if (scheduled.averageROI > 20) {
      // Increase frequency for high performing schedules
      const newSchedule = this.increaseFrequency(scheduled.schedule);
      if (newSchedule !== scheduled.schedule) {
        await this.updateSchedule(scheduleId, { schedule: newSchedule });
        botLogger.submission(`Increased schedule frequency for high performance`, {
          scheduleId,
          oldSchedule: scheduled.schedule,
          newSchedule
        });
      }
    }
  }

  private reduceFrequency(schedule: string): string {
    // Simple frequency reduction logic
    if (schedule.startsWith('0 */6')) {
      return '0 */12 * * *'; // 6h -> 12h
    }
    if (schedule.startsWith('0 */12')) {
      return '0 9 * * *'; // 12h -> daily
    }
    if (schedule.startsWith('0 9 * * *')) {
      return '0 9 * * 1,4'; // daily -> twice weekly
    }
    return schedule; // No change
  }

  private increaseFrequency(schedule: string): string {
    // Simple frequency increase logic
    if (schedule.startsWith('0 9 * * 1,4')) {
      return '0 9 * * *'; // twice weekly -> daily
    }
    if (schedule.startsWith('0 9 * * *')) {
      return '0 */12 * * *'; // daily -> 12h
    }
    if (schedule.startsWith('0 */12')) {
      return '0 */6 * * *'; // 12h -> 6h
    }
    return schedule; // No change
  }

  private getNextRunTime(schedule: string): Date {
    try {
      // Parse cron expression to get next run time
      const task = cron.schedule(schedule, () => {}, { scheduled: false });
      // This is a simplified version - in reality you'd use a cron parser
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24h from now
    } catch (error) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }

  private scheduleResultsUpdate(scheduleId: string, campaignId: string): void {
    // Check campaign results after it completes and update schedule statistics
    const checkResults = async () => {
      const campaign = this.campaignManager.getCampaign(campaignId);
      if (campaign && campaign.status === 'completed') {
        const scheduled = this.scheduledCampaigns.get(scheduleId);
        if (scheduled) {
          // Update cumulative statistics
          const campaignRewards = parseFloat(campaign.totalRewardsEarned || '0');
          const totalPreviousRewards = parseFloat(scheduled.totalRewardsEarned);
          scheduled.totalRewardsEarned = (totalPreviousRewards + campaignRewards).toFixed(6);

          // Calculate average ROI
          const campaignStats = this.campaignManager.getCampaignStats(campaignId);
          scheduled.averageROI = (scheduled.averageROI * (scheduled.runCount - 1) + campaignStats.estimatedROI) / scheduled.runCount;

          botLogger.submission(`Updated schedule statistics`, {
            scheduleId,
            campaignId,
            newAverageROI: scheduled.averageROI.toFixed(2) + '%',
            totalRewards: scheduled.totalRewardsEarned + ' ETH'
          });
        }
      } else {
        // Check again later if campaign is still running
        setTimeout(checkResults, 60000);
      }
    };

    setTimeout(checkResults, 60000); // Initial check after 1 minute
  }
}