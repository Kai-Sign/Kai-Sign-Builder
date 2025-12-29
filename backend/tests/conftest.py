"""
Pytest configuration and shared fixtures
"""
import pytest
from fastapi.testclient import TestClient
from api.index import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app"""
    return TestClient(app)


@pytest.fixture
def mock_ethereum_address():
    """Mock Ethereum address for testing"""
    return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"


@pytest.fixture
def mock_chain_id():
    """Mock chain ID (Sepolia)"""
    return 11155111


@pytest.fixture
def sample_erc7730_descriptor():
    """Sample ERC7730 descriptor for testing"""
    return {
        "context": {
            "contract": {
                "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
                "chainId": 11155111
            }
        },
        "metadata": {
            "functions": {
                "transfer": {
                    "label": "Transfer Tokens",
                    "params": {
                        "to": {"label": "Recipient"},
                        "amount": {"label": "Amount"}
                    }
                }
            }
        }
    }


@pytest.fixture
def api_headers():
    """Mock API headers with auth"""
    return {
        "X-API-Key": "test-api-key",
        "Content-Type": "application/json"
    }
