import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { CampaignManager } from '../orchestrator/campaign-manager.js';
import { AccountPool } from '../keystore/account-pool.js';
import { SubmissionBot } from '../submission/submission-bot.js';
import { VerificationBot } from '../verification/verification-bot.js';
import { Scheduler } from '../orchestrator/scheduler.js';
import { botLogger } from '../utils/logger.js';

export interface DashboardConfig {
  refreshInterval: number; // ms
  enableNotifications: boolean;
  alertThresholds: {
    lowAccountBalance: number; // ETH
    highFailureRate: number; // 0-1
    emergencyStopLoss: number; // ETH
  };
}

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private widgets: {
    overview: any;
    campaigns: any;
    submissions: any;
    verifications: any;
    accounts: any;
    performance: any;
    logs: any;
    alerts: any;
  };

  private campaignManager: CampaignManager;
  private accountPool: AccountPool;
  private submissionBot: SubmissionBot;
  private verificationBot: VerificationBot;
  private scheduler: Scheduler;
  
  private config: DashboardConfig;
  private refreshTimer?: NodeJS.Timeout;
  private alerts: Array<{ timestamp: Date; level: 'info' | 'warn' | 'error'; message: string }> = [];

  constructor(
    campaignManager: CampaignManager,
    accountPool: AccountPool,
    submissionBot: SubmissionBot,
    verificationBot: VerificationBot,
    scheduler: Scheduler,
    config: DashboardConfig = {
      refreshInterval: 5000,
      enableNotifications: true,
      alertThresholds: {
        lowAccountBalance: 0.01,
        highFailureRate: 0.3,
        emergencyStopLoss: 2.0
      }
    }
  ) {
    this.campaignManager = campaignManager;
    this.accountPool = accountPool;
    this.submissionBot = submissionBot;
    this.verificationBot = verificationBot;
    this.scheduler = scheduler;
    this.config = config;

    this.setupScreen();
    this.createWidgets();
    this.setupEventHandlers();
  }

  /**
   * Start the dashboard
   */
  start(): void {
    this.screen.render();
    this.startRefreshTimer();
    
    botLogger.submission('Dashboard started', {
      refreshInterval: this.config.refreshInterval + 'ms'
    });

    // Initial data load
    this.updateAllWidgets();
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    
    this.screen.destroy();
    botLogger.submission('Dashboard stopped');
  }

  /**
   * Add alert to the dashboard
   */
  addAlert(level: 'info' | 'warn' | 'error', message: string): void {
    this.alerts.unshift({
      timestamp: new Date(),
      level,
      message
    });

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    this.updateAlertsWidget();

    if (this.config.enableNotifications && level === 'error') {
      // Could integrate with Discord/Telegram here
      botLogger.error('Dashboard Alert', { message });
    }
  }

  private setupScreen(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'KaiSign Bot Dashboard'
    });

    // Exit on Escape, q, or Control-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    this.grid = new contrib.grid({ rows: 4, cols: 4, screen: this.screen });
  }

  private createWidgets(): void {
    // Overview box (top-left)
    this.widgets.overview = this.grid.set(0, 0, 1, 1, blessed.box, {
      label: ' System Overview ',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        label: { fg: 'cyan' }
      }
    });

    // Campaigns table (top-center, spans 2 cols)
    this.widgets.campaigns = this.grid.set(0, 1, 1, 2, contrib.table, {
      label: ' Active Campaigns ',
      columnSpacing: 2,
      columnWidth: [20, 12, 10, 12, 15],
      style: {
        border: { fg: 'green' },
        label: { fg: 'green' }
      }
    });

    // Account status (top-right)
    this.widgets.accounts = this.grid.set(0, 3, 1, 1, blessed.box, {
      label: ' Account Pool ',
      border: { type: 'line' },
      style: {
        border: { fg: 'yellow' },
        label: { fg: 'yellow' }
      }
    });

    // Submission stats (second row, left half)
    this.widgets.submissions = this.grid.set(1, 0, 1, 2, contrib.table, {
      label: ' Recent Submissions ',
      columnSpacing: 1,
      columnWidth: [15, 10, 12, 8, 15],
      style: {
        border: { fg: 'blue' },
        label: { fg: 'blue' }
      }
    });

    // Verification stats (second row, right half)
    this.widgets.verifications = this.grid.set(1, 2, 1, 2, contrib.table, {
      label: ' Recent Verifications ',
      columnSpacing: 1,
      columnWidth: [15, 10, 12, 10, 13],
      style: {
        border: { fg: 'magenta' },
        label: { fg: 'magenta' }
      }
    });

    // Performance chart (third row, spans 3 cols)
    this.widgets.performance = this.grid.set(2, 0, 1, 3, contrib.line, {
      label: ' Performance Metrics ',
      showLegend: true,
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black',
        border: { fg: 'white' },
        label: { fg: 'white' }
      },
      xLabelPadding: 3,
      xPadding: 5
    });

    // Alerts/Events log (third row, right)
    this.widgets.alerts = this.grid.set(2, 3, 1, 1, blessed.log, {
      label: ' Alerts & Events ',
      border: { type: 'line' },
      style: {
        border: { fg: 'red' },
        label: { fg: 'red' }
      },
      scrollable: true,
      mouse: true
    });

    // System logs (bottom row)
    this.widgets.logs = this.grid.set(3, 0, 1, 4, blessed.log, {
      label: ' System Logs ',
      border: { type: 'line' },
      style: {
        border: { fg: 'white' },
        label: { fg: 'white' }
      },
      scrollable: true,
      mouse: true
    });
  }

  private setupEventHandlers(): void {
    // Handle keyboard shortcuts
    this.screen.key('r', () => {
      this.updateAllWidgets();
      this.addAlert('info', 'Dashboard refreshed manually');
    });

    this.screen.key('p', () => {
      const active = this.campaignManager.getActiveCampaign();
      if (active) {
        this.campaignManager.pauseCampaign(active.id).catch(err => {
          this.addAlert('error', `Failed to pause campaign: ${err.message}`);
        });
      }
    });

    this.screen.key('s', () => {
      const active = this.campaignManager.getActiveCampaign();
      if (active) {
        this.campaignManager.stopCampaign(active.id).catch(err => {
          this.addAlert('error', `Failed to stop campaign: ${err.message}`);
        });
      }
    });

    // Help text
    this.widgets.logs.log('{cyan-fg}Dashboard Controls:{/cyan-fg}');
    this.widgets.logs.log('  r - Refresh data');
    this.widgets.logs.log('  p - Pause active campaign');
    this.widgets.logs.log('  s - Stop active campaign');
    this.widgets.logs.log('  q/ESC - Exit');
    this.widgets.logs.log('');
  }

  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(() => {
      this.updateAllWidgets();
      this.checkAlertConditions();
    }, this.config.refreshInterval);
  }

  private updateAllWidgets(): void {
    this.updateOverviewWidget();
    this.updateCampaignsWidget();
    this.updateAccountsWidget();
    this.updateSubmissionsWidget();
    this.updateVerificationsWidget();
    this.updatePerformanceWidget();
    this.screen.render();
  }

  private updateOverviewWidget(): void {
    const schedulerStats = this.scheduler.getSchedulerStats();
    const activeCampaign = this.campaignManager.getActiveCampaign();
    
    const content = [
      `{cyan-fg}KaiSign Automation Bot{/cyan-fg}`,
      ``,
      `{white-fg}Active Campaign:{/white-fg} ${activeCampaign?.name || 'None'}`,
      `{white-fg}Campaign Status:{/white-fg} ${activeCampaign?.status || 'N/A'}`,
      ``,
      `{white-fg}Scheduled Campaigns:{/white-fg} ${schedulerStats.activeSchedules}/${schedulerStats.totalSchedules}`,
      `{white-fg}Total Runs:{/white-fg} ${schedulerStats.totalRuns}`,
      `{white-fg}Total Rewards:{/white-fg} ${schedulerStats.totalRewards} ETH`,
      `{white-fg}Average ROI:{/white-fg} ${schedulerStats.averageROI.toFixed(1)}%`,
      ``,
      `{white-fg}Uptime:{/white-fg} ${this.formatUptime()}`,
      `{white-fg}Last Update:{/white-fg} ${new Date().toLocaleTimeString()}`
    ].join('\n');

    this.widgets.overview.setContent(content);
  }

  private updateCampaignsWidget(): void {
    const campaigns = this.campaignManager.getAllCampaigns()
      .filter(c => c.status !== 'completed')
      .slice(0, 10); // Show recent 10

    const data = campaigns.map(campaign => {
      const stats = this.campaignManager.getCampaignStats(campaign.id);
      return [
        campaign.name.substring(0, 18),
        campaign.status,
        `${stats.submissionsAttempted}`,
        `${stats.submissionSuccessRate.toFixed(1)}%`,
        `${campaign.budgetUsed} ETH`
      ];
    });

    this.widgets.campaigns.setData({
      headers: ['Campaign', 'Status', 'Submissions', 'Success Rate', 'Budget Used'],
      data: data
    });
  }

  private updateAccountsWidget(): void {
    const submitterStats = this.accountPool.getPoolStats('submitter');
    const verifierStats = this.accountPool.getPoolStats('verifier');
    const challengerStats = this.accountPool.getPoolStats('challenger');
    const monitorStats = this.accountPool.getPoolStats('monitor');

    const content = [
      `{yellow-fg}Account Pool Status{/yellow-fg}`,
      ``,
      `{white-fg}Submitters:{/white-fg}`,
      `  Available: ${submitterStats.available}`,
      `  In Use: ${submitterStats.inUse}`,
      `  Total: ${submitterStats.total}`,
      ``,
      `{white-fg}Verifiers:{/white-fg}`,
      `  Available: ${verifierStats.available}`,
      `  In Use: ${verifierStats.inUse}`,
      `  Total: ${verifierStats.total}`,
      ``,
      `{white-fg}Challengers:{/white-fg}`,
      `  Available: ${challengerStats.available}`,
      `  In Use: ${challengerStats.inUse}`,
      ``,
      `{white-fg}Monitors:{/white-fg}`,
      `  Available: ${monitorStats.available}`,
      `  In Use: ${monitorStats.inUse}`
    ].join('\n');

    this.widgets.accounts.setContent(content);
  }

  private updateSubmissionsWidget(): void {
    const submissions = this.submissionBot.getActiveSubmissions()
      .slice(0, 8) // Show recent 8
      .map(task => [
        task.target.contract.address.substring(0, 13) + '...',
        task.target.contract.chainId.toString(),
        task.status,
        task.target.targetBond,
        task.error?.substring(0, 13) || 'None'
      ]);

    this.widgets.submissions.setData({
      headers: ['Contract', 'Chain', 'Status', 'Bond', 'Error'],
      data: submissions
    });
  }

  private updateVerificationsWidget(): void {
    const verifications = this.verificationBot.getActiveTasks()
      .slice(0, 8) // Show recent 8
      .map(task => [
        task.contractAddress.substring(0, 13) + '...',
        task.chainId.toString(),
        task.status,
        task.vote !== undefined ? (task.vote ? 'VALID' : 'INVALID') : 'Pending',
        task.analysis?.confidence?.toFixed(2) || 'N/A'
      ]);

    this.widgets.verifications.setData({
      headers: ['Contract', 'Chain', 'Status', 'Vote', 'Confidence'],
      data: verifications
    });
  }

  private updatePerformanceWidget(): void {
    // Simulate performance data - in real implementation, this would come from metrics
    const now = Date.now();
    const timeRange = 60; // minutes
    
    const successRateData: Array<{ x: string; y: number }> = [];
    const revenueData: Array<{ x: string; y: number }> = [];
    
    for (let i = timeRange; i >= 0; i--) {
      const time = new Date(now - i * 60000).toLocaleTimeString();
      
      // Mock data - replace with actual metrics
      const successRate = 75 + Math.random() * 20; // 75-95%
      const revenue = Math.random() * 0.1; // 0-0.1 ETH per minute
      
      successRateData.push({ x: time, y: successRate });
      revenueData.push({ x: time, y: revenue * 1000 }); // Convert to milliETH for display
    }

    this.widgets.performance.setData([
      {
        title: 'Success Rate (%)',
        x: successRateData.map(d => d.x),
        y: successRateData.map(d => d.y),
        style: { line: 'green' }
      },
      {
        title: 'Revenue (mETH/min)',
        x: revenueData.map(d => d.x),
        y: revenueData.map(d => d.y),
        style: { line: 'yellow' }
      }
    ]);
  }

  private updateAlertsWidget(): void {
    this.widgets.alerts.setContent('');
    
    for (const alert of this.alerts.slice(0, 20)) {
      const color = alert.level === 'error' ? 'red' : alert.level === 'warn' ? 'yellow' : 'white';
      const time = alert.timestamp.toLocaleTimeString();
      this.widgets.alerts.log(`{${color}-fg}[${time}] ${alert.message}{/${color}-fg}`);
    }
  }

  private checkAlertConditions(): void {
    // Check account balances (simplified)
    const submitterStats = this.accountPool.getPoolStats('submitter');
    if (submitterStats.available === 0) {
      this.addAlert('warn', 'No submitter accounts available');
    }

    // Check campaign failure rates
    const activeCampaign = this.campaignManager.getActiveCampaign();
    if (activeCampaign) {
      const stats = this.campaignManager.getCampaignStats(activeCampaign.id);
      if (stats.submissionSuccessRate < this.config.alertThresholds.highFailureRate * 100) {
        this.addAlert('warn', `High failure rate: ${stats.submissionSuccessRate.toFixed(1)}%`);
      }

      // Check budget usage
      if (parseFloat(activeCampaign.budgetUsed) > this.config.alertThresholds.emergencyStopLoss) {
        this.addAlert('error', `Emergency stop loss exceeded: ${activeCampaign.budgetUsed} ETH`);
      }
    }

    // Check system health
    const verificationStats = this.verificationBot.getVerificationStats();
    if (verificationStats.failed > verificationStats.completed) {
      this.addAlert('warn', 'More verification failures than successes');
    }
  }

  private formatUptime(): string {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Log a message to the dashboard
   */
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const color = level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'white';
    const time = new Date().toLocaleTimeString();
    this.widgets.logs.log(`{${color}-fg}[${time}] ${message}{/${color}-fg}`);
    this.screen.render();
  }

  /**
   * Display help information
   */
  showHelp(): void {
    const helpText = [
      '{cyan-fg}KaiSign Bot Dashboard Help{/cyan-fg}',
      '',
      '{white-fg}Keyboard Shortcuts:{/white-fg}',
      '  r - Refresh all data',
      '  p - Pause active campaign',
      '  s - Stop active campaign',
      '  q/ESC - Exit dashboard',
      '',
      '{white-fg}Widget Information:{/white-fg}',
      '  Overview: System status and key metrics',
      '  Campaigns: Active campaign status',
      '  Accounts: Bot account pool status',
      '  Submissions: Recent submission attempts',
      '  Verifications: Recent verification activities',
      '  Performance: Success rates and revenue over time',
      '  Alerts: Important system notifications',
      '  Logs: Detailed system activity log',
      '',
      '{white-fg}Alert Levels:{/white-fg}',
      '  INFO (white): General information',
      '  WARN (yellow): Warnings that need attention',
      '  ERROR (red): Critical issues requiring action'
    ].join('\n');

    // Create temporary help box
    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      content: helpText,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    this.screen.append(helpBox);
    helpBox.focus();

    helpBox.key(['escape', 'enter', 'q'], () => {
      this.screen.remove(helpBox);
      this.screen.render();
    });

    this.screen.render();
  }
}