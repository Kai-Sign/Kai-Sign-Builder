"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { web3Service } from '~/lib/web3Service';

interface WalletContextType {
  walletConnected: boolean;
  currentAccount: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkConnection: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialConnection, setIsInitialConnection] = useState(false);

  const checkConnection = async () => {
    // Only check connection on client side
    if (typeof window === 'undefined') return;
    
    try {
      const account = await web3Service.getCurrentAccount();
      if (account) {
        setCurrentAccount(account);
        setWalletConnected(true);
      } else {
        setCurrentAccount(null);
        setWalletConnected(false);
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
      setCurrentAccount(null);
      setWalletConnected(false);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setIsInitialConnection(true); // Set flag to prevent reload during connection
    try {
      const account = await web3Service.connect();
      setCurrentAccount(account);
      setWalletConnected(true);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setCurrentAccount(null);
      setWalletConnected(false);
      throw error;
    } finally {
      setIsConnecting(false);
      // Clear the flag after a short delay to ensure chain change event has been handled
      setTimeout(() => setIsInitialConnection(false), 1000);
    }
  };

  const disconnectWallet = () => {
    setCurrentAccount(null);
    setWalletConnected(false);
  };

  // Listen for account changes and disconnections
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        disconnectWallet();
      } else if (accounts[0] && accounts[0] !== currentAccount) {
        // User switched accounts
        setCurrentAccount(accounts[0]);
        setWalletConnected(true);
      }
    };

    const handleChainChanged = async (chainId: string) => {
      // Don't reload during initial connection (when we're forcing Sepolia)
      if (isInitialConnection) {
        console.log("Chain changed during initial connection, ignoring...");
        return;
      }
      
      // Don't reload if we're switching to Sepolia (0xaa36a7)
      const chainIdNumber = parseInt(chainId, 16);
      if (chainIdNumber === 11155111) { // Sepolia chain ID
        // We're on Sepolia, just update the connection status
        console.log("Switched to Sepolia network successfully");
        // Don't reload or reconnect - just update status
      } else {
        // If switching to any other chain, reload to force reconnection to Sepolia
        console.warn("Wrong network detected, reloading to force Sepolia...");
        window.location.reload();
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
      window.ethereum.on?.('chainChanged', handleChainChanged);
    }

    // Check connection on mount
    checkConnection();

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      }
    };
  }, [currentAccount, isInitialConnection]);

  const value: WalletContextType = {
    walletConnected,
    currentAccount,
    isConnecting,
    connectWallet,
    disconnectWallet,
    checkConnection,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};