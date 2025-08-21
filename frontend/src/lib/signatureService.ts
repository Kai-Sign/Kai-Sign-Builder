import { ethers } from 'ethers';

/**
 * Service for handling digital signatures with Ethereum wallets
 */
export class SignatureService {
  /**
   * Signs a message using an Ethereum wallet
   * @param signer The ethers.js Signer object
   * @param message The message to sign
   * @returns An object containing the signature and related data
   */
  static async signMessage(signer: ethers.Signer, message: string): Promise<{
    message: string;
    signature: string;
    address: string;
    timestamp: number;
  }> {
    try {
      // Get the address of the signer
      const address = await signer.getAddress();
      
      // Create a timestamp
      const timestamp = Date.now();
      
      // Create the full message with timestamp to prevent replay attacks
      const fullMessage = `${message}\nTimestamp: ${timestamp}`;
      
      // Sign the message
      const signature = await signer.signMessage(fullMessage);
      
      return {
        message: fullMessage,
        signature,
        address,
        timestamp
      };
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  }
  
  /**
   * Signs a structured data object using EIP-712 standard
   * @param signer The ethers.js Signer object
   * @param domain The domain object as per EIP-712
   * @param types The types object as per EIP-712
   * @param value The actual data to sign
   * @returns An object containing the signature and related data
   */
  static async signTypedData(
    signer: ethers.Signer, 
    domain: any, 
    types: Record<string, Array<{ name: string; type: string }>>, 
    value: any
  ): Promise<{
    signature: string;
    address: string;
    data: any;
  }> {
    try {
      // Get the address of the signer
      const address = await signer.getAddress();
      
      // Sign the typed data (EIP-712)
      const signature = await (signer as any).signTypedData(domain, types, value);
      
      return {
        signature,
        address,
        data: {
          domain,
          types,
          value
        }
      };
    } catch (error) {
      console.error('Error signing typed data:', error);
      throw error;
    }
  }
  
  /**
   * Verifies a signed message
   * @param message The original message that was signed
   * @param signature The signature to verify
   * @returns The address that signed the message
   */
  static verifyMessage(message: string, signature: string): string {
    try {
      // Recover the address that signed the message
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      return recoveredAddress;
    } catch (error) {
      console.error('Error verifying message:', error);
      throw error;
    }
  }
  
  /**
   * Verifies a signed typed data structure
   * @param domain The domain object as per EIP-712
   * @param types The types object as per EIP-712
   * @param value The data that was signed
   * @param signature The signature to verify
   * @returns The address that signed the data
   */
  static verifyTypedData(
    domain: any,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: any,
    signature: string
  ): string {
    try {
      // Verify the typed data signature and recover the address
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
      
      return recoveredAddress;
    } catch (error) {
      console.error('Error verifying typed data:', error);
      throw error;
    }
  }
  
  /**
   * Validates if a string is a valid Ethereum address
   * @param address The address to validate
   * @returns True if the address is valid, false otherwise
   */
  static isValidAddress(address: string): boolean {
    if (!address) return false;
    
    // Primary check: Regex for standard Ethereum address format (0x followed by 40 hex characters)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return false;
    }
    
    // Optional: Add checksum validation if needed for more strict validation
    try {
      // This will normalize the address case according to EIP-55 checksum
      const checksumAddress = ethers.getAddress(address);
      return true;
    } catch (error) {
      return false;
    }
  }
} 