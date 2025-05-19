import { useState } from 'react';
import { ethers } from 'ethers';
import { SignatureService } from '../lib/signatureService';

interface SignatureState {
  message: string;
  signature: string;
  address: string;
  timestamp: number;
  isLoading: boolean;
  error: Error | null;
}

interface TypedSignatureState {
  signature: string;
  address: string;
  data: any;
  isLoading: boolean;
  error: Error | null;
}

interface VerificationState {
  isValid: boolean;
  recoveredAddress: string;
  isLoading: boolean;
  error: Error | null;
}

// Let's not redefine the window.ethereum type here, we'll use the existing one

/**
 * Hook for signature operations using Ethereum wallet
 */
export function useSignature() {
  const [signatureState, setSignatureState] = useState<SignatureState>({
    message: '',
    signature: '',
    address: '',
    timestamp: 0,
    isLoading: false,
    error: null
  });

  const [typedSignatureState, setTypedSignatureState] = useState<TypedSignatureState>({
    signature: '',
    address: '',
    data: null,
    isLoading: false,
    error: null
  });

  const [verificationState, setVerificationState] = useState<VerificationState>({
    isValid: false,
    recoveredAddress: '',
    isLoading: false,
    error: null
  });

  /**
   * Sign a message using the connected wallet
   */
  const signMessage = async (message: string) => {
    setSignatureState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Check if ethereum provider exists
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask or a similar wallet.");
      }
      
      // Request access to the user's Ethereum wallet
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      
      // Sign the message
      const result = await SignatureService.signMessage(signer, message);
      
      setSignatureState({
        message: result.message,
        signature: result.signature,
        address: result.address,
        timestamp: result.timestamp,
        isLoading: false,
        error: null
      });
      
      return result;
    } catch (error) {
      setSignatureState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      }));
      throw error;
    }
  };

  /**
   * Sign typed data using EIP-712 standard
   */
  const signTypedData = async (
    domain: any, 
    types: Record<string, Array<{ name: string; type: string }>>, 
    value: any
  ) => {
    setTypedSignatureState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Check if ethereum provider exists
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask or a similar wallet.");
      }
      
      // Request access to the user's Ethereum wallet
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      
      // Sign the typed data
      const result = await SignatureService.signTypedData(signer, domain, types, value);
      
      setTypedSignatureState({
        signature: result.signature,
        address: result.address,
        data: result.data,
        isLoading: false,
        error: null
      });
      
      return result;
    } catch (error) {
      setTypedSignatureState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      }));
      throw error;
    }
  };

  /**
   * Verify a message signature
   */
  const verifyMessageSignature = (message: string, signature: string, expectedAddress?: string) => {
    setVerificationState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Verify the signature
      const recoveredAddress = SignatureService.verifyMessage(message, signature);
      
      // Check if the address matches the expected address (if provided)
      const isValid = !expectedAddress || recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
      
      setVerificationState({
        isValid,
        recoveredAddress,
        isLoading: false,
        error: null
      });
      
      return { isValid, recoveredAddress };
    } catch (error) {
      setVerificationState({
        isValid: false,
        recoveredAddress: '',
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      });
      throw error;
    }
  };

  /**
   * Verify a typed data signature
   */
  const verifyTypedDataSignature = (
    domain: any,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: any,
    signature: string,
    expectedAddress?: string
  ) => {
    setVerificationState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Verify the typed data signature
      const recoveredAddress = SignatureService.verifyTypedData(domain, types, value, signature);
      
      // Check if the address matches the expected address (if provided)
      const isValid = !expectedAddress || recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
      
      setVerificationState({
        isValid,
        recoveredAddress,
        isLoading: false,
        error: null
      });
      
      return { isValid, recoveredAddress };
    } catch (error) {
      setVerificationState({
        isValid: false,
        recoveredAddress: '',
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      });
      throw error;
    }
  };

  // Return all functions and state
  return {
    signMessage,
    signTypedData,
    verifyMessageSignature,
    verifyTypedDataSignature,
    signatureState,
    typedSignatureState,
    verificationState
  };
} 