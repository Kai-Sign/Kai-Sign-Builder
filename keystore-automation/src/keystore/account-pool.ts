import { ethers } from 'ethers';
import { WalletManager, BotAccount } from './wallet-manager.js';
import { logger } from '../utils/logger.js';

export interface PooledAccount {
  account: BotAccount;
  wallet: ethers.Wallet;
  isInUse: boolean;
  lastUsed: Date;
  currentTask?: string;
}

export class AccountPool {
  private walletManager: WalletManager;
  private pools: Map<string, PooledAccount[]> = new Map(); // role -> accounts
  private inUseAccounts: Set<string> = new Set();

  constructor(walletManager: WalletManager) {
    this.walletManager = walletManager;
  }

  async initialize(): Promise<void> {
    await this.loadAccountPools();
    logger.info('Account pool initialized');
  }

  /**
   * Get an available account for a specific role and chain
   */
  async getAccount(
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainId: number,
    taskId?: string
  ): Promise<PooledAccount | null> {
    const poolKey = `${role}-${chainId}`;
    let pool = this.pools.get(poolKey);

    if (!pool || pool.length === 0) {
      // Try to populate pool
      await this.populatePool(role, chainId);
      pool = this.pools.get(poolKey);
      if (!pool || pool.length === 0) {
        logger.warn(`No accounts available for ${role} on chain ${chainId}`);
        return null;
      }
    }

    // Find available account
    const available = pool.find(account => !account.isInUse);
    if (!available) {
      logger.warn(`All ${role} accounts busy on chain ${chainId}`);
      return null;
    }

    // Mark as in use
    available.isInUse = true;
    available.lastUsed = new Date();
    available.currentTask = taskId;
    this.inUseAccounts.add(available.account.id);

    logger.debug(`Assigned ${role} account ${available.account.address} to task ${taskId}`);
    return available;
  }

  /**
   * Release an account back to the pool
   */
  async releaseAccount(accountId: string): Promise<void> {
    this.inUseAccounts.delete(accountId);

    // Find and release the account in all pools
    for (const pool of this.pools.values()) {
      const account = pool.find(acc => acc.account.id === accountId);
      if (account) {
        account.isInUse = false;
        account.currentTask = undefined;
        logger.debug(`Released account ${account.account.address}`);
        break;
      }
    }
  }

  /**
   * Get multiple accounts for batch operations
   */
  async getMultipleAccounts(
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainId: number,
    count: number,
    taskId?: string
  ): Promise<PooledAccount[]> {
    const accounts: PooledAccount[] = [];

    for (let i = 0; i < count; i++) {
      const account = await this.getAccount(role, chainId, taskId);
      if (account) {
        accounts.push(account);
      } else {
        // Release already allocated accounts if we can't get the full set
        for (const allocated of accounts) {
          await this.releaseAccount(allocated.account.id);
        }
        logger.warn(`Could only allocate ${accounts.length}/${count} ${role} accounts on chain ${chainId}`);
        return accounts;
      }
    }

    return accounts;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(role: 'submitter' | 'verifier' | 'challenger' | 'monitor', chainId?: number): {
    total: number;
    available: number;
    inUse: number;
    byChain?: Record<number, { total: number; available: number; inUse: number }>;
  } {
    if (chainId) {
      const poolKey = `${role}-${chainId}`;
      const pool = this.pools.get(poolKey) || [];
      const available = pool.filter(acc => !acc.isInUse).length;
      const inUse = pool.filter(acc => acc.isInUse).length;

      return {
        total: pool.length,
        available,
        inUse
      };
    }

    // Aggregate stats across all chains for this role
    let total = 0;
    let available = 0;
    let inUse = 0;
    const byChain: Record<number, { total: number; available: number; inUse: number }> = {};

    for (const [poolKey, pool] of this.pools.entries()) {
      if (poolKey.startsWith(`${role}-`)) {
        const chainId = parseInt(poolKey.split('-')[1]);
        const chainAvailable = pool.filter(acc => !acc.isInUse).length;
        const chainInUse = pool.filter(acc => acc.isInUse).length;

        total += pool.length;
        available += chainAvailable;
        inUse += chainInUse;

        byChain[chainId] = {
          total: pool.length,
          available: chainAvailable,
          inUse: chainInUse
        };
      }
    }

    return {
      total,
      available,
      inUse,
      byChain
    };
  }

  /**
   * Create additional accounts for a role/chain combination
   */
  async scalePool(
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainId: number,
    targetSize: number
  ): Promise<void> {
    const poolKey = `${role}-${chainId}`;
    const currentPool = this.pools.get(poolKey) || [];
    
    if (currentPool.length >= targetSize) {
      logger.info(`Pool ${poolKey} already has ${currentPool.length} accounts (target: ${targetSize})`);
      return;
    }

    const needed = targetSize - currentPool.length;
    logger.info(`Scaling pool ${poolKey} from ${currentPool.length} to ${targetSize} accounts`);

    for (let i = 0; i < needed; i++) {
      try {
        const account = await this.walletManager.createAccount(
          role,
          [chainId],
          this.getDefaultBondForRole(role)
        );
        
        const wallet = await this.walletManager.getWallet(account.id);
        if (wallet) {
          await this.addAccountToPool(account, wallet);
        }
      } catch (error) {
        logger.error(`Failed to create account ${i + 1}/${needed} for pool ${poolKey}:`, error);
      }
    }
  }

  /**
   * Remove inactive or problematic accounts from pools
   */
  async cleanupPools(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const [poolKey, pool] of this.pools.entries()) {
      const toRemove: PooledAccount[] = [];

      for (const account of pool) {
        // Remove if account is disabled or hasn't been used in a week
        if (!account.account.enabled || (account.lastUsed < cutoffTime && !account.isInUse)) {
          toRemove.push(account);
        }
      }

      for (const account of toRemove) {
        const index = pool.indexOf(account);
        if (index > -1) {
          pool.splice(index, 1);
          logger.info(`Removed inactive account ${account.account.address} from pool ${poolKey}`);
        }
      }
    }
  }

  private async loadAccountPools(): Promise<void> {
    const allAccounts = this.walletManager.getAllAccounts();

    for (const account of allAccounts) {
      if (!account.enabled) continue;

      const wallet = await this.walletManager.getWallet(account.id);
      if (wallet) {
        await this.addAccountToPool(account, wallet);
      }
    }
  }

  private async addAccountToPool(account: BotAccount, wallet: ethers.Wallet): Promise<void> {
    for (const chainId of account.chainIds) {
      const poolKey = `${account.role}-${chainId}`;
      
      if (!this.pools.has(poolKey)) {
        this.pools.set(poolKey, []);
      }

      const pool = this.pools.get(poolKey)!;
      
      // Check if account is already in pool
      const exists = pool.find(acc => acc.account.id === account.id);
      if (!exists) {
        pool.push({
          account,
          wallet,
          isInUse: false,
          lastUsed: account.lastUsed || account.created
        });
      }
    }
  }

  private async populatePool(
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainId: number
  ): Promise<void> {
    const accounts = await this.walletManager.getAccountsByRole(role);
    const relevantAccounts = accounts.filter(acc => 
      acc.chainIds.includes(chainId) && acc.enabled
    );

    for (const account of relevantAccounts) {
      const wallet = await this.walletManager.getWallet(account.id);
      if (wallet) {
        await this.addAccountToPool(account, wallet);
      }
    }
  }

  private getDefaultBondForRole(role: string): string {
    switch (role) {
      case 'submitter':
        return '0.05';
      case 'verifier':
        return '0.02';
      case 'challenger':
        return '0.03';
      case 'monitor':
        return '0.01';
      default:
        return '0.01';
    }
  }
}