/**
 * ABI Decoder - Decodes Solidity types from calldata
 * Supports all standard Solidity types including tuples and dynamic arrays
 */

import type { AbiInput, BigNumberLike } from '../types';

/**
 * Create a BigNumber-like object for compatibility
 */
function createBigNumber(value: bigint, hex: string): BigNumberLike {
  return {
    _isBigNumber: true,
    _hex: hex,
    toString: () => value.toString(),
  };
}

/**
 * ABI Decoder class for decoding function calldata
 */
export class AbiDecoder {
  private abi: AbiInput[];

  constructor(abi: AbiInput | AbiInput[]) {
    this.abi = Array.isArray(abi) ? abi : [abi];
  }

  /**
   * Check if a type is dynamic (requires offset resolution)
   */
  isDynamicType(type: string, input: AbiInput | null = null): boolean {
    if (!type) return false;

    // bytes, string, and any array type are dynamic
    if (type === 'bytes' || type === 'string') return true;
    if (type.endsWith('[]')) return true;

    // Tuples with any dynamic components are dynamic
    if (type === 'tuple' && input?.components) {
      return input.components.some((c) => this.isDynamicType(c.type, c));
    }

    return false;
  }

  /**
   * Decode a static type from data
   */
  decodeStaticType(
    type: string,
    paramData: string,
    offset: number,
    input: AbiInput | null = null
  ): { value: unknown; size: number } {
    // Address: 20 bytes right-padded in 32 bytes
    if (type === 'address') {
      const rawAddr = paramData.slice(offset + 24, offset + 64);
      return {
        value: '0x' + rawAddr.toLowerCase(),
        size: 64,
      };
    }

    // Unsigned integers: uint8, uint16, ..., uint256
    if (type.startsWith('uint')) {
      const hexValue = paramData.slice(offset, offset + 64);
      try {
        const value = BigInt('0x' + hexValue);
        return {
          value: createBigNumber(value, '0x' + hexValue),
          size: 64,
        };
      } catch {
        return { value: '0x' + hexValue, size: 64 };
      }
    }

    // Signed integers: int8, int16, ..., int256
    if (type.startsWith('int')) {
      const hexValue = paramData.slice(offset, offset + 64);
      try {
        const value = BigInt('0x' + hexValue);
        return {
          value: createBigNumber(value, '0x' + hexValue),
          size: 64,
        };
      } catch {
        return { value: '0x' + hexValue, size: 64 };
      }
    }

    // Fixed-size bytes: bytes1, bytes2, ..., bytes32
    if (type.startsWith('bytes') && !type.endsWith('[]') && type !== 'bytes') {
      const byteSize = parseInt(type.replace('bytes', '')) || 32;
      const hexSize = byteSize * 2;
      const value = '0x' + paramData.slice(offset, offset + hexSize);
      return { value, size: 64 }; // Always takes 32 bytes in ABI encoding
    }

    // Boolean
    if (type === 'bool') {
      const lastByte = paramData.slice(offset + 62, offset + 64);
      return {
        value: lastByte !== '00',
        size: 64,
      };
    }

    // Tuple (struct) - static tuples only
    if (type === 'tuple' && input?.components) {
      const tupleData: Record<string, unknown> = {};
      let tupleOffset = 0;

      for (const component of input.components) {
        if (this.isDynamicType(component.type, component)) {
          // Dynamic component in tuple - need to handle offset
          const dynOffset = parseInt(paramData.slice(offset + tupleOffset, offset + tupleOffset + 64), 16) * 2;
          const dynResult = this.decodeDynamicType(component.type, paramData, offset + dynOffset, component);
          tupleData[component.name] = dynResult;
          tupleOffset += 64;
        } else {
          const result = this.decodeStaticType(component.type, paramData, offset + tupleOffset, component);
          tupleData[component.name] = result.value;
          tupleOffset += result.size;
        }
      }

      return { value: tupleData, size: tupleOffset };
    }

    // Default: return raw hex
    return {
      value: '0x' + paramData.slice(offset, offset + 64),
      size: 64,
    };
  }

  /**
   * Decode a dynamic type from data
   */
  decodeDynamicType(type: string, paramData: string, offset: number, input: AbiInput | null = null): unknown {
    // Dynamic bytes
    if (type === 'bytes') {
      const length = parseInt(paramData.slice(offset, offset + 64), 16);
      const hexLength = length * 2;
      const data = paramData.slice(offset + 64, offset + 64 + hexLength);
      return '0x' + data;
    }

    // Dynamic string
    if (type === 'string') {
      const length = parseInt(paramData.slice(offset, offset + 64), 16);
      const hexLength = length * 2;
      const hexData = paramData.slice(offset + 64, offset + 64 + hexLength);
      return this.hexToString(hexData);
    }

    // Array types (address[], uint256[], bytes[], etc.)
    if (type.endsWith('[]')) {
      const baseType = type.slice(0, -2);
      const arrayLength = parseInt(paramData.slice(offset, offset + 64), 16);
      const results: unknown[] = [];

      if (this.isDynamicType(baseType, input)) {
        // Array of dynamic elements
        for (let i = 0; i < arrayLength; i++) {
          const elementOffsetHex = paramData.slice(offset + 64 + i * 64, offset + 64 + (i + 1) * 64);
          const elementOffset = parseInt(elementOffsetHex, 16) * 2;
          const value = this.decodeDynamicType(baseType, paramData, offset + 64 + elementOffset, input);
          results.push(value);
        }
      } else {
        // Array of static elements
        let arrayOffset = offset + 64;
        for (let i = 0; i < arrayLength; i++) {
          const { value, size } = this.decodeStaticType(baseType, paramData, arrayOffset, input);
          results.push(value);
          arrayOffset += size;
        }
      }

      return results;
    }

    // Dynamic tuple (tuple with dynamic components)
    if (type === 'tuple' && input?.components) {
      const tupleData: Record<string, unknown> = {};
      let tupleOffset = 0;

      for (const component of input.components) {
        if (this.isDynamicType(component.type, component)) {
          const relOffsetHex = paramData.slice(offset + tupleOffset, offset + tupleOffset + 64);
          const relOffset = parseInt(relOffsetHex, 16) * 2;
          const dynResult = this.decodeDynamicType(component.type, paramData, offset + relOffset, component);
          tupleData[component.name] = dynResult;
          tupleOffset += 64;
        } else {
          const result = this.decodeStaticType(component.type, paramData, offset + tupleOffset, component);
          tupleData[component.name] = result.value;
          tupleOffset += result.size;
        }
      }

      return tupleData;
    }

    // Fallback
    return '0x' + paramData.slice(offset, offset + 64);
  }

  /**
   * Convert hex string to UTF-8 string
   */
  hexToString(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.slice(i, i + 2), 16);
      if (charCode === 0) break; // Null terminator
      str += String.fromCharCode(charCode);
    }
    return str;
  }

  /**
   * Decode function calldata using ABI
   * @param functionName - Function name to decode
   * @param data - Full calldata including selector
   * @returns Array of decoded parameters
   */
  decodeFunctionData(functionName: string, data: string): unknown[] {
    // Find the function in the ABI
    const funcAbi = this.abi.find((item) => item.name === functionName);
    if (!funcAbi) {
      throw new Error(`Function ${functionName} not found in ABI`);
    }

    // Get inputs - handle case where funcAbi is just the inputs array
    const inputs = Array.isArray(funcAbi) ? funcAbi : (funcAbi as unknown as { inputs?: AbiInput[] }).inputs || [];

    // Remove function selector (first 4 bytes = 8 hex chars + 0x)
    const paramData = data.slice(10);
    const results: unknown[] = [];

    // First pass: calculate head offsets and identify dynamic types
    let headOffset = 0;
    const dynamicParams: { index: number; input: AbiInput; tailOffset: number }[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      if (this.isDynamicType(input.type, input)) {
        // Dynamic type: read offset from head, decode from tail later
        const offsetHex = paramData.slice(headOffset, headOffset + 64);
        const tailOffset = parseInt(offsetHex, 16) * 2;
        dynamicParams.push({ index: i, input, tailOffset });
        headOffset += 64;
      } else {
        // Static type: decode directly from head
        const { value, size } = this.decodeStaticType(input.type, paramData, headOffset, input);
        results[i] = value;
        headOffset += size;
      }
    }

    // Second pass: decode dynamic types from their tail offsets
    for (const { index, input, tailOffset } of dynamicParams) {
      const value = this.decodeDynamicType(input.type, paramData, tailOffset, input);
      results[index] = value;
    }

    return results;
  }
}

/**
 * Decode ABI parameters without function context
 * @param inputs - Array of ABI input definitions
 * @param paramData - Hex data without 0x prefix and without selector
 * @returns Object with decoded parameters
 */
export function decodeAbiParameters(inputs: AbiInput[], paramData: string): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};
  let offset = 0;

  try {
    const decoder = new AbiDecoder(inputs);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const paramName = input.name || `param${i}`;

      if (input.type === 'bytes' || input.type === 'bytes[]') {
        // Dynamic bytes - get offset and length
        const dataOffset = parseInt(paramData.slice(offset, offset + 64), 16) * 2;
        const dataLength = parseInt(paramData.slice(dataOffset, dataOffset + 64), 16) * 2;
        const data = '0x' + paramData.slice(dataOffset + 64, dataOffset + 64 + dataLength);
        decoded[paramName] = data;
      } else if (input.type === 'tuple[]' && input.components) {
        // Tuple array
        const arrayOffset = parseInt(paramData.slice(offset, offset + 64), 16) * 2;
        const arrayLength = parseInt(paramData.slice(arrayOffset, arrayOffset + 64), 16);
        const tuples: Record<string, unknown>[] = [];

        for (let j = 0; j < arrayLength; j++) {
          const tupleOffsetPointer = arrayOffset + 64 + j * 64;
          const tupleRelOffset = parseInt(paramData.slice(tupleOffsetPointer, tupleOffsetPointer + 64), 16) * 2;
          const tupleStart = arrayOffset + 64 + tupleRelOffset;

          const tuple: Record<string, unknown> = {};
          let tupleInnerOffset = 0;

          for (const comp of input.components) {
            if (comp.type === 'address') {
              tuple[comp.name] = '0x' + paramData.slice(tupleStart + tupleInnerOffset + 24, tupleStart + tupleInnerOffset + 64);
              tupleInnerOffset += 64;
            } else if (comp.type === 'uint256') {
              tuple[comp.name] = '0x' + paramData.slice(tupleStart + tupleInnerOffset, tupleStart + tupleInnerOffset + 64);
              tupleInnerOffset += 64;
            } else if (comp.type === 'bytes') {
              const bytesRelOffset = parseInt(paramData.slice(tupleStart + tupleInnerOffset, tupleStart + tupleInnerOffset + 64), 16) * 2;
              const bytesStart = tupleStart + bytesRelOffset;
              const bytesLen = parseInt(paramData.slice(bytesStart, bytesStart + 64), 16) * 2;
              tuple[comp.name] = '0x' + paramData.slice(bytesStart + 64, bytesStart + 64 + bytesLen);
              tupleInnerOffset += 64;
            } else {
              tuple[comp.name] = '0x' + paramData.slice(tupleStart + tupleInnerOffset, tupleStart + tupleInnerOffset + 64);
              tupleInnerOffset += 64;
            }
          }

          tuples.push(tuple);
        }

        decoded[paramName] = tuples;
      } else if (input.type === 'address') {
        const addressHex = paramData.slice(offset + 24, offset + 64);
        decoded[paramName] = '0x' + addressHex;
      } else if (input.type.startsWith('uint')) {
        const valueHex = paramData.slice(offset, offset + 64);
        decoded[paramName] = parseInt(valueHex, 16);
      } else {
        const valueHex = paramData.slice(offset, offset + 64);
        decoded[paramName] = '0x' + valueHex;
      }

      offset += 64;
    }
  } catch (error) {
    console.warn('[AbiDecoder] Parameter decoding error:', error);
  }

  return decoded;
}
