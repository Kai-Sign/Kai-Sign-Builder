import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export interface BotAccount {
  id: string;
  address: string;
  role: 'submitter' | 'verifier' | 'challenger' | 'monitor';
  chainIds: number[];
  maxBondEth: string;
  enabled: boolean;
  created: Date;
  lastUsed?: Date;
}

export interface EncryptedKeystore {
  id: string;
  address: string;
  role: string;
  encrypted: string;
  iv: string;
  salt: string;
  created: string;
  chainIds: number[];
  maxBondEth: string;
  enabled: boolean;
}

export class WalletManager {
  private keystoreDir: string;
  private password: string;
  private accounts: Map<string, BotAccount> = new Map();
  private wallets: Map<string, ethers.Wallet> = new Map();

  constructor(keystoreDir: string, password: string) {
    this.keystoreDir = keystoreDir;
    this.password = password;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.keystoreDir, { recursive: true });
      await this.loadAccounts();
      logger.info(`Initialized wallet manager with ${this.accounts.size} accounts`);
    } catch (error) {
      logger.error('Failed to initialize wallet manager:', error);
      throw error;
    }
  }

  async createAccount(
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainIds: number[] = [11155111], // Default to Sepolia
    maxBondEth: string = '0.1'
  ): Promise<BotAccount> {
    try {
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();
      const accountId = `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const account: BotAccount = {
        id: accountId,
        address: wallet.address,
        role,
        chainIds,
        maxBondEth,
        enabled: true,
        created: new Date()
      };

      // Encrypt and store private key
      await this.saveEncryptedWallet(account, wallet.privateKey);
      
      // Store account in memory
      this.accounts.set(accountId, account);
      this.wallets.set(accountId, wallet);

      logger.info(`Created new ${role} account: ${wallet.address}`);
      return account;
    } catch (error) {
      logger.error('Failed to create account:', error);
      throw error;
    }
  }

  async importAccount(
    privateKey: string,
    role: 'submitter' | 'verifier' | 'challenger' | 'monitor',
    chainIds: number[] = [11155111],
    maxBondEth: string = '0.1'
  ): Promise<BotAccount> {
    try {
      // Validate private key
      const wallet = new ethers.Wallet(privateKey);
      const accountId = `${role}-imported-${Date.now()}`;
      
      const account: BotAccount = {
        id: accountId,
        address: wallet.address,
        role,
        chainIds,
        maxBondEth,
        enabled: true,
        created: new Date()
      };

      // Encrypt and store private key
      await this.saveEncryptedWallet(account, privateKey);
      
      // Store account in memory
      this.accounts.set(accountId, account);
      this.wallets.set(accountId, wallet);

      logger.info(`Imported ${role} account: ${wallet.address}`);
      return account;
    } catch (error) {
      logger.error('Failed to import account:', error);
      throw error;
    }
  }

  async getWallet(accountId: string): Promise<ethers.Wallet | null> {
    if (this.wallets.has(accountId)) {
      return this.wallets.get(accountId)!;
    }

    // Try to load from keystore
    const account = this.accounts.get(accountId);
    if (!account) {
      return null;
    }

    try {
      const privateKey = await this.loadEncryptedWallet(accountId);
      const wallet = new ethers.Wallet(privateKey);
      this.wallets.set(accountId, wallet);
      
      // Update last used
      account.lastUsed = new Date();
      await this.updateAccount(account);
      
      return wallet;
    } catch (error) {
      logger.error(`Failed to load wallet ${accountId}:`, error);
      return null;
    }
  }

  async getAccountsByRole(role: 'submitter' | 'verifier' | 'challenger' | 'monitor'): Promise<BotAccount[]> {
    return Array.from(this.accounts.values()).filter(account => 
      account.role === role && account.enabled
    );
  }

  async getAccountsByChain(chainId: number): Promise<BotAccount[]> {
    return Array.from(this.accounts.values()).filter(account => 
      account.chainIds.includes(chainId) && account.enabled
    );
  }

  async updateAccount(account: BotAccount): Promise<void> {
    this.accounts.set(account.id, account);
    // Update metadata file
    await this.saveAccountMetadata();
  }

  async enableAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (account) {
      account.enabled = true;
      await this.updateAccount(account);
      logger.info(`Enabled account: ${accountId}`);
    }
  }

  async disableAccount(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (account) {
      account.enabled = false;
      await this.updateAccount(account);
      logger.info(`Disabled account: ${accountId}`);
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      // Remove files
      const keystorePath = path.join(this.keystoreDir, `${accountId}.json`);
      await fs.unlink(keystorePath).catch(() => {}); // Ignore if doesn't exist
      
      // Remove from memory
      this.accounts.delete(accountId);
      this.wallets.delete(accountId);
      
      await this.saveAccountMetadata();
      logger.info(`Deleted account: ${accountId}`);
    } catch (error) {
      logger.error(`Failed to delete account ${accountId}:`, error);
      throw error;
    }
  }

  getAllAccounts(): BotAccount[] {
    return Array.from(this.accounts.values());
  }

  private async saveEncryptedWallet(account: BotAccount, privateKey: string): Promise<void> {
    try {
      // Generate encryption parameters
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Derive key using PBKDF2
      const key = crypto.pbkdf2Sync(this.password, salt, 10000, 32, 'sha256');
      
      // Encrypt private key
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv.slice(0, 16));
      let encrypted = cipher.update(privateKey.replace('0x', ''), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const keystoreData: EncryptedKeystore = {
        id: account.id,
        address: account.address,
        role: account.role,
        encrypted: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        created: account.created.toISOString(),
        chainIds: account.chainIds,
        maxBondEth: account.maxBondEth,
        enabled: account.enabled
      };

      const keystorePath = path.join(this.keystoreDir, `${account.id}.json`);
      await fs.writeFile(keystorePath, JSON.stringify(keystoreData, null, 2));
      
      await this.saveAccountMetadata();
    } catch (error) {
      logger.error('Failed to save encrypted wallet:', error);
      throw error;
    }
  }

  private async loadEncryptedWallet(accountId: string): Promise<string> {
    try {
      const keystorePath = path.join(this.keystoreDir, `${accountId}.json`);
      const keystoreData: EncryptedKeystore = JSON.parse(
        await fs.readFile(keystorePath, 'utf8')
      );

      // Derive key using same parameters
      const salt = Buffer.from(keystoreData.salt, 'hex');
      const iv = Buffer.from(keystoreData.iv, 'hex');
      const key = crypto.pbkdf2Sync(this.password, salt, 10000, 32, 'sha256');
      
      // Decrypt private key
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv.slice(0, 16));
      
      let decrypted = decipher.update(keystoreData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return `0x${decrypted}`;
    } catch (error) {
      logger.error(`Failed to load encrypted wallet ${accountId}:`, error);
      throw error;
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      const metadataPath = path.join(this.keystoreDir, 'accounts.json');
      
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const accountsData: BotAccount[] = JSON.parse(metadataContent);
        
        for (const account of accountsData) {
          // Convert string dates back to Date objects
          account.created = new Date(account.created);
          if (account.lastUsed) {
            account.lastUsed = new Date(account.lastUsed);
          }
          
          this.accounts.set(account.id, account);
        }
        
        logger.info(`Loaded ${accountsData.length} accounts from keystore`);
      } catch (error) {
        // Metadata file doesn't exist yet, that's ok
        logger.info('No existing accounts found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load accounts:', error);
      throw error;
    }
  }

  private async saveAccountMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.keystoreDir, 'accounts.json');
      const accountsArray = Array.from(this.accounts.values());
      await fs.writeFile(metadataPath, JSON.stringify(accountsArray, null, 2));
    } catch (error) {
      logger.error('Failed to save account metadata:', error);
      throw error;
    }
  }
}