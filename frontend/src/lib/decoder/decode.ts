/**
 * Core Calldata Decoder - Decodes raw calldata using ERC-7730 metadata
 * Pure dynamic decoder with no hardcoded metadata
 */

import type {
  DecodedCall,
  FormattedField,
  DecodedCommand,
  ERC7730Metadata,
  AbiFunction,
  FieldDefinition,
  CommandRegistry,
} from './types';
import { isBigNumberLike } from './types';
import { calculateSelector, extractSelector } from './utils/keccak';
import { AbiDecoder } from './utils/abiDecoder';
import { formatTokenAmount, formatValue, toTitleCase } from './utils/formatters';
import { MetadataService, getMetadataService, resolveFieldPath, resolveJsonPath } from './metadataService';

/**
 * Calldata Decoder class
 */
export class CalldataDecoder {
  private metadataService: MetadataService;

  constructor(metadataService?: MetadataService) {
    this.metadataService = metadataService || getMetadataService();
  }

  /**
   * Decode calldata using metadata
   * @param data - Raw calldata (0x-prefixed)
   * @param contractAddress - Contract address
   * @param chainId - Chain ID
   * @returns Decoded call information
   */
  async decode(data: string, contractAddress: string, chainId: number): Promise<DecodedCall> {
    try {
      const selector = extractSelector(data);
      if (!selector) {
        return {
          success: false,
          selector: '0x',
          params: {},
          formatted: {},
          intent: 'Invalid data',
          error: 'Invalid calldata format',
        };
      }

      // Get metadata for contract
      const metadata = await this.metadataService.getContractMetadata(contractAddress, chainId, selector);

      if (!metadata) {
        return {
          success: false,
          selector,
          params: {},
          formatted: {},
          intent: 'Contract interaction',
          error: 'No metadata found',
        };
      }

      // Find function in ABI
      const { functionSignature, functionName, abiFunction } = this.findFunction(metadata, selector);

      if (!functionSignature && !functionName) {
        return {
          success: false,
          selector,
          params: {},
          formatted: {},
          intent: 'Unknown function',
          error: 'Function not found in metadata ABI',
        };
      }

      // Get format definition and field info
      const format = metadata.display?.formats?.[functionSignature || ''] ||
                     metadata.display?.formats?.[functionName || ''];

      const { intent, fieldInfo } = this.extractFieldInformation(format, functionName || '');
      const commandRegistries = metadata.commandRegistries || {};

      // Decode parameters
      const { params, rawParams, formatted } = await this.decodeParameters(
        data,
        abiFunction,
        functionName || '',
        fieldInfo,
        chainId
      );

      // Handle intent substitution
      let finalIntent = await this.processIntent(
        intent,
        params,
        rawParams,
        formatted,
        format?.fields || [],
        commandRegistries,
        chainId
      );

      return {
        success: true,
        selector,
        function: functionSignature || undefined,
        functionName: functionName || undefined,
        params,
        rawParams,
        formatted,
        intent: finalIntent,
      };
    } catch (error) {
      console.error('[CalldataDecoder] Error:', error);
      return {
        success: false,
        selector: extractSelector(data) || '0x',
        params: {},
        formatted: {},
        intent: 'Contract interaction',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find function in ABI by selector
   */
  private findFunction(metadata: ERC7730Metadata, selector: string): {
    functionSignature: string | null;
    functionName: string | null;
    abiFunction: AbiFunction | null;
  } {
    let functionSignature: string | null = null;
    let functionName: string | null = null;
    let abiFunction: AbiFunction | null = null;

    if (metadata.context?.contract?.abi && Array.isArray(metadata.context.contract.abi)) {
      for (const item of metadata.context.contract.abi) {
        if (item.type === 'function') {
          const func = item as AbiFunction;
          const types = (func.inputs || []).map((input) => input.type).join(',');
          const signature = `${func.name}(${types})`;

          // Use stored selector or calculate it
          const expectedSelector = func.selector || calculateSelector(signature);

          if (expectedSelector === selector) {
            functionSignature = signature;
            functionName = func.name;
            abiFunction = func;
            break;
          }
        }
      }
    }

    // Fallback to selectorFallbacks
    if (!functionName && metadata.context?.contract?.selectorFallbacks) {
      functionName = metadata.context.contract.selectorFallbacks[selector] || null;
      if (functionName) {
        functionSignature = `${functionName}(...)`;
      }
    }

    return { functionSignature, functionName, abiFunction };
  }

  /**
   * Extract field information from format definition
   */
  private extractFieldInformation(
    format: { intent?: unknown; fields?: FieldDefinition[] } | undefined,
    functionName: string
  ): { intent: string | { type: string; config?: unknown }; fieldInfo: Record<string, FieldInfo> } {
    let intent: string | { type: string; config?: unknown } = 'Contract interaction';
    const fieldInfo: Record<string, FieldInfo> = {};

    if (!format) {
      return { intent, fieldInfo };
    }

    // Extract intent
    if (format.intent) {
      if (typeof format.intent === 'string') {
        intent = format.intent;
      } else if (typeof format.intent === 'object') {
        const intentObj = format.intent as Record<string, unknown>;
        if (intentObj.type === 'composite') {
          intent = { type: 'composite', config: intentObj };
        } else if (intentObj.template) {
          intent = intentObj.template as string;
        } else if (intentObj.format && Array.isArray(intentObj.format)) {
          // Extract from nested format
          for (const item of intentObj.format as Array<{ type?: string; fields?: Array<{ value?: string; format?: string }> }>) {
            if (item.type === 'container' && item.fields) {
              for (const field of item.fields) {
                if (field.format === 'heading2' && field.value) {
                  intent = field.value;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Check for interpolatedIntent
    const formatAny = format as { interpolatedIntent?: string };
    if (formatAny.interpolatedIntent) {
      intent = { type: 'interpolated', config: { template: formatAny.interpolatedIntent } };
    }

    // Extract field info
    if (format.fields) {
      for (const field of format.fields) {
        if (field.path) {
          fieldInfo[field.path] = {
            label: field.label || field.path,
            format: field.format || 'raw',
            params: field.params || {},
            type: field.type || 'raw',
            calldataTarget: field.type === 'calldata' ? field.to : null,
          };
        }
      }
    }

    return { intent, fieldInfo };
  }

  /**
   * Decode function parameters
   */
  private async decodeParameters(
    data: string,
    abiFunction: AbiFunction | null,
    functionName: string,
    fieldInfo: Record<string, FieldInfo>,
    chainId: number
  ): Promise<{
    params: Record<string, string>;
    rawParams: Record<string, unknown>;
    formatted: Record<string, FormattedField>;
  }> {
    const params: Record<string, string> = {};
    const rawParams: Record<string, unknown> = {};
    const formatted: Record<string, FormattedField> = {};

    if (!abiFunction) {
      params.data = data.slice(10);
      formatted.data = {
        label: 'Transaction Data',
        value: data.slice(10),
        format: 'raw',
      };
      return { params, rawParams, formatted };
    }

    try {
      const decoder = new AbiDecoder([abiFunction]);
      const decodedData = decoder.decodeFunctionData(functionName, data);
      const inputs = abiFunction.inputs || [];

      for (let i = 0; i < decodedData.length && i < inputs.length; i++) {
        const input = inputs[i];
        const value = decodedData[i];
        const paramName = input.name || `param${i}`;

        rawParams[paramName] = value;

        // Format value
        let rawValue: string;
        if (isBigNumberLike(value)) {
          rawValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          rawValue = JSON.stringify(value);
        } else {
          rawValue = String(value ?? '');
        }

        // Get field info
        const fieldDef = fieldInfo[paramName];

        // Apply formatting
        let displayValue = rawValue;
        if (fieldDef?.format === 'amount' && fieldDef.params?.decimals) {
          const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
          if (rawValue === MAX_UINT256) {
            const symbol = fieldDef.params.symbol as string || '';
            displayValue = symbol ? `Unlimited ${symbol}` : 'Unlimited';
          } else {
            displayValue = formatTokenAmount(
              rawValue,
              fieldDef.params.decimals as number,
              fieldDef.params.symbol as string
            );
          }
        } else if (fieldDef?.format === 'tokenAmount' && fieldDef.params?.tokenPath) {
          // Handle tokenAmount with dynamic token lookup
          const tokenAddress = resolveFieldPath(fieldDef.params.tokenPath as string, rawParams as Record<string, unknown>);
          if (tokenAddress && typeof tokenAddress === 'string') {
            try {
              const tokenInfo = await this.metadataService.getTokenMetadata(tokenAddress, chainId);
              displayValue = formatTokenAmount(rawValue, tokenInfo.decimals || 18, tokenInfo.symbol);
            } catch {
              displayValue = rawValue;
            }
          }
        }

        params[paramName] = rawValue;
        formatted[paramName] = {
          label: fieldDef?.label || toTitleCase(paramName),
          value: displayValue,
          rawValue,
          format: fieldDef?.format || (input.type === 'address' ? 'address' : input.type === 'uint256' ? 'token' : 'raw'),
          params: fieldDef?.params,
        };
      }
    } catch (error) {
      console.warn('[CalldataDecoder] Parameter decoding error:', error);
      params.data = data.slice(10);
      formatted.data = {
        label: 'Transaction Data',
        value: data.slice(10),
        format: 'raw',
      };
    }

    return { params, rawParams, formatted };
  }

  /**
   * Process intent template and substitutions
   */
  private async processIntent(
    intent: string | { type: string; config?: unknown },
    params: Record<string, string>,
    rawParams: Record<string, unknown>,
    formatted: Record<string, FormattedField>,
    fields: FieldDefinition[],
    commandRegistries: Record<string, CommandRegistry>,
    chainId: number
  ): Promise<string> {
    // Handle composite intent
    if (typeof intent === 'object' && intent.type === 'composite') {
      const config = intent.config as {
        registry?: string;
        source?: string;
        separator?: string;
        maxDisplay?: number;
        overflow?: string;
      };
      const registryName = config?.registry;
      const registry = registryName ? commandRegistries[registryName] : undefined;
      const sourceParam = config?.source;

      if (sourceParam && rawParams[sourceParam] && registry) {
        const commandsValue = rawParams[sourceParam];
        const inputsValue = rawParams['inputs'];
        const decodedCommands = this.decodeCommandArray(commandsValue, inputsValue, registry);
        return this.buildCompositeIntent(config || {}, decodedCommands);
      }
      return 'Execute commands';
    }

    // Handle interpolated intent
    if (typeof intent === 'object' && intent.type === 'interpolated') {
      const config = intent.config as { template: string };
      const template = config?.template;
      if (template) {
        return await this.substituteInterpolatedIntent(template, rawParams, fields, chainId);
      }
    }

    // Handle standard intent template
    if (typeof intent === 'string') {
      return this.substituteIntentTemplate(intent, params, formatted, rawParams);
    }

    return 'Contract interaction';
  }

  /**
   * Substitute template variables in intent string
   */
  private substituteIntentTemplate(
    template: string,
    params: Record<string, string>,
    formatted: Record<string, FormattedField>,
    rawParams: Record<string, unknown>
  ): string {
    if (!template || typeof template !== 'string') return template;
    if (!template.includes('{')) return template;

    const regex = /\{([#@]?[\w.\[\]]+)(?::(\w+))?\}/g;

    return template.replace(regex, (match, paramPath, formatType) => {
      // Helper to get nested value
      const getNestedValue = (obj: unknown, path: string): unknown => {
        if (!obj) return undefined;

        let currentPath = path;
        if (currentPath.startsWith('#.') || currentPath.startsWith('@.')) {
          currentPath = currentPath.substring(2);
        }

        const parts = currentPath.split('.').filter((p) => p);
        let value = obj;

        for (const part of parts) {
          if (value === undefined || value === null) return undefined;

          const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/);
          if (arrayMatch) {
            const fieldName = arrayMatch[1];
            const index = parseInt(arrayMatch[2]);

            if (fieldName) {
              value = (value as Record<string, unknown>)[fieldName];
              if (value === undefined || value === null) return undefined;
            }

            if (Array.isArray(value)) {
              value = value[index];
            } else {
              return undefined;
            }
          } else {
            value = (value as Record<string, unknown>)[part];
          }
        }
        return value;
      };

      // Try formatted value first
      const formattedValue = formatted[paramPath] || getNestedValue(formatted, paramPath) as FormattedField | undefined;
      if (formattedValue && typeof formattedValue === 'object' && 'value' in formattedValue) {
        if (formatType === 'label') {
          return formattedValue.label || paramPath;
        }
        return formattedValue.value || match;
      }

      // Fall back to raw params
      const rawValue = getNestedValue(rawParams, paramPath);
      if (rawValue !== undefined && rawValue !== null) {
        if (isBigNumberLike(rawValue)) {
          return rawValue.toString();
        }
        return String(rawValue);
      }

      // Try string params
      const stringValue = getNestedValue(params, paramPath);
      if (stringValue !== undefined) {
        return String(stringValue);
      }

      return match;
    });
  }

  /**
   * Process interpolatedIntent template (async for token lookups)
   */
  private async substituteInterpolatedIntent(
    template: string,
    rawParams: Record<string, unknown>,
    fields: FieldDefinition[],
    chainId: number
  ): Promise<string> {
    if (!template || !template.includes('{')) return template;

    const regex = /\{([#@]?[\w.\[\]]+)(?::(\w+))?\}/g;
    const matches: Array<{ fullMatch: string; pathStr: string; formatType?: string }> = [];

    let match;
    while ((match = regex.exec(template)) !== null) {
      matches.push({
        fullMatch: match[0],
        pathStr: match[1],
        formatType: match[2],
      });
    }

    // Process all matches
    const replacements = await Promise.all(
      matches.map(async ({ fullMatch, pathStr }) => {
        const fieldSpec = fields.find((f) => f.path === pathStr);
        if (!fieldSpec) {
          return { match: fullMatch, value: fullMatch };
        }

        const value = resolveFieldPath(pathStr, rawParams as Record<string, unknown>);
        if (value === undefined || value === null) {
          return { match: fullMatch, value: fullMatch };
        }

        const formatted = await this.applyFieldFormat(value, fieldSpec, rawParams, chainId);
        return { match: fullMatch, value: formatted };
      })
    );

    let result = template;
    for (const { match, value } of replacements) {
      result = result.replace(match, value);
    }

    return result;
  }

  /**
   * Apply ERC-7730 field format to a value
   */
  private async applyFieldFormat(
    value: unknown,
    fieldSpec: FieldDefinition,
    allParams: Record<string, unknown>,
    chainId: number
  ): Promise<string> {
    const format = fieldSpec.format;
    const params = fieldSpec.params || {};

    if (format === 'tokenAmount') {
      const tokenPath = params.tokenPath as string;
      if (!tokenPath) {
        return String(value);
      }

      const tokenAddress = resolveFieldPath(tokenPath, allParams as Record<string, unknown>);

      let decimals = 18;
      let symbol = '';

      if (tokenAddress && typeof tokenAddress === 'string') {
        const normalizedAddr = tokenAddress.toLowerCase();
        if (
          normalizedAddr === '0x0000000000000000000000000000000000000000' ||
          normalizedAddr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        ) {
          decimals = 18;
          symbol = 'ETH';
        } else {
          try {
            const tokenInfo = await this.metadataService.getTokenMetadata(tokenAddress, chainId);
            decimals = tokenInfo.decimals || 18;
            symbol = tokenInfo.symbol || '';
          } catch {
            symbol = `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
          }
        }
      }

      // Convert value to string
      let valueStr: string;
      if (isBigNumberLike(value)) {
        valueStr = BigInt((value as { _hex: string })._hex).toString();
      } else if (typeof value === 'object' && value !== null && 'toString' in value) {
        valueStr = (value as { toString: () => string }).toString();
      } else {
        valueStr = String(value);
      }

      return formatTokenAmount(valueStr, decimals, symbol);
    }

    if (format === 'addressName') {
      return String(value);
    }

    return String(value);
  }

  /**
   * Decode Universal Router command array
   */
  private decodeCommandArray(
    commands: unknown,
    inputs: unknown,
    registry: CommandRegistry
  ): DecodedCommand[] {
    if (!commands || !registry) return [];

    const commandsStr = String(commands);
    const commandBytes = commandsStr.startsWith('0x') ? commandsStr.slice(2) : commandsStr;
    const inputsArray = Array.isArray(inputs) ? inputs : [];
    const results: DecodedCommand[] = [];

    for (let i = 0; i < commandBytes.length; i += 2) {
      const cmdByte = '0x' + commandBytes.slice(i, i + 2).toLowerCase();
      const cmdDef = registry[cmdByte];
      const inputData = inputsArray[i / 2];

      if (cmdDef) {
        let intent = cmdDef.intent || cmdDef.name;
        const decodedParams: Record<string, unknown> = {};

        // Try to decode input if available
        if (inputData && cmdDef.inputs) {
          try {
            const mockAbi = {
              type: 'function' as const,
              name: 'decode',
              inputs: cmdDef.inputs,
            };
            const decoder = new AbiDecoder([mockAbi]);
            const fakeCalldata = '0x00000000' + (String(inputData).startsWith('0x') ? String(inputData).slice(2) : String(inputData));
            const decoded = decoder.decodeFunctionData('decode', fakeCalldata);

            for (let j = 0; j < cmdDef.inputs.length && j < decoded.length; j++) {
              const paramDef = cmdDef.inputs[j];
              decodedParams[paramDef.name] = decoded[j];
            }

            // Substitute in intent
            intent = this.substituteCommandIntent(cmdDef.intent || cmdDef.name, decodedParams);
          } catch (e) {
            console.log('[CalldataDecoder] Failed to decode command input:', cmdByte);
          }
        }

        results.push({
          command: cmdByte,
          name: cmdDef.name,
          intent,
          params: decodedParams,
        });
      } else {
        results.push({
          command: cmdByte,
          name: `UNKNOWN_${cmdByte}`,
          intent: `Unknown command ${cmdByte}`,
          params: {},
        });
      }
    }

    return results;
  }

  /**
   * Substitute template variables in command intent
   */
  private substituteCommandIntent(template: string, params: Record<string, unknown>): string {
    if (!template || !template.includes('{')) return template;

    return template.replace(/\{(\w+)\}/g, (match, paramName) => {
      if (params[paramName] !== undefined) {
        return String(params[paramName]);
      }
      return match;
    });
  }

  /**
   * Build composite intent from decoded commands
   */
  private buildCompositeIntent(
    config: { separator?: string; maxDisplay?: number; overflow?: string },
    decodedCommands: DecodedCommand[]
  ): string {
    if (!decodedCommands || decodedCommands.length === 0) {
      return 'Execute commands';
    }

    const separator = config.separator || ' + ';
    const intents = decodedCommands.map((cmd) => cmd.intent);

    if (config.maxDisplay && intents.length > config.maxDisplay) {
      const shown = intents.slice(0, config.maxDisplay);
      const overflow = config.overflow || `and ${intents.length - config.maxDisplay} more`;
      return shown.join(separator) + separator + overflow;
    }

    return intents.join(separator);
  }
}

interface FieldInfo {
  label: string;
  format: string;
  params: Record<string, unknown>;
  type: string;
  calldataTarget: string | null;
}

// Default instance
let defaultDecoder: CalldataDecoder | null = null;

/**
 * Get or create the default calldata decoder instance
 */
export function getCalldataDecoder(metadataService?: MetadataService): CalldataDecoder {
  if (!defaultDecoder || metadataService) {
    defaultDecoder = new CalldataDecoder(metadataService);
  }
  return defaultDecoder;
}

/**
 * Decode calldata using the default decoder
 */
export async function decodeCalldata(
  data: string,
  contractAddress: string,
  chainId: number
): Promise<DecodedCall> {
  const decoder = getCalldataDecoder();
  return decoder.decode(data, contractAddress, chainId);
}
