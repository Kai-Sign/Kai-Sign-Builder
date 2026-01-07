/**
 * Format Conversion - Converts new decoder output to legacy format
 * Maintains backward compatibility with existing hardware viewer
 */

import type {
  DecodedTransaction as NewDecodedTransaction,
  DecodedCall,
  RecursiveDecodeResult,
  FormattedField,
} from './types';
import { isBigNumberLike } from './types';

/**
 * Legacy DecodedTransaction format (used by hardware viewer)
 */
export interface LegacyDecodedTransaction {
  txHash?: string;
  txType?: string;
  fromAddress?: string;
  toAddress?: string;
  contractName?: string;
  contractType?: string;
  methodCall?: {
    name: string;
    type?: string;
    signature?: string;
    params: LegacyParam[];
  };
  transfers?: Array<{
    type: string;
    name: string;
    symbol: string;
    address: string;
    amount: string;
    to: string;
    from: string;
  }>;
  addressesMeta?: Record<
    string,
    {
      contractAddress: string;
      contractName: string;
      tokenSymbol: string;
      decimals: number | null;
      type?: string;
      address?: string;
      chainID?: number;
    }
  >;
  nativeValueSent?: string;
  chainSymbol?: string;
  chainID?: number;
  effectiveGasPrice?: string;
  gasUsed?: string;
  gasPaid?: string;
  timestamp?: number;
  txIndex?: number;
  reverted?: boolean;
}

export interface LegacyParam {
  name: string;
  type: string;
  value: string;
  components?: LegacyParam[];
  valueDecoded?: {
    name: string;
    signature?: string;
    type?: string;
    params: LegacyParam[];
  };
}

/**
 * Convert new decoder output to legacy format
 * @param decoded - New decoder output (DecodedTransaction or RecursiveDecodeResult)
 * @returns Legacy format compatible with hardware viewer
 */
export function convertToLegacyFormat(
  decoded: NewDecodedTransaction | RecursiveDecodeResult
): LegacyDecodedTransaction {
  const legacy: LegacyDecodedTransaction = {
    addressesMeta: {},
  };

  // Handle DecodedTransaction
  if ('txType' in decoded) {
    const tx = decoded as NewDecodedTransaction;
    legacy.txType = tx.txType;
    legacy.toAddress = tx.to;
    legacy.chainID = tx.chainId;

    if (tx.value && tx.value !== '0x0') {
      legacy.nativeValueSent = tx.value;
    }

    if (tx.mainCall) {
      legacy.methodCall = convertCallToMethodCall(tx.mainCall);
    }

    // Convert nested calls to transfers if applicable
    if (tx.nestedCalls && tx.nestedCalls.length > 0) {
      for (const nested of tx.nestedCalls) {
        if (nested.decoded?.functionName) {
          // Add nested calls as valueDecoded in params if possible
          const targetAddr = nested.target.toLowerCase();
          legacy.addressesMeta = legacy.addressesMeta || {};
          legacy.addressesMeta[targetAddr] = {
            contractAddress: nested.target,
            contractName: nested.decoded.functionName || 'Unknown',
            tokenSymbol: '',
            decimals: null,
          };
        }
      }
    }

    return legacy;
  }

  // Handle RecursiveDecodeResult
  if ('selector' in decoded) {
    const result = decoded as RecursiveDecodeResult;
    legacy.methodCall = convertCallToMethodCall(result);

    return legacy;
  }

  return legacy;
}

/**
 * Convert DecodedCall to legacy methodCall format
 */
function convertCallToMethodCall(call: DecodedCall | RecursiveDecodeResult): LegacyDecodedTransaction['methodCall'] {
  if (!call.functionName && !call.function) {
    return undefined;
  }

  const params: LegacyParam[] = [];

  // Convert rawParams to legacy format
  if (call.rawParams) {
    for (const [name, value] of Object.entries(call.rawParams)) {
      params.push(convertValueToParam(name, value, call.formatted?.[name]));
    }
  } else if (call.params) {
    for (const [name, value] of Object.entries(call.params)) {
      params.push({
        name,
        type: 'unknown',
        value: String(value),
      });
    }
  }

  // Handle nested decodes if present (RecursiveDecodeResult)
  if ('nestedDecodes' in call && call.nestedDecodes) {
    for (const nested of call.nestedDecodes) {
      if (nested.type === 'multicall' || !nested.result) continue;

      // Find or create the param that contains the nested decode
      const paramName = nested.fieldPath.split('[')[0]; // Get base param name
      let param = params.find((p) => p.name === paramName);

      if (param && nested.result && 'functionName' in nested.result) {
        const nestedResult = nested.result as RecursiveDecodeResult;
        param.valueDecoded = {
          name: nestedResult.functionName || 'Unknown',
          signature: nestedResult.function,
          params: Object.entries(nestedResult.rawParams || {}).map(([n, v]) =>
            convertValueToParam(n, v, nestedResult.formatted?.[n])
          ),
        };
      }
    }
  }

  return {
    name: call.functionName || call.function?.split('(')[0] || 'Unknown',
    signature: call.function,
    params,
  };
}

/**
 * Convert a value to legacy param format
 */
function convertValueToParam(
  name: string,
  value: unknown,
  formatted?: FormattedField
): LegacyParam {
  const param: LegacyParam = {
    name,
    type: inferType(value),
    value: formatValueForLegacy(value),
  };

  // Handle arrays of tuples
  if (Array.isArray(value)) {
    const components: LegacyParam[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'object' && item !== null && !isBigNumberLike(item)) {
        // Tuple in array
        const tupleComponents = Object.entries(item as Record<string, unknown>).map(
          ([k, v]) => convertValueToParam(k, v)
        );
        components.push({
          name: `[${i}]`,
          type: 'tuple',
          value: JSON.stringify(item),
          components: tupleComponents,
        });
      } else {
        components.push({
          name: `[${i}]`,
          type: inferType(item),
          value: formatValueForLegacy(item),
        });
      }
    }
    if (components.length > 0) {
      param.components = components;
    }
  }

  // Handle tuple objects
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isBigNumberLike(value)
  ) {
    const components = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      convertValueToParam(k, v)
    );
    if (components.length > 0) {
      param.components = components;
      param.type = 'tuple';
    }
  }

  return param;
}

/**
 * Infer Solidity type from value
 */
function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'unknown';

  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'bigint') return 'uint256';

  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      if (value.length === 42) return 'address';
      if (value.length === 66) return 'bytes32';
      return 'bytes';
    }
    // Check if it's a number string
    if (/^\d+$/.test(value)) return 'uint256';
    return 'string';
  }

  if (typeof value === 'number') return 'uint256';

  if (isBigNumberLike(value)) return 'uint256';

  if (Array.isArray(value)) {
    if (value.length === 0) return 'bytes[]';
    const firstType = inferType(value[0]);
    return `${firstType}[]`;
  }

  if (typeof value === 'object') return 'tuple';

  return 'unknown';
}

/**
 * Format value for legacy string representation
 */
function formatValueForLegacy(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'bigint') return value.toString();

  if (isBigNumberLike(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Check if decoded result has valid data for display
 */
export function hasValidDecodedData(
  decoded: NewDecodedTransaction | RecursiveDecodeResult | null
): boolean {
  if (!decoded) return false;
  if (!decoded.success) return false;

  if ('mainCall' in decoded) {
    return !!decoded.mainCall?.functionName || !!decoded.mainCall?.function;
  }

  if ('functionName' in decoded || 'function' in decoded) {
    return !!decoded.functionName || !!decoded.function;
  }

  return false;
}
