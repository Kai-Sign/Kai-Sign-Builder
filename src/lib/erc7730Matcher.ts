import { type Address } from 'viem';
import { DecompiledBytecode } from './bytecodeDecompiler';

export interface ERC7730Metadata {
  $schema?: string;
  context?: {
    name: string;
    description: string;
    deployments?: Array<{
      chainId: number;
      address: string;
    }>;
  };
  metadata?: {
    owner?: string;
    displayName?: string;
    legalName?: string;
    description?: string;
    url?: string;
  };
  display?: {
    formats?: Record<string, ERC7730Format>;
  };
  constants?: Record<string, any>;
  enums?: Record<string, any>;
}

export interface ERC7730Format {
  intent: string;
  required?: string[];
  fields: Record<string, ERC7730Field>;
}

export interface ERC7730Field {
  label: string;
  format: string;
  params?: Record<string, any>;
}

export interface MatchedMetadata {
  format?: ERC7730Format;
  fields?: Array<{
    name: string;
    label: string;
    format: string;
    value: any;
    formattedValue?: string;
  }>;
  intent?: string;
}

/**
 * Load ERC-7730 metadata for a contract
 */
export async function loadERC7730Metadata(
  contractAddress: Address,
  chainId: number
): Promise<ERC7730Metadata | null> {
  try {
    // First, try to load from local storage or IPFS based on contract address
    // For now, we'll use the KaiSign metadata as an example
    // Note: This would normally fetch from an API, but for now we'll return null
    // to avoid errors during testing
    // const response = await fetch(`/api/metadata?address=${contractAddress}&chainId=${chainId}`);
    // if (response.ok) {
    //   return await response.json();
    // }
    
    // If not found via API, check if it's a known contract
    if (contractAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      // Return KaiSign metadata as example
      const kaisignMetadata = await fetch('/contracts/kaisign-v1-erc7730.json');
      if (kaisignMetadata.ok) {
        return await kaisignMetadata.json();
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to load ERC-7730 metadata:', error);
    return null;
  }
}

/**
 * Match decompiled bytecode with ERC-7730 metadata
 */
export function matchWithERC7730(
  decompiled: DecompiledBytecode,
  metadata: ERC7730Metadata
): MatchedMetadata {
  if (!metadata.display?.formats || !decompiled.functionName) {
    return {};
  }
  
  // Find matching format based on function name
  const format = metadata.display.formats[decompiled.functionName];
  if (!format) {
    return {};
  }
  
  const matchedFields: MatchedMetadata['fields'] = [];
  
  // Match decompiled parameters with ERC-7730 field definitions
  if (decompiled.decodedParams && decompiled.inputs) {
    decompiled.inputs.forEach((input, index) => {
      const fieldDef = format.fields[input.name];
      if (fieldDef && index < decompiled.decodedParams!.length) {
        const value = decompiled.decodedParams![index];
        matchedFields.push({
          name: input.name,
          label: fieldDef.label,
          format: fieldDef.format,
          value,
          formattedValue: formatValue(value, fieldDef)
        });
      }
    });
  }
  
  return {
    format,
    fields: matchedFields,
    intent: format.intent
  };
}

/**
 * Format value according to ERC-7730 field definition
 */
function formatValue(value: any, field: ERC7730Field): string {
  switch (field.format) {
    case 'address':
      return value as string;
    
    case 'uint256':
      return value.toString();
    
    case 'wei':
      if (field.params?.unit === 'ether') {
        // Convert wei to ether
        const etherValue = Number(value) / 1e18;
        return `${etherValue} ETH`;
      }
      return `${value} wei`;
    
    case 'bytes32':
      return value as string;
    
    case 'string':
      return value as string;
    
    case 'bool':
      return value ? 'Yes' : 'No';
    
    default:
      return String(value);
  }
}

/**
 * Generate hardware wallet display from matched metadata
 */
export function generateHardwareDisplay(matched: MatchedMetadata): string[] {
  const screens: string[] = [];
  
  if (matched.intent) {
    screens.push(matched.intent);
  }
  
  if (matched.fields) {
    matched.fields.forEach(field => {
      screens.push(`${field.label}: ${field.formattedValue || field.value}`);
    });
  }
  
  return screens;
}

/**
 * Complete analysis: decompile bytecode and match with ERC-7730
 */
export async function analyzeWithERC7730(
  bytecode: string,
  contractAddress: Address,
  chainId: number,
  decompiled: DecompiledBytecode
): Promise<{
  decompiled: DecompiledBytecode;
  metadata: ERC7730Metadata | null;
  matched: MatchedMetadata;
  hardwareDisplay: string[];
}> {
  // Load ERC-7730 metadata
  const metadata = await loadERC7730Metadata(contractAddress, chainId);
  
  // Match with metadata
  const matched = metadata ? matchWithERC7730(decompiled, metadata) : {};
  
  // Generate hardware wallet display
  const hardwareDisplay = generateHardwareDisplay(matched);
  
  return {
    decompiled,
    metadata,
    matched,
    hardwareDisplay
  };
}