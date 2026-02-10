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
    print("=" * 80)
    print(f"🚀 KaiSign Builder API Server")
    print("=" * 80)
    print(f"Port: {port}")
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

    # Initialize metadata cache
    print("\n" + "=" * 80)
    print("📦 Initializing Metadata Cache...")
    print("=" * 80)
    try:
        from api.metadata_cache import init_cache
        cache_stats = init_cache()
        print(f"✅ Metadata cache initialized: {cache_stats}")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize metadata cache: {e}")

    # Validate required environment variables for hash index
    print("\n" + "=" * 80)
    print("🔍 Validating Environment for Hash Index...")
    print("=" * 80)

    sepolia_rpc = os.getenv('SEPOLIA_RPC_URL')
    kaisign_addr = os.getenv('KAISIGN_ADDRESS', '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa')

    if sepolia_rpc:
        print(f"✅ SEPOLIA_RPC_URL: {sepolia_rpc[:50]}...")
    else:
        print("⚠️  SEPOLIA_RPC_URL not set, using default")
        os.environ['SEPOLIA_RPC_URL'] = 'https://ethereum-sepolia-rpc.publicnode.com'

    print(f"✅ KAISIGN_ADDRESS: {kaisign_addr}")

    # Initialize hash index
    print("\n" + "=" * 80)
    print("🔍 Initializing Metadata Hash Index...")
    print("=" * 80)

    try:
        from api.metadata_hash_store import (
            init_hash_db,
            load_from_contract_events,
            get_hash_stats
        )

        db_success = init_hash_db()
        if not db_success:
            print("❌ Failed to initialize hash database")
        else:
            print("✅ Hash database initialized")

            # Check if we need to populate
            stats = get_hash_stats()
            if stats.get("total_entries", 0) == 0:
                print("\n📥 Hash index is empty, scanning contract events...")
                print(f"⏳ Loading from {kaisign_addr} (this may take 60 seconds)...")

                loaded = load_from_contract_events()

                if loaded > 0:
                    print(f"\n✅ Loaded {loaded} attestations from contract")
                    stats = get_hash_stats()
                    print(f"📊 Final stats: {stats.get('total_entries', 0)} entries, {stats.get('db_size_mb', 0)} MB")
                else:
                    print("\n❌ ERROR: Failed to load attestations from contract")
                    print("    Check SEPOLIA_RPC_URL and v1-core ABI path")
                    print("    Try manual rebuild: POST /api/py/metadata/hash/rebuild")
            else:
                print(f"✅ Hash index already populated: {stats['total_entries']} entries")
                print(f"📊 Database size: {stats.get('db_size_mb', 0)} MB")

    except Exception as e:
        print(f"❌ ERROR: Could not initialize hash index: {e}")
        import traceback
        traceback.print_exc()
        print("\n⚠️  Hash index endpoints will return 404 until this is fixed!")
        print("    Check SEPOLIA_RPC_URL environment variable")
        print("    Try manual rebuild: POST /api/py/metadata/hash/rebuild")

    print("\n" + "=" * 80)
    print("🌐 Starting FastAPI server...")
    print("=" * 80 + "\n")

    # Start the FastAPI server
    uvicorn.run(
        "api.index:app",
        host="0.0.0.0",
        port=port,
        reload=False  # Disable reload in production
    )

if __name__ == "__main__":
    main() 