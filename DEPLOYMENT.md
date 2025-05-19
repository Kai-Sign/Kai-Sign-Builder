# Deployment Guide: Kai-Sign

This document provides instructions for deploying the Kai-Sign application using Vercel for the frontend and Railway for the backend.

## Architecture Overview

The application uses a split deployment architecture:
- **Frontend**: Next.js hosted on Vercel
- **Backend**: FastAPI hosted on Railway

## Prerequisites

1. GitHub account
2. Vercel account (https://vercel.com)
3. Railway account (https://railway.app)
4. Etherscan API key

## Environment Variables

Create a `.env` file based on the `.env.example` template with the following variables:

```
# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Configuration
USE_MOCK=false

# Node environment
NODE_ENV=development

# Next.js environment variables
NEXT_PUBLIC_API_URL=http://localhost:8000  # For local development
NEXT_PUBLIC_VERCEL_URL=localhost:3000      # For local development

# For Railway deployment
PORT=8000
```

## Frontend Deployment (Vercel)

1. Fork/Clone this repository to your GitHub account
2. Log in to Vercel and create a new project linked to your GitHub repository
3. Configure the following environment variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: The URL of your Railway API deployment (e.g., https://your-app.railway.app)
4. Deploy the application using the Vercel dashboard or CLI:
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```
5. For production deployment:
   ```bash
   vercel --prod
   ```

## Backend Deployment (Railway)

1. Log in to Railway and create a new project
2. Link your GitHub repository to the Railway project
3. Configure the following environment variables in Railway:
   - `ETHERSCAN_API_KEY`: Your Etherscan API key
   - `USE_MOCK`: Set to "false" for production (optional)
4. Deploy the application:
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway up
   ```

## Testing the Deployment

1. Test the Vercel frontend by visiting your Vercel deployment URL
2. Test the Railway backend with:
   ```bash
   curl https://your-app.railway.app/api/healthcheck
   ```
3. Verify integrated functionality by using the frontend to interact with the backend

## Troubleshooting

### Vercel Deployment Issues
- Check Vercel deployment logs in the Vercel dashboard
- Ensure all required environment variables are set
- Verify that the `next.config.js` and `vercel.json` files are correctly configured

### Railway Deployment Issues
- Check Railway deployment logs in the Railway dashboard
- Ensure the Python version is correctly specified in `runtime.txt`
- Verify that all dependencies are listed in `requirements.txt`
- Check that `railway.json` and `railway.toml` have the correct configuration

## Local Development

To run the application locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the Python virtual environment:
   ```bash
   npm run setup-venv
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

## Maintenance

### Updating the Deployment

1. Push changes to your GitHub repository
2. Vercel and Railway will automatically redeploy your application

### Monitoring

- Use the Vercel and Railway dashboards to monitor your application
- Check logs for any errors or issues 