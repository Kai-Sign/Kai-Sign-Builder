#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

import { WalletManager } from './keystore/wallet-manager.js';
import { AccountPool } from './keystore/account-pool.js';
import { ContractScanner } from './discovery/contract-scanner.js';
import { TargetPrioritizer } from './discovery/target-prioritizer.js';
import { SubmissionBot } from './submission/submission-bot.js';
import { VerificationBot } from './verification/verification-bot.js';
import { CampaignManager } from './orchestrator/campaign-manager.js';
import { Scheduler } from './orchestrator/scheduler.js';
import { Dashboard } from './monitoring/dashboard.js';
import { getEnabledChains } from './config/chains.js';
import { logger, botLogger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KaiSignBot {
  private walletManager!: WalletManager;
  private accountPool!: AccountPool;
  private contractScanner!: ContractScanner;
  private targetPrioritizer!: TargetPrioritizer;
  private submissionBot!: SubmissionBot;
  private verificationBot!: VerificationBot;
  private campaignManager!: CampaignManager;
  private scheduler!: Scheduler;
  private dashboard?: Dashboard;

  async initialize(): Promise<void> {
    const spinner = ora('Initializing KaiSign Bot...').start();

    try {
      // Validate environment
      this.validateEnvironment();
      spinner.text = 'Environment validated...';

      // Initialize keystore and accounts
      const keystoreDir = process.env.KEYSTORE_DIR || './config/keystores';
      const keystorePassword = process.env.KEYSTORE_PASSWORD;
      if (!keystorePassword) {
        throw new Error('KEYSTORE_PASSWORD environment variable required');
      }

      this.walletManager = new WalletManager(keystoreDir, keystorePassword);
      await this.walletManager.initialize();
      spinner.text = 'Keystore initialized...';

      this.accountPool = new AccountPool(this.walletManager);
      await this.accountPool.initialize();
      spinner.text = 'Account pool initialized...';

      // Initialize discovery components
      this.contractScanner = new ContractScanner();
      await this.contractScanner.initialize(getEnabledChains());
      spinner.text = 'Contract scanner initialized...';

      this.targetPrioritizer = new TargetPrioritizer();

      // Initialize submission bot
      this.submissionBot = new SubmissionBot(this.accountPool);
      await this.submissionBot.initialize(getEnabledChains());
      spinner.text = 'Submission bot initialized...';

      // Initialize verification bot
      this.verificationBot = new VerificationBot(this.accountPool);
      await this.verificationBot.initialize(getEnabledChains());
      spinner.text = 'Verification bot initialized...';

      // Initialize campaign management
      this.campaignManager = new CampaignManager(
        this.walletManager,
        this.accountPool,
        this.contractScanner,
        this.targetPrioritizer,
        this.submissionBot,
        this.verificationBot
      );

      this.scheduler = new Scheduler(this.campaignManager, this.accountPool);
      spinner.text = 'Campaign manager initialized...';

      // Initialize dashboard (optional)
      if (process.env.ENABLE_DASHBOARD !== 'false') {
        this.dashboard = new Dashboard(
          this.campaignManager,
          this.accountPool,
          this.submissionBot,
          this.verificationBot,
          this.scheduler
        );
      }

      spinner.succeed('KaiSign Bot initialized successfully');

      // Log system status
      this.logSystemStatus();

    } catch (error) {
      spinner.fail('Failed to initialize KaiSign Bot');
      throw error;
    }
  }

  private validateEnvironment(): void {
    const required = [
      'KEYSTORE_PASSWORD',
      'SEPOLIA_RPC_URL',
      'KAISIGN_V1_ADDRESS',
      'REALITY_ETH_ADDRESS'
    ];

    for (const env of required) {
      if (!process.env[env]) {
        throw new Error(`Missing required environment variable: ${env}`);
      }
    }

    // Validate keystore directory exists
    const keystoreDir = process.env.KEYSTORE_DIR || './config/keystores';
    try {
      require('fs').accessSync(keystoreDir);
    } catch {
      throw new Error(`Keystore directory does not exist: ${keystoreDir}. Run setup-keystores first.`);
    }
  }

  private logSystemStatus(): void {
    const accounts = this.walletManager.getAllAccounts();
    const submitters = accounts.filter(a => a.role === 'submitter').length;
    const verifiers = accounts.filter(a => a.role === 'verifier').length;
    const challengers = accounts.filter(a => a.role === 'challenger').length;

    botLogger.submission('System initialized', {
      accounts: {
        total: accounts.length,
        submitters,
        verifiers,
        challengers
      },
      enabledChains: getEnabledChains().map(c => `${c.name} (${c.id})`),
      version: '1.0.0'
    });
  }

  async startDashboard(): Promise<void> {
    if (!this.dashboard) {
      throw new Error('Dashboard not initialized');
    }

    console.log(chalk.cyan('🖥️  Starting KaiSign Bot Dashboard...'));
    console.log(chalk.gray('Press h for help, q to quit\n'));

    this.dashboard.start();
  }

  async runDiscovery(): Promise<void> {
    console.log(chalk.cyan('🔍 Running contract discovery...'));

    const enabledChains = getEnabledChains();
    const allContracts: any[] = [];

    for (const chain of enabledChains) {
      const spinner = ora(`Scanning ${chain.name}...`).start();

      try {
        const result = await this.contractScanner.scanChain(chain.id, {
          maxContracts: 20,
          minTxCount: 5000
        });

        allContracts.push(...result.contracts);
        spinner.succeed(`${chain.name}: ${result.contracts.length} contracts found`);

      } catch (error) {
        spinner.fail(`${chain.name}: Scan failed - ${error.message}`);
      }
    }

    // Prioritize all discovered contracts
    const targets = await this.targetPrioritizer.prioritizeContracts(allContracts);

    console.log(chalk.green(`\n✅ Discovery complete: ${targets.length} priority targets identified`));
    
    // Show top 10 targets
    console.log(chalk.cyan('\n📊 Top Priority Targets:'));
    targets.slice(0, 10).forEach((target, index) => {
      console.log(`${index + 1}. ${target.contract.address} (Chain ${target.contract.chainId}) - Priority: ${target.submissionPriority}`);
    });
  }

  async createCampaign(configName: string = 'default'): Promise<void> {
    console.log(chalk.cyan(`🚀 Creating campaign: ${configName}`));

    // Load campaign configuration
    const config = this.loadCampaignConfig(configName);

    const campaign = await this.campaignManager.createCampaign(
      `Automated Campaign - ${new Date().toLocaleDateString()}`,
      config
    );

    console.log(chalk.green(`✅ Campaign created: ${campaign.id}`));

    // Start campaign
    await this.campaignManager.startCampaign(campaign.id);
    console.log(chalk.green(`🟢 Campaign started`));

    // Monitor progress
    this.monitorCampaign(campaign.id);
  }

  private loadCampaignConfig(configName: string): any {
    // Default configuration
    return {
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
  }

  private async monitorCampaign(campaignId: string): Promise<void> {
    console.log(chalk.yellow('📊 Monitoring campaign progress...'));

    const monitor = setInterval(() => {
      const campaign = this.campaignManager.getCampaign(campaignId);
      if (!campaign) {
        clearInterval(monitor);
        return;
      }

      if (campaign.status === 'completed' || campaign.status === 'failed') {
        clearInterval(monitor);
        const stats = this.campaignManager.getCampaignStats(campaignId);
        
        console.log(chalk.green('\n🏁 Campaign finished!'));
        console.log(`Status: ${campaign.status}`);
        console.log(`Duration: ${stats.duration}`);
        console.log(`Submissions: ${stats.submissionsAttempted}`);
        console.log(`Success Rate: ${stats.submissionSuccessRate.toFixed(1)}%`);
        console.log(`Budget Used: ${campaign.budgetUsed} ETH`);
        return;
      }

      // Show progress
      process.stdout.write(`\rCampaign: ${campaign.status} | Submissions: ${campaign.submissions.length} | Budget: ${campaign.budgetUsed} ETH`);
    }, 5000);
  }

  async setupSchedules(): Promise<void> {
    console.log(chalk.cyan('📅 Setting up default schedules...'));

    await this.scheduler.createDefaultSchedules();
    console.log(chalk.green('✅ Default schedules created'));

    const stats = this.scheduler.getSchedulerStats();
    console.log(`Active schedules: ${stats.activeSchedules}`);
  }
}

// CLI setup
program
  .name('kaisign-bot')
  .description('KaiSign ERC7730 Automation Bot')
  .version('1.0.0');

program
  .command('dashboard')
  .description('Start the monitoring dashboard')
  .action(async () => {
    const bot = new KaiSignBot();
    await bot.initialize();
    await bot.startDashboard();
  });

program
  .command('discover')
  .description('Run contract discovery')
  .action(async () => {
    const bot = new KaiSignBot();
    await bot.initialize();
    await bot.runDiscovery();
    process.exit(0);
  });

program
  .command('campaign')
  .description('Create and run a campaign')
  .option('-c, --config <name>', 'Campaign configuration', 'default')
  .action(async (options) => {
    const bot = new KaiSignBot();
    await bot.initialize();
    await bot.createCampaign(options.config);
  });

program
  .command('schedule')
  .description('Set up scheduled campaigns')
  .action(async () => {
    const bot = new KaiSignBot();
    await bot.initialize();
    await bot.setupSchedules();
    process.exit(0);
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const bot = new KaiSignBot();
    await bot.initialize();
    
    // Show account status
    const accounts = bot.walletManager.getAllAccounts();
    console.log(chalk.cyan('📊 Account Status:'));
    console.log(`Total accounts: ${accounts.length}`);
    console.log(`Submitters: ${accounts.filter(a => a.role === 'submitter').length}`);
    console.log(`Verifiers: ${accounts.filter(a => a.role === 'verifier').length}`);
    
    process.exit(0);
  });

// Default command (interactive mode)
program
  .action(async () => {
    console.log(chalk.cyan.bold('🤖 KaiSign Automation Bot\n'));
    
    const bot = new KaiSignBot();
    await bot.initialize();

    console.log(chalk.green('✅ Bot initialized successfully!'));
    console.log(chalk.yellow('\nAvailable commands:'));
    console.log('  dashboard  - Start monitoring dashboard');
    console.log('  discover   - Run contract discovery');
    console.log('  campaign   - Create and run campaign');
    console.log('  schedule   - Set up scheduled campaigns');
    console.log('  status     - Show system status');
    console.log(chalk.gray('\nRun with --help for more options'));
  });

// Handle errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Gracefully shutting down...'));
  process.exit(0);
});

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}