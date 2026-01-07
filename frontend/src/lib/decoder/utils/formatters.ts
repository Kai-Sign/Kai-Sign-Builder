/**
 * Value formatting utilities for decoded transaction data
 */

import type { BigNumberLike } from '../types';
import { isBigNumberLike } from '../types';

/**
 * Format token amount with decimals
 * @param rawValue - Raw integer value as string or bigint
 * @param decimals - Number of decimals
 * @param symbol - Token symbol (optional)
 * @returns Formatted amount like "1.5 USDC"
 */
export function formatTokenAmount(rawValue: string | bigint, decimals: number, symbol?: string): string {
  try {
    const dec = Number(decimals);
    if (isNaN(dec) || dec < 0) {
      return String(rawValue);
    }

    // Check for max uint256 (unlimited approval)
    const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    const valueStr = String(rawValue);

    // Handle scientific notation (BigInt cannot parse)
    if (valueStr.includes('e') || valueStr.includes('E')) {
      return symbol ? `Unlimited ${symbol}` : 'Unlimited';
    }

    if (valueStr === MAX_UINT256) {
      return symbol ? `Unlimited ${symbol}` : 'Unlimited';
    }

    const value = BigInt(valueStr);
    const divisor = BigInt(10) ** BigInt(dec);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    // Format fractional part with leading zeros
    let fractionalStr = fractionalPart.toString().padStart(dec, '0');
    // Trim trailing zeros but keep at least 2 decimal places
    fractionalStr = fractionalStr.replace(/0+$/, '') || '0';
    if (fractionalStr.length < 2) fractionalStr = fractionalStr.padEnd(2, '0');

    const formatted = `${integerPart}.${fractionalStr}`;
    return symbol ? `${formatted} ${symbol}` : formatted;
  } catch (e) {
    console.error('[formatTokenAmount] Error:', e);
    return String(rawValue);
  }
}

/**
 * Format wei to ETH string
 * @param wei - Value in wei (bigint or string)
 * @returns Formatted ETH string
 */
export function formatEther(wei: bigint | string): string {
  try {
    const value = typeof wei === 'string' ? BigInt(wei) : wei;
    const eth = Number(value) / 1e18;
    if (eth === 0) return '0 ETH';
    return eth > 0.0001 ? `${eth.toFixed(4)} ETH` : `${eth.toExponential(2)} ETH`;
  } catch {
    return '0 ETH';
  }
}

/**
 * Format address for display (shortened)
 * @param address - Full address
 * @returns Shortened address like "0x1234...5678"
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 42) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format value for display, handling BigNumber-like objects
 * @param value - Value to format
 * @returns String representation
 */
export function formatValue(value: unknown): string {
  if (isBigNumberLike(value)) {
    return value.toString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

/**
 * Convert string to title case
 * @param str - Input string
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert camelCase to title with spaces
 * @param str - camelCase string
 * @returns Title with spaces
 */
export function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (match) => match.toUpperCase())
    .trim();
}

/**
 * Convert hex string to UTF-8 string
 * @param hex - Hex string without 0x prefix
 * @returns UTF-8 string
 */
export function hexToString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.slice(i, i + 2), 16);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str;
}

/**
 * Convert hex string to UTF-8 with proper error handling
 * @param hexString - Hex string (with or without 0x prefix)
 * @returns UTF-8 string
 */
export function hexToUtf8(hexString: string): string {
  try {
    const cleanHex = hexString.replace(/^0x/, '');
    const evenHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

    const bytes: number[] = [];
    for (let i = 0; i < evenHex.length; i += 2) {
      bytes.push(parseInt(evenHex.substr(i, 2), 16));
    }

    const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
    const uint8Array = new Uint8Array(bytes);
    return decoder.decode(uint8Array).replace(/\0/g, '');
  } catch (error) {
    console.warn('[hexToUtf8] Decoding failed:', error);
    return '';
  }
}

/**
 * Validate if string is a valid Ethereum address
 * @param address - Address to validate
 * @returns True if valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address) && address !== '0x0000000000000000000000000000000000000000';
}

/**
 * Check if value looks like calldata (hex string with function selector)
 * @param value - Value to check
 * @returns True if looks like calldata
 */
export function looksLikeCalldata(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('0x')) return false;
  if (value.length < 10) return false;

  const selector = value.slice(0, 10);
  return /^0x[a-fA-F0-9]{8}$/.test(selector);
}

/**
 * Decode ABI-encoded string return value
 * @param hexData - Hex encoded string data from eth_call
 * @returns Decoded string
 */
export function decodeAbiString(hexData: string): string {
  try {
    const data = hexData.slice(2);
    const offset = parseInt(data.slice(0, 64), 16) * 2;
    const length = parseInt(data.slice(offset, offset + 64), 16);
    const strHex = data.slice(offset + 64, offset + 64 + length * 2);

    let str = '';
    for (let i = 0; i < strHex.length; i += 2) {
      const charCode = parseInt(strHex.slice(i, i + 2), 16);
      if (charCode > 0) str += String.fromCharCode(charCode);
    }
    return str;
  } catch (e) {
    console.warn('[decodeAbiString] Failed:', e);
    return '';
  }
}

/**
 * Truncate long hex strings for display
 * @param hex - Hex string
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string
 */
export function truncateHex(hex: string, maxLength: number = 20): string {
  if (hex.length <= maxLength) return hex;
  const half = Math.floor((maxLength - 3) / 2);
  return `${hex.slice(0, half + 2)}...${hex.slice(-half)}`;
}
