'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Search, ExternalLink, Clock, CheckCircle } from 'lucide-react';
import { KaiSignGraphClient, type ContractMetadata, type FunctionMetadata } from '~/lib/graphClient';

interface ContractSelectorProps {
  /** The chain ID to query contracts for */
  chainID: string;
  /** Graph endpoint URL */
  graphEndpoint: string;
  /** Called when a contract is selected */
  onContractSelect: (contract: ContractMetadata) => void;
  /** Called when a function is selected */
  onFunctionSelect?: (func: FunctionMetadata, contract: ContractMetadata) => void;
  /** Whether to show the modal */
  isOpen: boolean;
  /** Called when modal should be closed */
  onClose: () => void;
  /** Optional title for the modal */
  title?: string;
  /** Whether to allow function selection */
  showFunctions?: boolean;
}

export function ContractSelector({
  chainID,
  graphEndpoint,
  onContractSelect,
  onFunctionSelect,
  isOpen,
  onClose,
  title = 'Select Contract',
  showFunctions = false
}: ContractSelectorProps) {
  const [client] = useState(() => new KaiSignGraphClient(graphEndpoint));
  const [contracts, setContracts] = useState<ContractMetadata[]>([]);
  const [functions, setFunctions] = useState<FunctionMetadata[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractMetadata | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFunctions, setLoadingFunctions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContracts();
    }
  }, [isOpen, chainID]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const result = await client.getContractsWithMetadata(chainID);
      setContracts(result);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFunctions = async (contract: ContractMetadata) => {
    if (!showFunctions) return;
    
    setLoadingFunctions(true);
    try {
      const result = await client.getContractFunctions(contract.address, contract.chainID);
      setFunctions(result);
    } catch (error) {
      console.error('Failed to load functions:', error);
      setFunctions([]);
    } finally {
      setLoadingFunctions(false);
    }
  };

  const filteredContracts = contracts.filter(contract =>
    contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contract.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContractClick = async (contract: ContractMetadata) => {
    setSelectedContract(contract);
    onContractSelect(contract);
    await loadFunctions(contract);
    
    if (!showFunctions) {
      onClose();
    }
  };

  const handleFunctionClick = (func: FunctionMetadata) => {
    if (selectedContract && onFunctionSelect) {
      onFunctionSelect(func, selectedContract);
      onClose();
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts by name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content Area */}
          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Contracts List */}
            <div className="flex-1 overflow-hidden">
              <h3 className="text-sm font-medium mb-2">
                Contracts ({filteredContracts.length})
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-y-auto space-y-2 pr-2">
                  {filteredContracts.map((contract) => (
                    <div
                      key={`${contract.address}-${contract.chainID}`}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                        selectedContract?.address === contract.address ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleContractClick(contract)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{contract.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatAddress(contract.address)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              v{contract.version}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {contract.functionCount} functions
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      
                      {contract.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {contract.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Functions List (if enabled) */}
            {showFunctions && selectedContract && (
              <div className="flex-1 overflow-hidden border-l pl-4">
                <h3 className="text-sm font-medium mb-2">
                  Functions ({functions.length})
                </h3>
                
                {loadingFunctions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="overflow-y-auto space-y-2 pr-2">
                    {functions.map((func) => (
                      <div
                        key={func.selector}
                        className="p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted"
                        onClick={() => handleFunctionClick(func)}
                      >
                        <h4 className="font-medium">{func.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {func.selector}
                        </p>
                        <p className="text-xs text-muted-foreground italic">
                          "{func.intent}"
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {func.parameterTypes.map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {selectedContract && (
            <Button asChild>
              <a 
                href={`https://etherscan.io/address/${selectedContract.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View on Explorer
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ContractSelector;
