/**
 * Smart Path Resolver for Hardware Viewer
 * Automatically detects nesting levels and translates only where metadata exists
 */

interface LoopDecoderTransaction {
  methodCall?: {
    name: string;
    params: LoopDecoderParam[];
  };
  [key: string]: any;
}

interface LoopDecoderParam {
  name: string;
  type: string;
  value: any;
  components?: LoopDecoderParam[];
  valueDecoded?: {
    name: string;
    params: LoopDecoderParam[];
  };
}

interface PathNode {
  path: string;
  level: number;
  type: string;
  value: any;
  isArray: boolean;
  isTuple: boolean;
  hasDecoded: boolean;
}

interface MetadataOperation {
  fields: Array<{
    path: string;
    label: string;
    format?: string;
  }>;
}

/**
 * Smart Path Resolver Class
 * Automatically detects transaction structure and resolves only metadata-defined paths
 */
export class SmartPathResolver {
  private pathMap: Map<string, PathNode> = new Map();
  private maxLevel: number = 0;

  /**
   * Analyze transaction structure and build complete path map
   */
  analyzeTransaction(transaction: LoopDecoderTransaction): void {
    this.pathMap.clear();
    this.maxLevel = 0;

    if (!transaction.methodCall?.params) {
      return;
    }

    this.buildPathMap(transaction.methodCall.params, '', 0);
  }

  /**
   * Recursively build path map for all available paths
   */
  private buildPathMap(params: LoopDecoderParam[], parentPath: string, level: number): void {
    this.maxLevel = Math.max(this.maxLevel, level);

    params.forEach((param) => {
      const currentPath = parentPath ? `${parentPath}.${param.name}` : param.name;
      const fullPath = `#.${currentPath}`;

      // Register this path
      this.pathMap.set(fullPath, {
        path: fullPath,
        level,
        type: param.type,
        value: param.value,
        isArray: param.type.includes('[]'),
        isTuple: !!param.components,
        hasDecoded: !!param.valueDecoded
      });

      // Recurse into tuple components
      if (param.components) {
        this.buildPathMap(param.components, currentPath, level + 1);
      }

      // Recurse into decoded nested calls
      if (param.valueDecoded?.params) {
        const decodedPath = `${currentPath}.valueDecoded`;
        this.buildPathMap(param.valueDecoded.params, decodedPath, level + 1);
      }
    });
  }

  /**
   * Get all available paths grouped by level
   */
  getPathsByLevel(): Record<number, PathNode[]> {
    const byLevel: Record<number, PathNode[]> = {};
    
    this.pathMap.forEach((node) => {
      if (!byLevel[node.level]) {
        byLevel[node.level] = [];
      }
      byLevel[node.level].push(node);
    });

    return byLevel;
  }

  /**
   * Get only paths that exist in metadata
   */
  getMetadataDefinedPaths(metadata: MetadataOperation): PathNode[] {
    const metadataPaths = metadata.fields.map(field => field.path);
    const availablePaths: PathNode[] = [];

    metadataPaths.forEach((metadataPath) => {
      const node = this.pathMap.get(metadataPath);
      if (node) {
        availablePaths.push(node);
      }
    });

    return availablePaths;
  }

  /**
   * Resolve value for a specific metadata path
   */
  resolveMetadataPath(transaction: LoopDecoderTransaction, metadataPath: string): any {
    const node = this.pathMap.get(metadataPath);
    if (!node) {
      return undefined; // Path not available in transaction
    }

    // Use the smart resolver to get the actual value
    return this.smartResolve(transaction, metadataPath);
  }

  /**
   * Smart path resolution - only resolves if path exists in transaction structure
   */
  private smartResolve(data: any, path: string): any {
    if (!data || !path || !path.startsWith('#.')) {
      return undefined;
    }

    // Check if path exists in our analyzed structure
    if (!this.pathMap.has(path)) {
      return undefined; // Path not available
    }

    const pathWithoutRoot = path.substring(2); // Remove '#.'
    const pathParts = pathWithoutRoot.split('.');

    let current = data.methodCall?.params;
    if (!current) return undefined;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (part === 'valueDecoded') {
        // Handle decoded nested calls
        if (current && current.valueDecoded) {
          current = current.valueDecoded.params;
          continue;
        }
        return undefined;
      }

      // Find parameter by name
      if (Array.isArray(current)) {
        const param = current.find((p: any) => p.name === part);
        if (!param) return undefined;

        // If this is the last part, return the value
        if (i === pathParts.length - 1) {
          return param.value;
        }

        // Navigate deeper
        if (param.components) {
          current = param.components;
        } else if (param.valueDecoded) {
          current = param.valueDecoded;
        } else {
          current = param;
        }
      } else {
        // Direct property access
        if (current[part] !== undefined) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }

    return current?.value !== undefined ? current.value : current;
  }

  /**
   * Get transaction structure summary
   */
  getStructureSummary(): {
    totalPaths: number;
    maxLevel: number;
    levelDistribution: Record<number, number>;
    arrayPaths: string[];
    tuplePaths: string[];
    decodedPaths: string[];
  } {
    const summary = {
      totalPaths: this.pathMap.size,
      maxLevel: this.maxLevel,
      levelDistribution: {} as Record<number, number>,
      arrayPaths: [] as string[],
      tuplePaths: [] as string[],
      decodedPaths: [] as string[]
    };

    this.pathMap.forEach((node) => {
      // Count by level
      summary.levelDistribution[node.level] = (summary.levelDistribution[node.level] || 0) + 1;

      // Categorize special types
      if (node.isArray) {
        summary.arrayPaths.push(node.path);
      }
      if (node.isTuple) {
        summary.tuplePaths.push(node.path);
      }
      if (node.hasDecoded) {
        summary.decodedPaths.push(node.path);
      }
    });

    return summary;
  }

  /**
   * Validate metadata paths against transaction structure
   */
  validateMetadataPaths(metadata: MetadataOperation): {
    validPaths: string[];
    invalidPaths: string[];
    suggestions: Record<string, string[]>;
  } {
    const result = {
      validPaths: [] as string[],
      invalidPaths: [] as string[],
      suggestions: {} as Record<string, string[]>
    };

    metadata.fields.forEach((field) => {
      const path = field.path;
      
      if (this.pathMap.has(path)) {
        result.validPaths.push(path);
      } else {
        result.invalidPaths.push(path);
        
        // Find similar paths as suggestions
        const suggestions: string[] = [];
        this.pathMap.forEach((node, nodePath) => {
          if (nodePath.includes(path.split('.').pop() || '')) {
            suggestions.push(nodePath);
          }
        });
        
        if (suggestions.length > 0) {
          result.suggestions[path] = suggestions.slice(0, 3); // Top 3 suggestions
        }
      }
    });

    return result;
  }
}

/**
 * Enhanced field value extraction using smart path resolver
 */
export function getFieldValueFromTransactionSmart(
  path: string,
  format: string,
  transactionData: LoopDecoderTransaction,
  metadata: any = {},
  resolver?: SmartPathResolver
): string {
  if (!transactionData) {
    return `Mock ${format} value`;
  }

  try {
    // Use resolver if provided, otherwise create new one
    if (!resolver) {
      resolver = new SmartPathResolver();
      resolver.analyzeTransaction(transactionData);
    }

    // Resolve value using smart resolver
    const value = resolver.resolveMetadataPath(transactionData, path);
    
    if (value === undefined) {
      return "[unmapped]";
    }

    // Format the value based on the format type
    switch (format) {
      case "tokenAmount":
        return value.toString();
        
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

/**
 * Generate screens for operation using smart path resolver
 */
export function getScreensForOperationSmart(
  operation: MetadataOperation,
  transactionData: LoopDecoderTransaction | null = null,
  metadata: any = {}
): Array<Array<{label: string; isActive?: boolean; displayValue: string}>> {
  const ITEM_PER_SCREEN = 4;
  const screens: Array<Array<{label: string; isActive?: boolean; displayValue: string}>> = [];
  let screen: Array<{label: string; isActive?: boolean; displayValue: string}> = [];

  // Initialize smart resolver if we have transaction data
  let resolver: SmartPathResolver | undefined;
  if (transactionData) {
    resolver = new SmartPathResolver();
    resolver.analyzeTransaction(transactionData);
    
    // Log structure summary for debugging
    const summary = resolver.getStructureSummary();
    console.log('📊 Transaction Structure:', summary);
    
    // Validate metadata paths
    const validation = resolver.validateMetadataPaths(operation);
    console.log('✅ Valid paths:', validation.validPaths);
    if (validation.invalidPaths.length > 0) {
      console.log('❌ Invalid paths:', validation.invalidPaths);
      console.log('💡 Suggestions:', validation.suggestions);
    }
  }

  const displays = operation.fields.filter((field) => {
    return field.label && field.label.trim() !== "";
  });

  for (let i = 0; i < displays.length; i++) {
    const isLastItem = i === displays.length - 1;
    const displayItem = displays[i];
    const label = displayItem.label;

    if (!label || label.trim() === "") continue;

    const format = displayItem.format || "raw";
    const path = displayItem.path || "";

    const displayValue = transactionData && resolver
      ? getFieldValueFromTransactionSmart(path, format, transactionData, metadata, resolver)
      : `Mock ${format} value`;
    
    // Log path resolution for debugging
    if (transactionData && resolver) {
      const pathExists = resolver.pathMap.has(path);
      console.log(`🔍 Path: ${path} → ${displayValue} [${pathExists ? 'EXISTS' : 'MISSING'}]`);
    }

    screen.push({
      label,
      isActive: true,
      displayValue
    });

    if (screen.length === ITEM_PER_SCREEN || isLastItem) {
      screens.push(screen);
      screen = [];
    }
  }

  return screens;
}