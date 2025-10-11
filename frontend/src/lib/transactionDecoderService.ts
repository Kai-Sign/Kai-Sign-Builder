// Simple frontend service that calls the API

export interface DecodedTransactionResult {
  txHash: string;
  chainId: number;
  chainName: string;
  decodedData: any;
  success: boolean;
  error?: string;
}

class TransactionDecoderService {
  /**
   * Decode a transaction hash for a specific chain
   */
  async decodeTransactionHashForChain(txHash: string, chainId: number): Promise<DecodedTransactionResult> {
    try {
      const response = await fetch('/api/decode-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txHash, chainId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decode transaction');
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Transaction decoding failed:', error);
      return {
        txHash,
        chainId,
        chainName: `Chain ${chainId}`,
        decodedData: null,
        success: false,
        error: error.message || 'Failed to decode transaction',
      };
    }
  }

  /**
   * Get list of supported networks
   */
  async getSupportedNetworks(): Promise<Array<{ chainId: number; name: string }>> {
    try {
      const response = await fetch('/api/decode-transaction');
      if (!response.ok) {
        throw new Error('Failed to fetch supported networks');
      }
      const data = await response.json();
      return data.supportedNetworks || [];
    } catch (error) {
      console.error('Failed to fetch supported networks:', error);
      return [];
    }
  }
}

// Create and export a singleton instance
export const transactionDecoderService = new TransactionDecoderService();

