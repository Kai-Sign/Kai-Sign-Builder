"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { 
  getMainnetNetworks, 
  getTestnetNetworks, 
  getNetworkById,
  type NetworkConfig 
} from "~/lib/networks";

interface NetworkSelectorProps {
  value?: number;
  onValueChange: (chainId: number) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export function NetworkSelector({
  value,
  onValueChange,
  placeholder = "Select network...",
  className,
  label = "Network",
}: NetworkSelectorProps) {
  const selectedNetwork = value ? getNetworkById(value) : undefined;
  const mainnetNetworks = getMainnetNetworks();
  const testnetNetworks = getTestnetNetworks();

  const handleValueChange = (chainIdString: string) => {
    const chainId = parseInt(chainIdString, 10);
    onValueChange(chainId);
  };

  const NetworkSelectItem = ({ network }: { network: NetworkConfig }) => (
    <SelectItem key={network.id} value={network.id.toString()}>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4" />
        <span>{network.name}</span>
        {network.testnet && (
          <span className="text-xs text-muted-foreground">(Testnet)</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {network.nativeCurrency.symbol}
        </span>
      </div>
    </SelectItem>
  );

  return (
    <div className={className}>
      <Label className="mb-2 block font-normal text-white">{label}</Label>
      <Select value={value?.toString()} onValueChange={handleValueChange}>
        <SelectTrigger className="h-12 rounded-lg border-[#1f0f4c] bg-[#0f051d] text-white">
          <SelectValue placeholder={placeholder}>
            {selectedNetwork && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{selectedNetwork.name}</span>
                {selectedNetwork.testnet && (
                  <span className="text-xs text-muted-foreground">(Testnet)</span>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#0f051d] border-[#1f0f4c]">
          {mainnetNetworks.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                Mainnet Networks
              </div>
              {mainnetNetworks.map((network) => (
                <NetworkSelectItem key={network.id} network={network} />
              ))}
            </>
          )}
          
          {testnetNetworks.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t border-[#1f0f4c] mt-1">
                Testnet Networks
              </div>
              {testnetNetworks.map((network) => (
                <NetworkSelectItem key={network.id} network={network} />
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
} 