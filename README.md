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
- `GET /api/healthcheck`: Health check endpoint

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request
