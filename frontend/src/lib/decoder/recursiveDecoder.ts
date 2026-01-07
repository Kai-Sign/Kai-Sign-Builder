/**
 * Recursive Calldata Decoder - ERC-7730 compliant recursive decoding
 * Handles nested calldata fields and multicall patterns with depth limiting
 */

import type {
  RecursiveDecodeResult,
  NestedDecodeEntry,
  MulticallResult,
  MulticallOperation,
  ERC7730Metadata,
  FieldDefinition,
  MulticallStructure,
  RecursiveDecoderOptions,
} from './types';
import { CalldataDecoder, getCalldataDecoder } from './decode';
import { MetadataService, getMetadataService, resolveJsonPath, resolveFieldPath } from './metadataService';

/**
 * Recursive Calldata Decoder
 */
export class RecursiveCalldataDecoder {
  private calldataDecoder: CalldataDecoder;
  private metadataService: MetadataService;
  private maxDepth: number;
  private decodingStack: string[];

  constructor(options: RecursiveDecoderOptions = {}) {
    this.calldataDecoder = getCalldataDecoder();
    this.metadataService = getMetadataService();
    this.maxDepth = options.maxDepth || 5;
    this.decodingStack = [];
  }

  /**
   * Main entry point for recursive decoding
   */
  async decode(
    calldata: string,
    targetAddress: string,
    chainId: number,
    parentContext: Record<string, unknown> | null = null,
    depth: number = 0
  ): Promise<RecursiveDecodeResult> {
    // Validate calldata
    if (!calldata || calldata === '0x' || calldata.length < 10) {
      return {
        success: false,
        selector: '0x',
        params: {},
        formatted: {},
        intent: 'Invalid data',
        error: 'Invalid or empty calldata',
        depth,
      };
    }

    const selector = calldata.slice(0, 10);

    // Depth check
    if (depth >= this.maxDepth) {
      return {
        success: false,
        selector,
        params: {},
        formatted: {},
        intent: 'Max depth reached',
        error: `Max recursion depth (${this.maxDepth}) reached`,
        depth,
        truncated: true,
      };
    }

    // Cycle detection
    const stackKey = `${targetAddress?.toLowerCase()}:${selector}`;
    if (this.decodingStack.includes(stackKey)) {
      return {
        success: false,
        selector,
        params: {},
        formatted: {},
        intent: 'Cycle detected',
        error: 'Recursive cycle detected',
        depth,
      };
    }
    this.decodingStack.push(stackKey);

    try {
      // Use base decoder for initial decode
      const decoded = await this.calldataDecoder.decode(calldata, targetAddress, chainId);

      if (!decoded.success) {
        return { ...decoded, depth };
      }

      // Get metadata for calldata field processing
      const metadata = await this.metadataService.getContractMetadata(targetAddress, chainId, selector);

      // Process fields for nested calldata
      const processedResult = await this.processFieldsRecursively(
        decoded.rawParams || {},
        decoded.function || decoded.functionName || '',
        metadata,
        { params: decoded.rawParams, parentContext, targetAddress },
        chainId,
        depth
      );

      // Aggregate intents
      const nestedIntents = this.aggregateIntents(processedResult);
      const aggregatedIntent =
        nestedIntents.length > 0 ? nestedIntents.join(' + ') : decoded.intent;

      return {
        ...decoded,
        params: processedResult.params as Record<string, string>,
        nestedDecodes: processedResult.nestedDecodes,
        nestedIntents,
        aggregatedIntent,
        wrapperIntent: decoded.intent,
        depth,
      };
    } finally {
      this.decodingStack.pop();
    }
  }

  /**
   * Process decoded parameters looking for calldata fields
   */
  private async processFieldsRecursively(
    params: Record<string, unknown>,
    functionName: string,
    metadata: ERC7730Metadata | null,
    context: { params: Record<string, unknown> | undefined; parentContext: Record<string, unknown> | null; targetAddress: string },
    chainId: number,
    depth: number
  ): Promise<{ params: Record<string, unknown>; nestedDecodes: NestedDecodeEntry[] }> {
    const nestedDecodes: NestedDecodeEntry[] = [];
    const processedParams = { ...params };

    // Get format definition
    let format = metadata?.display?.formats?.[functionName];

    if (!format && metadata?.display?.formats) {
      const baseFunctionName = functionName.includes('(')
        ? functionName.split('(')[0]
        : functionName;

      for (const key of Object.keys(metadata.display.formats)) {
        const keyBaseName = key.includes('(') ? key.split('(')[0] : key;
        if (key === baseFunctionName || keyBaseName === baseFunctionName) {
          format = metadata.display.formats[key];
          break;
        }
      }
    }

    if (!format) {
      return { params: processedParams, nestedDecodes };
    }

    // Find calldata fields
    const calldataFieldsMap = new Map<string, FieldDefinition>();
    const formatAny = format as { intent?: { format?: unknown[] }; fields?: FieldDefinition[] };

    if (formatAny.intent?.format) {
      const intentFields: FieldDefinition[] = [];
      this.findCalldataFields(formatAny.intent.format, intentFields);
      for (const field of intentFields) {
        if (field.path && !calldataFieldsMap.has(field.path)) {
          calldataFieldsMap.set(field.path, field);
        }
      }
    }

    if (formatAny.fields) {
      for (const field of formatAny.fields) {
        if ((field.type === 'calldata' || field.format === 'calldata') && field.path) {
          if (!calldataFieldsMap.has(field.path)) {
            calldataFieldsMap.set(field.path, field);
          }
        }
      }
    }

    // Process calldata fields
    const processedPaths = new Set<string>();

    for (const [path, fieldDef] of calldataFieldsMap) {
      if (processedPaths.has(path)) continue;
      processedPaths.add(path);

      const pathStr = fieldDef.path;

      // Handle array paths like "calls.[].data"
      if (pathStr.includes('[]')) {
        const parts = pathStr.split('.');
        const arrayFieldName = parts[0];
        const dataFieldName = parts[parts.length - 1];
        const calleePathStr = fieldDef.params?.calleePath as string || fieldDef.to;
        const calleeFieldName = calleePathStr?.split('.').pop();

        const arrayData = params[arrayFieldName];
        if (Array.isArray(arrayData)) {
          for (let i = 0; i < arrayData.length; i++) {
            const item = arrayData[i] as Record<string, unknown>;
            const calldata = item[dataFieldName] as string;
            const target = item[calleeFieldName || ''] as string;

            if (calldata && calldata.length >= 10 && target) {
              const nestedResult = await this.decode(calldata, target, chainId, context as unknown as Record<string, unknown>, depth + 1);
              if (nestedResult.success) {
                (processedParams as Record<string, unknown>)[`${arrayFieldName}[${i}].${dataFieldName}_decoded`] = nestedResult;
                nestedDecodes.push({
                  fieldPath: `${arrayFieldName}[${i}].${dataFieldName}`,
                  targetAddress: target,
                  result: nestedResult,
                });
              }
            }
          }
        }
        continue;
      }

      // Simple path handling
      const rawValue = params[fieldDef.path] as string;
      if (!rawValue || rawValue === '0x' || rawValue.length < 10) {
        continue;
      }

      // Resolve target address
      let targetAddress = fieldDef.to || (fieldDef.params?.calleePath as string);
      if (targetAddress) {
        if (targetAddress.startsWith('$.')) {
          targetAddress = resolveJsonPath(targetAddress, params) as string;
        } else if (!targetAddress.startsWith('0x')) {
          targetAddress = params[targetAddress] as string;
        }
      }

      if (!targetAddress) continue;

      const nestedResult = await this.decode(rawValue, targetAddress, chainId, context as unknown as Record<string, unknown>, depth + 1);

      if (nestedResult.success) {
        (processedParams as Record<string, unknown>)[`${fieldDef.path}_decoded`] = nestedResult;
        nestedDecodes.push({
          fieldPath: fieldDef.path,
          targetAddress,
          result: nestedResult,
        });
      }
    }

    // Check for multicall fields
    const multicallStructure = metadata?.parsing?.multicallStructure;
    const processedMulticallPaths = new Set<string>();

    const multicallFields = this.findMulticallDecoderFields(formatAny.intent?.format || []);
    for (const fieldDef of multicallFields) {
      const paramName = fieldDef.path;
      if (!paramName || processedMulticallPaths.has(paramName)) continue;

      const rawValue = params[paramName] as string;
      if (!rawValue || rawValue === '0x') continue;

      processedMulticallPaths.add(paramName);

      const multicallResult = await this.handleMulticallDecoder(
        fieldDef,
        rawValue,
        context as unknown as Record<string, unknown>,
        chainId,
        depth,
        multicallStructure || null
      );

      if (multicallResult.operations.length > 0) {
        (processedParams as Record<string, unknown>)[`${paramName}_multicall`] = multicallResult;
        nestedDecodes.push({
          fieldPath: paramName,
          type: 'multicall',
          result: multicallResult,
        });
      }
    }

    // Check format.fields for multicallBatch
    for (const field of formatAny.fields || []) {
      if (field.format === 'multicallBatch' || (field.path === 'transactions' && params.transactions)) {
        const paramName = field.path;
        if (processedMulticallPaths.has(paramName)) continue;

        const rawValue = params[paramName] as string;
        if (!rawValue || rawValue === '0x' || rawValue.length < 4) continue;

        processedMulticallPaths.add(paramName);

        const multicallResult = await this.handleMulticallDecoder(
          { path: paramName, format: 'multicallBatch' },
          rawValue,
          context as unknown as Record<string, unknown>,
          chainId,
          depth,
          multicallStructure || null
        );

        if (multicallResult.operations.length > 0) {
          (processedParams as Record<string, unknown>)[`${paramName}_multicall`] = multicallResult;
          nestedDecodes.push({
            fieldPath: paramName,
            type: 'multicall',
            result: multicallResult,
          });
        }
      }
    }

    return { params: processedParams, nestedDecodes };
  }

  /**
   * Find calldata fields in format structure
   */
  private findCalldataFields(formatArray: unknown, results: FieldDefinition[] = []): FieldDefinition[] {
    if (formatArray && typeof formatArray === 'object' && !Array.isArray(formatArray)) {
      const item = formatArray as { type?: string; path?: string; fields?: unknown };
      if (item.type === 'calldata' && item.path) {
        results.push(item as FieldDefinition);
      }
      if (item.fields) {
        this.findCalldataFields(item.fields, results);
      }
      return results;
    }

    if (!Array.isArray(formatArray)) return results;

    for (const item of formatArray) {
      const typedItem = item as { type?: string; path?: string; fields?: unknown };
      if (typedItem.type === 'calldata' && typedItem.path) {
        results.push(typedItem as FieldDefinition);
      }
      if (typedItem.fields) {
        this.findCalldataFields(typedItem.fields, results);
      }
    }
    return results;
  }

  /**
   * Find multicallDecoder fields
   */
  private findMulticallDecoderFields(formatArray: unknown, results: FieldDefinition[] = []): FieldDefinition[] {
    if (formatArray && typeof formatArray === 'object' && !Array.isArray(formatArray)) {
      const item = formatArray as { type?: string; path?: string; fields?: unknown };
      if (item.type === 'multicallDecoder' && item.path) {
        results.push(item as FieldDefinition);
      }
      if (item.fields) {
        this.findMulticallDecoderFields(item.fields, results);
      }
      return results;
    }

    if (!Array.isArray(formatArray)) return results;

    for (const item of formatArray) {
      const typedItem = item as { type?: string; path?: string; fields?: unknown };
      if (typedItem.type === 'multicallDecoder' && typedItem.path) {
        results.push(typedItem as FieldDefinition);
      }
      if (typedItem.fields) {
        this.findMulticallDecoderFields(typedItem.fields, results);
      }
    }
    return results;
  }

  /**
   * Handle multicall decoder field
   */
  private async handleMulticallDecoder(
    fieldDef: FieldDefinition,
    rawValue: string,
    context: Record<string, unknown>,
    chainId: number,
    depth: number,
    multicallStructure: MulticallStructure | null
  ): Promise<MulticallResult> {
    if (!multicallStructure) {
      return { operations: [], totalCount: 0, truncated: false, intents: [] };
    }

    const operations = this.parsePackedTransactions(rawValue, multicallStructure);
    const decodedOperations: MulticallOperation[] = [];
    const intents: string[] = [];
    const seenIntentKeys = new Set<string>();
    const maxOps = 20;
    const opsToProcess = operations.slice(0, maxOps);

    for (let i = 0; i < opsToProcess.length; i++) {
      const op = opsToProcess[i];

      const decodedOp: MulticallOperation = {
        index: i,
        operation: op.operation,
        operationType: this.getOperationType(op.operation),
        to: op.to,
        value: op.value,
        data: op.data,
        selector: op.data?.length >= 10 ? op.data.slice(0, 10) : null,
      };

      if (op.data && op.data.length > 10) {
        try {
          const nestedDecode = await this.decode(op.data, op.to, chainId, context, depth + 1);
          if (nestedDecode.success) {
            decodedOp.decoded = nestedDecode;

            if (nestedDecode.nestedIntents && nestedDecode.nestedIntents.length > 0) {
              for (const leafIntent of nestedDecode.nestedIntents) {
                if (leafIntent && !seenIntentKeys.has(leafIntent)) {
                  seenIntentKeys.add(leafIntent);
                  intents.push(leafIntent);
                }
              }
            } else {
              const leafIntent = nestedDecode.intent;
              if (leafIntent && !seenIntentKeys.has(leafIntent)) {
                seenIntentKeys.add(leafIntent);
                intents.push(leafIntent);
              }
            }
          } else {
            // Fallback intent
            const selector = op.data?.slice(0, 10) || '0x';
            const shortAddr = op.to ? `${op.to.slice(0, 8)}...${op.to.slice(-6)}` : 'Unknown';
            const fallbackIntent = `Call ${selector} to ${shortAddr}`;
            if (!seenIntentKeys.has(fallbackIntent)) {
              seenIntentKeys.add(fallbackIntent);
              intents.push(fallbackIntent);
            }
          }
        } catch {
          const selector = op.data?.slice(0, 10) || '0x';
          const shortAddr = op.to ? `${op.to.slice(0, 8)}...${op.to.slice(-6)}` : 'Unknown';
          const fallbackIntent = `Call ${selector} to ${shortAddr}`;
          if (!seenIntentKeys.has(fallbackIntent)) {
            seenIntentKeys.add(fallbackIntent);
            intents.push(fallbackIntent);
          }
        }
      }

      decodedOperations.push(decodedOp);
    }

    return {
      operations: decodedOperations,
      totalCount: operations.length,
      truncated: operations.length > maxOps,
      intents,
    };
  }

  /**
   * Parse packed transactions using metadata structure
   */
  private parsePackedTransactions(
    data: string,
    structure: MulticallStructure
  ): Array<{ operation: number; to: string; value: string; data: string; dataLength?: number }> {
    const transactions: Array<{ operation: number; to: string; value: string; data: string; dataLength?: number }> = [];
    const cleanData = data.startsWith('0x') ? data.slice(2) : data;
    let pos = 0;
    const maxTransactions = 50;
    let txCount = 0;

    // Convert structure to fields array
    let fields: Array<{ name: string; type: string; size?: number; dynamic?: boolean }>;
    if (Array.isArray(structure.fields)) {
      fields = structure.fields;
    } else {
      fields = Object.entries(structure)
        .filter(([key]) => !['fields'].includes(key))
        .map(([name, def]) => ({
          name,
          type: (def as { type: string }).type,
          size: (def as { size?: number }).size,
          dynamic: (def as { dynamic?: boolean }).dynamic,
        }));
    }

    while (pos < cleanData.length && txCount < maxTransactions) {
      const tx: Record<string, unknown> = {};
      let currentPos = pos;

      const fixedFieldsSize = fields
        .filter((f) => !f.dynamic && f.size)
        .reduce((sum, f) => sum + (f.size || 0) * 2, 0);

      if (currentPos + fixedFieldsSize > cleanData.length) break;

      for (const field of fields) {
        if (field.dynamic) {
          const dataLength = (tx.dataLength as number) || 0;
          if (dataLength > 0) {
            tx[field.name] = '0x' + cleanData.slice(currentPos, currentPos + dataLength);
            currentPos += dataLength;
          } else {
            tx[field.name] = '0x';
          }
        } else {
          const hexSize = (field.size || 32) * 2;
          const rawValue = cleanData.slice(currentPos, currentPos + hexSize);

          if (field.type === 'uint8' || field.type === 'int8') {
            tx[field.name] = parseInt(rawValue, 16);
          } else if (field.type === 'address') {
            tx[field.name] = '0x' + rawValue;
          } else if (field.type === 'uint256') {
            if (field.name === 'dataLength') {
              tx[field.name] = parseInt(rawValue, 16) * 2;
            } else {
              tx[field.name] = '0x' + rawValue;
            }
          } else {
            tx[field.name] = '0x' + rawValue;
          }
          currentPos += hexSize;
        }
      }

      transactions.push({
        operation: tx.operation as number || 0,
        to: tx.to as string || '',
        value: tx.value as string || '0x0',
        data: tx.data as string || '0x',
        dataLength: tx.dataLength as number,
      });
      pos = currentPos;
      txCount++;
    }

    return transactions;
  }

  /**
   * Get operation type info
   */
  private getOperationType(opCode: number): { name: string; color: string } {
    if (opCode === 0) return { name: 'Call', color: '#48bb78' };
    if (opCode === 1) return { name: 'DelegateCall', color: '#ed8936' };
    return { name: `Operation ${opCode}`, color: '#a0aec0' };
  }

  /**
   * Aggregate intents from nested decodes
   */
  private aggregateIntents(
    processedResult: { nestedDecodes: NestedDecodeEntry[] }
  ): string[] {
    const intents: string[] = [];
    const seenIntents = new Set<string>();

    for (const nested of processedResult.nestedDecodes) {
      if (nested.type === 'multicall') {
        const multicallResult = nested.result as MulticallResult;
        for (const intent of multicallResult.intents || []) {
          if (intent && !seenIntents.has(intent)) {
            seenIntents.add(intent);
            intents.push(intent);
          }
        }
      } else {
        const recursiveResult = nested.result as RecursiveDecodeResult;
        if (recursiveResult.nestedIntents && recursiveResult.nestedIntents.length > 0) {
          for (const intent of recursiveResult.nestedIntents) {
            if (intent && !seenIntents.has(intent)) {
              seenIntents.add(intent);
              intents.push(intent);
            }
          }
        } else if (recursiveResult.intent) {
          if (!seenIntents.has(recursiveResult.intent)) {
            seenIntents.add(recursiveResult.intent);
            intents.push(recursiveResult.intent);
          }
        }
      }
    }

    return intents;
  }
}

// Default instance
let defaultRecursiveDecoder: RecursiveCalldataDecoder | null = null;

/**
 * Get or create the default recursive decoder instance
 */
export function getRecursiveDecoder(options?: RecursiveDecoderOptions): RecursiveCalldataDecoder {
  if (!defaultRecursiveDecoder || options) {
    defaultRecursiveDecoder = new RecursiveCalldataDecoder(options);
  }
  return defaultRecursiveDecoder;
}

/**
 * Decode calldata recursively
 */
export async function decodeCalldataRecursive(
  data: string,
  contractAddress: string,
  chainId: number
): Promise<RecursiveDecodeResult> {
  const decoder = getRecursiveDecoder();
  return decoder.decode(data, contractAddress, chainId);
}
