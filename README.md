# Kai-Sign

A Next.js + FastAPI application for generating and managing ERC7730 descriptors.

## Repository Structure

```
api/
    └── index.py             # FastAPI backend
contracts/                   # Smart contract files
graph/                       # Subgraph for contract events
llm/                         # LLM integration
public/                      # Static assets
src/                         # Next.js frontend
    ├── app/                 # Next.js App Router
    ├── components/          # React components
    └── ...
```

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), Go API
- **Smart Contracts**: Foundry, Solidity
- **Deployment**: Vercel (frontend), Railway (backend)

## Contract Addresses (Sepolia Testnet)

- **KaiSign Contract**: `0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf`
- **Treasury Multisig**: `0x7D8730aD11f0D421bd41c6E5584F20c744CBAf29`

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python 3.12
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Kai-Sign.git
   cd Kai-Sign
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Python environment:
   ```bash
   npm run setup-venv
   ```

4. Set up environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the values in `.env` with your own configuration

### Configuration

#### Using Local Backend (Default)

By default, the application uses the local FastAPI backend running on `http://localhost:8000`. No additional configuration is needed.

#### Using Railway Backend

To use the deployed Railway backend instead of the local backend:

1. Create or update your `.env` file with:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-railway-app-url.railway.app
   ```

2. Replace `your-railway-app-url` with your actual Railway deployment URL.

3. Restart your development server:
   ```bash
   npm run dev
   ```

**Note**: When `NEXT_PUBLIC_API_URL` is set, the frontend will make API calls to the Railway backend instead of the local backend. This is useful for:
- Testing against production data
- Development without running the local Python backend
- Sharing a common backend across multiple developers

#### Environment Variables

**Backend Variables** (for local development):
```bash
ALCHEMY_RPC_URL=your_alchemy_rpc_endpoint
KAISIGN_CONTRACT_ADDRESS=0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf
TREASURY_MULTISIG_ADDRESS=0x7D8730aD11f0D421bd41c6E5584F20c744CBAf29
CURVEGRID_JWT=your_curvegrid_jwt_token
ETHERSCAN_API_KEY=your_etherscan_api_key
USE_MOCK=false
```

**Frontend Variables**:
```bash
NEXT_PUBLIC_API_URL=https://your-railway-app-url.railway.app  # Optional: Use Railway backend
NEXT_PUBLIC_GTM=your_google_tag_manager_id
NEXT_PUBLIC_ONETRUST=your_onetrust_id
NEXT_PUBLIC_IPFS_API_KEY=your_ipfs_api_key
NEXT_PUBLIC_IPFS_API_SECRET=your_ipfs_api_secret
NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS=0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf
NEXT_PUBLIC_TREASURY_MULTISIG_ADDRESS=0x7D8730aD11f0D421bd41c6E5584F20c744CBAf29
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
```

### Running Locally

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Deployment

### Frontend Deployment (Vercel)

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Configure environment variables in the Vercel dashboard
4. Deploy from the Vercel dashboard or use the Vercel CLI

### Backend Deployment (Railway)

1. Connect your repository to Railway
2. Configure environment variables in the Railway dashboard
3. Deploy from the Railway dashboard or use the Railway CLI

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## API Endpoints

- `POST /api/py/generateERC7730`: Generate ERC7730 descriptor
- `POST /api/py/getIPFSMetadata`: Fetch IPFS metadata from contract specID
- `GET /api/py`: Health check endpoint
- `GET /api/healthcheck`: Health check endpoint

### API Usage Examples

#### Generate ERC7730 Descriptor
```bash
curl -X POST https://your-railway-app.railway.app/api/py/generateERC7730 \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234567890123456789012345678901234567890", "chain_id": 1}'
```

#### Fetch IPFS Metadata
```bash
curl -X POST https://your-railway-app.railway.app/api/py/getIPFSMetadata \
  -H "Content-Type: application/json" \
  -d '{"spec_id": "0xa0ffcaf51795d9c96dcdab2deadf864f458480f629eb683d591916369df49316"}'
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request
