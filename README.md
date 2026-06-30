# Kai Sign Builder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

An open-source tool for building, visualizing, and managing **ERC7730** transaction descriptors for hardware wallets. Create clear, user-friendly transaction displays that help users understand what they're signing before approving blockchain transactions.

## 🚀 What is ERC7730?

[ERC7730](https://eips.ethereum.org/EIPS/eip-7730) is an Ethereum standard that defines structured metadata for describing smart contract interactions in human-readable format. It enables hardware wallets and dApps to show users clear transaction details instead of raw bytecode.

**Example**: Instead of seeing `0xa9059cbb000000000000000000...`, users see:
- **Action**: Transfer USDC
- **To**: vitalik.eth  
- **Amount**: 100.00 USDC

## ✨ Features

- 🎨 **Visual ERC7730 Builder** - Drag-and-drop interface for creating transaction descriptors
- 📱 **Hardware Wallet Preview** - See exactly how transactions appear on Ledger devices
- 🔍 **Multi-Contract Support** - Handle complex transactions (Safe + Token operations)
- 📊 **Real Transaction Testing** - Validate descriptors with actual blockchain data
- 🌐 **Blob Storage** - Decentralized metadata storage via Ethereum blobs
- 🔐 **Digital Signatures** - Cryptographic verification of metadata authenticity

## 🏗️ Architecture

```
├── frontend/               # Next.js application
│   ├── src/app/           # App router pages
│   ├── src/components/    # React components
│   └── src/lib/          # Utilities and services
├── backend/               # Python FastAPI server
├── contracts/             # Solidity contracts (Foundry)
├── graph/                # Subgraph for indexing events
└── llm/                  # AI-assisted descriptor generation
```

## 🛠️ Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Python FastAPI
- **Contracts**: Solidity, Foundry
- **Deployment**: Vercel, Railway

## Contract Addresses (Sepolia Testnet)

- **KaiSign Registry (Sepolia)**: `0x655084b6A0f2Ee600bd31A71820b5E068b7870d0`

See [MERKLE.md](MERKLE.md) to rebuild the complete metadata set locally and verify it against the on-chain Merkle root. This works without trusting or running the KaiSign backend; users can consume the verified metadata from `metadata/`, `../kaisign-extension`, MCP, or any other client.

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
KAISIGN_CONTRACT_ADDRESS=0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719
CURVEGRID_JWT=your_curvegrid_jwt_token
ETHERSCAN_API_KEY=your_etherscan_api_key
USE_MOCK=false
```

**Frontend Variables**:
```bash
NEXT_PUBLIC_API_URL=https://your-railway-app-url.railway.app
NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS=0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719
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

## 🤝 Contributing

We welcome contributions from the community! This project follows standard open source practices.

### Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/Kai-Sign-Builder.git`
3. **Install** dependencies: `cd Kai-Sign-Builder && npm install`
4. **Create** a branch: `git checkout -b feature/your-feature-name`
5. **Make** your changes
6. **Test** your changes: `npm run dev`
7. **Commit** with clear messages: `git commit -m "feat: add new feature"`
8. **Push** to your fork: `git push origin feature/your-feature-name`
9. **Create** a Pull Request

### Development Guidelines

- **Code Style**: We use Prettier and ESLint - run `npm run lint` before committing
- **TypeScript**: Maintain type safety - no `any` types without justification
- **Testing**: Add tests for new features in the appropriate test files
- **Documentation**: Update README and add JSDoc comments for new functions

### Types of Contributions Welcome

- 🐛 **Bug fixes** - Help us squash issues
- ✨ **New features** - Enhance ERC7730 tooling
- 📝 **Documentation** - Improve guides and examples
- 🎨 **UI/UX** - Better user experience
- 🧪 **Testing** - Increase test coverage
- 🔧 **DevOps** - Improve build and deployment

### Reporting Issues

When reporting bugs, please include:
- **Description** - Clear description of the issue
- **Steps to reproduce** - How to trigger the bug
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, browser, Node.js version
- **Screenshots** - If applicable

### Pull Request Guidelines

- **One feature per PR** - Keep changes focused
- **Clear title** - Use conventional commits (feat:, fix:, docs:, etc.)
- **Description** - Explain what and why
- **Link issues** - Reference related issue numbers
- **Tests pass** - Ensure CI checks pass
- **Review ready** - Mark as ready when complete

## 📄 License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our [Gitbook](kaisign.gitbook.io) for detailed guides
- **Issues**: Report bugs via [GitHub Issues](../../issues)
- **Community**: Follow us for updates and announcements

## 🙏 Acknowledgments

- [ERC7730 Standard](https://eips.ethereum.org/EIPS/eip-7730) - The foundation of this project
- [Ledger](https://www.ledger.com/) - Hardware wallet integration insights
- [ENS PG Builder Grants](https://builder.ensgrants.xyz/) - Supporting ecosystem development
- **Contributors** - Thank you to everyone who has contributed code, ideas, and feedback

---

**Built with ⟠ for the Ethereum ecosystem**
