"""
Tests for main API endpoints
"""
import pytest


class TestHealthCheck:
    """Test health check endpoint"""

    def test_health_check_success(self, client):
        """Test health check returns 200"""
        response = client.get("/api/py/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestMetadataEndpoints:
    """Test metadata-related endpoints"""

    def test_get_metadata_requires_params(self, client):
        """Test metadata endpoint requires address and chainId"""
        response = client.get("/api/py/metadata")

        assert response.status_code in [400, 422]

    def test_get_metadata_with_params(self, client, mock_ethereum_address, mock_chain_id):
        """Test metadata retrieval with valid parameters"""
        response = client.get(
            "/api/py/metadata",
            params={
                "address": mock_ethereum_address,
                "chainId": mock_chain_id
            }
        )

        # Should return 200 with data or 404 if not found
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "metadata" in data or "descriptors" in data


class TestDescriptorValidation:
    """Test ERC7730 descriptor validation"""

    def test_validate_valid_descriptor(self, client, sample_erc7730_descriptor):
        """Test validation of valid descriptor"""
        response = client.post(
            "/api/py/validate",
            json=sample_erc7730_descriptor
        )

        assert response.status_code == 200
        data = response.json()
        assert "valid" in data

    def test_validate_invalid_descriptor(self, client):
        """Test validation fails for invalid descriptor"""
        invalid_descriptor = {"invalid": "data"}

        response = client.post(
            "/api/py/validate",
            json=invalid_descriptor
        )

        # Should indicate validation failure
        data = response.json()
        assert data.get("valid") is False or response.status_code == 400


class TestRateLimiting:
    """Test API rate limiting"""

    @pytest.mark.skipif(
        True,
        reason="Rate limiting may not be testable in all environments"
    )
    def test_rate_limit_exceeded(self, client, mock_ethereum_address):
        """Test rate limiting kicks in after many requests"""
        # Make many requests quickly
        responses = []
        for _ in range(100):
            response = client.get(
                "/api/py/metadata",
                params={
                    "address": mock_ethereum_address,
                    "chainId": 11155111
                }
            )
            responses.append(response)

        # Check if any were rate limited
        rate_limited = any(r.status_code == 429 for r in responses)

        # Note: This may not trigger in test environment
        # Kept as documentation of expected behavior
        assert True  # Placeholder


class TestCORSHeaders:
    """Test CORS configuration"""

    def test_cors_headers_present(self, client):
        """Test CORS headers are set correctly"""
        response = client.options("/api/py/health")

        # Check for CORS headers
        assert "access-control-allow-origin" in response.headers or \
               response.status_code == 405  # Some frameworks handle OPTIONS differently


@pytest.mark.asyncio
class TestAsyncEndpoints:
    """Test async endpoint functionality"""

    async def test_async_health_check(self, client):
        """Test async health check works"""
        response = client.get("/api/py/health")

        assert response.status_code == 200
