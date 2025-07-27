"use client";

import React, { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card } from '~/components/ui/card';
import { ExternalLink, Code, Package } from 'lucide-react';

const SAMPLE_CONTRACTS = [
  {
    name: 'KaiSign V1 Contract (Your Data)',
    address: '0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf',
    chainId: 11155111,
    description: 'KaiSign V1 Platform with complete ERC-7730 metadata'
  },
  {
    name: 'USDC Token',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    description: 'USD Coin on Ethereum'
  },
  {
    name: 'KaiSign Contract',
    address: '0x79D0e06350CfCE33A7a73A7549248fd6AeD774f2',
    chainId: 11155111,
    description: 'KaiSign on Sepolia'
  },
  {
    name: 'Uniswap V3 Factory',
    address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    chainId: 1,
    description: 'Uniswap V3 Factory on Ethereum'
  }
];

export default function ContractMetadataDemo() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [customChainId, setCustomChainId] = useState('11155111');

  const handleTestAPI = async (address: string, chainId: string) => {
    setLoading(true);
    setApiResponse(null);
    
    try {
      const response = await fetch(`/api/contract-metadata?address=${address}&chainId=${chainId}`);
      const data = await response.json();
      setApiResponse(data);
    } catch (error) {
      setApiResponse({ error: 'Failed to fetch data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Code className="text-white" size={24} />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              KaiSign Contract Metadata
            </h1>
          </div>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Retrieve comprehensive ERC-7730 metadata from smart contracts with clear function descriptions, 
            parameter details, and rich contextual information for better user understanding.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded">Live</span>
            <span>•</span>
            <span>Real blockchain data</span>
            <span>•</span>
            <span>ERC-7730 compliant</span>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50 hover:border-blue-600/70 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <Code className="text-blue-400" size={24} />
              <h3 className="text-lg font-semibold">Simple API</h3>
            </div>
            <p className="text-sm text-gray-300">
              RESTful endpoints for instant metadata retrieval. Just provide contract address and chain ID.
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-700/50 hover:border-green-600/70 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <Package className="text-green-400" size={24} />
              <h3 className="text-lg font-semibold">React Component</h3>
            </div>
            <p className="text-sm text-gray-300">
              Drop-in modal component for instant integration. No setup required, works out of the box.
            </p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-700/50 hover:border-purple-600/70 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <ExternalLink className="text-purple-400" size={24} />
              <h3 className="text-lg font-semibold">ERC-7730 Support</h3>
            </div>
            <p className="text-sm text-gray-300">
              Full support for ERC-7730 standard with rich metadata from IPFS and subgraph indexing.
            </p>
          </Card>
        </div>

        {/* API Demo */}
        <Card className="p-8 bg-gradient-to-br from-gray-900/80 to-gray-800/40 border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Code className="text-white" size={16} />
            </div>
            <h2 className="text-2xl font-bold">Live API Demo</h2>
          </div>
          
          {/* Sample Contracts */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Try with sample contracts:</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {SAMPLE_CONTRACTS.map((contract, index) => (
                <button
                  key={index}
                  onClick={() => handleTestAPI(contract.address, contract.chainId.toString())}
                  className="p-4 text-left bg-gradient-to-br from-gray-800/60 to-gray-700/40 hover:from-gray-700/70 hover:to-gray-600/50 rounded-lg border border-gray-600/50 hover:border-gray-500/70 transition-all group"
                >
                  <div className="font-medium text-gray-200 group-hover:text-white transition-colors">{contract.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{contract.description}</div>
                  <div className="text-xs text-blue-400 mt-2 font-mono break-all">{contract.address}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div className="grid md:grid-cols-4 gap-3 mb-6">
            <div className="md:col-span-2">
              <Input
                placeholder="Contract Address (0x...)"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="bg-gray-800/60 border-gray-600/60 focus:border-blue-500/70 h-11"
              />
            </div>
            <div>
              <Input
                placeholder="Chain ID"
                value={customChainId}
                onChange={(e) => setCustomChainId(e.target.value)}
                className="bg-gray-800/60 border-gray-600/60 focus:border-blue-500/70 h-11"
              />
            </div>
            <Button
              onClick={() => handleTestAPI(customAddress, customChainId)}
              disabled={!customAddress || loading}
              className="h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Test API'}
            </Button>
          </div>

          {/* API Response */}
          {apiResponse && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">API Response:</h4>
              
              {/* Show structured view for KaiSign contracts */}
              {apiResponse.metadata?.erc7730 && (
                <div className="mb-6 p-6 bg-gradient-to-br from-green-900/20 to-emerald-800/10 rounded-lg border border-green-700/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                    <h5 className="text-lg font-semibold text-green-400">Complete ERC-7730 Metadata Found</h5>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Contract Info */}
                    {apiResponse.metadata.info && (
                      <div className="bg-gray-800/30 rounded-lg p-4">
                        <h6 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                          <Package size={16} />
                          Contract Information
                        </h6>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div><span className="text-gray-400">Owner:</span> <span className="text-white">{apiResponse.metadata.owner}</span></div>
                          <div><span className="text-gray-400">Legal Name:</span> <span className="text-white">{apiResponse.metadata.info.legalName}</span></div>
                          <div><span className="text-gray-400">Version:</span> <span className="text-white">{apiResponse.metadata.info.version}</span></div>
                          <div><span className="text-gray-400">Last Update:</span> <span className="text-white">{apiResponse.metadata.info.lastUpdate}</span></div>
                          <div className="md:col-span-2">
                            <span className="text-gray-400">URL:</span> 
                            <a href={apiResponse.metadata.info.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline ml-1">
                              {apiResponse.metadata.info.url}
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Functions */}
                    {apiResponse.metadata.functions && apiResponse.metadata.functions.length > 0 && (
                      <div className="bg-gray-800/30 rounded-lg p-4">
                        <h6 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                          <Code size={16} />
                          Functions ({apiResponse.metadata.functions.length})
                        </h6>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {apiResponse.metadata.functions.slice(0, 8).map((func: any, idx: number) => (
                            <div key={idx} className="bg-gray-700/30 rounded p-3 border-l-2 border-blue-500/50">
                              <div className="font-mono text-sm text-green-300 mb-1">{func.selector}</div>
                              <div className="text-sm text-gray-200 mb-2">{func.intent}</div>
                              {func.fields && func.fields.length > 0 && (
                                <div className="text-xs text-gray-400">
                                  <span className="text-gray-500">Fields:</span> {func.fields.map((f: any) => f.label).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                          {apiResponse.metadata.functions.length > 8 && (
                            <div className="text-center py-2">
                              <span className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded">
                                ... and {apiResponse.metadata.functions.length - 8} more functions
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Constants */}
                    {apiResponse.metadata.constants && Object.keys(apiResponse.metadata.constants).length > 0 && (
                      <div>
                        <h6 className="font-medium text-blue-400">Constants ({Object.keys(apiResponse.metadata.constants).length}):</h6>
                        <div className="ml-4 mt-1 text-sm text-gray-300">
                          {Object.keys(apiResponse.metadata.constants).slice(0, 3).join(', ')}
                          {Object.keys(apiResponse.metadata.constants).length > 3 && '...'}
                        </div>
                      </div>
                    )}

                    {/* Enums */}
                    {apiResponse.metadata.enums && Object.keys(apiResponse.metadata.enums).length > 0 && (
                      <div>
                        <h6 className="font-medium text-blue-400">Enums ({Object.keys(apiResponse.metadata.enums).length}):</h6>
                        <div className="ml-4 mt-1 text-sm text-gray-300">
                          {Object.keys(apiResponse.metadata.enums).slice(0, 3).join(', ')}
                          {Object.keys(apiResponse.metadata.enums).length > 3 && '...'}
                        </div>
                      </div>
                    )}

                    {/* Sources */}
                    <div>
                      <h6 className="font-medium text-blue-400">Data Sources:</h6>
                      <div className="ml-4 mt-1 text-sm flex gap-3">
                        <span className={`px-2 py-1 rounded text-xs ${apiResponse.sources?.graph ? 'bg-green-600' : 'bg-gray-600'}`}>
                          Graph: {apiResponse.sources?.graph ? '✓' : '✗'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${apiResponse.sources?.ipfs ? 'bg-green-600' : 'bg-gray-600'}`}>
                          IPFS: {apiResponse.sources?.ipfs ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold text-gray-300 hover:text-white">
                  View Raw JSON Response
                </summary>
                <pre className="bg-gray-800 p-4 rounded-lg text-xs overflow-x-auto max-h-96 border border-gray-600 mt-2">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </Card>

        {/* Usage Examples */}
        <Card className="p-8 bg-gradient-to-br from-gray-900/80 to-gray-800/40 border-gray-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Package className="text-white" size={16} />
            </div>
            <h2 className="text-2xl font-bold">Integration Guide</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* API Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-200">API Usage</h3>
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/50">
                <code className="text-sm text-gray-300">
                  {`GET /api/contract-metadata
?address=0x123...&chainId=1

Response:
{
  "success": true,
  "metadata": {
    "functions": [...],
    "erc7730": {...}
  }
}`}
                </code>
              </div>
            </div>

            {/* React Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-200">React Component</h3>
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700/50">
                <code className="text-sm text-gray-300">
                  {`import { KaiSignModal } from './components';

<KaiSignModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  contractAddress="0x123..."
  chainId={1}
/>`}
                </code>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
