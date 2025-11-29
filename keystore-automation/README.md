# KaiSign Automation Bot System

A comprehensive automation system for KaiSign ERC7730 specification submission and verification across multiple blockchain networks.

## Features

- 🔐 **Secure Keystore Management**: Encrypted wallet storage with role-based account pools
- 🔍 **Multi-Chain Discovery**: Automated contract scanning across Ethereum, Polygon, Arbitrum, Base, and more
- 🤖 **Automated Submission**: Full commit-reveal-submit workflow with EIP-4844 blob support
- ✅ **Verification Network**: Consensus-based verification with Reality.eth integration
- 📊 **Campaign Management**: Coordinated submission campaigns with economic optimization
- ⏰ **Scheduling**: Cron-based automated campaigns with performance optimization
- 🖥️ **Monitoring Dashboard**: Real-time terminal-based monitoring and control
- 🔧 **Failure Recovery**: Automatic retry logic and emergency safeguards

## Quick Start

### 1. Installation

```bash
cd keystore-automation
npm install
npm run build
```

### 2. Setup

First, set up your encrypted keystores and accounts:

```bash
npm run setup-keystores
```

This will guide you through:
- Creating encrypted wallet keystores
- Setting up submitter, verifier, and challenger accounts
- Configuring supported blockchain networks
- Generating environment configuration

### 3. Configuration

Edit the generated `.env` file with your API keys and settings:

```bash
# Update with your actual API keys
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_api_key

# Configure bot behavior
MAX_CONCURRENT_SUBMISSIONS=5
VERIFICATION_DELAY_MS=60000
```

### 4. Fund Accounts

Transfer ETH to your bot accounts for gas fees and bonds:

```bash
# Check account addresses
npm run status

# Fund accounts on your target networks
```

### 5. Run

Start the bot with monitoring dashboard:

```bash
npm run dashboard
```

Or run specific operations:

```bash
# Contract discovery
npm run discovery

# Single campaign
npm run campaign

# Set up scheduled campaigns
npm run schedule
```

## Architecture

### Core Components

- **Keystore Manager**: Secure encrypted storage for private keys
- **Account Pool**: Role-based account allocation and management
- **Contract Scanner**: Multi-chain contract discovery and analysis
- **Submission Bot**: Automated ERC7730 submission pipeline
- **Verification Bot**: Reality.eth verification and consensus building
- **Campaign Manager**: Coordinated multi-target operations
- **Scheduler**: Automated recurring campaigns
- **Dashboard**: Real-time monitoring and control

### Bot Account Types

- **Submitters**: Create and submit ERC7730 specifications
- **Verifiers**: Participate in Reality.eth verification process
- **Challengers**: Challenge invalid specifications
- **Monitors**: Track system performance and health

## Usage Examples

### Interactive Dashboard

```bash
npm run dashboard
```

Dashboard controls:
- `r` - Refresh data
- `p` - Pause active campaign
- `s` - Stop active campaign
- `q` - Quit

### Contract Discovery

Discover high-priority contracts for ERC7730 submission:

```bash
npm run discovery
```

### Campaign Management

Create a targeted submission campaign:

```bash
# Conservative strategy
npm run campaign -- --config conservative

# Aggressive strategy  
npm run campaign -- --config aggressive

# Custom configuration
npm run campaign -- --config custom
```

### Scheduled Operations

Set up recurring automated campaigns:

```bash
npm run schedule
```

Default schedules:
- Daily discovery and submission (9 AM UTC)
- Weekly comprehensive scan (Monday 6 AM UTC)
- High-frequency mainnet DeFi focus (every 6 hours)

## Configuration

### Campaign Templates

Located in `config/campaign-templates.json`:

```json
{
  "conservative": {
    "discoveryConfig": {
      "maxContractsPerChain": 10,
      "minTxCount": 10000,
      "includeUnverified": false,
      "targetTypes": ["defi", "erc20"]
    },
    "submissionConfig": {
      "maxConcurrent": 2,
      "bondStrategy": "minimal"
    },
    "riskLimits": {
      "emergencyStopLoss": "0.5"
    }
  }
}
```

### Risk Management

Built-in safeguards:
- Maximum bond amounts per submission
- Failure rate thresholds
- Emergency stop-loss limits
- Consecutive failure detection
- Account balance monitoring

## Security

### Private Key Management

- All private keys are encrypted with AES-256-GCM
- Master password required for key access
- Keys never stored in plaintext
- Role-based access control

### Best Practices

1. Use strong master passwords (>12 characters)
2. Regularly backup keystore directory
3. Monitor account balances
4. Set appropriate risk limits
5. Keep API keys secure

## API Integration

### Supported Networks

- Ethereum Mainnet
- Sepolia Testnet (primary)
- Polygon
- Arbitrum One
- Base
- Optimism

### External APIs

- Block explorer APIs for contract discovery
- RPC endpoints for blockchain interaction
- KaiSign V1 contract integration
- Reality.eth oracle integration
- EIP-4844 blob transaction support

## Economic Model

### Revenue Sources

- Bond recovery from successful submissions
- Verification rewards from Reality.eth
- Incentive pool participation
- Challenge rewards for detecting invalid specs

### Cost Structure

- Gas fees for transactions
- Bond amounts for submissions and verifications
- API usage costs
- Infrastructure costs

### Optimization

- Dynamic gas price optimization
- Bond amount strategies (minimal/optimal/aggressive)
- Multi-account coordination for gas efficiency
- Economic risk management

## Monitoring

### Dashboard Widgets

- **System Overview**: Active campaigns and key metrics
- **Account Pool**: Bot account status and availability  
- **Submissions**: Recent submission attempts and status
- **Verifications**: Verification activities and accuracy
- **Performance**: Success rates and revenue over time
- **Alerts**: System notifications and warnings
- **Logs**: Detailed activity logging

### Alerting

Automatic alerts for:
- Low account balances
- High failure rates
- Emergency stop conditions
- System errors
- Network issues

## Development

### Project Structure

```
src/
├── keystore/          # Encrypted wallet management
├── discovery/         # Contract scanning and prioritization
├── submission/        # Automated submission pipeline
├── verification/      # Reality.eth verification bots
├── orchestrator/      # Campaign and schedule management
├── monitoring/        # Dashboard and alerting
├── utils/            # Shared utilities and logging
└── config/           # Chain and system configuration
```

### Building

```bash
npm run build
npm run typecheck
npm run lint
```

### Testing

```bash
npm test
```

## Troubleshooting

### Common Issues

1. **"Keystore directory does not exist"**
   - Run `npm run setup-keystores` first

2. **"No available accounts"**
   - Check account pool status
   - Ensure accounts are funded
   - Verify keystore password

3. **"API rate limit exceeded"**
   - Add API keys to `.env`
   - Reduce discovery frequency
   - Use premium API tiers

4. **"Transaction failed"**
   - Check account ETH balance
   - Verify gas price settings
   - Check network congestion

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run dashboard
```

### Emergency Stop

Stop all active operations immediately:

```bash
pkill -f kaisign-bot
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

Apache 2.0 License - see LICENSE file for details.

## Disclaimer

This software is for educational and research purposes. Users are responsible for:
- Securing their private keys
- Managing financial risks
- Complying with applicable laws
- Understanding smart contract interactions

Use at your own risk. The developers are not responsible for any financial losses.