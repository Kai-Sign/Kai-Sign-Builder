#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { WalletManager } from '../keystore/wallet-manager.js';
import { getEnabledChains } from '../config/chains.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SetupConfig {
  keystoreDir: string;
  password: string;
  accountCounts: {
    submitters: number;
    verifiers: number;
    challengers: number;
    monitors: number;
  };
  chains: number[];
  importKeys?: string[];
}

async function main() {
  console.log(chalk.cyan.bold('\n🔐 KaiSign Bot Keystore Setup\n'));

  program
    .name('setup-keystores')
    .description('Set up encrypted keystores for KaiSign automation bot')
    .option('-i, --interactive', 'Interactive setup mode', false)
    .option('-d, --keystore-dir <dir>', 'Keystore directory', './config/keystores')
    .option('-c, --config <file>', 'Configuration file')
    .parse();

  const options = program.opts();

  try {
    let config: SetupConfig;

    if (options.interactive) {
      config = await interactiveSetup(options.keystoreDir);
    } else if (options.config) {
      config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
    } else {
      config = await quickSetup(options.keystoreDir);
    }

    await createKeystores(config);
    await showCompletionSummary(config);

  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

async function interactiveSetup(defaultKeystoreDir: string): Promise<SetupConfig> {
  console.log(chalk.yellow('🔧 Interactive Setup Mode\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'keystoreDir',
      message: 'Keystore directory:',
      default: defaultKeystoreDir,
      validate: (input: string) => input.length > 0 || 'Directory path required'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Master password for keystores:',
      mask: '*',
      validate: (input: string) => input.length >= 12 || 'Password must be at least 12 characters'
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: 'Confirm master password:',
      mask: '*',
      validate: (input: string, answers: any) => 
        input === answers.password || 'Passwords do not match'
    },
    {
      type: 'number',
      name: 'submitters',
      message: 'Number of submitter accounts:',
      default: 3,
      validate: (input: number) => input > 0 && input <= 10 || 'Must be between 1 and 10'
    },
    {
      type: 'number',
      name: 'verifiers',
      message: 'Number of verifier accounts:',
      default: 5,
      validate: (input: number) => input > 0 && input <= 20 || 'Must be between 1 and 20'
    },
    {
      type: 'number',
      name: 'challengers',
      message: 'Number of challenger accounts:',
      default: 2,
      validate: (input: number) => input >= 0 && input <= 5 || 'Must be between 0 and 5'
    },
    {
      type: 'number',
      name: 'monitors',
      message: 'Number of monitor accounts:',
      default: 1,
      validate: (input: number) => input >= 0 && input <= 3 || 'Must be between 0 and 3'
    },
    {
      type: 'checkbox',
      name: 'chains',
      message: 'Select chains to support:',
      choices: getEnabledChains().map(chain => ({
        name: `${chain.name} (${chain.id})`,
        value: chain.id,
        checked: true
      }))
    },
    {
      type: 'confirm',
      name: 'importExisting',
      message: 'Do you want to import existing private keys?',
      default: false
    }
  ]);

  let importKeys: string[] = [];

  if (answers.importExisting) {
    console.log(chalk.yellow('\n📥 Import Existing Keys\n'));
    
    while (true) {
      const keyAnswer = await inquirer.prompt([
        {
          type: 'password',
          name: 'privateKey',
          message: 'Private key (0x... format, or press Enter to finish):',
          mask: '*',
          validate: (input: string) => {
            if (input === '') return true; // Allow empty to finish
            return input.match(/^0x[a-fA-F0-9]{64}$/) || 'Invalid private key format';
          }
        }
      ]);

      if (keyAnswer.privateKey === '') break;
      importKeys.push(keyAnswer.privateKey);
      console.log(chalk.green(`✓ Key ${importKeys.length} added`));
    }
  }

  return {
    keystoreDir: answers.keystoreDir,
    password: answers.password,
    accountCounts: {
      submitters: answers.submitters,
      verifiers: answers.verifiers,
      challengers: answers.challengers,
      monitors: answers.monitors
    },
    chains: answers.chains,
    importKeys: importKeys.length > 0 ? importKeys : undefined
  };
}

async function quickSetup(keystoreDir: string): Promise<SetupConfig> {
  console.log(chalk.yellow('⚡ Quick Setup Mode\n'));

  const password = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: 'Master password for keystores:',
      mask: '*',
      validate: (input: string) => input.length >= 12 || 'Password must be at least 12 characters'
    }
  ]);

  return {
    keystoreDir,
    password: password.password,
    accountCounts: {
      submitters: 3,
      verifiers: 5,
      challengers: 2,
      monitors: 1
    },
    chains: [11155111], // Sepolia testnet only for quick setup
    importKeys: undefined
  };
}

async function createKeystores(config: SetupConfig): Promise<void> {
  const spinner = ora('Setting up keystores...').start();

  try {
    // Create keystore directory
    await fs.promises.mkdir(config.keystoreDir, { recursive: true });

    // Initialize wallet manager
    const walletManager = new WalletManager(config.keystoreDir, config.password);
    await walletManager.initialize();

    spinner.text = 'Creating accounts...';

    let totalAccounts = 0;
    let importedAccounts = 0;

    // Import existing keys first
    if (config.importKeys) {
      for (const privateKey of config.importKeys) {
        try {
          const role = importedAccounts < config.accountCounts.submitters ? 'submitter' :
                      importedAccounts < config.accountCounts.submitters + config.accountCounts.verifiers ? 'verifier' :
                      importedAccounts < config.accountCounts.submitters + config.accountCounts.verifiers + config.accountCounts.challengers ? 'challenger' : 'monitor';
          
          await walletManager.importAccount(privateKey, role, config.chains, '0.1');
          importedAccounts++;
          totalAccounts++;
          
          spinner.text = `Imported ${importedAccounts} accounts...`;
        } catch (error) {
          console.warn(chalk.yellow(`⚠️  Failed to import key ${importedAccounts + 1}: ${error.message}`));
        }
      }
    }

    // Create submitter accounts
    const submitterCount = Math.max(0, config.accountCounts.submitters - (importedAccounts > config.accountCounts.submitters ? config.accountCounts.submitters : importedAccounts));
    for (let i = 0; i < submitterCount; i++) {
      await walletManager.createAccount('submitter', config.chains, '0.1');
      totalAccounts++;
      spinner.text = `Created ${totalAccounts} accounts...`;
    }

    // Create verifier accounts
    const verifierCount = Math.max(0, config.accountCounts.verifiers - Math.max(0, importedAccounts - config.accountCounts.submitters));
    for (let i = 0; i < verifierCount; i++) {
      await walletManager.createAccount('verifier', config.chains, '0.05');
      totalAccounts++;
      spinner.text = `Created ${totalAccounts} accounts...`;
    }

    // Create challenger accounts
    for (let i = 0; i < config.accountCounts.challengers; i++) {
      await walletManager.createAccount('challenger', config.chains, '0.03');
      totalAccounts++;
      spinner.text = `Created ${totalAccounts} accounts...`;
    }

    // Create monitor accounts
    for (let i = 0; i < config.accountCounts.monitors; i++) {
      await walletManager.createAccount('monitor', config.chains, '0.01');
      totalAccounts++;
      spinner.text = `Created ${totalAccounts} accounts...`;
    }

    spinner.succeed(`✓ Created ${totalAccounts} accounts (${importedAccounts} imported, ${totalAccounts - importedAccounts} generated)`);

    // Create environment file template
    await createEnvTemplate(config);

    // Create configuration files
    await createConfigFiles(config);

  } catch (error) {
    spinner.fail('Failed to create keystores');
    throw error;
  }
}

async function createEnvTemplate(config: SetupConfig): Promise<void> {
  const envContent = `# KaiSign Bot Configuration
# Generated on ${new Date().toISOString()}

# Keystore Configuration
KEYSTORE_PASSWORD=${config.password}
KEYSTORE_DIR=${config.keystoreDir}

# RPC Endpoints (Add your API keys)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# KaiSign Contract Addresses
KAISIGN_V1_ADDRESS=0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719
REALITY_ETH_ADDRESS=0x5b7dD1E86623dDB25ff312e17C5c51f9ee4C1555

# Bot Configuration
MAX_CONCURRENT_SUBMISSIONS=5
SUBMISSION_DELAY_MS=30000
VERIFICATION_DELAY_MS=60000
MAX_BOND_AMOUNT_ETH=0.1
MIN_BOND_AMOUNT_ETH=0.01

# Gas Configuration
MAX_GAS_PRICE_GWEI=50
MAX_PRIORITY_FEE_GWEI=5

# API Keys for contract discovery (Add your keys)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_API_KEY
ARBISCAN_API_KEY=YOUR_ARBISCAN_API_KEY
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY

# Monitoring (Optional)
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
`;

  const envPath = path.join(process.cwd(), '.env');
  await fs.promises.writeFile(envPath, envContent);
}

async function createConfigFiles(config: SetupConfig): Promise<void> {
  const configDir = path.join(config.keystoreDir, '..');
  await fs.promises.mkdir(configDir, { recursive: true });

  // Campaign templates
  const campaignTemplates = {
    conservative: {
      discoveryConfig: {
        maxContractsPerChain: 10,
        minTxCount: 10000,
        includeUnverified: false,
        targetTypes: ['defi', 'erc20']
      },
      submissionConfig: {
        maxConcurrent: 2,
        delayBetweenSubmissions: 60000,
        retryAttempts: 3,
        bondStrategy: 'minimal'
      },
      verificationConfig: {
        participationRate: 0.7,
        confidenceThreshold: 0.8,
        maxBotsPerVerification: 2,
        enableChallenger: true
      },
      riskLimits: {
        maxBondPerHour: '0.1',
        maxFailureRate: 0.2,
        stopOnConsecutiveFailures: 2,
        emergencyStopLoss: '0.5'
      }
    },
    aggressive: {
      discoveryConfig: {
        maxContractsPerChain: 50,
        minTxCount: 1000,
        includeUnverified: true,
        targetTypes: ['defi', 'erc20', 'governance', 'erc721']
      },
      submissionConfig: {
        maxConcurrent: 5,
        delayBetweenSubmissions: 15000,
        retryAttempts: 2,
        bondStrategy: 'aggressive'
      },
      verificationConfig: {
        participationRate: 0.9,
        confidenceThreshold: 0.6,
        maxBotsPerVerification: 3,
        enableChallenger: true
      },
      riskLimits: {
        maxBondPerHour: '1.0',
        maxFailureRate: 0.4,
        stopOnConsecutiveFailures: 5,
        emergencyStopLoss: '2.0'
      }
    }
  };

  const templatesPath = path.join(configDir, 'campaign-templates.json');
  await fs.promises.writeFile(templatesPath, JSON.stringify(campaignTemplates, null, 2));

  // Chain configuration
  const chainConfig = {
    enabledChains: config.chains,
    defaultChain: config.chains[0],
    preferences: {
      prioritizeMainnet: false,
      preferL2: true,
      avoidTestnets: false
    }
  };

  const chainConfigPath = path.join(configDir, 'chain-config.json');
  await fs.promises.writeFile(chainConfigPath, JSON.stringify(chainConfig, null, 2));
}

async function showCompletionSummary(config: SetupConfig): Promise<void> {
  const walletManager = new WalletManager(config.keystoreDir, config.password);
  await walletManager.initialize();
  
  const accounts = walletManager.getAllAccounts();
  const byRole = {
    submitter: accounts.filter(a => a.role === 'submitter').length,
    verifier: accounts.filter(a => a.role === 'verifier').length,
    challenger: accounts.filter(a => a.role === 'challenger').length,
    monitor: accounts.filter(a => a.role === 'monitor').length
  };

  console.log(chalk.green.bold('\n✅ Keystore Setup Complete!\n'));
  
  console.log(chalk.cyan('📊 Account Summary:'));
  console.log(`  Submitters:  ${chalk.yellow(byRole.submitter)}`);
  console.log(`  Verifiers:   ${chalk.yellow(byRole.verifier)}`);
  console.log(`  Challengers: ${chalk.yellow(byRole.challenger)}`);
  console.log(`  Monitors:    ${chalk.yellow(byRole.monitor)}`);
  console.log(`  Total:       ${chalk.yellow(accounts.length)}`);

  console.log(chalk.cyan('\n🔗 Supported Chains:'));
  for (const chainId of config.chains) {
    const chainName = getChainName(chainId);
    console.log(`  ${chainName} (${chainId})`);
  }

  console.log(chalk.cyan('\n📁 Files Created:'));
  console.log(`  Keystores:   ${chalk.gray(config.keystoreDir)}`);
  console.log(`  Environment: ${chalk.gray('.env')}`);
  console.log(`  Templates:   ${chalk.gray('config/campaign-templates.json')}`);
  console.log(`  Chain Config: ${chalk.gray('config/chain-config.json')}`);

  console.log(chalk.yellow('\n⚠️  Security Reminders:'));
  console.log('  1. Keep your master password secure');
  console.log('  2. Back up your keystore directory');
  console.log('  3. Never commit .env or keystore files to version control');
  console.log('  4. Fund accounts with sufficient ETH before starting bot');

  console.log(chalk.cyan('\n🚀 Next Steps:'));
  console.log('  1. Update .env file with your API keys');
  console.log('  2. Fund bot accounts with ETH');
  console.log('  3. Run: npm run dev to start the bot');
  console.log('  4. Run: npm run monitor to open the dashboard');

  console.log(chalk.green('\n🎉 Your KaiSign automation bot is ready!'));
}

function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    42161: 'Arbitrum One',
    8453: 'Base',
    10: 'Optimism'
  };
  
  return chains[chainId] || `Chain ${chainId}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}