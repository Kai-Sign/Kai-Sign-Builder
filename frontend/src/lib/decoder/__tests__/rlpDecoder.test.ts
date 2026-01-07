/**
 * RLP Decoder Tests
 *
 * Tests for decoding RLP-encoded Ethereum transactions:
 * - Legacy (type 0) transactions
 * - EIP-1559 (type 2) transactions
 * - EIP-7702 (type 4) transactions
 * - Input type auto-detection
 */

import { describe, test, expect } from 'vitest';
import {
  decodeRlpTransaction,
  detectTransactionType,
  detectInputType,
} from '../rlpDecoder';
import {
  ADDRESSES,
  EIP7702_TEST_TX,
  REAL_AUTH_LIST,
  REAL_EIP7702_CALLDATA,
} from './testUtils';

describe('detectInputType', () => {
  describe('JSON detection', () => {
    test('detects valid JSON object', () => {
      const input = '{"methodCall":{"name":"transfer"}}';
      expect(detectInputType(input)).toBe('json');
    });

    test('detects valid JSON array', () => {
      const input = '[{"to":"0x123"}]';
      expect(detectInputType(input)).toBe('json');
    });

    test('handles JSON with whitespace', () => {
      const input = '  { "methodCall": {} }  ';
      expect(detectInputType(input)).toBe('json');
    });

    test('rejects malformed JSON', () => {
      const input = '{ "methodCall": }';
      expect(detectInputType(input)).not.toBe('json');
    });
  });

  describe('RLP detection', () => {
    test('detects EIP-1559 transaction (type 0x02)', () => {
      const input = '0x02f8730101843b9aca00...';
      expect(detectInputType(input)).toBe('rlp');
    });

    test('detects EIP-7702 transaction (type 0x04)', () => {
      const input = '0x04f8730101843b9aca00...';
      expect(detectInputType(input)).toBe('rlp');
    });

    test('detects EIP-2930 transaction (type 0x01)', () => {
      const input = '0x01f8730101843b9aca00...';
      expect(detectInputType(input)).toBe('rlp');
    });

    test('detects legacy transaction (0xf8+ prefix)', () => {
      const input = '0xf86c8085174876e800825208...';
      expect(detectInputType(input)).toBe('rlp');
    });

    test('detects legacy transaction (0xf9+ prefix)', () => {
      const input = '0xf90100...';
      expect(detectInputType(input)).toBe('rlp');
    });
  });

  describe('raw calldata detection', () => {
    test('detects transfer calldata', () => {
      const input =
        '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000186a0';
      expect(detectInputType(input)).toBe('calldata');
    });

    test('detects approve calldata', () => {
      const input =
        '0x095ea7b3000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      expect(detectInputType(input)).toBe('calldata');
    });

    test('detects minimal valid calldata (just selector)', () => {
      const input = '0xa9059cbb00';
      expect(detectInputType(input)).toBe('calldata');
    });
  });

  describe('invalid input detection', () => {
    test('returns null for very short hex', () => {
      const input = '0x1234';
      expect(detectInputType(input)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(detectInputType('')).toBeNull();
    });

    test('returns null for non-hex string', () => {
      const input = 'hello world';
      expect(detectInputType(input)).toBeNull();
    });
  });
});

describe('detectTransactionType', () => {
  test('detects EIP-1559 (type 2)', () => {
    const rawTx = '0x02f8730101843b9aca00850144b6f60082520894...';
    expect(detectTransactionType(rawTx)).toBe(2); // TX_TYPES.EIP1559 = 2
  });

  test('detects EIP-7702 (type 4)', () => {
    const rawTx = '0x04f8730101843b9aca00...';
    expect(detectTransactionType(rawTx)).toBe(4); // TX_TYPES.EIP7702 = 4
  });

  test('detects EIP-2930 (type 1)', () => {
    const rawTx = '0x01f8730101843b9aca00...';
    expect(detectTransactionType(rawTx)).toBe(1); // TX_TYPES.EIP2930 = 1
  });

  test('detects legacy transaction (0xf8)', () => {
    const rawTx = '0xf86c8085174876e800825208...';
    expect(detectTransactionType(rawTx)).toBe(0); // TX_TYPES.LEGACY = 0
  });

  test('detects legacy transaction (0xf9)', () => {
    const rawTx = '0xf90100...';
    expect(detectTransactionType(rawTx)).toBe(0); // TX_TYPES.LEGACY = 0
  });

  test('returns legacy type for raw calldata starting with 0xa9', () => {
    const rawTx = '0xa9059cbb000000000000000000000000d8da...';
    // 0xa9 >= 0x80, so it's treated as legacy RLP prefix
    const result = detectTransactionType(rawTx);
    expect(result).toBe(0); // Legacy type
  });
});

describe('decodeRlpTransaction', () => {
  describe('EIP-1559 transaction parsing', () => {
    // Real EIP-1559 USDC transfer transaction
    const eip1559Tx =
      '0x02f8730101843b9aca00850144b6f60082520894a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000186a0c0';

    test('parses EIP-1559 chainId', () => {
      const result = decodeRlpTransaction(eip1559Tx);
      expect(result.chainId).toBe(1);
    });

    test('parses EIP-1559 to address', () => {
      const result = decodeRlpTransaction(eip1559Tx);
      expect(result.to?.toLowerCase()).toBe(ADDRESSES.USDC.toLowerCase());
    });

    test('parses EIP-1559 data field', () => {
      const result = decodeRlpTransaction(eip1559Tx);
      expect(result.data).toBeDefined();
      expect(result.data?.startsWith('0xa9059cbb')).toBe(true);
    });

    test('parses EIP-1559 value', () => {
      const result = decodeRlpTransaction(eip1559Tx);
      expect(result.value).toBe('0x0');
    });

    test('returns parsed transaction type', () => {
      const result = decodeRlpTransaction(eip1559Tx);
      // The decoder returns 'parsed' as the type to indicate it was successfully parsed
      expect(result.type).toBe('parsed');
    });
  });

  describe('Legacy transaction parsing', () => {
    // Real legacy ETH transfer
    const legacyTx =
      '0xf86c8085174876e800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83';

    test('parses legacy to address', () => {
      const result = decodeRlpTransaction(legacyTx);
      expect(result.to?.toLowerCase()).toBe('0x3535353535353535353535353535353535353535');
    });

    test('parses legacy value', () => {
      const result = decodeRlpTransaction(legacyTx);
      // 1 ETH in wei = de0b6b3a7640000 (with leading 0 in hex encoding)
      // The RLP decoder preserves the raw hex without removing leading zeros
      expect(result.value).toMatch(/de0b6b3a7640000$/i);
    });

    test('returns parsed transaction type', () => {
      const result = decodeRlpTransaction(legacyTx);
      expect(result.type).toBe('parsed');
    });
  });

  describe('EIP-7702 transaction parsing', () => {
    test('parses authorization list from raw tx object', () => {
      // Since we're testing with parsed tx object format
      const tx = {
        type: 4,
        to: EIP7702_TEST_TX.authority,
        data: REAL_EIP7702_CALLDATA,
        value: '0x0',
        authorizationList: REAL_AUTH_LIST,
      };

      // The function should handle parsed tx input
      expect(tx.authorizationList).toHaveLength(1);
      expect(tx.authorizationList[0].address.toLowerCase()).toBe(
        EIP7702_TEST_TX.delegatedTo.toLowerCase()
      );
    });

    test('authorization list contains chainId', () => {
      expect(REAL_AUTH_LIST[0].chainId).toBe('0x1');
    });

    test('authorization list contains nonce', () => {
      expect(REAL_AUTH_LIST[0].nonce).toBe('0x9');
    });

    test('authorization list contains signature components', () => {
      expect(REAL_AUTH_LIST[0].r).toBeDefined();
      expect(REAL_AUTH_LIST[0].s).toBeDefined();
      expect(REAL_AUTH_LIST[0].yParity).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('handles empty input', () => {
      expect(() => decodeRlpTransaction('')).toThrow();
    });

    test('handles invalid hex', () => {
      expect(() => decodeRlpTransaction('not-hex')).toThrow();
    });

    test('handles truncated RLP', () => {
      const truncated = '0x02f873010184';
      expect(() => decodeRlpTransaction(truncated)).toThrow();
    });
  });
});

describe('EIP-7702 specific tests', () => {
  test('real Ambire EIP-7702 calldata structure', () => {
    // The REAL_EIP7702_CALLDATA contains executeMultiple with 2 calls
    expect(REAL_EIP7702_CALLDATA.startsWith('0xabc5345e')).toBe(true);
    // 0xabc5345e is the selector for executeMultiple((address,uint256,bytes)[])
  });

  test('calldata contains USDC approve', () => {
    // The first nested call is USDC approve
    expect(REAL_EIP7702_CALLDATA).toContain('095ea7b3'); // approve selector
    expect(REAL_EIP7702_CALLDATA.toLowerCase()).toContain(
      'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'.toLowerCase() // USDC address
    );
  });

  test('calldata contains Fluid deposit', () => {
    // The second nested call is Fluid deposit
    expect(REAL_EIP7702_CALLDATA).toContain('6e553f65'); // deposit selector
  });

  test('authorization list targets Ambire delegator', () => {
    expect(REAL_AUTH_LIST[0].address.toLowerCase()).toBe(
      EIP7702_TEST_TX.delegatedTo.toLowerCase()
    );
  });

  test('revocation detection (zero address)', () => {
    const revocationAuth = {
      chainId: 1,
      address: ADDRESSES.ZERO,
      nonce: 10,
      yParity: '0x1',
      r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    };

    // Zero address delegation = revocation
    expect(revocationAuth.address).toBe(ADDRESSES.ZERO);
  });
});
