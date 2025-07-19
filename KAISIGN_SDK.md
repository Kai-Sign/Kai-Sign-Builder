# KaiSign SDK Documentation

The KaiSign SDK provides easy access to contract metadata through both UI components and API endpoints. It automatically handles disputes and replacements by always providing the latest approved metadata.

## Installation

```bash
npm install graphql-request graphql
# Add KaiSign components to your project
```

## Quick Start

### 1. Using React Hooks

```tsx
import { useKaiSign } from './hooks/useKaiSign';

function MyWalletApp() {
  const { contracts, loading, actions } = useKaiSign({
    graphEndpoint: 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia',
    chainID: '11155111' // Sepolia
  });

  const handleTransactionPreview = async (to: string, data: string) => {
    const metadata = await actions.getTransactionMetadata(to, data.slice(0, 10));
    
    if (metadata) {
      console.log(`Action: ${metadata.intent}`);
    } else {
      console.log('Unknown transaction');
    }
  };

  return (
    <div>
      <h2>Contracts ({contracts.length})</h2>
      {loading.contracts ? (
        <div>Loading...</div>
      ) : (
        contracts.map(contract => (
          <div key={contract.address}>
            <h3>{contract.name}</h3>
            <p>{contract.address}</p>
          </div>
        ))
      )}
    </div>
  );
}
```

### 2. Using UI Components

```tsx
import { ContractSelector } from './components/ContractSelector';
import { TransactionPreview } from './components/TransactionPreview';
import { useState } from 'react';

function WalletUI() {
  const [showSelector, setShowSelector] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  return (
    <>
      <button onClick={() => setShowSelector(true)}>
        Select Contract
      </button>
      
      <ContractSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        chainID="11155111"
        graphEndpoint="https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia"
        onContractSelect={(contract) => {
          setSelectedContract(contract);
          console.log('Selected:', contract);
        }}
        showFunctions={true}
        onFunctionSelect={(func, contract) => {
          console.log('Function selected:', func.name, func.intent);
        }}
      />

      {/* Transaction Preview */}
      <TransactionPreview
        contractAddress="0x..."
        data="0xa9059cbb..." // Transfer function calldata
        chainID="11155111"
        graphEndpoint="https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia"
        showRawData={true}
      />
    </>
  );
}
```

### 3. Using Direct Client

```tsx
import { KaiSignGraphClient } from './lib/graphClient';

const client = new KaiSignGraphClient(
  'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia'
);

// Get all contracts with metadata
const contracts = await client.getContractsWithMetadata('11155111');

// Get transaction metadata
const metadata = await client.getTransactionMetadata(
  '0x...', // contract address
  '0xa9059cbb', // function selector
  '11155111' // chain ID
);

// Search contracts
const results = await client.searchContracts('USDC', '11155111');
```

## API Endpoints

### GET /api/contracts

Get all contracts with approved metadata.

**Parameters:**
- `chainId` (required): Blockchain chain ID
- `search` (optional): Search term for contract names
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "contracts": [
      {
        "address": "0x...",
        "chainId": "11155111",
        "name": "USDC Token",
        "version": "1.0.0",
        "description": "USD Coin stablecoin",
        "hasApprovedMetadata": true,
        "functionCount": 12,
        "lastUpdated": "1642524400"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### GET /api/contracts/[address]

Get all functions for a specific contract.

**Parameters:**
- `chainId` (required): Blockchain chain ID

**Response:**
```json
{
  "success": true,
  "recognized": true,
  "data": {
    "contract": "0x...",
    "chainId": "11155111",
    "functions": [
      {
        "selector": "0xa9059cbb",
        "name": "transfer",
        "intent": "Transfer {{amount}} to {{to}}",
        "displayFormat": "transfer",
        "parameterTypes": ["address", "uint256"]
      }
    ],
    "specHistory": [
      {
        "id": "0x...",
        "creator": "0x...",
        "ipfsCID": "QmXYZ...",
        "timestamp": "1642524400",
        "status": "FINALIZED"
      }
    ],
    "totalFunctions": 12,
    "lastUpdated": "1642524400"
  }
}
```

### GET /api/metadata

Get metadata for a specific function.

**Parameters:**
- `chainId` (required): Blockchain chain ID
- `contract` (required): Contract address
- `selector` (required): Function selector (0x...)

**Response:**
```json
{
  "success": true,
  "recognized": true,
  "data": {
    "selector": "0xa9059cbb",
    "name": "transfer",
    "intent": "Transfer {{amount}} to {{to}}",
    "displayFormat": "transfer",
    "parameterTypes": ["address", "uint256"],
    "contract": "0x...",
    "chainId": "11155111"
  }
}
```

### POST /api/analyze

Analyze a complete transaction.

**Request Body:**
```json
{
  "to": "0x...",
  "data": "0xa9059cbb...",
  "chainId": "11155111",
  "value": "0", // optional
  "gasLimit": "21000" // optional
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "to": "0x...",
    "data": "0xa9059cbb...",
    "value": "0",
    "chainId": "11155111",
    "gasLimit": "21000",
    "selector": "0xa9059cbb",
    "parametersHex": "..."
  },
  "analysis": {
    "recognized": true,
    "metadata": {
      "functionName": "transfer",
      "intent": "Transfer {{amount}} to {{to}}",
      "displayFormat": "transfer",
      "parameterTypes": ["address", "uint256"]
    }
  },
  "preview": {
    "action": "Transfer {{amount}} to {{to}}",
    "formattedValue": null,
    "isContract": true,
    "riskLevel": "LOW"
  }
}
```

## Integration Examples

### Wallet Integration

```tsx
import { useTransactionPreview } from './hooks/useKaiSign';

function TransactionConfirmation({ transaction }) {
  const { previewTransaction, loading } = useTransactionPreview(
    'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia',
    '11155111'
  );

  const [preview, setPreview] = useState(null);

  useEffect(() => {
    previewTransaction(transaction.to, transaction.data)
      .then(setPreview);
  }, [transaction]);

  return (
    <div>
      <h2>Confirm Transaction</h2>
      {loading ? (
        <div>Analyzing transaction...</div>
      ) : preview?.isRecognized ? (
        <div className="bg-green-100 p-4 rounded">
          <h3>✅ Recognized Action</h3>
          <p>{preview.metadata.intent}</p>
        </div>
      ) : (
        <div className="bg-yellow-100 p-4 rounded">
          <h3>⚠️ Unknown Function</h3>
          <p>This transaction calls an unrecognized function</p>
        </div>
      )}
    </div>
  );
}
```

### DApp Integration

```tsx
function DAppInterface() {
  const [selectedContract, setSelectedContract] = useState(null);
  
  return (
    <div>
      <ContractSelector
        isOpen={true}
        onClose={() => {}}
        chainID="1" // Mainnet
        graphEndpoint="https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-mainnet"
        onContractSelect={setSelectedContract}
        title="Select Contract to Interact With"
      />
      
      {selectedContract && (
        <div>
          <h2>{selectedContract.name}</h2>
          <p>Version: {selectedContract.version}</p>
          <p>Functions: {selectedContract.functionCount}</p>
        </div>
      )}
    </div>
  );
}
```

### MetaMask Snap Integration

```javascript
// In your MetaMask Snap
export const onTransaction = async ({ transaction }) => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: transaction.to,
        data: transaction.data,
        chainId: transaction.chainId,
        value: transaction.value
      })
    });
    
    const analysis = await response.json();
    
    if (analysis.success && analysis.analysis.recognized) {
      return {
        content: panel([
          heading('Transaction Preview'),
          text(`Action: ${analysis.preview.action}`),
          text(`Risk Level: ${analysis.preview.riskLevel}`)
        ])
      };
    } else {
      return {
        content: panel([
          heading('⚠️ Unrecognized Transaction'),
          text('This transaction calls an unknown function.')
        ])
      };
    }
  } catch (error) {
    return {
      content: panel([
        heading('Analysis Failed'),
        text('Could not analyze this transaction.')
      ])
    };
  }
};
```

## Error Handling

All API endpoints return consistent error formats:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common error codes:
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (contract/function not recognized)
- `500` - Internal Server Error

React components handle errors gracefully and provide fallback UI.

## Environment Setup

```bash
# Required environment variables
KAISIGN_GRAPH_ENDPOINT=https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia
KAISIGN_CONTRACT_ADDRESS=0x2d2f90786a365a2044324f6861697e9EF341F858

# For production
KAISIGN_GRAPH_ENDPOINT_MAINNET=https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-mainnet
```

## Benefits

1. **Always Latest Metadata**: Automatically handles disputes and replacements
2. **Developer Friendly**: Easy-to-use components and hooks
3. **Type Safe**: Full TypeScript support
4. **Performant**: Cached subgraph queries
5. **Flexible**: Works with any React framework or plain JavaScript
6. **Comprehensive**: Covers all use cases from simple lookups to complex wallet integrations

## Next Steps

1. Deploy the updated subgraph with latest metadata tracking
2. Test the API endpoints with real contract data
3. Create additional UI components as needed
4. Add support for more blockchain networks
5. Implement caching for better performance
