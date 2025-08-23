"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";
import { web3Service } from "~/lib/web3Service";
import { 
  Shield, 
  Loader2,
  AlertCircle,
  ExternalLink,
  Settings,
  Users,
  Plus,
  Trash2
} from "lucide-react";

interface MetadataRegistryManagerProps {
  currentAccount: string;
}

export function MetadataRegistryManager({ currentAccount }: MetadataRegistryManagerProps) {
  const { toast } = useToast();
  
  // State
  const [registryAddress, setRegistryAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Trust configuration state
  const [accountConfig, setAccountConfig] = useState<any>(null);
  const [trustedAttesters, setTrustedAttesters] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [mustIncludeAny, setMustIncludeAny] = useState<string[]>([]);
  const [mustIncludeAll, setMustIncludeAll] = useState<string[]>([]);
  const [newAttester, setNewAttester] = useState("");
  const [isConfiguringTrust, setIsConfiguringTrust] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Load registry info on mount
  useEffect(() => {
    loadRegistryInfo();
    loadAccountConfig();
  }, [currentAccount]);

  const loadRegistryInfo = async () => {
    try {
      setIsLoading(true);
      
      const address = await web3Service.getMetadataRegistryAddress();
      setRegistryAddress(address);
      
    } catch (error: any) {
      console.error("Error loading registry info:", error);
      toast({
        title: "Error",
        description: "Failed to load registry information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadAccountConfig = async () => {
    try {
      setIsLoadingConfig(true);
      const config = await web3Service.getAccountConfig(currentAccount);
      setAccountConfig(config);
      
      if (config.isConfigured) {
        setTrustedAttesters(config.attesters);
        setThreshold(config.threshold);
        setMustIncludeAny(config.mustIncludeAny);
        setMustIncludeAll(config.mustIncludeAll);
      }
    } catch (error: any) {
      console.error("Error loading account config:", error);
    } finally {
      setIsLoadingConfig(false);
    }
  };
  
  const handleConfigureTrust = async () => {
    if (trustedAttesters.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one attester",
        variant: "destructive",
      });
      return;
    }
    
    if (threshold < 1 || threshold > trustedAttesters.length) {
      toast({
        title: "Error",
        description: `Threshold must be between 1 and ${trustedAttesters.length}`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsConfiguringTrust(true);
      
      const txHash = await web3Service.trustAttesters(
        threshold,
        trustedAttesters,
        mustIncludeAny,
        mustIncludeAll
      );
      
      toast({
        title: "Success",
        description: (
          <div className="flex flex-col gap-2">
            <span>Trust configuration updated!</span>
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ),
      });
      
      // Reload config
      await loadAccountConfig();
      
    } catch (error: any) {
      console.error("Error configuring trust:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to configure trusted attesters",
        variant: "destructive",
      });
    } finally {
      setIsConfiguringTrust(false);
    }
  };
  
  const addAttester = (address: string) => {
    if (!address) return;
    
    // Check if already added
    if (trustedAttesters.includes(address)) {
      toast({
        title: "Already Added",
        description: "This attester is already in your list",
        variant: "default",
      });
      return;
    }
    
    // Validate ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }
    
    setTrustedAttesters([...trustedAttesters, address]);
    setNewAttester("");
  };
  
  const removeAttester = (address: string) => {
    setTrustedAttesters(trustedAttesters.filter(a => a !== address));
    // Remove from must include lists too
    setMustIncludeAny(mustIncludeAny.filter(a => a !== address));
    setMustIncludeAll(mustIncludeAll.filter(a => a !== address));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registry Info Card */}
      <Card className="p-6 bg-gray-950 border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold">Metadata Registry</h3>
              <p className="text-sm text-gray-400">Decentralized metadata attestation and verification</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400">Registry Address</p>
            <a 
              href={`https://sepolia.etherscan.io/address/${registryAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {registryAddress}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>

      {/* Account Trust Configuration */}
      <Card className="p-6 bg-gray-950 border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-purple-400" />
            <div>
              <h3 className="text-lg font-semibold">Your Trust Configuration</h3>
              <p className="text-sm text-gray-400">Configure which attesters you trust for your metadata</p>
            </div>
          </div>
          {accountConfig?.isConfigured && (
            <Badge variant="default" className="bg-purple-600">
              <Users className="mr-1 h-3 w-3" />
              Configured
            </Badge>
          )}
        </div>
        
        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Configuration Display */}
            {accountConfig?.isConfigured && (
              <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg mb-4">
                <p className="text-sm font-medium text-purple-200 mb-2">Current Configuration:</p>
                <div className="text-xs space-y-1 text-gray-300">
                  <p>• <strong>Threshold:</strong> {accountConfig.threshold} of {accountConfig.attesters.length} attesters required</p>
                  <p>• <strong>Trusted Attesters:</strong> {accountConfig.attesters.length} configured</p>
                  {accountConfig.mustIncludeAny.length > 0 && (
                    <p>• <strong>Must Include Any:</strong> {accountConfig.mustIncludeAny.length} attesters</p>
                  )}
                  {accountConfig.mustIncludeAll.length > 0 && (
                    <p>• <strong>Must Include All:</strong> {accountConfig.mustIncludeAll.length} attesters</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Add Attester */}
            <div>
              <Label htmlFor="add-attester">Add Trusted Attester</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="add-attester"
                  type="text"
                  placeholder="0x..."
                  value={newAttester}
                  onChange={(e) => setNewAttester(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
                <Button
                  onClick={() => addAttester(newAttester)}
                  disabled={!newAttester}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Trusted Attesters List */}
            {trustedAttesters.length > 0 && (
              <div>
                <Label>Trusted Attesters ({trustedAttesters.length})</Label>
                <div className="space-y-2 mt-2">
                  {trustedAttesters.map((attester) => (
                    <div
                      key={attester}
                      className="flex items-center justify-between p-2 bg-gray-900 rounded text-sm"
                    >
                      <span className="font-mono text-xs">
                        {attester.substring(0, 8)}...{attester.substring(attester.length - 6)}
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={mustIncludeAny.includes(attester)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMustIncludeAny([...mustIncludeAny, attester]);
                              } else {
                                setMustIncludeAny(mustIncludeAny.filter(a => a !== attester));
                              }
                            }}
                          />
                          Any
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={mustIncludeAll.includes(attester)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMustIncludeAll([...mustIncludeAll, attester]);
                              } else {
                                setMustIncludeAll(mustIncludeAll.filter(a => a !== attester));
                              }
                            }}
                          />
                          All
                        </label>
                        <Button
                          onClick={() => removeAttester(attester)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Threshold Configuration */}
            {trustedAttesters.length > 0 && (
              <div>
                <Label htmlFor="threshold">Approval Threshold</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="threshold"
                    type="number"
                    min="1"
                    max={trustedAttesters.length}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="bg-gray-900 border-gray-700 w-24"
                  />
                  <span className="text-sm text-gray-400">
                    of {trustedAttesters.length} attesters must approve
                  </span>
                </div>
              </div>
            )}
            
            {/* Save Configuration Button */}
            {trustedAttesters.length > 0 && (
              <Button
                onClick={handleConfigureTrust}
                disabled={isConfiguringTrust}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isConfiguringTrust ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configuring...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Save Trust Configuration
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </Card>
      
      {/* Info Card */}
      <Card className="p-4 bg-blue-950/30 border-blue-800">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              <strong>How the Metadata Registry Works:</strong>
            </p>
            <p>
              <strong>1. Permissionless Attestation:</strong> Any address can attest to metadata hashes. There is no central authority or owner controlling who can attest.
            </p>
            <p>
              <strong>2. Account Trust Configuration:</strong> Each account owner configures which attesters they trust for their own metadata using the trustAttesters function. You can specify a threshold, required attesters, and optional attesters.
            </p>
            <p>
              <strong>3. Verification:</strong> When verifying metadata, the registry checks if enough of YOUR trusted attesters have attested to that specific metadata hash.
            </p>
            <p className="text-yellow-300">
              This creates a fully decentralized trust network where each account has complete autonomy over their trust relationships.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}