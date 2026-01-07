/**
 * RLP Decoder - Decodes RLP-encoded Ethereum transactions
 * Supports Legacy, EIP-2930, EIP-1559, and EIP-7702 transaction types
 */

import type {
  ParsedTransactionInput,
  TransactionType,
  AccessListItem,
  AuthorizationTuple,
} from './types';
import { TX_TYPES } from './types';

// Re-export TX_TYPES for use in tests
export { TX_TYPES } from './types';

/**
 * Decode an RLP-encoded transaction
 * @param rawTx - Raw RLP-encoded transaction (0x-prefixed)
 * @returns Parsed transaction input
 */
export function decodeRlpTransaction(rawTx: string): ParsedTransactionInput {
  const data = rawTx.startsWith('0x') ? rawTx.slice(2) : rawTx;

  if (data.length < 2) {
    throw new Error('Transaction data too short');
  }

  const firstByte = parseInt(data.slice(0, 2), 16);

  // Typed transactions start with type byte (< 0x80)
  if (firstByte < 0x80) {
    switch (firstByte) {
      case TX_TYPES.ACCESS_LIST:
        return decodeType1Transaction(data.slice(2));
      case TX_TYPES.EIP1559:
        return decodeType2Transaction(data.slice(2));
      case TX_TYPES.EIP7702:
        return decodeType4Transaction(data.slice(2));
      default:
        throw new Error(`Unsupported transaction type: 0x${firstByte.toString(16)}`);
    }
  }

  // Legacy transaction (RLP encoded, starts with 0xf8 or similar)
  return decodeLegacyTransaction(data);
}

/**
 * Detect transaction type from raw data
 * @param rawTx - Raw transaction data
 * @returns Transaction type
 */
export function detectTransactionType(rawTx: string): TransactionType {
  const data = rawTx.startsWith('0x') ? rawTx.slice(2) : rawTx;

  if (data.length < 2) {
    return TX_TYPES.LEGACY;
  }

  const firstByte = parseInt(data.slice(0, 2), 16);

  if (firstByte >= 0x80) {
    return TX_TYPES.LEGACY;
  }

  return firstByte as TransactionType;
}

/**
 * Decode RLP list from hex string
 * @param data - Hex string without 0x prefix
 * @returns Array of decoded items and bytes consumed
 */
function decodeRlpList(data: string): { items: string[]; consumed: number } {
  const items: string[] = [];
  let pos = 0;

  while (pos < data.length) {
    const { item, consumed } = decodeRlpItem(data.slice(pos));
    items.push(item);
    pos += consumed;
  }

  return { items, consumed: pos };
}

/**
 * Decode a single RLP item
 * @param data - Hex string without 0x prefix
 * @returns Decoded item and bytes consumed
 */
function decodeRlpItem(data: string): { item: string; consumed: number } {
  if (data.length === 0) {
    return { item: '', consumed: 0 };
  }

  const prefix = parseInt(data.slice(0, 2), 16);

  // Single byte (0x00-0x7f)
  if (prefix <= 0x7f) {
    return { item: data.slice(0, 2), consumed: 2 };
  }

  // Short string (0x80-0xb7)
  if (prefix <= 0xb7) {
    const length = prefix - 0x80;
    const hexLength = length * 2;
    return { item: data.slice(2, 2 + hexLength), consumed: 2 + hexLength };
  }

  // Long string (0xb8-0xbf)
  if (prefix <= 0xbf) {
    const lengthOfLength = prefix - 0xb7;
    const lengthHex = data.slice(2, 2 + lengthOfLength * 2);
    const length = parseInt(lengthHex, 16);
    const hexLength = length * 2;
    const dataStart = 2 + lengthOfLength * 2;
    return { item: data.slice(dataStart, dataStart + hexLength), consumed: dataStart + hexLength };
  }

  // Short list (0xc0-0xf7)
  if (prefix <= 0xf7) {
    const length = prefix - 0xc0;
    const hexLength = length * 2;
    return { item: data.slice(2, 2 + hexLength), consumed: 2 + hexLength };
  }

  // Long list (0xf8-0xff)
  const lengthOfLength = prefix - 0xf7;
  const lengthHex = data.slice(2, 2 + lengthOfLength * 2);
  const length = parseInt(lengthHex, 16);
  const hexLength = length * 2;
  const dataStart = 2 + lengthOfLength * 2;
  return { item: data.slice(dataStart, dataStart + hexLength), consumed: dataStart + hexLength };
}

/**
 * Decode legacy transaction (type 0)
 */
function decodeLegacyTransaction(data: string): ParsedTransactionInput {
  const { item } = decodeRlpItem(data);
  const { items } = decodeRlpList(item);

  // Legacy: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
  if (items.length < 6) {
    throw new Error('Invalid legacy transaction: not enough fields');
  }

  const nonce = items[0] ? parseInt(items[0], 16) : 0;
  const gasLimit = items[2] ? '0x' + items[2] : undefined;
  const to = items[3] ? '0x' + items[3] : undefined;
  const value = items[4] ? '0x' + items[4] : '0x0';
  const txData = items[5] ? '0x' + items[5] : '0x';

  // Extract chainId from v if available (EIP-155)
  let chainId = 1;
  if (items.length >= 7 && items[6]) {
    const v = parseInt(items[6], 16);
    if (v >= 35) {
      chainId = Math.floor((v - 35) / 2);
    }
  }

  return {
    type: 'parsed',
    chainId,
    nonce,
    gasLimit,
    to,
    value,
    data: txData,
  };
}

/**
 * Decode EIP-2930 transaction (type 1)
 */
function decodeType1Transaction(data: string): ParsedTransactionInput {
  const { item } = decodeRlpItem(data);
  const { items } = decodeRlpList(item);

  // Type 1: [chainId, nonce, gasPrice, gasLimit, to, value, data, accessList, v, r, s]
  if (items.length < 8) {
    throw new Error('Invalid type 1 transaction: not enough fields');
  }

  const chainId = items[0] ? parseInt(items[0], 16) : 1;
  const nonce = items[1] ? parseInt(items[1], 16) : 0;
  const gasLimit = items[3] ? '0x' + items[3] : undefined;
  const to = items[4] ? '0x' + items[4] : undefined;
  const value = items[5] ? '0x' + items[5] : '0x0';
  const txData = items[6] ? '0x' + items[6] : '0x';
  const accessList = decodeAccessList(items[7] || '');

  return {
    type: 'parsed',
    chainId,
    nonce,
    gasLimit,
    to,
    value,
    data: txData,
    accessList,
  };
}

/**
 * Decode EIP-1559 transaction (type 2)
 */
function decodeType2Transaction(data: string): ParsedTransactionInput {
  const { item } = decodeRlpItem(data);
  const { items } = decodeRlpList(item);

  // Type 2: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, v, r, s]
  if (items.length < 9) {
    throw new Error('Invalid type 2 transaction: not enough fields');
  }

  const chainId = items[0] ? parseInt(items[0], 16) : 1;
  const nonce = items[1] ? parseInt(items[1], 16) : 0;
  const maxPriorityFeePerGas = items[2] ? '0x' + items[2] : undefined;
  const maxFeePerGas = items[3] ? '0x' + items[3] : undefined;
  const gasLimit = items[4] ? '0x' + items[4] : undefined;
  const to = items[5] ? '0x' + items[5] : undefined;
  const value = items[6] ? '0x' + items[6] : '0x0';
  const txData = items[7] ? '0x' + items[7] : '0x';
  const accessList = decodeAccessList(items[8] || '');

  return {
    type: 'parsed',
    chainId,
    nonce,
    maxPriorityFeePerGas,
    maxFeePerGas,
    gasLimit,
    to,
    value,
    data: txData,
    accessList,
  };
}

/**
 * Decode EIP-7702 transaction (type 4)
 */
function decodeType4Transaction(data: string): ParsedTransactionInput {
  const { item } = decodeRlpItem(data);
  const { items } = decodeRlpList(item);

  // Type 4: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, authorizationList, v, r, s]
  if (items.length < 10) {
    throw new Error('Invalid type 4 transaction: not enough fields');
  }

  const chainId = items[0] ? parseInt(items[0], 16) : 1;
  const nonce = items[1] ? parseInt(items[1], 16) : 0;
  const maxPriorityFeePerGas = items[2] ? '0x' + items[2] : undefined;
  const maxFeePerGas = items[3] ? '0x' + items[3] : undefined;
  const gasLimit = items[4] ? '0x' + items[4] : undefined;
  const to = items[5] ? '0x' + items[5] : undefined;
  const value = items[6] ? '0x' + items[6] : '0x0';
  const txData = items[7] ? '0x' + items[7] : '0x';
  const accessList = decodeAccessList(items[8] || '');
  const authorizationList = decodeAuthorizationList(items[9] || '');

  return {
    type: 'parsed',
    chainId,
    nonce,
    maxPriorityFeePerGas,
    maxFeePerGas,
    gasLimit,
    to,
    value,
    data: txData,
    accessList,
    authorizationList,
  };
}

/**
 * Decode access list from RLP
 */
function decodeAccessList(data: string): AccessListItem[] {
  if (!data || data.length === 0) {
    return [];
  }

  const accessList: AccessListItem[] = [];

  try {
    const { items: entries } = decodeRlpList(data);

    for (const entry of entries) {
      const { items: entryItems } = decodeRlpList(entry);
      if (entryItems.length >= 2) {
        const address = '0x' + entryItems[0];
        const { items: keyItems } = decodeRlpList(entryItems[1]);
        const storageKeys = keyItems.map((k) => '0x' + k);
        accessList.push({ address, storageKeys });
      }
    }
  } catch (e) {
    console.warn('[RLP] Failed to decode access list:', e);
  }

  return accessList;
}

/**
 * Decode authorization list from RLP (EIP-7702)
 */
function decodeAuthorizationList(data: string): AuthorizationTuple[] {
  if (!data || data.length === 0) {
    return [];
  }

  const authList: AuthorizationTuple[] = [];

  try {
    const { items: entries } = decodeRlpList(data);

    for (const entry of entries) {
      const { items: entryItems } = decodeRlpList(entry);
      // [chainId, address, nonce, yParity, r, s]
      if (entryItems.length >= 6) {
        authList.push({
          chainId: entryItems[0] ? parseInt(entryItems[0], 16) : 1,
          address: '0x' + entryItems[1],
          nonce: entryItems[2] ? parseInt(entryItems[2], 16) : 0,
          yParity: entryItems[3] ? parseInt(entryItems[3], 16) : 0,
          r: '0x' + entryItems[4],
          s: '0x' + entryItems[5],
        });
      }
    }
  } catch (e) {
    console.warn('[RLP] Failed to decode authorization list:', e);
  }

  return authList;
}

/**
 * Auto-detect input type from raw data
 * @param input - Raw input string
 * @returns Detected input type
 */
export function detectInputType(input: string): 'json' | 'rlp' | 'calldata' | null {
  const trimmed = input.trim();

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  // Check for hex
  if (trimmed.startsWith('0x')) {
    // RLP transactions start with type byte or RLP length prefix
    const firstByte = parseInt(trimmed.slice(2, 4), 16);

    // Type 1, 2, 4 transactions
    if (firstByte === 0x01 || firstByte === 0x02 || firstByte === 0x04) {
      return 'rlp';
    }

    // RLP long list prefix (legacy tx)
    if (firstByte >= 0xf8) {
      return 'rlp';
    }

    // Otherwise assume raw calldata
    if (trimmed.length >= 10) {
      return 'calldata';
    }
  }

  return null;
}
