import { decodeFunctionData, getAbiItem, type Abi, type Address, type Hex } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { ALCHEMY_RPC_URL, ETHERSCAN_API_KEY } from './config';

export interface ParameterValue {
  name: string;
  type: string;
  value: string | number;
  valueDecoded?: any;
}

export interface DecompiledBytecode {
  selector: string;
  signature?: string;
  functionName?: string;
  inputs?: any[];
  decodedParams?: any[];
  params?: ParameterValue[];
  error?: string;
}

export interface BytecodeAnalysis {
  bytecode: string;
  decompiled: DecompiledBytecode;
  erc7730Match?: any;
}

// Common function selectors and their signatures
const KNOWN_SELECTORS: Record<string, { signature: string; abi: any }> = {
  // ERC20
  'a9059cbb': {
    signature: 'transfer(address,uint256)',
    abi: {
      name: 'transfer',
      type: 'function',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable'
    }
  },
  '095ea7b3': {
    signature: 'approve(address,uint256)',
    abi: {
      name: 'approve',
      type: 'function',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable'
    }
  },
  '23b872dd': {
    signature: 'transferFrom(address,address,uint256)',
    abi: {
      name: 'transferFrom',
      type: 'function',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable'
    }
  },
  // BatchExecutor
  '34fcd5be': {
    signature: 'executeBatch((address,uint256,bytes)[])',
    abi: {
      name: 'executeBatch',
      type: 'function',
      inputs: [{
        name: 'operations',
        type: 'tuple[]',
        components: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      }],
      outputs: [],
      stateMutability: 'payable'
    }
  },
  // DeleGator
  '1cff79cd': {
    signature: 'execute(bytes32,bytes)',
    abi: {
      name: 'execute',
      type: 'function',
      inputs: [
        { name: '_mode', type: 'bytes32' },
        { name: '_executionCalldata', type: 'bytes' }
      ],
      outputs: [{ name: '', type: 'bytes' }],
      stateMutability: 'payable'
    }
  },
  // Safe (Gnosis Safe) execTransaction
  '6a761202': {
    signature: 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
    abi: {
      name: 'execTransaction',
      type: 'function',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'signatures', type: 'bytes' }
      ],
      outputs: [{ name: 'success', type: 'bool' }],
      stateMutability: 'payable'
    }
  }
};

/**
 * Extract function selector from bytecode/calldata
 */
export function extractSelector(bytecode: string): string {
  const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  return cleanBytecode.slice(0, 8);
}

/**
 * Create structured parameters with nested decoding
 */
function createStructuredParams(inputs: any[], args: any[], fullBytecode?: string): ParameterValue[] {
  return inputs.map((input, index) => {
    const arg = args[index];
    let value: string | number;
    let valueDecoded: any = undefined;
    
    if (typeof arg === 'bigint') {
      value = arg.toString();
    } else if (input.type === 'bytes' && typeof arg === 'string' && arg.startsWith('0x')) {
      value = arg;
      // Try to decode nested function call in bytes data
      if (arg.length >= 10) {
        const selector = arg.slice(0, 10);
        const knownFunction = KNOWN_SELECTORS[selector.slice(2)]; // Remove 0x
        if (knownFunction) {
          try {
            const abi = [knownFunction.abi] as Abi;
            const decoded = decodeFunctionData({
              abi,
              data: arg as Hex
            });
            
            valueDecoded = {
              name: knownFunction.abi.name,
              signature: knownFunction.signature,
              type: 'function',
              params: createStructuredParams(
                knownFunction.abi.inputs,
                decoded.args as any[]
              )
            };
          } catch (error) {
            console.warn('Failed to decode nested call:', error);
          }
        }
      }
    } else if (typeof arg === 'number') {
      value = arg;
    } else if (Array.isArray(arg) && input.type.includes('tuple[]')) {
      // Handle tuple arrays (like batch operations)
      value = `Array of ${arg.length} operations`;
      // Create nested structure for batch operations
      if (arg.length > 0 && typeof arg[0] === 'object') {
        valueDecoded = {
          type: 'batchOperations',
          operations: arg.map((op: any, opIndex: number) => {
            const operation: any = {
              index: opIndex,
              to: op.to || op[0],
              value: (typeof op.value === 'bigint' ? op.value.toString() : op.value) || op[1]?.toString() || '0',
              data: op.data || op[2]
            };
            
            // Try to decode the operation data if it exists
            if (operation.data && operation.data.length >= 10) {
              const selector = operation.data.slice(0, 10);
              const knownFunction = KNOWN_SELECTORS[selector.slice(2)]; // Remove 0x
              if (knownFunction) {
                try {
                  const abi = [knownFunction.abi] as Abi;
                  const decoded = decodeFunctionData({
                    abi,
                    data: operation.data as Hex
                  });
                  
                  operation.decodedCall = {
                    name: knownFunction.abi.name,
                    signature: knownFunction.signature,
                    params: createStructuredParams(
                      knownFunction.abi.inputs,
                      decoded.args as any[]
                    )
                  };
                } catch (error) {
                  console.warn('Failed to decode operation call:', error);
                }
              }
            }
            
            return operation;
          })
        };
      }
    } else if (typeof arg === 'object' && arg !== null) {
      try {
        value = JSON.stringify(arg, (key, val) => 
          typeof val === 'bigint' ? val.toString() : val
        );
      } catch (error) {
        value = arg.toString();
      }
    } else {
      value = arg?.toString() || arg;
    }
    
    return {
      name: input.name || 'param' + index,
      type: input.type,
      value,
      valueDecoded
    };
  });
}

/**
 * Decode DeleGator execute function
 */
function decodeDeleGatorExecute(bytecode: string): DecompiledBytecode {
  try {
    const data = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    
    // Skip function selector (8 chars)
    // Next 64 chars is the mode (bytes32)
    const mode = '0x' + data.slice(8, 72);
    
    // Next 64 chars is the offset to bytes data
    const bytesOffset = parseInt(data.slice(72, 136), 16) * 2;
    
    // At the offset (relative to start of params, not including selector), we have the length of the bytes
    const bytesLengthStart = 8 + bytesOffset; // 8 for selector
    const bytesLength = parseInt(data.slice(bytesLengthStart, bytesLengthStart + 64), 16) * 2;
    
    // The actual bytes data
    const executionCalldata = '0x' + data.slice(bytesLengthStart + 64, bytesLengthStart + 64 + bytesLength);
    
    return {
      selector: '1cff79cd',
      signature: 'execute(bytes32,bytes)',
      functionName: 'execute',
      inputs: [
        { name: '_mode', type: 'bytes32' },
        { name: '_executionCalldata', type: 'bytes' }
      ],
      decodedParams: [mode, executionCalldata]
    };
  } catch (error) {
    console.error('Error decoding DeleGator:', error);
    return {
      selector: '1cff79cd',
      error: 'Failed to decode DeleGator execute function: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Decompile bytecode to identify function calls and parameters
 */
export async function decompileBytecode(
  bytecode: string,
  contractAddress?: Address,
  chainId: number = 1
): Promise<DecompiledBytecode> {
  try {
    const selector = extractSelector(bytecode);
    const knownFunction = KNOWN_SELECTORS[selector];
    
    // Special handling for DeleGator execute function
    if (selector === '1cff79cd') {
      return decodeDeleGatorExecute(bytecode);
    }
    
    if (knownFunction) {
      try {
        // Use known ABI to decode
        const abi = [knownFunction.abi] as Abi;
        const decoded = decodeFunctionData({
          abi,
          data: bytecode as Hex
        });
        
        const params = createStructuredParams(
          knownFunction.abi.inputs,
          decoded.args as any[],
          bytecode
        );
        
        return {
          selector,
          signature: knownFunction.signature,
          functionName: decoded.functionName,
          inputs: knownFunction.abi.inputs,
          decodedParams: (decoded.args as any[]).map(arg => 
            typeof arg === 'bigint' ? arg.toString() : arg
          ),
          params
        };
      } catch (error) {
        console.error('Failed to decode with known ABI:', error);
        // Fall through to try other methods
      }
    }
    
    // If we have a contract address, try to fetch ABI from Etherscan
    if (contractAddress && ETHERSCAN_API_KEY) {
      try {
        const abi = await fetchContractABI(contractAddress, chainId);
        if (abi) {
          const decoded = decodeFunctionData({
            abi,
            data: bytecode as Hex
          });
          
          const abiItem = getAbiItem({
            abi,
            name: decoded.functionName
          });
          
          const inputs = abiItem && 'inputs' in abiItem ? abiItem.inputs : [];
          const params = createStructuredParams(
            inputs,
            decoded.args as any[],
            bytecode
          );
          
          return {
            selector,
            functionName: decoded.functionName,
            inputs,
            decodedParams: (decoded.args as any[]).map(arg => 
              typeof arg === 'bigint' ? arg.toString() : arg
            ),
            params
          };
        }
      } catch (error) {
        console.error('Failed to fetch ABI from Etherscan:', error);
      }
    }
    
    // Unknown function
    return {
      selector,
      error: 'Unknown function selector'
    };
  } catch (error) {
    return {
      selector: 'unknown',
      error: error instanceof Error ? error.message : 'Failed to decompile bytecode'
    };
  }
}

/**
 * Fetch contract ABI from Etherscan
 */
async function fetchContractABI(address: Address, chainId: number): Promise<Abi | null> {
  try {
    const baseUrl = chainId === 1 
      ? 'https://api.etherscan.io/api'
      : chainId === 11155111 
        ? 'https://api-sepolia.etherscan.io/api'
        : null;
    
    if (!baseUrl) return null;
    
    const response = await fetch(
      `${baseUrl}?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    );
    
    const data = await response.json();
    if (data.status === '1' && data.result) {
      return JSON.parse(data.result) as Abi;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching ABI:', error);
    return null;
  }
}

/**
 * Decode DeleGator batch operations
 */
async function decodeDeleGatorBatchOperations(calldata: string, chainId: number): Promise<any[]> {
  try {
    // Remove 0x if present
    const data = calldata.startsWith('0x') ? calldata.slice(2) : calldata;
    
    // The calldata should contain batch operation data
    // First 64 chars (32 bytes) is the array length
    const arrayLength = parseInt(data.slice(0, 64), 16);
    
    const operations = [];
    let offset = 64; // Start after array length
    
    for (let i = 0; i < arrayLength; i++) {
      // Each operation contains: target (20 bytes), value (32 bytes), data offset, data length, data
      const target = '0x' + data.slice(offset + 24, offset + 64); // Skip 12 zero bytes, take 20 bytes
      offset += 64;
      
      const value = '0x' + data.slice(offset, offset + 64);
      offset += 64;
      
      const dataOffset = parseInt(data.slice(offset, offset + 64), 16) * 2;
      offset += 64;
      
      // Get data length and data
      const dataLengthStart = dataOffset;
      const dataLength = parseInt(data.slice(dataLengthStart, dataLengthStart + 64), 16) * 2;
      const operationData = '0x' + data.slice(dataLengthStart + 64, dataLengthStart + 64 + dataLength);
      
      // Try to decode the operation data
      const nestedDecoded = await decompileBytecode(operationData, undefined, chainId);
      
      operations.push({
        target,
        value,
        data: operationData,
        decoded: nestedDecoded
      });
    }
    
    return operations;
  } catch (error) {
    console.error('Error decoding DeleGator batch operations:', error);
    return [];
  }
}

/**
 * Decode nested batch operations
 */
export async function decodeBatchOperations(
  operations: any[],
  chainId: number = 1
): Promise<DecompiledBytecode[]> {
  const decompiled: DecompiledBytecode[] = [];
  
  for (const op of operations) {
    if (op.data && op.data !== '0x') {
      const result = await decompileBytecode(op.data, op.to, chainId);
      decompiled.push(result);
    }
  }
  
  return decompiled;
}

/**
 * Analyze transaction bytecode and return detailed breakdown
 */
// Helper function to recursively convert BigInts to strings
function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(convertBigIntsToStrings);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntsToStrings(obj[key]);
    }
    return result;
  }
  return obj;
}

export async function analyzeBytecode(
  bytecode: string,
  contractAddress?: Address,
  chainId: number = 1
): Promise<BytecodeAnalysis> {
  const decompiled = await decompileBytecode(bytecode, contractAddress, chainId);
  
  // Handle batch operations
  if (decompiled.functionName === 'executeBatch' && decompiled.decodedParams) {
    const operations = decompiled.decodedParams[0] as any[];
    const nestedDecompiled = await decodeBatchOperations(operations, chainId);
    
    // Add nested operations to the result
    (decompiled as any).nestedOperations = nestedDecompiled;
  }
  
  // Handle DeleGator execute with batch mode
  if (decompiled.functionName === 'execute' && decompiled.decodedParams) {
    const mode = decompiled.decodedParams[0];
    const executionCalldata = decompiled.decodedParams[1];
    
    // Mode 0x04 indicates batch transactions
    if (mode === '0x0000000000000000000000000000000000000000000000000000000000000004' && 
        typeof executionCalldata === 'string') {
      // The execution calldata contains batch transactions
      // Try to decode it as batch operations
      try {
        const batchOps = await decodeDeleGatorBatchOperations(executionCalldata, chainId);
        if (batchOps.length > 0) {
          (decompiled as any).nestedOperations = batchOps;
        }
      } catch (error) {
        console.error('Failed to decode DeleGator batch operations:', error);
      }
    }
  }
  
  // Convert all BigInts to strings to prevent serialization issues
  return convertBigIntsToStrings({
    bytecode,
    decompiled
  });
}