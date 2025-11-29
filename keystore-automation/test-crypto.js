#!/usr/bin/env node

import crypto from 'crypto';

console.log('Testing crypto functions...');

try {
    // Test encryption/decryption
    const password = 'test-password-123456';
    const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    // Generate encryption parameters
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
    
    // Encrypt private key
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv.slice(0, 16));
    let encrypted = cipher.update(privateKey.replace('0x', ''), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    console.log('✅ Encryption successful');
    
    // Decrypt private key
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv.slice(0, 16));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const result = `0x${decrypted}`;
    
    if (result === privateKey) {
        console.log('✅ Decryption successful - crypto functions work correctly!');
        console.log('✅ Setup should now work. Try running: npm run setup');
    } else {
        console.log('❌ Decryption failed - mismatch');
        console.log(`Expected: ${privateKey}`);
        console.log(`Got:      ${result}`);
    }
    
} catch (error) {
    console.error('❌ Crypto test failed:', error.message);
}