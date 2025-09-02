/**
 * EigenDA V2 Service for Frontend
 * The proxy/relayer handles all encoding/decoding automatically
 */

interface EigenDAConfig {
  apiUrl?: string;
  timeout?: number;
}

interface BlobResult {
  success: boolean;
  blobHash?: string;
  certificate?: string;
  error?: string;
}

class EigenDAService {
  private apiUrl: string;
  private timeout: number;

  constructor(config: EigenDAConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.NEXT_PUBLIC_EIGENDA_API || 'http://localhost:3001/api/eigenda';
    this.timeout = config.timeout || 120000; // 2 minutes default
  }

  /**
   * Post ERC7730 JSON to EigenDA
   * No encoding needed - the relayer handles everything!
   */
  async postERC7730(jsonData: any): Promise<BlobResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.apiUrl}/erc7730`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          erc7730Data: jsonData,
          metadata: {
            timestamp: Date.now(),
            chainId: jsonData.chainId || 11155111,
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();

      return {
        success: true,
        blobHash: result.blobHash,
        certificate: result.certificate,
      };
    } catch (error: any) {
      console.error('EigenDA post failed:', error);
      
      // Handle timeout gracefully
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. The blob may still be processing.',
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve ERC7730 spec from EigenDA
   * The relayer returns decoded data directly!
   */
  async retrieveERC7730(certificate: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/erc7730/${certificate}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Relayer returns decoded JSON directly
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('EigenDA retrieve failed:', error);
      throw error;
    }
  }

  /**
   * Post raw blob data
   */
  async postBlob(data: string | ArrayBuffer): Promise<BlobResult> {
    try {
      const response = await fetch(`${this.apiUrl}/blob`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: data,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        success: true,
        blobHash: result.blobHash,
        certificate: result.certificate,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if the service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl.replace('/api/eigenda', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const eigenDAService = new EigenDAService();

// Export class for custom instances
export default EigenDAService;