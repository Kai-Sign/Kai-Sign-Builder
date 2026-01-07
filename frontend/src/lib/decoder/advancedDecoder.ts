/**
 * Advanced Transaction Decoder - Handles full transaction decoding with nested calls
 * Supports EIP-1559, EIP-7702, and nested multicall patterns
 */

import type {
  TransactionInput,
  DecodedTransaction,
  DecodedCall,
  NestedCall,
  Delegation,
  ERC7730Metadata,
  ParsedTransactionInput,
  AbiFunction,
  DecoderOptions,
} from './types';
import { TX_TYPES } from './types';
import { extractSelector } from './utils/keccak';
import { decodeAbiParameters } from './utils/abiDecoder';
import { looksLikeCalldata, isValidAddress } from './utils/formatters';
import { CalldataDecoder, getCalldataDecoder } from './decode';
import { MetadataService, getMetadataService } from './metadataService';
import { decodeRlpTransaction, detectTransactionType } from './rlpDecoder';

const DELEGATION_DESIGNATOR = '0xef0100';

/**
 * Advanced Transaction Decoder
 */
export class AdvancedTransactionDecoder {
  private calldataDecoder: CalldataDecoder;
  private metadataService: MetadataService;
  private maxDepth: number;
  private maxBytecodeNesting: number;
  private metadataCache: Map<string, ERC7730Metadata | null>;
  private functionSignatureCache: Map<string, string>;

  constructor(options: DecoderOptions = {}) {
    this.calldataDecoder = getCalldataDecoder();
    this.metadataService = getMetadataService();
    this.maxDepth = options.maxDepth || 10;
    this.maxBytecodeNesting = options.maxBytecodeNesting || 5;
    this.metadataCache = new Map();
    this.functionSignatureCache = new Map();
  }

  /**
   * Main entry point for transaction decoding
   * @param input - Transaction input (raw calldata, RLP, or parsed)
   * @returns Decoded transaction
   */
  async decodeTransaction(input: TransactionInput): Promise<DecodedTransaction> {
    try {
      // Handle different input types
      if (input.type === 'raw') {
        return this.decodeRawCalldata(input.data, input.contractAddress, input.chainId);
      }

      if (input.type === 'rlp') {
        const parsed = decodeRlpTransaction(input.data);
        return this.decodeParsedTransaction(parsed);
      }

      if (input.type === 'parsed') {
        return this.decodeParsedTransaction(input);
      }

      throw new Error('Unknown input type');
    } catch (error) {
      console.error('[AdvancedDecoder] Error:', error);
      return {
        success: false,
        txType: 'unknown',
        chainId: 'chainId' in input ? input.chainId || 1 : 1,
        intent: 'Failed to decode transaction',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Decode raw calldata (without full transaction context)
   */
  private async decodeRawCalldata(
    data: string,
    contractAddress: string,
    chainId: number
  ): Promise<DecodedTransaction> {
    const mainCall = await this.calldataDecoder.decode(data, contractAddress, chainId);

    const result: DecodedTransaction = {
      success: mainCall.success,
      txType: 'unknown',
      chainId,
      to: contractAddress,
      data,
      mainCall,
      nestedCalls: [],
      allIntents: [],
      intent: mainCall.intent,
    };

    // Analyze nested calls
    const nestedAnalysis = await this.analyzeNestedCalls(data, contractAddress, chainId, 0);
    result.nestedCalls = nestedAnalysis.calls;
    result.allIntents = nestedAnalysis.intents;
    result.nestedIntents = nestedAnalysis.intents;

    if (result.nestedIntents && result.nestedIntents.length > 0) {
      result.aggregatedIntent = result.nestedIntents.join(' + ');
      result.intent = result.aggregatedIntent;
    }

    return result;
  }

  /**
   * Decode a parsed transaction
   */
  private async decodeParsedTransaction(tx: ParsedTransactionInput): Promise<DecodedTransaction> {
    const txType = this.getTransactionTypeName(tx);

    const result: DecodedTransaction = {
      success: true,
      txType,
      chainId: tx.chainId,
      nonce: tx.nonce,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      maxFeePerGas: tx.maxFeePerGas,
      gasLimit: tx.gasLimit,
      to: tx.to,
      value: tx.value,
      data: tx.data,
      accessList: tx.accessList,
      authorizationList: tx.authorizationList,
      nestedCalls: [],
      allIntents: [],
      intent: 'Contract interaction',
    };

    // Handle EIP-7702 delegations
    if (tx.authorizationList && tx.authorizationList.length > 0) {
      result.delegations = await this.parseAuthorizationList(tx.authorizationList, tx.chainId);
    }

    // Decode main call
    if (tx.data && tx.data !== '0x' && tx.to) {
      if (result.delegations && result.delegations.length > 0) {
        result.mainCall = await this.decodeWithDelegation(
          tx.data,
          tx.to,
          result.delegations,
          tx.chainId
        );
      } else {
        result.mainCall = await this.calldataDecoder.decode(tx.data, tx.to, tx.chainId);
      }

      if (result.mainCall.success) {
        result.intent = result.mainCall.intent;
      }

      // Analyze nested calls
      const nestedAnalysis = result.delegations
        ? await this.analyzeNestedCallsWithDelegation(
            tx.data,
            tx.to,
            result.delegations,
            tx.chainId,
            0
          )
        : await this.analyzeNestedCalls(tx.data, tx.to, tx.chainId, 0);

      result.nestedCalls = nestedAnalysis.calls;
      result.allIntents = nestedAnalysis.intents;
      result.nestedIntents = nestedAnalysis.intents;

      if (result.nestedIntents && result.nestedIntents.length > 0) {
        result.aggregatedIntent = result.nestedIntents.join(' + ');
        result.intent = result.aggregatedIntent;
      }
    }

    return result;
  }

  /**
   * Get transaction type name
   */
  private getTransactionTypeName(tx: ParsedTransactionInput): 'legacy' | 'EIP-1559' | 'EIP-7702' | 'unknown' {
    if (tx.authorizationList && tx.authorizationList.length > 0) {
      return 'EIP-7702';
    }
    if (tx.maxFeePerGas || tx.maxPriorityFeePerGas) {
      return 'EIP-1559';
    }
    return 'legacy';
  }

  /**
   * Parse EIP-7702 authorization list
   */
  private async parseAuthorizationList(
    authList: ParsedTransactionInput['authorizationList'],
    chainId: number
  ): Promise<Delegation[]> {
    const delegations: Delegation[] = [];

    for (const auth of authList || []) {
      try {
        const delegation: Delegation = {
          chainId: auth.chainId,
          address: auth.address,
          nonce: auth.nonce,
          yParity: auth.yParity,
          r: auth.r,
          s: auth.s,
          isRevocation: false,
          delegateCode: null,
          delegateMetadata: null,
        };

        if (auth.address === '0x0000000000000000000000000000000000000000') {
          delegation.isRevocation = true;
        } else {
          delegation.delegateCode = DELEGATION_DESIGNATOR + auth.address.slice(2).toLowerCase();
          delegation.delegateMetadata = await this.getContractMetadata(auth.address, chainId);
        }

        delegations.push(delegation);
      } catch (error) {
        console.warn('[AdvancedDecoder] Failed to parse authorization:', error);
      }
    }

    return delegations;
  }

  /**
   * Decode with EIP-7702 delegation context
   */
  private async decodeWithDelegation(
    data: string,
    contractAddress: string,
    delegations: Delegation[],
    chainId: number
  ): Promise<DecodedCall> {
    const delegation = delegations.find(
      (d) => d.address.toLowerCase() === contractAddress.toLowerCase() && !d.isRevocation
    );

    if (delegation) {
      return this.calldataDecoder.decode(data, delegation.address, chainId);
    }

    return this.calldataDecoder.decode(data, contractAddress, chainId);
  }

  /**
   * Analyze nested calls in calldata
   */
  async analyzeNestedCalls(
    calldata: string,
    contractAddress: string,
    chainId: number,
    depth: number
  ): Promise<{ calls: NestedCall[]; intents: string[]; bytecodes: string[] }> {
    if (depth >= this.maxDepth) {
      return { calls: [], intents: [], bytecodes: [] };
    }

    const calls: NestedCall[] = [];
    const intents: string[] = [];
    const bytecodes: string[] = [];

    const isMulticall = this.looksLikeMulticall(calldata);

    if (isMulticall) {
      try {
        const extractedBytecodes = await this.extractGenericMulticallBytecodes(
          calldata,
          contractAddress,
          chainId
        );

        for (const extracted of extractedBytecodes) {
          bytecodes.push(extracted.bytecode);

          const nestedResult = await this.calldataDecoder.decode(
            extracted.bytecode,
            extracted.target,
            chainId
          );

          const callInfo: NestedCall = {
            ...extracted,
            decoded: nestedResult,
            intent: nestedResult.success ? nestedResult.intent : 'Unknown function',
            depth: depth + 1,
          };

          calls.push(callInfo);
          if (nestedResult.success) {
            intents.push(nestedResult.intent);
          }

          // Check for deeper nesting
          if (looksLikeCalldata(extracted.bytecode)) {
            if (this.looksLikeMulticall(extracted.bytecode)) {
              const deeperNesting = await this.analyzeNestedCalls(
                extracted.bytecode,
                extracted.target,
                chainId,
                depth + 1
              );
              calls.push(...deeperNesting.calls);
              intents.push(...deeperNesting.intents);
              bytecodes.push(...deeperNesting.bytecodes);
            } else {
              const embeddedBytecodes = await this.extractEmbeddedBytecodes(
                extracted.bytecode,
                extracted.target,
                chainId
              );

              for (const embedded of embeddedBytecodes) {
                bytecodes.push(embedded.bytecode);
                const embeddedResult = await this.calldataDecoder.decode(
                  embedded.bytecode,
                  embedded.target,
                  chainId
                );

                calls.push({
                  ...embedded,
                  decoded: embeddedResult,
                  intent: embeddedResult.success ? embeddedResult.intent : 'Unknown function',
                  depth: depth + 2,
                });

                if (embeddedResult.success) {
                  intents.push(embeddedResult.intent);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('[AdvancedDecoder] Failed to analyze nested calls:', error);
      }
    } else {
      // Check for embedded bytecodes
      const embeddedBytecodes = await this.extractEmbeddedBytecodes(calldata, contractAddress, chainId);

      for (const embedded of embeddedBytecodes) {
        bytecodes.push(embedded.bytecode);
        const nestedResult = await this.calldataDecoder.decode(
          embedded.bytecode,
          embedded.target,
          chainId
        );

        calls.push({
          ...embedded,
          decoded: nestedResult,
          intent: nestedResult.success ? nestedResult.intent : 'Unknown function',
          depth: depth + 1,
        });

        if (nestedResult.success) {
          intents.push(nestedResult.intent);
        }
      }
    }

    return { calls, intents, bytecodes };
  }

  /**
   * Analyze nested calls with delegation context
   */
  private async analyzeNestedCallsWithDelegation(
    calldata: string,
    contractAddress: string,
    delegations: Delegation[],
    chainId: number,
    depth: number
  ): Promise<{ calls: NestedCall[]; intents: string[]; bytecodes: string[] }> {
    const standardAnalysis = await this.analyzeNestedCalls(calldata, contractAddress, chainId, depth);

    // Enhance with delegation context
    for (const call of standardAnalysis.calls) {
      const delegation = delegations.find(
        (d) => d.address.toLowerCase() === call.target.toLowerCase()
      );
      if (delegation && !delegation.isRevocation) {
        call.delegationContext = delegation;
        call.actualExecutionTarget = delegation.address;
      }
    }

    return standardAnalysis;
  }

  /**
   * Check if calldata looks like a multicall
   */
  private looksLikeMulticall(calldata: string): boolean {
    if (!looksLikeCalldata(calldata)) return false;
    if (calldata.length < 200) return false;

    const paramData = calldata.slice(10);
    const firstWord = paramData.slice(0, 64);
    const offset = parseInt(firstWord, 16);

    return offset === 32 || offset === 64 || offset === 96;
  }

  /**
   * Extract bytecodes from multicall using ABI
   */
  private async extractGenericMulticallBytecodes(
    calldata: string,
    contractAddress: string,
    chainId: number
  ): Promise<NestedCall[]> {
    const extractedCalls: NestedCall[] = [];

    try {
      const metadata = await this.getContractMetadata(contractAddress, chainId);
      if (!metadata?.context?.contract?.abi) {
        return [];
      }

      const selector = extractSelector(calldata);
      const abiFunction = metadata.context.contract.abi.find(
        (item) => item.type === 'function' && (item as AbiFunction).selector === selector
      ) as AbiFunction | undefined;

      if (!abiFunction?.inputs) {
        return [];
      }

      const paramData = calldata.slice(10);
      const decodedParams = decodeAbiParameters(abiFunction.inputs, paramData);

      let callIndex = 0;
      for (const [paramName, paramValue] of Object.entries(decodedParams)) {
        if (looksLikeCalldata(paramValue as string)) {
          extractedCalls.push({
            index: callIndex++,
            target: contractAddress,
            bytecode: paramValue as string,
            selector: extractSelector(paramValue as string),
            value: '0x0',
            callType: 'CALL',
            parentCall: abiFunction.name,
            parameterName: paramName,
            depth: 0,
          });
        } else if (Array.isArray(paramValue)) {
          for (let i = 0; i < (paramValue as unknown[]).length; i++) {
            const item = (paramValue as unknown[])[i];

            if (looksLikeCalldata(item as string)) {
              extractedCalls.push({
                index: callIndex++,
                target: contractAddress,
                bytecode: item as string,
                selector: extractSelector(item as string),
                value: '0x0',
                callType: 'CALL',
                parentCall: abiFunction.name,
                parameterName: `${paramName}[${i}]`,
                depth: 0,
              });
            } else if (typeof item === 'object' && item !== null) {
              const itemObj = item as Record<string, unknown>;
              const to = itemObj.to || itemObj[0];
              const value = itemObj.value || itemObj[1] || '0x0';
              const data = itemObj.data || itemObj[2];

              if (to && data && looksLikeCalldata(data as string)) {
                extractedCalls.push({
                  index: callIndex++,
                  target: String(to).toLowerCase(),
                  bytecode: data as string,
                  selector: extractSelector(data as string),
                  value: String(value),
                  callType: 'CALL',
                  parentCall: abiFunction.name,
                  parameterName: `${paramName}[${i}]`,
                  tupleFields: { to, value, data },
                  depth: 0,
                });
              } else if (itemObj.sender && itemObj.callData && looksLikeCalldata(itemObj.callData as string)) {
                // ERC-4337 UserOperation
                extractedCalls.push({
                  index: callIndex++,
                  target: String(itemObj.sender).toLowerCase(),
                  bytecode: itemObj.callData as string,
                  selector: extractSelector(itemObj.callData as string),
                  value: '0x0',
                  callType: 'USEROP',
                  parentCall: abiFunction.name,
                  parameterName: `${paramName}[${i}].callData`,
                  tupleFields: { sender: itemObj.sender, callData: itemObj.callData },
                  depth: 0,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('[AdvancedDecoder] Generic multicall extraction error:', error);
    }

    return extractedCalls;
  }

  /**
   * Extract embedded bytecodes from non-multicall functions
   */
  private async extractEmbeddedBytecodes(
    calldata: string,
    contractAddress: string,
    chainId: number
  ): Promise<NestedCall[]> {
    const embeddedBytecodes: NestedCall[] = [];

    try {
      const metadata = await this.getContractMetadata(contractAddress, chainId);
      const selector = extractSelector(calldata);

      if (metadata?.context?.contract?.abi) {
        const abiFunction = metadata.context.contract.abi.find(
          (item) => item.type === 'function' && (item as AbiFunction).selector === selector
        ) as AbiFunction | undefined;

        if (abiFunction?.inputs) {
          const paramData = calldata.slice(10);
          const decodedParams = decodeAbiParameters(abiFunction.inputs, paramData);

          let embeddedIndex = 0;
          for (const [paramName, paramValue] of Object.entries(decodedParams)) {
            if (looksLikeCalldata(paramValue as string)) {
              embeddedBytecodes.push({
                index: embeddedIndex++,
                target: this.extractTargetFromEmbedded(paramValue as string, decodedParams) || contractAddress,
                bytecode: paramValue as string,
                selector: extractSelector(paramValue as string),
                value: '0x0',
                callType: 'EMBEDDED',
                parentCall: abiFunction.name,
                parameterName: paramName,
                depth: 0,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('[AdvancedDecoder] Embedded bytecode extraction error:', error);
    }

    return embeddedBytecodes;
  }

  /**
   * Try to extract target address from embedded calldata context
   */
  private extractTargetFromEmbedded(
    bytecode: string,
    allParams: Record<string, unknown>
  ): string | null {
    for (const [paramName, paramValue] of Object.entries(allParams)) {
      if (typeof paramValue === 'string' && isValidAddress(paramValue)) {
        const lowerParamName = paramName.toLowerCase();
        if (
          lowerParamName.includes('to') ||
          lowerParamName.includes('target') ||
          lowerParamName.includes('contract') ||
          lowerParamName.includes('recipient') ||
          lowerParamName.includes('dest')
        ) {
          return paramValue;
        }
      }
    }

    // Try to extract from bytecode
    try {
      const paramData = bytecode.slice(10);
      for (let i = 0; i < Math.min(3, paramData.length / 64); i++) {
        const param = paramData.slice(i * 64, (i + 1) * 64);
        if (param.startsWith('000000000000000000000000')) {
          const address = '0x' + param.slice(24);
          if (isValidAddress(address)) {
            return address;
          }
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Get contract metadata with caching
   */
  private async getContractMetadata(
    address: string,
    chainId: number
  ): Promise<ERC7730Metadata | null> {
    const cacheKey = `${address.toLowerCase()}-${chainId}`;

    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    const metadata = await this.metadataService.getContractMetadata(address, chainId);
    this.metadataCache.set(cacheKey, metadata);

    return metadata;
  }
}

// Default instance
let defaultAdvancedDecoder: AdvancedTransactionDecoder | null = null;

/**
 * Get or create the default advanced decoder instance
 */
export function getAdvancedDecoder(options?: DecoderOptions): AdvancedTransactionDecoder {
  if (!defaultAdvancedDecoder || options) {
    defaultAdvancedDecoder = new AdvancedTransactionDecoder(options);
  }
  return defaultAdvancedDecoder;
}

/**
 * Decode a transaction using the default advanced decoder
 */
export async function decodeTransaction(input: TransactionInput): Promise<DecodedTransaction> {
  const decoder = getAdvancedDecoder();
  return decoder.decodeTransaction(input);
}
