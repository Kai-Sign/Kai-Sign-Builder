/**
 * Level-Based Metadata Mapping System
 * 
 * Core Principle: Each metadata file covers exactly one nesting level
 * - Level 0: Main transaction (e.g., execTransaction)
 * - Level 1: First nested call (e.g., data.valueDecoded)  
 * - Level 2: Second nested call, etc.
 * 
 * No hardcoded transaction logic - purely metadata-driven mapping.
 */

export interface TransactionData {
  txHash?: string;
  methodCall?: {
    name: string;
    signature?: string;
    params: Array<{
      name: string;
      type: string;
      value: any;
      valueDecoded?: TransactionData['methodCall'];
      components?: any[];
    }>;
  };
  transfers?: any[];
  addressesMeta?: Record<string, any>;
  [key: string]: any;
}

export interface MetadataFile {
  id: string;
  level: number; // Which nesting level this metadata covers
  metadata: {
    display?: {
      formats?: Record<string, {
        intent?: string;
        fields: Array<{
          path: string;
          label: string;
          format: string;
          params?: any;
        }>;
      }>;
    };
    [key: string]: any;
  };
}

export interface FunctionCall {
  name: string;
  signature: string;
  level: number;
  path: string;
  params: any[];
  data: any;
}

export interface MappedOperation {
  level: number;
  functionCall: FunctionCall;
  metadata: MetadataFile['metadata'];
  operation: {
    intent?: string;
    fields: Array<{
      path: string;
      label: string;
      format: string;
      resolvedValue: any;
      displayValue: string;
    }>;
  };
}

/**
 * Extracts all function calls from transaction data at different nesting levels
 */
export function extractFunctionCalls(data: TransactionData, basePath = '', level = 0): FunctionCall[] {
  const calls: FunctionCall[] = [];
  
  // Check if current data represents a function call
  if (data?.methodCall?.name && data?.methodCall?.params) {
    const methodCall = data.methodCall;
    const paramTypes = methodCall.params?.map(p => p.type).join(',') || '';
    const signature = `${methodCall.name}(${paramTypes})`;
    
    calls.push({
      name: methodCall.name,
      signature,
      level,
      path: basePath,
      params: methodCall.params,
      data: methodCall
    });
  }
  
  // Recursively extract from nested structures
  if (data?.methodCall?.params) {
    data.methodCall.params.forEach((param, index) => {
      // Check for valueDecoded (nested function calls)
      if (param.valueDecoded) {
        const nestedData: TransactionData = {
          methodCall: param.valueDecoded
        };
        calls.push(...extractFunctionCalls(
          nestedData, 
          `${basePath}.params[${index}].valueDecoded`, 
          level + 1
        ));
      }
      
      // Check components for struct-based nested calls
      if (param.components) {
        param.components.forEach((component: any, compIndex: number) => {
          if (component.valueDecoded) {
            const nestedData: TransactionData = {
              methodCall: component.valueDecoded
            };
            calls.push(...extractFunctionCalls(
              nestedData,
              `${basePath}.params[${index}].components[${compIndex}].valueDecoded`,
              level + 1
            ));
          }
        });
      }
    });
  }
  
  return calls;
}

/**
 * Finds metadata that matches a function signature at a specific level
 */
export function findMetadataForFunction(
  signature: string, 
  level: number, 
  metadataFiles: MetadataFile[]
): MetadataFile | null {
  // Find metadata assigned to this specific level
  const levelMetadata = metadataFiles.filter(m => m.level === level);
  
  for (const metadata of levelMetadata) {
    const formats = metadata.metadata.display?.formats;
    if (!formats) continue;
    
    // Exact signature match
    if (formats[signature]) {
      return metadata;
    }
    
    // Function name match (for simple formats)
    const functionName = signature.split('(')[0];
    if (formats[functionName]) {
      return metadata;
    }
  }
  
  return null;
}

/**
 * Resolves a metadata path in the context of a specific function call
 */
export function resolvePathInContext(
  path: string, 
  functionCall: FunctionCall, 
  transactionData: TransactionData
): any {
  if (!path || !path.startsWith('#.')) {
    return undefined;
  }
  
  const pathParts = path.substring(2).split('.'); // Remove '#.'
  let current = functionCall.params;
  
  for (const part of pathParts) {
    if (!current) return undefined;
    
    // Handle array access: params[0], components[1]
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      
      if (Array.isArray(current) && arrayName === 'params') {
        current = current[index]?.value ?? current[index];
        continue;
      }
      
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        current = current[arrayName][index];
        continue;
      }
      
      return undefined;
    }
    
    // Handle parameter lookup by name
    if (Array.isArray(current)) {
      const param = current.find((p: any) => p?.name === part);
      if (param) {
        current = param.value ?? param;
        continue;
      }
      return undefined;
    }
    
    // Direct property access
    if (current && typeof current === 'object' && current[part] !== undefined) {
      current = current[part];
      continue;
    }
    
    return undefined;
  }
  
  return current;
}

/**
 * Maps transaction data to operations using level-based metadata
 */
export function mapTransactionToOperations(
  transactionData: TransactionData,
  metadataFiles: MetadataFile[]
): MappedOperation[] {
  const operations: MappedOperation[] = [];
  
  // Extract all function calls with their levels
  const functionCalls = extractFunctionCalls(transactionData);
  
  // Map each function call to its corresponding metadata
  for (const functionCall of functionCalls) {
    const metadata = findMetadataForFunction(
      functionCall.signature, 
      functionCall.level, 
      metadataFiles
    );
    
    if (!metadata) {
      console.log(`No metadata found for ${functionCall.signature} at level ${functionCall.level}`);
      continue;
    }
    
    const format = metadata.metadata.display?.formats?.[functionCall.signature] || 
                   metadata.metadata.display?.formats?.[functionCall.name];
    
    if (!format) {
      continue;
    }
    
    // Resolve all field values using level-aware path resolution
    const resolvedFields = format.fields.map(field => {
      const resolvedValue = resolvePathInContext(
        field.path, 
        functionCall, 
        transactionData
      );
      
      // Apply formatting
      let displayValue: string;
      switch (field.format) {
        case 'addressName':
          if (typeof resolvedValue === 'string' && resolvedValue.startsWith('0x')) {
            displayValue = `${resolvedValue.slice(0, 6)}...${resolvedValue.slice(-4)}`;
          } else {
            displayValue = String(resolvedValue ?? '[unmapped]');
          }
          break;
        case 'amount':
        case 'tokenAmount':
          displayValue = String(resolvedValue ?? '0');
          break;
        case 'raw':
          const rawStr = String(resolvedValue ?? '[unmapped]');
          if (rawStr.startsWith('0x') && rawStr.length > 42) {
            displayValue = `${rawStr.slice(0, 10)}...${rawStr.slice(-7)}`;
          } else {
            displayValue = rawStr;
          }
          break;
        default:
          displayValue = String(resolvedValue ?? '[unmapped]');
      }
      
      return {
        ...field,
        resolvedValue,
        displayValue
      };
    });
    
    operations.push({
      level: functionCall.level,
      functionCall,
      metadata: metadata.metadata,
      operation: {
        intent: format.intent,
        fields: resolvedFields
      }
    });
  }
  
  return operations;
}

/**
 * Processes batch transactions by iterating through each batch item
 */
export function processBatchTransaction(
  transactionData: TransactionData,
  metadataFiles: MetadataFile[]
): MappedOperation[] {
  const allOperations: MappedOperation[] = [];
  
  // Check if this is a batch transaction by looking for array parameters
  const batchParams = transactionData.methodCall?.params?.filter(param => 
    Array.isArray(param.value) && param.value.length > 0
  );
  
  if (!batchParams || batchParams.length === 0) {
    // Not a batch, process normally
    return mapTransactionToOperations(transactionData, metadataFiles);
  }
  
  // Find the largest array (likely the main batch)
  const mainBatchParam = batchParams.reduce((largest, current) => 
    current.value.length > largest.value.length ? current : largest
  );
  
  // Process each item in the batch
  for (let i = 0; i < mainBatchParam.value.length; i++) {
    // Create a synthetic transaction for this batch item
    const batchItemTransaction: TransactionData = {
      ...transactionData,
      methodCall: {
        ...transactionData.methodCall!,
        params: transactionData.methodCall!.params.map(param => {
          if (param === mainBatchParam) {
            return {
              ...param,
              value: param.value[i], // Single item from batch
              valueDecoded: Array.isArray(param.valueDecoded) ? param.valueDecoded[i] : param.valueDecoded
            };
          }
          return param;
        })
      }
    };
    
    const operations = mapTransactionToOperations(batchItemTransaction, metadataFiles);
    
    // Mark operations as part of batch
    const batchOperations = operations.map(op => ({
      ...op,
      batchIndex: i,
      batchTotal: mainBatchParam.value.length
    }));
    
    allOperations.push(...batchOperations);
  }
  
  return allOperations;
}

/**
 * Main entry point - processes any transaction (single or batch) with level-based metadata
 */
export function processTransaction(
  transactionData: TransactionData,
  metadataFiles: MetadataFile[]
): MappedOperation[] {
  // Auto-detect batch vs single transaction and process accordingly
  return processBatchTransaction(transactionData, metadataFiles);
}