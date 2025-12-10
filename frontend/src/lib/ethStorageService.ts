import { ethers } from 'ethers';

// EthStorage stores blobs on Sepolia (chain 11155111) and syncs to EthStorage L2
const SEPOLIA_CHAIN_ID = 11155111;

// FlatDirectory contract for EthStorage on Sepolia (deployed via ethfs-cli)
const FLAT_DIRECTORY_CONTRACT = "0x2F3F5beF94424A8b2Da1Fbedbe049f344ED7Cc08";

// Blob storage related constants
const BLOB_MAX_SIZE = 131072; // 128KB max per EIP-4844

export interface EthStorageResult {
  success: boolean;
  txHash: string;
  blobVersionedHash: string;
  metadataHash: string; // Semantic hash of original content (before padding)
  key: string;
  ethStorageProofUrl: string;
  ethStorageExplorerUrl: string;
  blockNumber?: number;
  gasUsed?: string;
  blobGasUsed?: string;
  wasPadded?: boolean;
  error?: string;
}

export class EthStorageService {
  /**
   * Generate a deterministic key for the blob based on content hash
   */
  private generateBlobKey(content: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(content));
  }

  /**
   * Post JSON data as EIP-4844 blob via the backend API
   * The backend handles KZG proofs and blob transaction submission
   * Data is padded if needed to meet minimum blob size for cost efficiency
   */
  async postBlob(jsonData: any, _signer?: ethers.Signer): Promise<EthStorageResult> {
    try {
      // Prepare data - use compact JSON for the blob
      const jsonString = JSON.stringify(jsonData);
      const blobKey = this.generateBlobKey(jsonString);

      console.log(`Posting blob via API for ${jsonString.length} bytes of data`);

      // Call the backend API which handles KZG proofs and blob submission
      const response = await fetch('/api/blob/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ json: jsonString })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || result.error || 'Blob upload failed');
      }

      console.log(`Blob transaction confirmed: ${result.txHash}`);
      if (result.wasPadded) {
        console.log(`Data was padded from ${result.originalSize} to ${result.paddedSize} bytes`);
      }

      return {
        success: true,
        txHash: result.txHash,
        blobVersionedHash: result.blobVersionedHash,
        metadataHash: result.metadataHash, // Semantic hash (before padding)
        key: blobKey,
        ethStorageProofUrl: result.blobscanUrl,
        ethStorageExplorerUrl: result.etherscanUrl,
        blockNumber: result.blockNumber,
        wasPadded: result.wasPadded
      };

    } catch (error: any) {
      console.error('Blob posting error:', error);
      return {
        success: false,
        txHash: '',
        blobVersionedHash: '',
        metadataHash: '',
        key: '',
        ethStorageProofUrl: '',
        ethStorageExplorerUrl: '',
        error: error.message || String(error)
      };
    }
  }

  /**
   * Retrieve blob data from Blobscan API
   */
  async getBlob(blobHash: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Use Blobscan API to retrieve blob data
      const response = await fetch(`https://api.sepolia.blobscan.com/blobs/${blobHash}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blobData = await response.json();

      // Blobscan returns the blob data in the 'data' field
      if (blobData.data) {
        // Try to decode the blob data (remove padding marker if present)
        const PADDING_MARKER = "\n\n/* ERC7730_BLOB_PADDING_START */\n";
        let content = blobData.data;

        // Strip padding if present
        const paddingIndex = content.indexOf(PADDING_MARKER);
        if (paddingIndex !== -1) {
          content = content.substring(0, paddingIndex);
        }

        // Try to parse as JSON
        try {
          return { success: true, data: JSON.parse(content) };
        } catch {
          return { success: true, data: { raw: content } };
        }
      }

      return { success: false, error: 'No data in blob' };
    } catch (error: any) {
      console.error('Error retrieving blob:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Calculate metadata hash from JSON string
   */
  calculateMetadataHash(jsonString: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(jsonString));
  }

  /**
   * Create a viewable proof link on Blobscan
   */
  createProofLink(blobHash: string): string {
    return `https://sepolia.blobscan.com/blob/${blobHash}`;
  }

  /**
   * Create Etherscan explorer link for transaction
   */
  createExplorerLink(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  /**
   * Get network information for blob posting
   */
  async getNetworkInfo(): Promise<{ chainId: number; rpcUrl: string; explorerUrl: string }> {
    return {
      chainId: SEPOLIA_CHAIN_ID,
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      explorerUrl: "https://sepolia.etherscan.io"
    };
  }

  /**
   * Check if a blob exists via Blobscan
   */
  async blobExists(blobHash: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.sepolia.blobscan.com/blobs/${blobHash}`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Verify blob content matches expected metadata hash
   */
  async verifyBlob(blobHash: string, expectedMetadataHash: string): Promise<boolean> {
    try {
      const result = await this.getBlob(blobHash);
      if (!result.success || !result.data) {
        return false;
      }

      // Calculate hash of retrieved data
      const jsonString = JSON.stringify(result.data);
      const actualHash = ethers.keccak256(ethers.toUtf8Bytes(jsonString));

      return actualHash === expectedMetadataHash;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const ethStorageService = new EthStorageService();