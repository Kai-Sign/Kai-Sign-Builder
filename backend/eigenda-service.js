const axios = require('axios');
const { ethers } = require('ethers');

class EigenDAService {
    constructor(config = {}) {
        // Use EigenDA proxy for simpler REST API interface
        this.proxyUrl = config.proxyUrl || process.env.EIGENDA_PROXY_URL || 'http://localhost:3100';
        
        // For direct disperser connection (if needed)
        this.disperserUrl = config.disperserUrl || 'disperser-testnet-holesky.eigenda.xyz:443';
        this.serviceManagerAddress = config.serviceManagerAddress || '0xD4A7E1Bd8015057293f0D0A557088c286942e84b';
    }

    /**
     * Post data to EigenDA and get back a certificate/blob hash
     * @param {Buffer|string} data - The data to post
     * @returns {Promise<{certificate: string, blobHash: string}>}
     */
    async postBlob(data) {
        try {
            // Convert string to Buffer if needed
            const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
            
            // Post to EigenDA proxy
            const response = await axios.post(
                `${this.proxyUrl}/put?commitment_mode=standard`,
                dataBuffer,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    responseType: 'arraybuffer',
                    timeout: 120000 // 2 minute timeout for blob dispersal
                }
            );
            
            // Convert response to hex certificate
            const certificate = Buffer.from(response.data).toString('hex');
            
            // The certificate contains the blob hash and other metadata
            // For simplicity, we'll use the certificate as the blob hash
            const blobHash = '0x' + certificate.slice(0, 64); // First 32 bytes as blob hash
            
            console.log('EigenDA blob posted successfully:', {
                certificate: certificate.slice(0, 20) + '...',
                blobHash: blobHash
            });
            
            return {
                certificate,
                blobHash,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error posting to EigenDA:', error.message);
            throw new Error(`Failed to post blob to EigenDA: ${error.message}`);
        }
    }

    /**
     * Retrieve blob data from EigenDA using certificate
     * @param {string} certificate - The certificate returned from postBlob
     * @returns {Promise<Buffer>}
     */
    async retrieveBlob(certificate) {
        try {
            // Remove 0x prefix if present
            const certHex = certificate.startsWith('0x') ? certificate.slice(2) : certificate;
            
            const response = await axios.get(
                `${this.proxyUrl}/get/${certHex}?commitment_mode=standard`,
                {
                    responseType: 'arraybuffer',
                    timeout: 30000 // 30 second timeout for retrieval
                }
            );
            
            return Buffer.from(response.data);
        } catch (error) {
            console.error('Error retrieving from EigenDA:', error.message);
            throw new Error(`Failed to retrieve blob from EigenDA: ${error.message}`);
        }
    }

    /**
     * Post ERC7730 spec to EigenDA
     * @param {Object} erc7730Data - The ERC7730 JSON data
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<{certificate: string, blobHash: string}>}
     */
    async postERC7730Spec(erc7730Data, metadata = {}) {
        try {
            // Prepare the full payload
            const payload = {
                erc7730: erc7730Data,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    version: '2.0.0-eigenda'
                }
            };
            
            // Convert to JSON string then to Buffer
            const dataBuffer = Buffer.from(JSON.stringify(payload));
            
            // Post to EigenDA
            const result = await this.postBlob(dataBuffer);
            
            console.log('ERC7730 spec posted to EigenDA:', {
                blobHash: result.blobHash,
                size: dataBuffer.length + ' bytes'
            });
            
            return result;
        } catch (error) {
            console.error('Error posting ERC7730 spec:', error);
            throw error;
        }
    }

    /**
     * Retrieve and parse ERC7730 spec from EigenDA
     * @param {string} certificate - The certificate for the blob
     * @returns {Promise<Object>}
     */
    async retrieveERC7730Spec(certificate) {
        try {
            const dataBuffer = await this.retrieveBlob(certificate);
            const payload = JSON.parse(dataBuffer.toString());
            
            return payload;
        } catch (error) {
            console.error('Error retrieving ERC7730 spec:', error);
            throw error;
        }
    }

    /**
     * Check if EigenDA proxy is available
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            // Try a simple health check by attempting to retrieve a non-existent blob
            // This should fail quickly if the proxy is not running
            await axios.get(`${this.proxyUrl}/health`, { timeout: 5000 }).catch(() => {
                // If no health endpoint, try the base URL
                return axios.get(this.proxyUrl, { timeout: 5000 });
            });
            return true;
        } catch (error) {
            console.log('EigenDA proxy not available:', error.message);
            return false;
        }
    }
}

module.exports = EigenDAService;