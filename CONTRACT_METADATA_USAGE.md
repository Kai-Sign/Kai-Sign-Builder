# KaiSign Contract Metadata API & UI

This document explains how to use the KaiSign Contract Metadata API and UI components to retrieve JSON metadata from smart contracts.

## Quick Overview

We've created a simple API and React component library that allows developers to:

1. **Fetch contract metadata via REST API** - Get JSON metadata from smart contracts
2. **Use a pre-built React modal component** - Display metadata in a user-friendly modal
3. **Import and integrate easily** - Copy the component file and start using immediately

## 🚀 Getting Started

### Option 1: Direct API Usage

**GET** `/api/contract-metadata?address={contractAddress}&chainId={chainId}`

```bash
curl "https://your-app.com/api/contract-metadata?address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&chainId=1"
```

**Response:**
```json
{
  "success": true,
  "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chainId": 1,
  "metadata": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chainId": 1,
    "erc7730": {
      "owner": "Circle",
      "info": {
        "legalName": "Circle Internet Financial LLC",
        "url": "https://circle.com"
      }
    }
  },
  "sources": {
    "graph": true,
    "ipfs": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Option 2: React Component Usage

1. **Copy the component file:**
   ```bash
   cp src/components/kaisign-metadata-ui.tsx your-project/components/
   ```

2. **Install dependencies:**
   ```bash
   npm install lucide-react
   ```

3. **Use in your React app:**
   ```tsx
   import { KaiSignModal } from './components/kaisign-metadata-ui';
   import { useState } from 'react';

   function App() {
     const [isOpen, setIsOpen] = useState(false);
     
     return (
       <div>
         <button onClick={() => setIsOpen(true)}>
           View Contract Metadata
         </button>
         
         <KaiSignModal
           isOpen={isOpen}
           onClose={() => setIsOpen(false)}
           contractAddress="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
           chainId={1}
           theme="dark"
         />
       </div>
     );
   }
   ```

## 📚 Component API Reference

### KaiSignModal Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | ✅ | - | Whether modal is visible |
| `onClose` | `() => void` | ✅ | - | Function called when modal closes |
| `contractAddress` | `string` | ✅ | - | Contract address to fetch metadata for |
| `chainId` | `number` | ✅ | - | Network chain ID |
| `apiEndpoint` | `string` | ❌ | `/api/contract-metadata` | Custom API endpoint |
| `className` | `string` | ❌ | `''` | Additional CSS classes |
| `theme` | `'light' \| 'dark'` | ❌ | `'dark'` | UI theme |

### useContractMetadata Hook

```tsx
const { data, loading, error } = useContractMetadata({
  contractAddress: '0x...',
  chainId: 1,
  apiEndpoint: '/api/contract-metadata' // optional
});
```

**Returns:**
- `data`: Contract metadata object or null
- `loading`: Boolean indicating if request is in progress
- `error`: Error message string or null

## 🌐 Supported Networks

- **Ethereum** (chainId: 1)
- **Polygon** (chainId: 137)
- **Optimism** (chainId: 10)
- **Arbitrum** (chainId: 42161)
- **Base** (chainId: 8453)
- **Sepolia** (chainId: 11155111)

## 💡 Use Cases

### 1. DeFi Applications
```tsx
function TokenSwapInterface({ tokenAddress }) {
  const [showInfo, setShowInfo] = useState(false);
  
  return (
    <div>
      <h3>Swapping {tokenAddress}</h3>
      <button onClick={() => setShowInfo(true)}>
        ℹ️ Token Info
      </button>
      
      <KaiSignModal
        isOpen={showInfo}
        onClose={() => setShowInfo(false)}
        contractAddress={tokenAddress}
        chainId={1}
      />
    </div>
  );
}
```

### 2. Wallet Applications
```tsx
function TransactionDetails({ contractAddress, chainId }) {
  const { data, loading } = useContractMetadata({
    contractAddress,
    chainId
  });
  
  if (loading) return <div>Loading contract info...</div>;
  
  return (
    <div>
      <h4>{data?.metadata.erc7730?.owner || 'Unknown Contract'}</h4>
      <p>Interacting with: {contractAddress}</p>
      {data?.metadata.erc7730?.info?.url && (
        <a href={data.metadata.erc7730.info.url}>Learn more</a>
      )}
    </div>
  );
}
```

### 3. Portfolio Trackers
```tsx
function ContractList({ contracts }) {
  return (
    <div>
      {contracts.map(contract => (
        <ContractCard 
          key={contract.address}
          address={contract.address}
          chainId={contract.chainId}
        />
      ))}
    </div>
  );
}

function ContractCard({ address, chainId }) {
  const [showDetails, setShowDetails] = useState(false);
  const { data } = useContractMetadata({ contractAddress: address, chainId });
  
  return (
    <div className="card">
      <h3>{data?.metadata.erc7730?.owner || 'Unknown'}</h3>
      <p>{address}</p>
      <button onClick={() => setShowDetails(true)}>
        View Details
      </button>
      
      <KaiSignModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        contractAddress={address}
        chainId={chainId}
      />
    </div>
  );
}
```

## 🔧 Advanced Configuration

### Custom API Endpoint

```tsx
<KaiSignModal
  isOpen={isOpen}
  onClose={onClose}
  contractAddress="0x..."
  chainId={1}
  apiEndpoint="https://your-custom-api.com/metadata"
/>
```

### Custom Styling

```tsx
<KaiSignModal
  isOpen={isOpen}
  onClose={onClose}
  contractAddress="0x..."
  chainId={1}
  theme="light"
  className="my-custom-modal-styles"
/>
```

### Error Handling

```tsx
function MyComponent() {
  const { data, loading, error } = useContractMetadata({
    contractAddress: '0x...',
    chainId: 1
  });
  
  if (error) {
    console.error('Contract metadata error:', error);
    return <div>Unable to load contract information</div>;
  }
  
  // ... rest of component
}
```

## 🎯 Demo

Visit `/contract-metadata-demo` in the KaiSign Builder application to see live examples and test the API with real contracts.

## 📦 Package Installation (Future)

When published as an NPM package:

```bash
npm install kaisign-metadata-ui
```

```tsx
import { KaiSignModal, useContractMetadata } from 'kaisign-metadata-ui';
```