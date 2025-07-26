"use client";

import React, { useState } from 'react';
import { KaiSignModal } from '~/components/kaisign-metadata-ui';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ExternalLink, Code, Package } from 'lucide-react';

const SAMPLE_CONTRACTS = [
  {
    name: 'USDC Token',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    description: 'USD Coin on Ethereum'
  },
  {
    name: 'KaiSign Contract',
    address: '0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf',
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(SAMPLE_CONTRACTS[0]);
  const [customAddress, setCustomAddress] = useState('');
  const [customChainId, setCustomChainId] = useState('1');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  const openModal = (contract: typeof SAMPLE_CONTRACTS[0]) => {
    setSelectedContract(contract);
    setIsModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">KaiSign Contract Metadata API & UI</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Simple JSON metadata retrieval from smart contracts with an easy-to-use React component library.
            No bytecode decoding required - just pure JSON metadata.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-gray-900 border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Code className="text-blue-400" size={24} />
              <h3 className="text-lg font-semibold">Simple API</h3>
            </div>
            <p className="text-sm text-gray-400">
              RESTful API endpoints for fetching contract metadata. Just provide address and chain ID.
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Package className="text-green-400" size={24} />
              <h3 className="text-lg font-semibold">React Component</h3>
            </div>
            <p className="text-sm text-gray-400">
              Pre-built modal component that developers can import and use instantly in their applications.
            </p>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <ExternalLink className="text-purple-400" size={24} />
              <h3 className="text-lg font-semibold">ERC7730 Support</h3>
            </div>
            <p className="text-sm text-gray-400">
              Automatically fetches and displays ERC7730 metadata when available from IPFS or graph networks.
            </p>
          </Card>
        </div>

        {/* API Demo */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-2xl font-bold mb-4">API Demo</h2>
          
          {/* Sample Contracts */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Try with sample contracts:</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {SAMPLE_CONTRACTS.map((contract, index) => (
                <button
                  key={index}
                  onClick={() => handleTestAPI(contract.address, contract.chainId.toString())}
                  className="p-3 text-left bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-600 transition-colors"
                >
                  <div className="font-medium">{contract.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{contract.description}</div>
                  <div className="text-xs text-blue-400 mt-1 font-mono">{contract.address}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Contract Address (0x...)"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            <div>
              <Input
                placeholder="Chain ID"
                value={customChainId}
                onChange={(e) => setCustomChainId(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
          </div>

          <Button
            onClick={() => handleTestAPI(customAddress, customChainId)}
            disabled={!customAddress || loading}
            className="mb-4"
          >
            {loading ? 'Loading...' : 'Test API'}
          </Button>

          {/* API Response */}
          {apiResponse && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">API Response:</h4>
              <pre className="bg-gray-800 p-4 rounded-lg text-xs overflow-x-auto max-h-96 border border-gray-600">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* UI Component Demo */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-2xl font-bold mb-4">UI Component Demo</h2>
          <p className="text-gray-400 mb-4">
            Click any button below to see the KaiSign metadata modal in action:
          </p>
          
          <div className="grid md:grid-cols-3 gap-3">
            {SAMPLE_CONTRACTS.map((contract, index) => (
              <Button
                key={index}
                onClick={() => openModal(contract)}
                variant="outline"
                className="p-4 h-auto flex flex-col items-start text-left"
              >
                <div className="font-medium">{contract.name}</div>
                <div className="text-xs text-gray-400 mt-1">{contract.description}</div>
                <Badge variant="secondary" className="mt-2">Chain {contract.chainId}</Badge>
              </Button>
            ))}
          </div>
        </Card>

        {/* Usage Examples */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-2xl font-bold mb-4">Usage Examples</h2>
          
          <div className="space-y-6">
            {/* API Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-2">API Usage</h3>
              <div className="bg-gray-800 p-4 rounded-lg">
                <code className="text-sm">
                  {`GET /api/contract-metadata?address=0x123...&chainId=1

{
  "success": true,
  "contractAddress": "0x123...",
  "chainId": 1,
  "metadata": {
    "address": "0x123...",
    "chainId": 1,
    "erc7730": {
      "owner": "Circle",
      "info": {
        "legalName": "Circle",
        "url": "https://circle.com"
      }
    }
  },
  "sources": {
    "graph": true,
    "ipfs": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}`}
                </code>
              </div>
            </div>

            {/* React Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-2">React Component Usage</h3>
              <div className="bg-gray-800 p-4 rounded-lg">
                <code className="text-sm">
                  {`import { KaiSignModal } from '~/components/kaisign-metadata-ui';

function MyApp() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(true)}>
        View Contract Metadata
      </button>
      
      <KaiSignModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contractAddress="0x123..."
        chainId={1}
        theme="dark" // or "light"
      />
    </div>
  );
}`}
                </code>
              </div>
            </div>

            {/* Hook Usage */}
            <div>
              <h3 className="text-lg font-semibold mb-2">React Hook Usage</h3>
              <div className="bg-gray-800 p-4 rounded-lg">
                <code className="text-sm">
                  {`import { useContractMetadata } from '~/components/kaisign-metadata-ui';

function MyComponent() {
  const { data, loading, error } = useContractMetadata({
    contractAddress: '0x123...',
    chainId: 1
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h2>{data?.metadata.erc7730?.owner}</h2>
      <p>Contract: {data?.contractAddress}</p>
    </div>
  );
}`}
                </code>
              </div>
            </div>
          </div>
        </Card>

        {/* Package Installation */}
        <Card className="p-6 bg-gray-900 border-gray-700">
          <h2 className="text-2xl font-bold mb-4">Installation</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Copy the component file</h3>
              <p className="text-gray-400 text-sm mb-2">
                Copy <code className="bg-gray-800 px-2 py-1 rounded">kaisign-metadata-ui.tsx</code> to your project's components folder.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Install dependencies</h3>
              <div className="bg-gray-800 p-3 rounded-lg">
                <code className="text-sm">npm install lucide-react</code>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. Use in your app</h3>
              <p className="text-gray-400 text-sm">
                Import and use the component as shown in the examples above.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal */}
      {selectedContract && (
        <KaiSignModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          contractAddress={selectedContract.address}
          chainId={selectedContract.chainId}
        />
      )}
    </div>
  );
}
