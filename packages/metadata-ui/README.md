# KaiSign Metadata UI

A simple React component library and API for fetching JSON metadata from smart contracts. No bytecode decoding required - just pure JSON metadata retrieval.

## Features

- 🚀 **Simple API**: RESTful endpoints for contract metadata
- ⚛️ **React Components**: Pre-built modal and hooks
- 📱 **Responsive Design**: Works on desktop and mobile
- 🎨 **Themeable**: Light and dark mode support
- 📦 **Zero Dependencies**: Only requires React and Lucide icons
- 🔗 **ERC7730 Support**: Automatic IPFS and graph network integration

## Quick Start

### 1. Installation

```bash
npm install kaisign-metadata-ui lucide-react
```

### 2. Basic Usage

```tsx
import { KaiSignModal, useContractMetadata } from 'kaisign-metadata-ui';
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

## API Reference

### REST API

#### Get Contract Metadata

```
GET /api/contract-metadata?address={contractAddress}&chainId={chainId}
```

**Parameters:**
- `address` (required): Contract address (0x...)
- `chainId` (required): Network chain ID (1 for Ethereum, 137 for Polygon, etc.)

**Response:**
```json
{
  "success": true,
  "contractAddress": "0x...",
  "chainId": 1,
  "metadata": {
    "address": "0x...",
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

#### Batch Request

```
POST /api/contract-metadata
```

**Body:**
```json
{
  "contracts": [
    { "address": "0x...", "chainId": 1 },
    { "address": "0x...", "chainId": 137 }
  ]
}
```

### React Components

#### KaiSignModal

A modal component for displaying contract metadata.

```tsx
interface KaiSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractAddress: string;
  chainId: number;
  apiEndpoint?: string;
  className?: string;
  theme?: 'light' | 'dark';
}
```

**Props:**
- `isOpen`: Whether the modal is visible
- `onClose`: Function called when modal should close
- `contractAddress`: Contract address to fetch metadata for
- `chainId`: Network chain ID
- `apiEndpoint`: Custom API endpoint (optional)
- `className`: Additional CSS classes (optional)
- `theme`: UI theme, 'light' or 'dark' (default: 'dark')

#### useContractMetadata

A React hook for fetching contract metadata.

```tsx
function useContractMetadata({
  contractAddress: string;
  chainId: number;
  apiEndpoint?: string;
}) {
  // Returns: { data, loading, error }
}
```

**Usage:**
```tsx
function MyComponent() {
  const { data, loading, error } = useContractMetadata({
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
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
}
```

## Supported Networks

- Ethereum (chainId: 1)
- Polygon (chainId: 137)
- Optimism (chainId: 10)
- Arbitrum (chainId: 42161)
- Base (chainId: 8453)
- Sepolia (chainId: 11155111)
- And more...

## Examples

### Simple Integration

```tsx
import { KaiSignModal } from 'kaisign-metadata-ui';

function TokenInfo({ tokenAddress }) {
  const [showMetadata, setShowMetadata] = useState(false);
  
  return (
    <div>
      <h3>Token: {tokenAddress}</h3>
      <button onClick={() => setShowMetadata(true)}>
        View Metadata
      </button>
      
      <KaiSignModal
        isOpen={showMetadata}
        onClose={() => setShowMetadata(false)}
        contractAddress={tokenAddress}
        chainId={1}
      />
    </div>
  );
}
```

### With Custom Styling

```tsx
<KaiSignModal
  isOpen={isOpen}
  onClose={onClose}
  contractAddress="0x..."
  chainId={1}
  theme="light"
  className="custom-modal-styles"
/>
```

### Using the Hook

```tsx
function ContractStats({ address, chainId }) {
  const { data, loading, error } = useContractMetadata({
    contractAddress: address,
    chainId
  });
  
  if (loading) return <div>Loading contract data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data available</div>;
  
  return (
    <div>
      <h2>{data.metadata.erc7730?.owner || 'Unknown Contract'}</h2>
      <p>Address: {data.contractAddress}</p>
      <p>Network: Chain {data.chainId}</p>
      {data.metadata.erc7730?.info?.url && (
        <a href={data.metadata.erc7730.info.url} target="_blank">
          Learn More
        </a>
      )}
    </div>
  );
}
```

## Advanced Usage

### Custom API Endpoint

```tsx
<KaiSignModal
  isOpen={isOpen}
  onClose={onClose}
  contractAddress="0x..."
  chainId={1}
  apiEndpoint="https://your-api.com/contract-metadata"
/>
```

### Error Handling

```tsx
const { data, loading, error } = useContractMetadata({
  contractAddress: '0x...',
  chainId: 1
});

if (error) {
  console.error('Failed to fetch contract metadata:', error);
  // Handle error appropriately
}
```

## Development

### Setup

```bash
git clone https://github.com/kaisign/metadata-ui
cd metadata-ui
npm install
```

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
