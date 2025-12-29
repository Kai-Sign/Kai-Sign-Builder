# Testing Guide - kai-sign-builder

Comprehensive testing strategy for the KaiSign Builder platform.

## Overview

kai-sign-builder uses a multi-layered testing approach:

- **Unit Tests**: Frontend utilities and backend functions (Vitest, pytest)
- **Component Tests**: React components (Testing Library)
- **Integration Tests**: API endpoints and smart contracts (Foundry)
- **E2E Tests**: Critical user flows (Playwright - planned)

## Quick Start

```bash
# Run all tests
npm test

# Run frontend tests only
cd frontend && npm test

# Run backend tests
cd backend && pytest

# Run smart contract tests
cd contracts && forge test

# Run with coverage
npm run test:coverage
```

## Frontend Testing (Vitest + Testing Library)

### Setup

Tests are colocated with source code:

```
frontend/src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── __tests__/
│   │       └── Button.test.tsx
├── lib/
│   ├── web3Service.ts
│   └── __tests__/
│       └── web3Service.test.ts
```

### Running Tests

```bash
# Watch mode
npm test

# Run once
npm test -- --run

# Coverage
npm test -- --coverage

# Specific file
npm test -- src/lib/web3Service.test.ts

# UI mode
npm test -- --ui
```

### Writing Component Tests

```typescript
// frontend/src/components/ui/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.firstChild).toHaveClass('destructive');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Writing Service Tests

```typescript
// frontend/src/lib/__tests__/web3Service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { connectWallet, getChainId } from '../web3Service';

// Mock ethers
vi.mock('ethers');

describe('web3Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectWallet', () => {
    it('should connect to MetaMask', async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue(['0x123'])
      };

      global.window.ethereum = mockProvider;

      const address = await connectWallet();

      expect(address).toBe('0x123');
      expect(mockProvider.send).toHaveBeenCalledWith(
        'eth_requestAccounts',
        []
      );
    });

    it('should throw error if no wallet found', async () => {
      global.window.ethereum = undefined;

      await expect(connectWallet()).rejects.toThrow(
        'No Ethereum wallet found'
      );
    });
  });

  describe('getChainId', () => {
    it('should return current chain ID', async () => {
      const mockProvider = {
        send: vi.fn().mockResolvedValue('0xaa36a7') // Sepolia
      };

      const chainId = await getChainId(mockProvider);
      expect(chainId).toBe(11155111);
    });
  });
});
```

### Testing Next.js API Routes

```typescript
// frontend/src/app/api/__tests__/metadata.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../metadata/route';
import { NextRequest } from 'next/server';

describe('/api/metadata', () => {
  describe('GET', () => {
    it('should return metadata for contract', async () => {
      const request = new NextRequest(
        'http://localhost/api/metadata?address=0x123&chainId=11155111'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metadata');
    });

    it('should return 400 for missing parameters', async () => {
      const request = new NextRequest('http://localhost/api/metadata');

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST', () => {
    it('should create new metadata entry', async () => {
      const metadata = {
        contractAddress: '0x123',
        chainId: 11155111,
        descriptors: []
      };

      const request = new NextRequest('http://localhost/api/metadata', {
        method: 'POST',
        body: JSON.stringify(metadata)
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
    });
  });
});
```

### Testing tRPC Routes

```typescript
// frontend/src/server/__tests__/metadata.test.ts
import { describe, it, expect } from 'vitest';
import { createCaller } from '../trpc/root';
import { createInnerTRPCContext } from '../trpc/init';

describe('metadata router', () => {
  const createContext = () => createInnerTRPCContext({
    session: null,
  });

  const caller = createCaller(createContext());

  it('should fetch metadata by address', async () => {
    const result = await caller.metadata.getByAddress({
      address: '0x123',
      chainId: 11155111
    });

    expect(result).toHaveProperty('contractAddress', '0x123');
  });

  it('should create metadata submission', async () => {
    const result = await caller.metadata.create({
      contractAddress: '0x123',
      chainId: 11155111,
      descriptors: [],
      bond: '1000000000000000000' // 1 ETH
    });

    expect(result).toHaveProperty('submissionId');
  });
});
```

## Backend Testing (pytest)

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-cov pytest-asyncio httpx
```

### Running Tests

```bash
# Run all tests
pytest

# With coverage
pytest --cov=api --cov-report=html

# Specific test
pytest tests/test_kms.py

# Verbose
pytest -v

# Stop on first failure
pytest -x
```

### Writing API Tests

```python
# backend/tests/test_api.py
import pytest
from fastapi.testclient import TestClient
from api.index import app

client = TestClient(app)

class TestMetadataEndpoints:
    def test_get_metadata_success(self):
        """Test successful metadata retrieval"""
        response = client.get(
            "/api/py/metadata",
            params={"address": "0x123", "chainId": 11155111}
        )

        assert response.status_code == 200
        assert "metadata" in response.json()

    def test_get_metadata_invalid_address(self):
        """Test invalid address returns 400"""
        response = client.get(
            "/api/py/metadata",
            params={"address": "invalid", "chainId": 11155111}
        )

        assert response.status_code == 400
        assert "error" in response.json()

    def test_post_metadata_unauthorized(self):
        """Test posting metadata without API key"""
        response = client.post(
            "/api/py/metadata",
            json={"contractAddress": "0x123"}
        )

        assert response.status_code == 401

class TestKMSEndpoints:
    def test_sign_message(self):
        """Test KMS message signing"""
        response = client.post(
            "/api/py/kms/sign",
            json={"message": "0x1234"},
            headers={"X-API-Key": "test-key"}
        )

        assert response.status_code == 200
        assert "signature" in response.json()

    def test_sign_message_no_auth(self):
        """Test signing without authentication"""
        response = client.post(
            "/api/py/kms/sign",
            json={"message": "0x1234"}
        )

        assert response.status_code == 401

@pytest.mark.asyncio
async def test_async_blob_upload():
    """Test async blob upload functionality"""
    from api.index import upload_to_blob

    metadata = {"test": "data"}
    result = await upload_to_blob(metadata)

    assert result["success"] is True
    assert "blobHash" in result
```

### Testing ERC7730 Integration

```python
# backend/tests/test_erc7730.py
import pytest
from api.patched_erc7730 import validate_descriptor

class TestERC7730:
    def test_validate_valid_descriptor(self):
        """Test validation of valid ERC7730 descriptor"""
        descriptor = {
            "context": {
                "contract": {
                    "address": "0x123",
                    "chainId": 11155111
                }
            },
            "metadata": {
                "functions": {}
            }
        }

        result = validate_descriptor(descriptor)
        assert result["valid"] is True

    def test_validate_invalid_descriptor(self):
        """Test validation fails for invalid descriptor"""
        descriptor = {"invalid": "data"}

        result = validate_descriptor(descriptor)
        assert result["valid"] is False
        assert len(result["errors"]) > 0
```

## Smart Contract Testing (Foundry)

### Running Tests

```bash
cd contracts

# Run all tests
forge test

# With verbosity
forge test -vvv

# Specific test
forge test --match-test testSubmitSpec

# With coverage
forge coverage

# Gas report
forge test --gas-report
```

### Writing Contract Tests

```solidity
// contracts/test/KaiSign.t.sol
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KaiSign.sol";

contract KaiSignTest is Test {
    KaiSign public kaisign;
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    function setUp() public {
        kaisign = new KaiSign(
            address(0x123), // RealityETH
            address(this),  // Arbitrator
            bytes32(0)      // Template ID
        );

        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testSubmitSpec() public {
        vm.startPrank(user1);

        string memory cid = "QmTest123";
        string memory specHash = "0xabcd";

        kaisign.submitSpec(cid, specHash);

        // Verify submission
        (address submitter, string memory storedCid) = kaisign.getSpec(specHash);
        assertEq(submitter, user1);
        assertEq(storedCid, cid);

        vm.stopPrank();
    }

    function testCannotSubmitDuplicate() public {
        string memory cid = "QmTest123";
        string memory specHash = "0xabcd";

        vm.startPrank(user1);
        kaisign.submitSpec(cid, specHash);

        // Try to submit again
        vm.expectRevert("Spec already submitted");
        kaisign.submitSpec(cid, specHash);

        vm.stopPrank();
    }

    function testProposalWithBond() public {
        vm.startPrank(user1);

        string memory cid = "QmTest123";
        string memory specHash = "0xabcd";

        kaisign.submitSpec{value: 1 ether}(cid, specHash);

        // Verify bond was deposited
        assertEq(address(kaisign).balance, 1 ether);

        vm.stopPrank();
    }

    function testChallenge() public {
        // User 1 submits
        vm.prank(user1);
        string memory cid = "QmTest123";
        string memory specHash = "0xabcd";
        kaisign.submitSpec{value: 1 ether}(cid, specHash);

        // User 2 challenges
        vm.prank(user2);
        kaisign.challenge{value: 1 ether}(specHash);

        // Verify challenge state
        assertTrue(kaisign.isChallenged(specHash));
    }
}
```

## Integration Testing

### API Integration Tests

```typescript
// tests/integration/api-flow.test.ts
import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';

describe('Complete Metadata Submission Flow', () => {
  it('should submit, verify, and retrieve metadata', async () => {
    // 1. Connect wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    // 2. Submit metadata
    const metadata = {
      contractAddress: '0x123',
      chainId: 11155111,
      descriptors: []
    };

    const response = await fetch('/api/metadata', {
      method: 'POST',
      body: JSON.stringify(metadata),
      headers: { 'Content-Type': 'application/json' }
    });

    const { submissionId } = await response.json();
    expect(submissionId).toBeDefined();

    // 3. Wait for verification
    let verified = false;
    for (let i = 0; i < 10; i++) {
      const status = await fetch(`/api/submissions/${submissionId}`);
      const data = await status.json();

      if (data.status === 'verified') {
        verified = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    expect(verified).toBe(true);

    // 4. Retrieve metadata
    const retrieved = await fetch(
      `/api/metadata?address=0x123&chainId=11155111`
    );
    const retrievedData = await retrieved.json();

    expect(retrievedData.metadata).toEqual(metadata);
  });
});
```

## Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Utilities | 90%+ | Critical |
| Services | 80%+ | High |
| API Routes | 80%+ | High |
| Components | 70%+ | Medium |
| Smart Contracts | 90%+ | Critical |

### Viewing Coverage

```bash
# Frontend
npm test -- --coverage
open coverage/index.html

# Backend
pytest --cov=api --cov-report=html
open htmlcov/index.html

# Contracts
forge coverage
```

## CI/CD Integration

Tests run automatically in GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt pytest pytest-cov
      - run: cd backend && pytest --cov=api

  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: cd contracts && forge test --coverage
```

## Best Practices

### 1. Test Naming

```typescript
// Good
it('should return error when address is invalid', () => {});

// Bad
it('works', () => {});
```

### 2. Arrange-Act-Assert

```typescript
it('should calculate bond correctly', () => {
  // Arrange
  const baseAmount = ethers.parseEther('1');

  // Act
  const bond = calculateBond(baseAmount);

  // Assert
  expect(bond).toBe(ethers.parseEther('1.1'));
});
```

### 3. Mock External Dependencies

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/web3Service', () => ({
  getProvider: vi.fn().mockReturnValue(mockProvider),
  getSigner: vi.fn().mockReturnValue(mockSigner)
}));
```

### 4. Clean Up After Tests

```typescript
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
```

### 5. Test Error Cases

```typescript
it('should handle network errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));

  await expect(fetchMetadata()).rejects.toThrow('Network error');
});
```

## Debugging Tests

### VS Code Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--run"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debugging Specific Test

```typescript
import { describe, it } from 'vitest';

describe.only('MyService', () => {
  it.only('specific failing test', () => {
    // This will be the only test that runs
  });
});
```

## Performance Testing

```typescript
// tests/performance/bundle-size.test.ts
import { describe, it, expect } from 'vitest';
import { stat } from 'fs/promises';

describe('Bundle Size', () => {
  it('should not exceed size budget', async () => {
    const stats = await stat('.next/static/chunks/pages/index.js');
    const sizeKB = stats.size / 1024;

    expect(sizeKB).toBeLessThan(500); // 500KB budget
  });
});
```

## Security Testing

```bash
# Dependency vulnerability scanning
npm audit

# Smart contract security
slither contracts/src/

# Static analysis
npm run lint
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Foundry Book](https://book.getfoundry.sh/)
- [pytest Documentation](https://docs.pytest.org/)

---

**Last Updated**: 2024-12-28
