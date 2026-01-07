/**
 * ABI Decoder Tests
 *
 * Tests for decoding ABI-encoded calldata parameters including:
 * - Static types (address, uint256, bool, bytes32)
 * - Dynamic types (bytes, string, arrays)
 * - Complex types (tuples, nested arrays)
 */

import { describe, test, expect } from 'vitest';
import { AbiDecoder, decodeAbiParameters } from '../utils/abiDecoder';
import type { AbiInput } from '../types';
import {
  ADDRESSES,
  SELECTORS,
  createTransferCalldata,
  createApproveCalldata,
  createUnlimitedApproveCalldata,
} from './testUtils';

describe('AbiDecoder', () => {
  // Define transfer ABI
  const transferAbi: AbiInput[] = [
    {
      type: 'function',
      name: 'transfer',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
  ];

  // Define approve ABI
  const approveAbi: AbiInput[] = [
    {
      type: 'function',
      name: 'approve',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
  ];

  // Define setApprovalForAll ABI
  const setApprovalForAllAbi: AbiInput[] = [
    {
      type: 'function',
      name: 'setApprovalForAll',
      inputs: [
        { name: 'operator', type: 'address' },
        { name: 'approved', type: 'bool' },
      ],
    },
  ];

  describe('address parameter decoding', () => {
    test('decodes transfer recipient address', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = createTransferCalldata(ADDRESSES.VITALIK, '100000');

      const result = decoder.decodeFunctionData('transfer', calldata);

      expect(result[0]).toBe(ADDRESSES.VITALIK.toLowerCase());
    });

    test('decodes approve spender address', () => {
      const decoder = new AbiDecoder(approveAbi);
      const calldata = createApproveCalldata(ADDRESSES.UNISWAP_ROUTER, '1000000');

      const result = decoder.decodeFunctionData('approve', calldata);

      expect(result[0]).toBe(ADDRESSES.UNISWAP_ROUTER.toLowerCase());
    });

    test('handles zero address', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = createTransferCalldata(ADDRESSES.ZERO, '1000000');

      const result = decoder.decodeFunctionData('transfer', calldata);

      expect(result[0]).toBe(ADDRESSES.ZERO.toLowerCase());
    });
  });

  describe('uint256 parameter decoding', () => {
    test('decodes small amount', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = createTransferCalldata(ADDRESSES.VITALIK, '100000');

      const result = decoder.decodeFunctionData('transfer', calldata);

      expect(result[1].toString()).toBe('100000');
    });

    test('decodes large amount', () => {
      const decoder = new AbiDecoder(transferAbi);
      const largeAmount = '1000000000000000000'; // 1 ETH in wei
      const calldata = createTransferCalldata(ADDRESSES.VITALIK, largeAmount);

      const result = decoder.decodeFunctionData('transfer', calldata);

      expect(result[1].toString()).toBe(largeAmount);
    });

    test('decodes max uint256 (unlimited approval)', () => {
      const decoder = new AbiDecoder(approveAbi);
      const calldata = createUnlimitedApproveCalldata(ADDRESSES.UNISWAP_ROUTER);

      const result = decoder.decodeFunctionData('approve', calldata);

      // Max uint256
      const maxUint256 = BigInt('0x' + 'f'.repeat(64));
      expect(BigInt(result[1].toString())).toBe(maxUint256);
    });

    test('decodes zero amount', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = createTransferCalldata(ADDRESSES.VITALIK, '0');

      const result = decoder.decodeFunctionData('transfer', calldata);

      expect(result[1].toString()).toBe('0');
    });
  });

  describe('boolean parameter decoding', () => {
    test('decodes true value', () => {
      const decoder = new AbiDecoder(setApprovalForAllAbi);
      // setApprovalForAll(address,bool) with true
      const calldata =
        '0xa22cb465' +
        ADDRESSES.UNISWAP_ROUTER.slice(2).toLowerCase().padStart(64, '0') +
        '0000000000000000000000000000000000000000000000000000000000000001';

      const result = decoder.decodeFunctionData('setApprovalForAll', calldata);

      expect(result[1]).toBe(true);
    });

    test('decodes false value', () => {
      const decoder = new AbiDecoder(setApprovalForAllAbi);
      const calldata =
        '0xa22cb465' +
        ADDRESSES.UNISWAP_ROUTER.slice(2).toLowerCase().padStart(64, '0') +
        '0000000000000000000000000000000000000000000000000000000000000000';

      const result = decoder.decodeFunctionData('setApprovalForAll', calldata);

      expect(result[1]).toBe(false);
    });
  });

  describe('bytes32 parameter decoding', () => {
    test('decodes bytes32 value', () => {
      const someFunction: AbiInput[] = [
        {
          type: 'function',
          name: 'someFunction',
          inputs: [{ name: 'data', type: 'bytes32' }],
        },
      ];
      const decoder = new AbiDecoder(someFunction);

      const bytes32Value = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const calldata = '0x12345678' + bytes32Value;

      const result = decoder.decodeFunctionData('someFunction', calldata);

      expect(result[0].toLowerCase()).toBe('0x' + bytes32Value.toLowerCase());
    });
  });

  describe('error handling', () => {
    test('handles short calldata gracefully', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = '0x1234';

      // Decoder returns array with undefined/partial values for short calldata
      const result = decoder.decodeFunctionData('transfer', calldata);
      expect(Array.isArray(result)).toBe(true);
    });

    test('handles empty calldata gracefully', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = '0x';

      // Decoder returns empty array for empty calldata
      const result = decoder.decodeFunctionData('transfer', calldata);
      expect(Array.isArray(result)).toBe(true);
    });

    test('throws for unknown function name', () => {
      const decoder = new AbiDecoder(transferAbi);
      const calldata = createTransferCalldata(ADDRESSES.VITALIK, '100000');

      expect(() => {
        decoder.decodeFunctionData('unknownFunction', calldata);
      }).toThrow('Function unknownFunction not found in ABI');
    });
  });
});

describe('decodeAbiParameters', () => {
  test('decodes address and uint256', () => {
    const inputs: AbiInput[] = [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ];
    const data =
      '0x' +
      '000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045' +
      '00000000000000000000000000000000000000000000000000000000000186a0';

    const result = decodeAbiParameters(inputs, data.slice(2)); // Without 0x

    expect(result.to).toBe('0x' + 'd8da6bf26964af9d7eed9e03e53415d37aa96045');
    expect(result.amount).toBe(100000);
  });

  test('decodes multiple addresses', () => {
    const inputs: AbiInput[] = [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
    ];
    const data =
      '000000000000000000000000' + ADDRESSES.VITALIK.slice(2).toLowerCase() +
      '000000000000000000000000' + ADDRESSES.UNISWAP_ROUTER.slice(2).toLowerCase();

    const result = decodeAbiParameters(inputs, data);

    // Compare case-insensitively
    expect(result.from?.toLowerCase()).toBe(ADDRESSES.VITALIK.toLowerCase());
    expect(result.to?.toLowerCase()).toBe(ADDRESSES.UNISWAP_ROUTER.toLowerCase());
  });
});
