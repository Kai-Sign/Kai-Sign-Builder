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

  const checkConnection = async () => {
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
    }
  };

  const disconnectWallet = () => {
    setCurrentAccount(null);
    setWalletConnected(false);
  };

  // Listen for account changes and disconnections
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        disconnectWallet();
      } else if (accounts[0] !== currentAccount) {
        // User switched accounts
        setCurrentAccount(accounts[0]);
        setWalletConnected(true);
      }
    };

    const handleChainChanged = () => {
      // Reload the page when chain changes to avoid state issues
      window.location.reload();
    };

    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
      window.ethereum.on?.('chainChanged', handleChainChanged);
    }

    // Check connection on mount
    checkConnection();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener?.('chainChanged', handleChainChanged);
      }
    };
  }, [currentAccount]);

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