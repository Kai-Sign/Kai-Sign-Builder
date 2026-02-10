/**
 * Core hardware viewer functions extracted from hardwareViewer.tsx
 * These are the exact same functions used in the React component
 */

interface DecodedTransaction {
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
    params: Array<{
      name: string;
      type: string;
      value: string;
      valueDecoded?: {
        name: string;
        signature?: string;
        type?: string;
        params: Array<{
          name: string;
          type: string;
          value: string;
        }>;
      };
    }>;
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
  addressesMeta?: Record<string, {
    contractAddress: string;
    contractName: string;
    tokenSymbol: string;
    decimals: number | null;
    type: string;
    address?: string;
    chainID?: number;
  }>;
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

// ERC-7730 COMPLIANT PATH RESOLVER - EXACT COPY FROM hardwareViewer.tsx
export function resolveValueAtPath(data: any, metadata: any, path: string): any {
  if (!data || !path) return undefined;
  
  if (path === "separator") return "";
  
  // Parse root node and path according to ERC-7730 spec
  const rootNode = path.charAt(0); // #, $, or @
  if (!["#", "$", "@"].includes(rootNode)) {
    // Fallback for non-ERC-7730 paths
    return undefined;
  }
  
  const pathWithoutRoot = path.substring(2); // Remove root + dot
  
  // Resolve based on root node type
  let current: any;
  switch (rootNode) {
    case '#': // Structured data (ABI)
      current = data;
      break;
    case '$': // Metadata constants
      current = metadata;
      break;
    case '@': // Container values (transaction metadata)
      current = data.container || data;
      break;
    default:
      throw new Error(`Unsupported root node: ${rootNode}`);
  }
  
  // Handle empty path after root
  if (!pathWithoutRoot) return current;
  
  // Split path into segments and process
  const pathParts = pathWithoutRoot.split('.');
  
  for (const part of pathParts) {
    if (!current) return undefined;
    
    // a) Handle array slicing: path[:20], path[-20:], path[1:5]
    const sliceMatch = part.match(/^(.+)\[(-?\d*):(-?\d*)\]$/);
    if (sliceMatch && sliceMatch.length >= 4) {
      const arrayName = sliceMatch[1];
      const startStr = sliceMatch[2];
      const endStr = sliceMatch[3];
      if (arrayName && current[arrayName]) {
        const array = current[arrayName];
        if (Array.isArray(array) || typeof array === 'string') {
          const start = !startStr || startStr === '' ? 0 : parseInt(startStr);
          const end = !endStr || endStr === '' ? array.length : parseInt(endStr);
          current = array.slice(start, end);
          continue;
        }
      }
    }
    
    // b) Handle array index access: params[0], params[1]
    const indexMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (indexMatch && indexMatch.length >= 3) {
      const arrayName = indexMatch[1];
      const indexStr = indexMatch[2];
      if (arrayName && indexStr) {
        const idx = parseInt(indexStr);
        
        // Special handling for params access - check if this is at transaction root
        if (arrayName === 'params') {
          // If at transaction root, access methodCall.params
          if (current.methodCall?.params && Array.isArray(current.methodCall.params)) {
            if (current.methodCall.params[idx]) {
              current = current.methodCall.params[idx].value !== undefined ? 
                       current.methodCall.params[idx].value : 
                       current.methodCall.params[idx];
              continue;
            }
          }
          // If current object already has params array directly
          else if (current.params && Array.isArray(current.params)) {
            if (current.params[idx]) {
              current = current.params[idx].value !== undefined ? 
                       current.params[idx].value : 
                       current.params[idx];
              continue;
            }
          }
        }
        
        // General array access
        if (current[arrayName] && Array.isArray(current[arrayName])) {
          current = current[arrayName][idx];
          continue;
        }
      }
    }
    
    // c) Handle full array access: details.[]
    if (part.endsWith('.[]')) {
      const arrayName = part.slice(0, -3);
      current = current[arrayName];
      continue;
    }
    
    // d) Position-based ABI parameter access (ERC-7730 requirement)
    if (part === 'params' && current.methodCall?.params) {
      current = current.methodCall.params;
      continue;
    }
    
    // d2) Named parameter access at transaction root (for paths like #.executor, #.desc)
    if (current.methodCall && current.methodCall.params && Array.isArray(current.methodCall.params)) {
      const param = current.methodCall.params.find((p: any) => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // e) Struct component access by name
    if (current.components) {
      const found = current.components.find((c: any) => c.name === part);
      if (found) {
        current = found.value !== undefined ? found.value : found;
        continue;
      }
    }
    
    // f) Nested function calls (valueDecoded)
    if (current.valueDecoded && part === 'valueDecoded') {
      current = current.valueDecoded;
      continue;
    }
    
    if (current.valueDecoded && current.valueDecoded.params && part !== 'valueDecoded') {
      const param = current.valueDecoded.params.find((p: any) => p.name === part);
      if (param) {
        current = param.value !== undefined ? param.value : param;
        continue;
      }
    }
    
    // g) Direct property access
    if (current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    // h) Access property in value object
    if (current.value && typeof current.value === 'object' && current.value[part] !== undefined) {
      current = current.value[part];
      continue;
    }
    
    // Path not found
    return undefined;
  }
  
  // Extract final value
  return current?.value !== undefined ? current.value : current;
}

// ERC-7730 COMPLIANT FIELD VALUE EXTRACTION - EXACT COPY FROM hardwareViewer.tsx
export function getFieldValueFromTransaction(path: string, format: string, transactionData: any, metadata: any = {}): string {
  if (!transactionData) {
    return `Mock ${format} value`;
  }

  try {
    // ERC-7730 compliant path resolution
    const value = resolveValueAtPath(transactionData, metadata, path);
    
    if (value === undefined) {
      return "[unmapped]";
    }

    // Format the value based on the format type
    switch (format) {
      case "tokenAmount":
        const rawValue = value.toString();
        return rawValue;
        
      case "addressName":
        const addressValue = value.toString();
        if (addressValue.startsWith('0x') && addressValue.length === 42) {
          if (transactionData.addressesMeta && transactionData.addressesMeta[addressValue]) {
            const meta = transactionData.addressesMeta[addressValue];
            return meta.contractName || meta.tokenSymbol || `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
          }
          return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
        }
        return addressValue;
        
      case "amount":
        if (value === "0" || value === 0) return "0";
        return value.toString();
        
      case "raw":
        const rawValueStr = value.toString();
        if (rawValueStr.startsWith('0x') && rawValueStr.length > 42) {
          return `${rawValueStr.slice(0, 10)}...${rawValueStr.slice(-7)}`;
        }
        return rawValueStr;
        
      default:
        return value.toString();
    }
  } catch (error) {
    console.error(`Error resolving path ${path}:`, error);
    return `[error: ${path}]`;
  }
}

export type { DecodedTransaction };