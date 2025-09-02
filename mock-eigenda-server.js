#!/usr/bin/env node

/**
 * Mock EigenDA Server - Simulates EigenDA for local testing
 * No Docker or external dependencies required
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3100;
const DATA_DIR = './mock-eigenda-data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory storage for simplicity (could use file system for persistence)
const blobStorage = new Map();

// Colors for console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Generate a mock certificate that looks like an EigenDA certificate
function generateCertificate(data) {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  // Simulate EigenDA certificate format (32 bytes hash + metadata)
  const certificate = hash + crypto.randomBytes(32).toString('hex');
  return certificate;
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(body);
      resolve(buffer);
    });
    req.on('error', reject);
  });
}

// Handle CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Request handler
async function handleRequest(req, res) {
  setCorsHeaders(res);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  log(`${req.method} ${pathname}`, 'cyan');
  
  // Health check
  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      type: 'mock-eigenda',
      message: 'Mock EigenDA server is running',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // POST /put - Store a blob
  if (req.method === 'POST' && pathname === '/put') {
    try {
      const data = await parseBody(req);
      const certificate = generateCertificate(data);
      
      // Store the blob
      blobStorage.set(certificate, data);
      
      // Also save to file for persistence
      const filename = path.join(DATA_DIR, `${certificate}.blob`);
      fs.writeFileSync(filename, data);
      
      log(`Stored blob: ${certificate.substring(0, 16)}... (${data.length} bytes)`, 'green');
      
      // Return certificate as binary (like real EigenDA)
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(Buffer.from(certificate, 'hex'));
      
    } catch (error) {
      log(`Error storing blob: ${error.message}`, 'red');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // GET /get/:certificate - Retrieve a blob
  if (req.method === 'GET' && pathname.startsWith('/get/')) {
    try {
      const certificate = pathname.split('/')[2];
      
      if (!certificate) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Certificate required' }));
        return;
      }
      
      // Try memory first
      let data = blobStorage.get(certificate);
      
      // Try file system if not in memory
      if (!data) {
        const filename = path.join(DATA_DIR, `${certificate}.blob`);
        if (fs.existsSync(filename)) {
          data = fs.readFileSync(filename);
          blobStorage.set(certificate, data); // Cache in memory
        }
      }
      
      if (data) {
        log(`Retrieved blob: ${certificate.substring(0, 16)}... (${data.length} bytes)`, 'green');
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(data);
      } else {
        log(`Blob not found: ${certificate.substring(0, 16)}...`, 'yellow');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Blob not found' }));
      }
      
    } catch (error) {
      log(`Error retrieving blob: ${error.message}`, 'red');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  
  // GET /list - List all stored blobs (for debugging)
  if (req.method === 'GET' && pathname === '/list') {
    const blobs = Array.from(blobStorage.keys()).map(cert => ({
      certificate: cert,
      size: blobStorage.get(cert).length,
      preview: cert.substring(0, 16) + '...'
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      count: blobs.length,
      blobs: blobs
    }, null, 2));
    return;
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  log('🚀 Mock EigenDA Server Started', 'bright');
  log('=====================================', 'bright');
  log(`Server URL: http://localhost:${PORT}`, 'cyan');
  log(`Data directory: ${path.resolve(DATA_DIR)}`, 'blue');
  log('', 'reset');
  log('Endpoints:', 'green');
  log(`  POST http://localhost:${PORT}/put         - Store a blob`, 'blue');
  log(`  GET  http://localhost:${PORT}/get/{cert}  - Retrieve a blob`, 'blue');
  log(`  GET  http://localhost:${PORT}/list        - List all blobs`, 'blue');
  log(`  GET  http://localhost:${PORT}/health      - Health check`, 'blue');
  log('', 'reset');
  log('Test with curl:', 'yellow');
  log(`  curl -X POST http://localhost:${PORT}/put \\`, 'cyan');
  log(`    -H "Content-Type: application/octet-stream" \\`, 'cyan');
  log(`    --data-binary "Hello EigenDA"`, 'cyan');
  log('', 'reset');
  log('Or use the test scripts:', 'yellow');
  log(`  ./test-eigenda-simple.sh`, 'cyan');
  log(`  node test-eigenda.js`, 'cyan');
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('\nShutting down server...', 'yellow');
  server.close(() => {
    log('Server stopped', 'green');
    process.exit(0);
  });
});