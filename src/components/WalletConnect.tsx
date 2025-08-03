"use client";

import React from 'react';
import { ExtensionSafeButton } from "~/components/ExtensionSafeButton";
import { Wallet, Loader2 } from "lucide-react";
import { useWallet } from "~/contexts/WalletContext";
import { useToast } from "~/hooks/use-toast";

interface WalletConnectProps {
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  className?: string;
  showDisconnect?: boolean;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ 
  size = "default", 
  variant = "default", 
  className = "",
  showDisconnect = false
}) => {
  const { walletConnected, currentAccount, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      await connectWallet();
      toast({
        title: "Wallet Connected",
        description: `Connected to ${currentAccount?.substring(0, 6)}...${currentAccount?.substring(currentAccount.length - 4)}`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
      variant: "default",
    });
  };

  if (walletConnected && currentAccount) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">
          {currentAccount.substring(0, 6)}...{currentAccount.substring(currentAccount.length - 4)}
        </span>
        {showDisconnect && (
          <ExtensionSafeButton
            onClick={handleDisconnect}
            size={size}
            variant="outline"
            className={className}
          >
            Disconnect
          </ExtensionSafeButton>
        )}
      </div>
    );
  }

  return (
    <ExtensionSafeButton
      onClick={handleConnect}
      disabled={isConnecting}
      size={size}
      variant={variant}
      className={className}
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </>
      )}
    </ExtensionSafeButton>
  );
};