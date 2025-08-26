import { ethers } from "ethers";

export interface BlobValidationResult {
  isValid: boolean;
  exists: boolean;
  error?: string;
  blobData?: {
    txHash: string;
    blockNumber: number;
    blobIndex: number;
    etherscanUrl: string;
  };
}

export class BlobValidationService {
  private provider: ethers.JsonRpcProvider | ethers.BrowserProvider | null = null;

  constructor(rpcUrl?: string) {
    if (rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    } else if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.provider = new ethers.BrowserProvider((window as any).ethereum);
    }
  }

  /**
   * Validates blob hash format and checks if it exists on-chain
   */
  async validateBlobHash(blobHash: string): Promise<BlobValidationResult> {
    try {
      // Step 1: Basic format validation
      const formatValidation = this.validateBlobHashFormat(blobHash);
      if (!formatValidation.isValid) {
        return formatValidation;
      }

      // Step 2: Check if blob exists on-chain
      const existenceCheck = await this.checkBlobExists(blobHash);
      if (!existenceCheck.exists) {
        return {
          isValid: false,
          exists: false,
          error: `Blob hash ${blobHash} does not exist on-chain. This could be because:
1. The blob was never posted to the blockchain
2. The blob hash is incorrect
3. The blob transaction failed or was reverted
4. You're checking on the wrong network (should be Sepolia)`
        };
      }

      return {
        isValid: true,
        exists: true,
        blobData: existenceCheck.blobData
      };

    } catch (error) {
      console.error('Blob validation error:', error);
      return {
        isValid: false,
        exists: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validates the basic format of a blob hash
   */
  private validateBlobHashFormat(blobHash: string): BlobValidationResult {
    // Check if it's a string
    if (typeof blobHash !== 'string') {
      return {
        isValid: false,
        exists: false,
        error: 'Blob hash must be a string'
      };
    }

    // Check if it starts with 0x01 (EIP-4844 blob version)
    if (!blobHash.startsWith('0x01')) {
      return {
        isValid: false,
        exists: false,
        error: 'Blob hash must start with 0x01 (EIP-4844 blob version)'
      };
    }

    // Check if it's exactly 68 characters (0x01 + 64 hex chars)
    if (blobHash.length !== 68) {
      return {
        isValid: false,
        exists: false,
        error: `Blob hash must be exactly 68 characters (got ${blobHash.length}). Expected format: 0x01 + 64 hex characters`
      };
    }

    // Check if it contains only valid hex characters
    const hexRegex = /^0x01[a-fA-F0-9]{64}$/;
    if (!hexRegex.test(blobHash)) {
      // Find the first invalid character for better error reporting
      const afterPrefix = blobHash.substring(4); // Remove "0x01"
      let invalidChar = '';
      let invalidPos = -1;
      
      for (let i = 0; i < afterPrefix.length; i++) {
        const char = afterPrefix[i];
        if (!/[0-9a-fA-F]/.test(char)) {
          invalidChar = char;
          invalidPos = i + 4; // +4 to account for "0x01" prefix
          break;
        }
      }
      
      const errorMessage = invalidChar 
        ? `Invalid character '${invalidChar}' at position ${invalidPos}. Only hex characters (0-9, a-f, A-F) are allowed after 0x01`
        : 'Blob hash contains invalid characters. Only hex characters (0-9, a-f, A-F) are allowed after 0x01';
      
      return {
        isValid: false,
        exists: false,
        error: errorMessage
      };
    }

    // Check for common invalid patterns
    if (blobHash === '0x010000000000000000000000000000000000000000000000000000000000000000') {
      return {
        isValid: false,
        exists: false,
        error: 'This is a zero blob hash which is invalid. Blob hashes cannot be all zeros.'
      };
    }

    // Check for the specific invalid example mentioned
    if (blobHash === '0x0100000000000') {
      return {
        isValid: false,
        exists: false,
        error: 'This blob hash is too short and invalid. Valid blob hashes must be 66 characters long starting with 0x01.'
      };
    }

    return {
      isValid: true,
      exists: false // Will be checked in next step
    };
  }

  /**
   * Checks if a blob hash actually exists on the blockchain
   */
  private async checkBlobExists(blobHash: string): Promise<{ exists: boolean; blobData?: any }> {
    if (!this.provider) {
      throw new Error('No provider available for blockchain queries');
    }

    try {
      // Method 1: Try to get blob data using eth_getBlobByHash (if supported)
      try {
        const blobData = await this.provider.send('eth_getBlobByHash', [blobHash]);
        if (blobData && blobData !== '0x') {
          return {
            exists: true,
            blobData: {
              txHash: 'Unknown',
              blockNumber: 0,
              blobIndex: 0,
              etherscanUrl: `https://sepolia.etherscan.io/blob/${blobHash}`
            }
          };
        }
      } catch (blobError) {
        // eth_getBlobByHash might not be supported by all RPCs
        console.log('eth_getBlobByHash not supported, trying alternative methods');
      }

      // Method 2: Search for blob transactions in recent blocks
      const currentBlock = await this.provider.getBlockNumber();
      const searchBlocks = Math.min(1000, currentBlock); // Search last 1000 blocks
      
      for (let i = 0; i < searchBlocks; i += 10) { // Check every 10th block for efficiency
        const blockNumber = currentBlock - i;
        try {
          const block = await this.provider.getBlock(blockNumber, true);
          if (!block || !block.transactions) continue;

          for (const tx of block.transactions) {
            if (tx && typeof tx === 'object' && 'type' in tx && tx.type === 3 && 'blobVersionedHashes' in tx && tx.blobVersionedHashes) {
              const blobHashes = tx.blobVersionedHashes as string[];
              for (let j = 0; j < blobHashes.length; j++) {
                if (blobHashes[j]?.toLowerCase() === blobHash.toLowerCase()) {
                  return {
                    exists: true,
                    blobData: {
                      txHash: (tx as any).hash || 'Unknown',
                      blockNumber: blockNumber,
                      blobIndex: j,
                      etherscanUrl: `https://sepolia.etherscan.io/blob/${blobHash}`
                    }
                  };
                }
              }
            }
          }
        } catch (blockError) {
          // Skip blocks that can't be fetched
          continue;
        }
      }

      // Method 3: Try to get transaction receipt by searching for blob events
      // This is a fallback method that might work on some RPCs
      try {
        const filter = {
          fromBlock: currentBlock - 1000,
          toBlock: 'latest',
          topics: [
            '0x' + ethers.keccak256(ethers.toUtf8Bytes('LogRevealSpec(address,bytes32,bytes32,bytes32,address,uint256)')).slice(2, 10)
          ]
        };

        const logs = await this.provider.getLogs(filter);
        for (const log of logs) {
          if (log.topics && log.topics.length >= 3) {
            const logBlobHash = log.topics[2]; // blobHash is the third topic
            if (logBlobHash.toLowerCase() === blobHash.toLowerCase()) {
              return {
                exists: true,
                blobData: {
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                  blobIndex: 0,
                  etherscanUrl: `https://sepolia.etherscan.io/blob/${blobHash}`
                }
              };
            }
          }
        }
      } catch (logError) {
        console.log('Log search failed:', logError);
      }

      return { exists: false };

    } catch (error) {
      console.error('Error checking blob existence:', error);
      throw new Error(`Failed to check blob existence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates multiple blob hashes at once
   */
  async validateMultipleBlobHashes(blobHashes: string[]): Promise<Map<string, BlobValidationResult>> {
    const results = new Map<string, BlobValidationResult>();
    
    for (const blobHash of blobHashes) {
      const result = await this.validateBlobHash(blobHash);
      results.set(blobHash, result);
    }
    
    return results;
  }

  /**
   * Gets blob data from Etherscan API (alternative method)
   */
  async getBlobDataFromEtherscan(blobHash: string): Promise<any> {
    try {
      const response = await fetch(`https://api-sepolia.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${blobHash}`);
      const data = await response.json();
      
      if (data.result && data.result.blobVersionedHashes) {
        return {
          exists: true,
          blobData: {
            txHash: data.result.hash,
            blockNumber: parseInt(data.result.blockNumber, 16),
            blobIndex: 0,
            etherscanUrl: `https://sepolia.etherscan.io/blob/${blobHash}`
          }
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.error('Etherscan API error:', error);
      return { exists: false };
    }
  }
}

// Export singleton instance
export const blobValidationService = new BlobValidationService();
