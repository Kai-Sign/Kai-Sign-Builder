#!/usr/bin/env node

/**
 * EigenDA V2 Simple Client
 * The proxy handles all encoding/decoding automatically!
 */

import axios from 'axios';
import crypto from 'crypto';

class EigenDAV2Client {
    constructor(proxyUrl = 'http://localhost:3100') {
        this.proxyUrl = proxyUrl;
    }

    /**
     * Post raw data - proxy handles encoding
     */
    async postBlob(data) {
        try {
            console.log('📤 Posting to EigenDA V2...');
            
            // Just send raw data - proxy handles everything!
            const response = await axios.post(
                `${this.proxyUrl}/put?commitment_mode=standard`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    responseType: 'arraybuffer',
                    timeout: 120000 // 2 minutes for dispersal
                }
            );
            
            // Certificate is returned as bytes
            const certificate = Buffer.from(response.data).toString('hex');
            
            console.log('✅ Blob posted successfully!');
            console.log('📜 Certificate:', certificate.substring(0, 64) + '...');
            
            return certificate;
        } catch (error) {
            console.error('❌ Error posting blob:', error.message);
            throw error;
        }
    }

    /**
     * Retrieve raw data - proxy handles decoding
     */
    async retrieveBlob(certificate) {
        try {
            console.log('📥 Retrieving from EigenDA V2...');
            
            // Remove 0x prefix if present
            const certHex = certificate.startsWith('0x') ? certificate.slice(2) : certificate;
            
            // Proxy returns decoded data directly!
            const response = await axios.get(
                `${this.proxyUrl}/get/${certHex}?commitment_mode=standard`,
                {
                    responseType: 'arraybuffer',
                    timeout: 30000
                }
            );
            
            const data = Buffer.from(response.data);
            console.log('✅ Data retrieved successfully!');
            
            return data;
        } catch (error) {
            console.error('❌ Error retrieving blob:', error.message);
            throw error;
        }
    }
}

/**
 * Direct integration for frontend
 */
export async function postToEigenDA(jsonData) {
    const EIGENDA_API = process.env.EIGENDA_API_URL || 'http://localhost:3001/api/eigenda';
    
    try {
        // Post directly - no encoding needed!
        const response = await fetch(`${EIGENDA_API}/blob`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: jsonData })
        });
        
        const result = await response.json();
        
        return {
            success: true,
            blobHash: result.blobHash,
            certificate: result.certificate
        };
    } catch (error) {
        console.error('EigenDA post failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Example usage
 */
async function example() {
    console.log('🚀 EigenDA V2 Simple Example');
    console.log('============================\n');
    
    const client = new EigenDAV2Client();
    
    // Test data - can be anything!
    const testData = {
        type: "ERC7730",
        contract: "0x123...",
        chainId: 11155111,
        spec: {
            name: "Test Contract",
            version: "1.0.0"
        },
        timestamp: Date.now()
    };
    
    console.log('📦 Original data:', JSON.stringify(testData, null, 2));
    console.log('');
    
    try {
        // Post blob - no encoding needed!
        const certificate = await client.postBlob(JSON.stringify(testData));
        
        // Wait a bit for propagation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retrieve blob - automatically decoded!
        const retrievedData = await client.retrieveBlob(certificate);
        const parsed = JSON.parse(retrievedData.toString());
        
        console.log('\n📦 Retrieved data:', JSON.stringify(parsed, null, 2));
        
        // Verify match
        if (JSON.stringify(testData) === JSON.stringify(parsed)) {
            console.log('\n✅ Data integrity verified!');
        }
        
        console.log('\n💡 Key Points:');
        console.log('1. No manual encoding/decoding needed');
        console.log('2. Proxy handles all complexity');
        console.log('3. Certificate works like a blob hash');
        console.log('4. Can store certificate in smart contract as bytes32');
        
    } catch (error) {
        console.error('Example failed:', error.message);
        console.log('\n💡 Make sure EigenDA proxy is running:');
        console.log('   docker run --rm -p 3100:3100 ghcr.io/layr-labs/eigenda-proxy:latest \\');
        console.log('     --eigenda.disperser-rpc=disperser-holesky.eigenda.xyz:443 \\');
        console.log('     --eigenda.signer-private-key-hex=YOUR_KEY \\');
        console.log('     --port=3100');
    }
}

// Run example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    example().catch(console.error);
}

export default EigenDAV2Client;