const express = require('express');
const cors = require('cors');
const EigenDAService = require('./eigenda-service');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Initialize EigenDA service
const eigenDA = new EigenDAService({
    proxyUrl: process.env.EIGENDA_PROXY_URL || 'http://localhost:3100'
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const eigenDAHealthy = await eigenDA.checkHealth();
        res.json({ 
            status: 'ok',
            eigenDA: eigenDAHealthy ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// Post blob to EigenDA
app.post('/api/eigenda/blob', async (req, res) => {
    try {
        const data = req.body;
        
        if (!data) {
            return res.status(400).json({ 
                error: 'No data provided' 
            });
        }

        // Post to EigenDA
        const result = await eigenDA.postBlob(
            typeof data === 'object' ? JSON.stringify(data) : data
        );

        res.json({
            success: true,
            certificate: result.certificate,
            blobHash: result.blobHash,
            timestamp: result.timestamp
        });
    } catch (error) {
        console.error('Error posting blob:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Retrieve blob from EigenDA
app.get('/api/eigenda/blob/:certificate', async (req, res) => {
    try {
        const { certificate } = req.params;
        
        if (!certificate) {
            return res.status(400).json({ 
                error: 'Certificate required' 
            });
        }

        // Retrieve from EigenDA
        const data = await eigenDA.retrieveBlob(certificate);

        // Try to parse as JSON, otherwise return raw
        try {
            const jsonData = JSON.parse(data.toString());
            res.json(jsonData);
        } catch {
            res.send(data);
        }
    } catch (error) {
        console.error('Error retrieving blob:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Post ERC7730 spec to EigenDA
app.post('/api/eigenda/erc7730', async (req, res) => {
    try {
        const { erc7730Data, metadata } = req.body;
        
        if (!erc7730Data) {
            return res.status(400).json({ 
                error: 'ERC7730 data required' 
            });
        }

        // Post spec to EigenDA
        const result = await eigenDA.postERC7730Spec(erc7730Data, metadata);

        res.json({
            success: true,
            certificate: result.certificate,
            blobHash: result.blobHash,
            timestamp: result.timestamp
        });
    } catch (error) {
        console.error('Error posting ERC7730 spec:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Retrieve ERC7730 spec from EigenDA
app.get('/api/eigenda/erc7730/:certificate', async (req, res) => {
    try {
        const { certificate } = req.params;
        
        if (!certificate) {
            return res.status(400).json({ 
                error: 'Certificate required' 
            });
        }

        // Retrieve spec from EigenDA
        const spec = await eigenDA.retrieveERC7730Spec(certificate);

        res.json(spec);
    } catch (error) {
        console.error('Error retrieving ERC7730 spec:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`EigenDA API server running on port ${port}`);
    console.log(`EigenDA Proxy URL: ${process.env.EIGENDA_PROXY_URL || 'http://localhost:3100'}`);
});

module.exports = app;