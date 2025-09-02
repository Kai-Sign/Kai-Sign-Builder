#!/usr/bin/env python3
"""
Entry point for the Railway/Docker deployment.
This script starts the FastAPI server after setting up all necessary environment variables.
"""
import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

def main():
    """Main entry point for the application."""
    # Set default values for required environment variables
    if not os.environ.get("USE_MOCK"):
        # Default to mock mode if no Etherscan API key is available
        os.environ["USE_MOCK"] = "true" if not os.environ.get("ETHERSCAN_API_KEY") else "false"
    
    # Get port from environment variable (Railway sets this)
    port = int(os.environ.get("PORT", 8000))
    
    # Log important information
    print(f"Starting API server on port {port}")
    print(f"USE_MOCK: {os.environ.get('USE_MOCK')}")
    
    if os.environ.get("ETHERSCAN_API_KEY"):
        # Don't show the full API key, just that it's set
        print(f"ETHERSCAN_API_KEY: {os.environ.get('ETHERSCAN_API_KEY')[:4]}...")
    else:
        print("ETHERSCAN_API_KEY not set - using mock data")
    
    # Check for Python path issues
    if '.' not in sys.path:
        sys.path.insert(0, '.')
        print("Added current directory to Python path")
    
    # Start the FastAPI server
    uvicorn.run(
        "api.index:app",
        host="0.0.0.0",
        port=port,
        reload=False  # Disable reload in production
    )

if __name__ == "__main__":
    main() 