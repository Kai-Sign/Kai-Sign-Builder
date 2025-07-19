'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ContractSelector } from '~/components/ContractSelector';
import { TransactionPreview } from '~/components/TransactionPreview';
import { useKaiSign, useTransactionPreview } from '~/hooks/useKaiSign';
import { type ContractMetadata } from '~/lib/graphClient';
import { Code2, Eye, Search, Zap } from 'lucide-react';

const EXAMPLE_TRANSACTIONS = [
  {
    name: 'USDC Transfer',
    to: '0xA0b86a33E6C73bEf4De6da2A25F96c3A02B7B644',
    data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d23ba14ac04f49c50000000000000000000000000000000000000000000000000de0b6b3a7640000',
    chainId: '11155111'
  },
  {
    name: 'Uniswap Swap',
    to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    data: '0x414bf389000000000000000000000000a0b86a33e6c73bef4de6da2a25f96c3a02b7b6440000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000',
    chainId: '11155111'
  }
];

export default function KaiSignDemo() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractMetadata | null>(null);
  const [previewTransaction, setPreviewTransaction] = useState(EXAMPLE_TRANSACTIONS[0]);
  const [customTransaction, setCustomTransaction] = useState({
    to: '',
    data: '',
    chainId: '11155111'
  });

  const graphEndpoint = 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia';
  
  const { contracts, functions, loading, error, actions } = useKaiSign({
    graphEndpoint,
    chainID: '11155111'
  });

  const { previewTransaction: analyzeTransaction, loading: analyzing } = useTransactionPreview(
    graphEndpoint,
    '11155111'
  );

  const handleAnalyzeCustom = async () => {
    if (customTransaction.to && customTransaction.data) {
      const result = await analyzeTransaction(customTransaction.to, customTransaction.data);
      console.log('Analysis result:', result);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">KaiSign SDK Demo</h1>
        <p className="text-muted-foreground">
          Comprehensive contract metadata integration for wallets and dApps
        </p>
      </div>

      <Tabs defaultValue="components" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="components">UI Components</TabsTrigger>
          <TabsTrigger value="hooks">React Hooks</TabsTrigger>
          <TabsTrigger value="api">API Examples</TabsTrigger>
          <TabsTrigger value="integration">Integration Guide</TabsTrigger>
        </TabsList>

        {/* UI Components Tab */}
        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Contract Selector Demo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Contract Selector
                </CardTitle>
                <CardDescription>
                  Modal component for selecting contracts with metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => setSelectorOpen(true)}>
                  Open Contract Selector
                </Button>
                
                {selectedContract && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <h4 className="font-medium">{selectedContract.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedContract.address}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="secondary">v{selectedContract.version}</Badge>
                      <Badge variant="outline">{selectedContract.functionCount} functions</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transaction Preview Demo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Transaction Preview
                </CardTitle>
                <CardDescription>
                  Analyze and preview transactions with metadata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Example Transactions:</label>
                  <div className="flex gap-2">
                    {EXAMPLE_TRANSACTIONS.map((tx, idx) => (
                      <Button
                        key={idx}
                        variant={previewTransaction === tx ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreviewTransaction(tx)}
                      >
                        {tx.name}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <TransactionPreview
                  contractAddress={previewTransaction?.to || ''}
                  data={previewTransaction?.data || ''}
                  chainID={previewTransaction?.chainId || '11155111'}
                  graphEndpoint={graphEndpoint}
                  showRawData={true}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* React Hooks Tab */}
        <TabsContent value="hooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                useKaiSign Hook
              </CardTitle>
              <CardDescription>
                React hook for contract metadata management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Hook Status */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Contracts:</span> {contracts.length}
                  {loading.contracts && <span className="text-muted-foreground ml-1">(loading...)</span>}
                </div>
                <div>
                  <span className="font-medium">Functions:</span> {functions.length}
                  {loading.functions && <span className="text-muted-foreground ml-1">(loading...)</span>}
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <Badge variant={error ? "destructive" : "secondary"} className="ml-1">
                    {error ? "Error" : "Ready"}
                  </Badge>
                </div>
              </div>

              {/* Contracts List */}
              <div>
                <h4 className="font-medium mb-2">Available Contracts ({contracts.length})</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {contracts.slice(0, 5).map((contract) => (
                    <div key={contract.address} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <div>
                        <span className="font-medium">{contract.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {contract.functionCount} functions
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Hook Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={actions.loadContracts}
                  disabled={loading.contracts}
                >
                  Refresh Contracts
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => actions.searchContracts('USDC')}
                >
                  Search "USDC"
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Examples Tab */}
        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* API Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  API Endpoints
                </CardTitle>
                <CardDescription>
                  Direct REST API access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Available Endpoints:</div>
                  <div className="space-y-1 text-xs font-mono bg-muted p-2 rounded">
                    <div>GET /api/contracts?chainId=11155111</div>
                    <div>GET /api/contracts/[address]?chainId=11155111</div>
                    <div>GET /api/metadata?chainId=11155111&contract=...&selector=...</div>
                    <div>POST /api/analyze</div>
                  </div>
                </div>
                
                <Button size="sm" asChild>
                  <a href="/api/contracts?chainId=11155111" target="_blank">
                    Test Contracts API
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Custom Transaction Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Transaction</CardTitle>
                <CardDescription>
                  Test transaction analysis with your own data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Input
                    placeholder="Contract address (0x...)"
                    value={customTransaction.to}
                    onChange={(e) => setCustomTransaction(prev => ({
                      ...prev,
                      to: e.target.value
                    }))}
                  />
                  <Input
                    placeholder="Transaction data (0x...)"
                    value={customTransaction.data}
                    onChange={(e) => setCustomTransaction(prev => ({
                      ...prev,
                      data: e.target.value
                    }))}
                  />
                </div>
                
                <Button 
                  onClick={handleAnalyzeCustom}
                  disabled={analyzing || !customTransaction.to || !customTransaction.data}
                  className="w-full"
                >
                  {analyzing ? "Analyzing..." : "Analyze Transaction"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integration Guide Tab */}
        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Guide</CardTitle>
              <CardDescription>
                How to integrate KaiSign into your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Installation */}
              <div>
                <h3 className="font-medium mb-2">1. Installation</h3>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`npm install graphql-request graphql
# Copy KaiSign components to your project`}</code>
                </pre>
              </div>

              {/* Basic Usage */}
              <div>
                <h3 className="font-medium mb-2">2. Basic Usage</h3>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`import { useKaiSign } from './hooks/useKaiSign';

function MyComponent() {
  const { contracts, actions } = useKaiSign({
    graphEndpoint: 'https://api.thegraph.com/...',
    chainID: '11155111'
  });

  const handleTransaction = async (to, data) => {
    const metadata = await actions.getTransactionMetadata(
      to, 
      data.slice(0, 10)
    );
    
    if (metadata) {
      console.log(\`Action: \${metadata.intent}\`);
    }
  };

  return <div>...</div>;
}`}</code>
                </pre>
              </div>

              {/* API Usage */}
              <div>
                <h3 className="font-medium mb-2">3. Direct API Usage</h3>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`// Get all contracts
const response = await fetch('/api/contracts?chainId=11155111');
const { data } = await response.json();

// Analyze transaction
const analysis = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '0x...',
    data: '0xa9059cbb...',
    chainId: '11155111'
  })
});`}</code>
                </pre>
              </div>

              {/* Benefits */}
              <div>
                <h3 className="font-medium mb-2">4. Key Benefits</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Always returns latest approved metadata (handles disputes automatically)</li>
                  <li>Type-safe TypeScript interfaces</li>
                  <li>Ready-to-use React components</li>
                  <li>Comprehensive error handling</li>
                  <li>Works with any React framework</li>
                  <li>RESTful API for non-React applications</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contract Selector Modal */}
      <ContractSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        chainID="11155111"
        graphEndpoint={graphEndpoint}
        onContractSelect={(contract) => {
          setSelectedContract(contract);
          setSelectorOpen(false);
        }}
        title="Select Contract with Metadata"
        showFunctions={false}
      />
    </div>
  );
}
