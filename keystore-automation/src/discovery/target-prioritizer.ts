import { ContractInfo } from './contract-scanner.js';
import { botLogger } from '../utils/logger.js';

export interface TargetContract {
  contract: ContractInfo;
  submissionPriority: number;
  expectedReward: string; // Estimated ETH reward
  riskScore: number; // 1-10, lower is safer
  submissionDeadline?: Date;
  targetBond: string; // ETH amount for optimal bond
  hasCompetition: boolean;
  notes?: string;
}

export interface PrioritizationConfig {
  maxTargets: number;
  minTxCount: number;
  minPriority: number;
  maxRiskScore: number;
  preferredChains: number[];
  excludeUnverified: boolean;
  minExpectedRewardEth: number;
}

export class TargetPrioritizer {
  private config: PrioritizationConfig;

  constructor(config: Partial<PrioritizationConfig> = {}) {
    this.config = {
      maxTargets: 50,
      minTxCount: 1000,
      minPriority: 5,
      maxRiskScore: 7,
      preferredChains: [1, 137, 42161, 8453], // Mainnet, Polygon, Arbitrum, Base
      excludeUnverified: false,
      minExpectedRewardEth: 0.005,
      ...config
    };
  }

  /**
   * Prioritize contracts for submission based on various factors
   */
  async prioritizeContracts(contracts: ContractInfo[]): Promise<TargetContract[]> {
    botLogger.discovery(`Prioritizing ${contracts.length} contracts`);

    // Filter contracts based on basic criteria
    const filtered = this.filterContracts(contracts);
    botLogger.discovery(`${filtered.length} contracts after filtering`);

    // Convert to target contracts with enhanced scoring
    const targets = await Promise.all(
      filtered.map(contract => this.analyzeContract(contract))
    );

    // Sort by submission priority (descending)
    targets.sort((a, b) => b.submissionPriority - a.submissionPriority);

    // Limit to max targets
    const finalTargets = targets.slice(0, this.config.maxTargets);

    botLogger.discovery(`Selected ${finalTargets.length} priority targets for submission`);
    this.logTargetSummary(finalTargets);

    return finalTargets;
  }

  /**
   * Get targets for a specific chain
   */
  async getChainTargets(contracts: ContractInfo[], chainId: number): Promise<TargetContract[]> {
    const chainContracts = contracts.filter(c => c.chainId === chainId);
    return this.prioritizeContracts(chainContracts);
  }

  /**
   * Update target priority based on market conditions or competition
   */
  async updateTargetPriority(target: TargetContract, factors: {
    newCompetition?: boolean;
    marketVolatility?: number;
    networkCongestion?: number;
  }): Promise<TargetContract> {
    let newPriority = target.submissionPriority;

    // Adjust for new competition
    if (factors.newCompetition) {
      newPriority *= 0.7; // Reduce priority if competition appears
      target.hasCompetition = true;
    }

    // Adjust for network conditions
    if (factors.networkCongestion && factors.networkCongestion > 0.8) {
      newPriority *= 0.9; // Slightly reduce priority during congestion
    }

    // Adjust for market volatility (affects bond costs)
    if (factors.marketVolatility && factors.marketVolatility > 0.5) {
      target.riskScore = Math.min(10, target.riskScore + 1);
    }

    target.submissionPriority = Math.max(1, newPriority);
    return target;
  }

  /**
   * Calculate optimal bond amount for a contract
   */
  calculateOptimalBond(contract: ContractInfo): string {
    let baseBond = 0.01; // Minimum bond

    // Increase bond based on contract importance
    if (contract.priority >= 8) baseBond = 0.05;
    else if (contract.priority >= 6) baseBond = 0.03;
    else if (contract.priority >= 4) baseBond = 0.02;

    // Increase bond for high-value DeFi contracts
    if (contract.contractType === 'defi' && contract.txCount > 50000) {
      baseBond *= 1.5;
    }

    // Chain-specific adjustments
    switch (contract.chainId) {
      case 1: // Ethereum - higher costs
        baseBond *= 2;
        break;
      case 137: // Polygon - lower costs
        baseBond *= 0.3;
        break;
      case 42161: // Arbitrum - moderate costs
      case 8453: // Base - moderate costs
        baseBond *= 0.5;
        break;
    }

    return baseBond.toFixed(4);
  }

  private filterContracts(contracts: ContractInfo[]): ContractInfo[] {
    return contracts.filter(contract => {
      // Basic transaction count filter
      if (contract.txCount < this.config.minTxCount) return false;

      // Priority filter
      if (contract.priority < this.config.minPriority) return false;

      // Chain preference filter
      if (this.config.preferredChains.length > 0 && 
          !this.config.preferredChains.includes(contract.chainId)) return false;

      // Verification filter
      if (this.config.excludeUnverified && !contract.isVerified) return false;

      // Skip if already has ERC7730
      if (contract.hasErc7730) return false;

      return true;
    });
  }

  private async analyzeContract(contract: ContractInfo): Promise<TargetContract> {
    // Calculate submission priority (1-100)
    const submissionPriority = this.calculateSubmissionPriority(contract);
    
    // Estimate expected reward
    const expectedReward = this.estimateReward(contract);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(contract);
    
    // Determine optimal bond
    const targetBond = this.calculateOptimalBond(contract);
    
    // Check for existing competition (simplified)
    const hasCompetition = await this.checkCompetition(contract);

    return {
      contract,
      submissionPriority,
      expectedReward,
      riskScore,
      targetBond,
      hasCompetition,
      notes: this.generateNotes(contract)
    };
  }

  private calculateSubmissionPriority(contract: ContractInfo): number {
    let priority = 0;

    // Base priority from contract importance (0-30)
    priority += contract.priority * 3;

    // Transaction volume factor (0-25)
    if (contract.txCount > 1000000) priority += 25;
    else if (contract.txCount > 100000) priority += 20;
    else if (contract.txCount > 10000) priority += 15;
    else if (contract.txCount > 1000) priority += 10;

    // Contract type bonus (0-20)
    switch (contract.contractType) {
      case 'defi':
        priority += 20;
        break;
      case 'erc20':
        priority += 15;
        break;
      case 'governance':
        priority += 12;
        break;
      case 'erc721':
        priority += 8;
        break;
      default:
        priority += 5;
    }

    // Verification bonus (0-10)
    if (contract.isVerified) priority += 10;

    // Chain preference bonus (0-15)
    if (this.config.preferredChains.includes(contract.chainId)) priority += 15;
    if (contract.chainId === 1) priority += 5; // Ethereum mainnet bonus

    // Recent activity bonus (0-10)
    const daysSinceActivity = Math.floor(
      (Date.now() - contract.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceActivity <= 1) priority += 10;
    else if (daysSinceActivity <= 7) priority += 5;
    else if (daysSinceActivity <= 30) priority += 2;

    return Math.min(100, priority);
  }

  private estimateReward(contract: ContractInfo): string {
    let baseReward = 0.01; // Base reward in ETH

    // Scale with transaction volume
    const txMultiplier = Math.min(5, contract.txCount / 100000);
    baseReward *= txMultiplier;

    // Contract type multiplier
    switch (contract.contractType) {
      case 'defi':
        baseReward *= 2.5;
        break;
      case 'erc20':
        baseReward *= 1.5;
        break;
      case 'governance':
        baseReward *= 1.3;
        break;
    }

    // Chain multiplier (based on typical bond amounts)
    switch (contract.chainId) {
      case 1: // Ethereum
        baseReward *= 3;
        break;
      case 137: // Polygon
        baseReward *= 0.5;
        break;
      case 42161: // Arbitrum
      case 8453: // Base
        baseReward *= 0.8;
        break;
    }

    return baseReward.toFixed(4);
  }

  private calculateRiskScore(contract: ContractInfo): number {
    let riskScore = 5; // Base risk

    // Unverified contract risk
    if (!contract.isVerified) riskScore += 2;

    // Low activity risk
    if (contract.txCount < 10000) riskScore += 1;

    // New contract risk (less than 30 days old)
    const contractAge = Date.now() - contract.discoveredAt.getTime();
    if (contractAge < 30 * 24 * 60 * 60 * 1000) riskScore += 1;

    // Chain risk (some chains are more volatile)
    switch (contract.chainId) {
      case 1: // Ethereum - lower risk
        riskScore -= 1;
        break;
      case 11155111: // Sepolia testnet - higher risk
        riskScore += 3;
        break;
    }

    // Contract type risk
    switch (contract.contractType) {
      case 'defi':
        riskScore += 1; // DeFi can be complex
        break;
      case 'other':
        riskScore += 2; // Unknown functionality
        break;
    }

    return Math.max(1, Math.min(10, riskScore));
  }

  private async checkCompetition(contract: ContractInfo): Promise<boolean> {
    // TODO: Implement actual competition checking
    // This would involve querying KaiSign to see if other submissions are pending
    return false;
  }

  private generateNotes(contract: ContractInfo): string {
    const notes: string[] = [];

    if (contract.contractType === 'defi') {
      notes.push('High-value DeFi protocol');
    }

    if (contract.txCount > 1000000) {
      notes.push('Very active contract');
    }

    if (!contract.isVerified) {
      notes.push('Unverified contract - higher risk');
    }

    if (contract.chainId === 11155111) {
      notes.push('Testnet deployment');
    }

    return notes.join(', ');
  }

  private logTargetSummary(targets: TargetContract[]): void {
    const summary = {
      totalTargets: targets.length,
      byChain: {} as Record<number, number>,
      byType: {} as Record<string, number>,
      totalExpectedReward: 0,
      avgRiskScore: 0
    };

    for (const target of targets) {
      const chainId = target.contract.chainId;
      const contractType = target.contract.contractType;

      summary.byChain[chainId] = (summary.byChain[chainId] || 0) + 1;
      summary.byType[contractType] = (summary.byType[contractType] || 0) + 1;
      summary.totalExpectedReward += parseFloat(target.expectedReward);
      summary.avgRiskScore += target.riskScore;
    }

    summary.avgRiskScore = summary.avgRiskScore / targets.length;

    botLogger.discovery('Target prioritization summary', summary);
  }
}