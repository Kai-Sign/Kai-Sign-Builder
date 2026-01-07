/**
 * Test Utilities for KaiSign Decoder Tests
 */

import type { ERC7730Metadata } from '../types';

// Common test addresses
export const ADDRESSES = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  VITALIK: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  UNISWAP_ROUTER: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  ONE_INCH_ROUTER: '0x111111125421ca6dc452d289314280a0f8842a65',
  AMBIRE_DELEGATOR: '0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d',
  ZERO: '0x0000000000000000000000000000000000000000',
};

// Common selectors
export const SELECTORS = {
  TRANSFER: '0xa9059cbb',
  APPROVE: '0x095ea7b3',
  TRANSFER_FROM: '0x23b872dd',
  BALANCE_OF: '0x70a08231',
  EXECUTE: '0xb61d27f6',
  EXECUTE_BATCH: '0x47e1da2a',
  WETH_DEPOSIT: '0xd0e30db0',
  WETH_WITHDRAW: '0x2e1a7d4d',
};

// Max uint256 value (for unlimited approvals)
export const MAX_UINT256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

/**
 * Create a simple ERC-20 transfer calldata
 */
export function createTransferCalldata(to: string, amount: string): string {
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return `${SELECTORS.TRANSFER}${paddedTo}${paddedAmount}`;
}

/**
 * Create a simple ERC-20 approve calldata
 */
export function createApproveCalldata(spender: string, amount: string): string {
  const paddedSpender = spender.slice(2).toLowerCase().padStart(64, '0');
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
  return `${SELECTORS.APPROVE}${paddedSpender}${paddedAmount}`;
}

/**
 * Create unlimited approval calldata
 */
export function createUnlimitedApproveCalldata(spender: string): string {
  const paddedSpender = spender.slice(2).toLowerCase().padStart(64, '0');
  return `${SELECTORS.APPROVE}${paddedSpender}${MAX_UINT256}`;
}

/**
 * Load fixture file
 */
export async function loadFixture<T>(path: string): Promise<T> {
  const module = await import(`./fixtures/${path}`);
  return module.default as T;
}

/**
 * Create basic USDC metadata for testing
 */
export function createUsdcMetadata(): ERC7730Metadata {
  return {
    context: {
      contract: {
        address: ADDRESSES.USDC,
        chainId: 1,
        name: 'USD Coin',
        abi: [
          {
            type: 'function',
            name: 'transfer',
            selector: SELECTORS.TRANSFER,
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          {
            type: 'function',
            name: 'approve',
            selector: SELECTORS.APPROVE,
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
        ],
      },
    },
    display: {
      formats: {
        'transfer(address,uint256)': {
          intent: 'Transfer {amount} USDC',
          fields: [
            { path: 'to', label: 'Recipient', format: 'address' },
            {
              path: 'amount',
              label: 'Amount',
              format: 'amount',
              params: { decimals: 6, symbol: 'USDC' },
            },
          ],
        },
        'approve(address,uint256)': {
          intent: 'Approve {amount} USDC',
          fields: [
            { path: 'spender', label: 'Spender', format: 'address' },
            {
              path: 'amount',
              label: 'Amount',
              format: 'amount',
              params: { decimals: 6, symbol: 'USDC' },
            },
          ],
        },
      },
    },
  };
}

/**
 * Create test metadata with custom function
 */
export function createTestMetadata(
  address: string,
  functions: Array<{
    name: string;
    selector: string;
    inputs: Array<{ name: string; type: string }>;
    intent?: string;
  }>
): ERC7730Metadata {
  const abi = functions.map((fn) => ({
    type: 'function' as const,
    name: fn.name,
    selector: fn.selector,
    inputs: fn.inputs,
  }));

  const formats: Record<string, { intent: string; fields: Array<{ path: string; label: string; format: string }> }> = {};

  for (const fn of functions) {
    const signature = `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
    formats[signature] = {
      intent: fn.intent || `Call ${fn.name}`,
      fields: fn.inputs.map((i) => ({
        path: i.name,
        label: i.name.charAt(0).toUpperCase() + i.name.slice(1),
        format: i.type === 'address' ? 'address' : 'number',
      })),
    };
  }

  return {
    context: {
      contract: {
        address,
        chainId: 1,
        name: 'Test Contract',
        abi,
      },
    },
    display: { formats },
  };
}

/**
 * Real EIP-7702 test transaction data from Ambire
 */
export const EIP7702_TEST_TX = {
  hash: '0xf82a7507f698c4023520793837be2b1fb942618899a6d43369bb0b37c97731b6',
  type: 4,
  authority: '0x408e2995a8E765E9a417dC98498f7AB773b9Af94',
  delegatedTo: '0x5A7FC11397E9a8AD41BF10bf13F22B0a63f96f6d',
  chainId: 1,
  description: 'Ambire EIP-7702 delegation with USDC approve + Fluid deposit',
};

/**
 * Real EIP-7702 authorization list from tx 0xf82a7507...
 */
export const REAL_AUTH_LIST = [
  {
    chainId: '0x1',
    address: '0x5a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d',
    nonce: '0x9',
    yParity: '0x1',
    r: '0x468ece68a3c933e4a2691be11028ba7eaa842321e539b1bc0f95f6756733252f',
    s: '0x42450fe44bc5a8e3fd1e644fee6eab1f9a11cca425d53fc3d8bee3fb155ed79c',
  },
];

/**
 * Real EIP-7702 calldata from Ambire tx (executeMultiple with 2 calls)
 */
export const REAL_EIP7702_CALLDATA =
  '0xabc5345e' +
  '0000000000000000000000000000000000000000000000000000000000000020' +
  '0000000000000000000000000000000000000000000000000000000000000002' +
  '0000000000000000000000000000000000000000000000000000000000000040' +
  '0000000000000000000000000000000000000000000000000000000000000120' +
  '000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' +
  '0000000000000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000060' +
  '0000000000000000000000000000000000000000000000000000000000000044' +
  '095ea7b3' +
  '0000000000000000000000009fb7b4477576fe5b32be4c1843afb1e55f251b33' +
  '000000000000000000000000000000000000000000000000000000000000c350' +
  '00000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000009fb7b4477576fe5b32be4c1843afb1e55f251b33' +
  '0000000000000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000060' +
  '0000000000000000000000000000000000000000000000000000000000000044' +
  '6e553f65' +
  '000000000000000000000000000000000000000000000000000000000000c350' +
  '000000000000000000000000408e2995a8e765e9a417dc98498f7ab773b9af94' +
  '00000000000000000000000000000000000000000000000000000000';
