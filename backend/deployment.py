"""
Deployment Configuration (Python)

Central registry of deployed contract addresses, RPC endpoints, and
merkle-root constants.  Every hardcoded address or RPC URL in a Python
module MUST be imported from here.

Mirrors backend/metadata/deployment.js.
"""

# =========================================================================
# Registry Contracts (Sepolia)
# =========================================================================

# Current KaiSignRegistry on Sepolia — latest deployment.
REGISTRY_NEW_SEPOLIA = "0x655084b6A0f2Ee600bd31A71820b5E068b7870d0"

# Previous (v2) KaiSignRegistry on Sepolia — superseded.
REGISTRY_PREVIOUS_SEPOLIA = "0x51052A4d116F2c50C8bAac6E3b6f9F9D04846A4C"

# Original (v1) KaiSignRegistry on Sepolia — superseded.
REGISTRY_OLD_SEPOLIA = "0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa"

# =========================================================================
# RPC Endpoints
# =========================================================================

# Public Sepolia RPC for test and deploy workflows.
SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"

# =========================================================================
# Merkle Root — Pinned from build-seed-frontier.mjs output
# =========================================================================

EXPECTED_NEW_REGISTRY_MERKLE_ROOT = (
    "0xe09fe7b34856157aeb42654fd475355743230cb73574d5ad3cb157979aca062d"
)
