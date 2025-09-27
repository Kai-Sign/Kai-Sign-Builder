"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Eye, Upload, AlertCircle, Plus, Trash2, FileJson } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { cn } from "~/lib/utils";
import { Device } from "~/components/devices/device";
import { getScreensForOperation } from "~/shared/getScreensForOperation";
import operationScreens from "../review/operationScreens";
import { type Erc7730, type Operation } from "~/store/types";

interface DecodedTransaction {
  txHash?: string;
  methodCall?: {
    name: string;
    params: Array<{
      name: string;
      type: string;
      value: string;
      valueDecoded?: {
        name: string;
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
  }>;
}

interface MetadataEntry {
  id: string;
  name: string;
  metadata: Erc7730;
}

interface HardwareViewerProps {
  initialTransactionData?: DecodedTransaction;
}

const HardwareViewer = ({ initialTransactionData }: HardwareViewerProps = {}) => {
  const [activeTab, setActiveTab] = useState("simple");
  const [jsonInput, setJsonInput] = useState("");
  const [selectedOperation, setSelectedOperation] = useState("");
  const [parsedData, setParsedData] = useState<Erc7730 | null>(null);
  const [error, setError] = useState("");
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  // Multi-metadata support
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);
  const [transactionData, setTransactionData] = useState<DecodedTransaction | null>(null);
  const [selectedMetadataId, setSelectedMetadataId] = useState("");

  // Sample ERC7730 data for demonstration
  const sampleData = {
    "$schema": "https://schemas.ledger.com/erc7730/1.0.0",
    "context": {
      "contract": {
        "address": "0x1234567890123456789012345678901234567890",
        "chainId": 1
      }
    },
    "metadata": {
      "owner": "Sample DApp",
      "info": {
        "url": "https://example.com",
        "legalName": "Sample Company"
      }
    },
    "display": {
      "formats": {
        "transfer": {
          "intent": "Transfer tokens",
          "fields": [
            {
              "path": "to",
              "label": "To",
              "format": "addressName",
              "params": {}
            },
            {
              "path": "value",
              "label": "Amount",
              "format": "tokenAmount",
              "params": {
                "tokenPath": "$.contract"
              }
            }
          ]
        },
        "approve": {
          "intent": "Approve spending",
          "fields": [
            {
              "path": "spender",
              "label": "Spender",
              "format": "addressName",
              "params": {}
            },
            {
              "path": "amount",
              "label": "Amount",
              "format": "tokenAmount",
              "params": {
                "tokenPath": "$.contract"
              }
            }
          ]
        }
      }
    }
  };

  // Sample Safe metadata (using exact ERC7730 v1 format)
  const sampleSafeMetadata = {
    "$schema": "https://eips.ethereum.org/assets/eip-7730/erc7730-v1.schema.json",
    "context": {
      "id": null,
      "contract": {
        "deployments": [
          {
            "chainId": 1,
            "address": "0x6092722B33FcF90af6e99C93F5F9349473869e23"
          }
        ],
        "abi": [
          {
            "type": "function",
            "name": "execTransaction",
            "inputs": [
              {
                "name": "to",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "value",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "operation",
                "type": "uint8",
                "internalType": "enum Enum.Operation"
              },
              {
                "name": "safeTxGas",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "baseGas",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "gasPrice",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "gasToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "refundReceiver",
                "type": "address",
                "internalType": "address payable"
              },
              {
                "name": "signatures",
                "type": "bytes",
                "internalType": "bytes"
              }
            ],
            "outputs": [
              {
                "name": "",
                "type": "bool",
                "internalType": "bool"
              }
            ],
            "stateMutability": "payable"
          }
        ]
      }
    },
    "metadata": {
      "owner": "SAFE",
      "info": {
        "legalName": "SAFE",
        "url": "https://safe.global"
      }
    },
    "display": {
      "formats": {
        "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)": {
          "id": null,
          "intent": "execute transaction",
          "screens": null,
          "fields": [
            {
              "id": null,
              "label": "To",
              "format": "addressName",
              "params": {
                "types": ["eoa", "wallet"],
                "sources": null
              },
              "path": "#.to",
              "value": null
            },
            {
              "id": null,
              "label": "Value",
              "format": "amount",
              "params": null,
              "path": "#.value",
              "value": null
            },
            {
              "id": null,
              "label": "Data",
              "format": "raw",
              "params": null,
              "path": "#.data",
              "value": null
            },
            {
              "id": null,
              "label": "Operation",
              "format": "raw",
              "params": null,
              "path": "#.operation",
              "value": null
            },
            {
              "id": null,
              "label": "Safe Tx Gas",
              "format": "raw",
              "params": null,
              "path": "#.safeTxGas",
              "value": null
            },
            {
              "id": null,
              "label": "Base Gas",
              "format": "raw",
              "params": null,
              "path": "#.baseGas",
              "value": null
            },
            {
              "id": null,
              "label": "Gas Price",
              "format": "amount",
              "params": null,
              "path": "#.gasPrice",
              "value": null
            },
            {
              "id": null,
              "label": "Gas Token",
              "format": "addressName",
              "params": {
                "types": ["token"],
                "sources": null
              },
              "path": "#.gasToken",
              "value": null
            },
            {
              "id": null,
              "label": "Refund Receiver",
              "format": "addressName",
              "params": {
                "types": ["eoa", "wallet"],
                "sources": null
              },
              "path": "#.refundReceiver",
              "value": null
            },
            {
              "id": null,
              "label": "Signatures",
              "format": "raw",
              "params": null,
              "path": "#.signatures",
              "value": null
            }
          ],
          "required": [
            "#.to",
            "#.value",
            "#.data",
            "#.operation",
            "#.safeTxGas",
            "#.baseGas",
            "#.gasPrice",
            "#.gasToken",
            "#.refundReceiver",
            "#.signatures"
          ],
          "excluded": null
        }
      }
    }
  };

  const sampleTokenMetadata = {
    "$schema": "https://schemas.ledger.com/erc7730/1.0.0",
    "context": {
      "contract": {
        "address": "dynamic",
        "chainId": 1
      }
    },
    "metadata": {
      "owner": "Token Contract",
      "info": {
        "url": "https://example.com",
        "legalName": "Generic ERC20 Token"
      }
    },
    "display": {
      "formats": {
        "transfer": {
          "intent": "Transfer Tokens",
          "fields": [
            {
              "path": "to",
              "label": "Recipient",
              "format": "addressName",
              "params": {}
            },
            {
              "path": "value",
              "label": "Amount",
              "format": "tokenAmount",
              "params": {
                "tokenPath": "$.contract"
              }
            }
          ]
        }
      }
    }
  };

  // Function to get function selector from transaction data
  const getTransactionFunctionSelector = (transactionData: DecodedTransaction | null): string | null => {
    if (!transactionData?.methodCall?.name || !transactionData?.methodCall?.params) {
      return null;
    }
    
    const functionName = transactionData.methodCall.name;
    const params = transactionData.methodCall.params;
    
    // Build function signature
    const paramTypes = params.map(param => param.type).join(',');
    const functionSignature = `${functionName}(${paramTypes})`;
    
    return functionSignature;
  };

  // Function to check if operation matches transaction
  const operationMatchesTransaction = (operationKey: string, transactionData: DecodedTransaction | null): boolean => {
    if (!transactionData) return true; // Show all operations if no transaction data
    
    const txSelector = getTransactionFunctionSelector(transactionData);
    if (!txSelector) return true; // Show all if we can't determine selector
    
    // Direct match
    if (operationKey === txSelector) return true;
    
    // Check if operation key contains the function name from transaction
    const txFunctionName = transactionData.methodCall?.name;
    if (txFunctionName && operationKey.includes(txFunctionName)) return true;
    
    return false;
  };

  // Sample decoded transaction data
  const sampleTransactionData = {
    txHash: "0x22a244794f155ce4a5765588353cf82dfc842c33ee3ed98e95ef488f6964f4fb",
    methodCall: {
      name: "execTransaction",
      params: [
        {
          name: "to",
          type: "address",
          value: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        },
        {
          name: "value",
          type: "uint256",
          value: "0"
        },
        {
          name: "data",
          type: "bytes",
          value: "0xa9059cbb000000000000000000000000a1371748d65baef4509a3c067b3fe3a1b79183ae000000000000000000000000000000000000000000000000000000001f143c37",
          valueDecoded: {
            name: "transfer",
            params: [
              {
                name: "to",
                type: "address",
                value: "0xA1371748D65baEF4509A3c067b3fe3a1b79183aE"
              },
              {
                name: "value",
                type: "uint256",
                value: "521419831"
              }
            ]
          }
        },
        {
          name: "operation",
          type: "uint8",
          value: "0"
        },
        {
          name: "safeTxGas",
          type: "uint256",
          value: "0"
        },
        {
          name: "baseGas",
          type: "uint256",
          value: "0"
        },
        {
          name: "gasPrice",
          type: "uint256",
          value: "0"
        },
        {
          name: "gasToken",
          type: "address",
          value: "0x0000000000000000000000000000000000000000"
        },
        {
          name: "refundReceiver",
          type: "address",
          value: "0x0000000000000000000000000000000000000000"
        },
        {
          name: "signatures",
          type: "bytes",
          value: "0x000000000000000000000000049bdd0528e2d5f2e579e1bdd133daed7c935dfc000000000000000000000000000000000000000000000000000000000000000001be6195185c0afdda36c5ccc9951d628873f0c2546d68edd266c4a6142ef05ed30be88a934eac08bb8d86705cb7a339d61c2342fdd7607806c488e0055a0232e51c"
        }
      ]
    },
    transfers: [],
    addressesMeta: {}
  };

  useEffect(() => {
    if (!api) {
      return;
    }

    setSelected(api.selectedScrollSnap());

    api.on("select", () => {
      setSelected(api.selectedScrollSnap());
    });
  }, [api]);


  // Helper function to normalize transaction data for hardware viewer
  const normalizeTransactionData = (data: any): DecodedTransaction => {
    // If data is already in the correct format, return as-is
    if (data.methodCall && Array.isArray(data.methodCall.params)) {
      return data;
    }

    // Handle 1inch transaction format or other formats that need normalization
    return {
      txHash: data.txHash,
      methodCall: data.methodCall ? {
        name: data.methodCall.name,
        params: data.methodCall.params || []
      } : undefined,
      transfers: data.transfers || [],
      addressesMeta: data.addressesMeta || {}
    };
  };

  // Load initial transaction data if provided
  useEffect(() => {
    if (initialTransactionData) {
      setTransactionData(normalizeTransactionData(initialTransactionData));
    }
  }, [initialTransactionData]);

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    setError("");
    
    if (!value.trim()) {
      setParsedData(null);
      setSelectedOperation("");
      return;
    }

    try {
      const parsed = JSON.parse(value) as Erc7730;
      setParsedData(parsed);
      
      // Auto-select first operation if available
      if (parsed.display?.formats) {
        const firstOperation = Object.keys(parsed.display.formats)[0];
        if (firstOperation) {
          setSelectedOperation(firstOperation);
        }
      }
    } catch (err) {
      setError("Invalid JSON format");
      setParsedData(null);
      setSelectedOperation("");
    }
  };

  const loadSampleData = () => {
    const sampleJson = JSON.stringify(sampleData, null, 2);
    setJsonInput(sampleJson);
    handleJsonChange(sampleJson);
  };

  const loadSampleSet = async (metadataFile: string | string[], txData: any) => {
    console.log('DEBUG: loadSampleSet called with:', metadataFile, txData);
    try {
      setMetadataEntries([]);
      setTransactionData(null);
      setSelectedMetadataId("");
      setSelectedOperation("");
      
      const metadataFiles = Array.isArray(metadataFile) ? metadataFile : [metadataFile];
      const entries = [];
      
      for (const file of metadataFiles) {
        // Load the metadata file
        const response = await fetch(`/erc7730/${file}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${file}`);
        }
        
        const metadata = await response.json();
        const entry = {
          id: `metadata-${Date.now()}-${entries.length}`,
          name: metadata.metadata?.owner || "Metadata",
          metadata: metadata as unknown as Erc7730
        };
        entries.push(entry);
      }
      
      setMetadataEntries(entries);
      setTransactionData(normalizeTransactionData(txData));
      setActiveTab("advanced");
      
      // Auto-select metadata and matching operation
      setSelectedMetadataId(entries[0].id);
      
      // Find matching operation based on transaction method
      if (txData.methodCall?.signature || txData.methodCall?.name) {
        const formats = entries[0].metadata.display?.formats || {};
        const definitions = entries[0].metadata.definitions || [];
        
        console.log('DEBUG: Available format operations:', Object.keys(formats));
        console.log('DEBUG: Available definitions:', definitions.map((d: any) => d.id));
        console.log('DEBUG: Looking for signature:', txData.methodCall.signature);
        console.log('DEBUG: Method name:', txData.methodCall.name);
        
        // Try to match by signature first (1inch style)
        let matchingOp = Object.keys(formats).find(op => 
          op === txData.methodCall.signature || op.startsWith(txData.methodCall.name + '(')
        );
        
        // If no match, try definitions by method name (Aave style)
        if (!matchingOp) {
          const matchingDef = definitions.find((def: any) => 
            def.id === txData.methodCall.name && def.isFunction
          );
          if (matchingDef) {
            matchingOp = matchingDef.id;
          }
        }
        
        console.log('DEBUG: Found matching operation:', matchingOp);
        
        if (matchingOp) {
          setSelectedOperation(matchingOp);
        } else {
          console.log('DEBUG: No matching operation found');
        }
      }
      
    } catch (error) {
      console.error('Failed to load sample set:', error);
      setError(`Failed to load metadata: ${metadataFile}`);
    }
  };

  const addMetadataEntry = () => {
    const newId = `metadata-${Date.now()}`;
    setMetadataEntries([...metadataEntries, {
      id: newId,
      name: `Metadata ${metadataEntries.length + 1}`,
      metadata: sampleData as unknown as Erc7730
    }]);
  };

  const removeMetadataEntry = (id: string) => {
    setMetadataEntries(metadataEntries.filter(entry => entry.id !== id));
    if (selectedMetadataId === id) {
      setSelectedMetadataId("");
      setSelectedOperation("");
    }
  };

  const updateMetadataEntry = (id: string, metadata: Erc7730) => {
    setMetadataEntries(metadataEntries.map(entry => 
      entry.id === id ? { ...entry, metadata } : entry
    ));
  };

  const updateMetadataName = (id: string, name: string) => {
    setMetadataEntries(metadataEntries.map(entry => 
      entry.id === id ? { ...entry, name } : entry
    ));
  };

  // Auto-select matching operation when transaction data changes - PRIORITIZE SAFE OPERATIONS
  useEffect(() => {
    if (transactionData && selectedMetadataId) {
      const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
      if (selectedMetadata?.metadata.display?.formats) {
        const detectedSelector = getTransactionFunctionSelector(transactionData);
        
        // ALWAYS prioritize Safe execTransaction over nested operations
        const availableOperations = Object.keys(selectedMetadata.metadata.display.formats);
        
        // Check if this is Safe metadata with execTransaction
        const safeExecOperation = availableOperations.find(op => 
          op.includes('execTransaction') && op === detectedSelector
        );
        
        if (safeExecOperation) {
          // If this is Safe metadata and we have execTransaction, select it
          setSelectedOperation(safeExecOperation);
        } else {
          // Only select nested operations if we're not looking at Safe metadata
          const exactMatch = availableOperations.find(op => op === detectedSelector);
          
          if (exactMatch) {
            setSelectedOperation(exactMatch);
          } else {
            // Find partial match by function name only for non-Safe operations
            const txFunctionName = transactionData.methodCall?.name;
            if (txFunctionName && txFunctionName !== 'execTransaction') {
              const partialMatch = availableOperations.find(op => 
                operationMatchesTransaction(op, transactionData)
              );
              if (partialMatch) {
                setSelectedOperation(partialMatch);
              }
            }
          }
        }
      }
    }
  }, [transactionData, selectedMetadataId, metadataEntries]);

  // Get the actual field value from decoded transaction data
  const getFieldValueFromTransaction = (path: string, format: string, field?: any): string => {
    // Use nested transaction data if available in the field, otherwise use main transaction data
    const contextData = field?.nestedTransactionData || transactionData;
    
    console.log('DEBUG getFieldValueFromTransaction:', {
      path,
      format,
      hasField: !!field,
      hasNestedData: !!field?.nestedTransactionData,
      contextData,
      mainTransactionData: transactionData
    });
    
    if (!contextData) {
      console.log('DEBUG: No context data, returning mock value');
      return `Mock ${format} value`;
    }
    
    // Check if this field should use nested transaction context
    const useNestedContext = field && field.useNestedContext;
    const hasNestedTransactionData = field && field.nestedTransactionData;
    console.log('DEBUG: hasNestedTransactionData:', hasNestedTransactionData, 'field:', field);
    
    if (useNestedContext && !hasNestedTransactionData) {
      // Find the first transfer operation in nested data
      const dataParam = transactionData.methodCall?.params?.find((p: any) => p.name === 'data' && p.valueDecoded);
      if (dataParam?.valueDecoded?.params) {
        const transactionsParam = dataParam.valueDecoded.params.find((p: any) => p.name === 'transactions');
        if (transactionsParam?.value && Array.isArray(transactionsParam.value)) {
          // Find the first transaction with a transfer
          for (const txItem of transactionsParam.value) {
            if (txItem?.data?.valueDecoded?.name === 'transfer') {
              contextData = {
                methodCall: {
                  name: 'transfer',
                  params: txItem.data.valueDecoded.params
                }
              };
              break;
            }
          }
        }
      }
    }

    try {
      // Debug logging
      console.log("DEBUG: Parsing path:", path, "format:", format, "hasNestedData:", hasNestedTransactionData);
      console.log("DEBUG: Context data:", contextData);
      console.log("DEBUG: Field object:", field);
      // Handle ERC7730 path format: "#.fieldName" means direct parameter access
      let cleanPath = path;
      let isDirectParam = false;
      
      if (path.startsWith('#.')) {
        cleanPath = path.substring(2); // Remove "#." prefix
        isDirectParam = true;
      }
      
      const pathParts = cleanPath.split('.');
      let value: any = contextData;
      
      if (contextData.methodCall && contextData.methodCall.params) {
        if (isDirectParam) {
          // Direct parameter access for ERC7730 format (e.g., "#.to", "#.value", "#.desc.srcToken")
          const param = contextData.methodCall.params.find((p: any) => p.name === pathParts[0]);
          console.log(`DEBUG: Looking for param "${pathParts[0]}" in:`, contextData.methodCall.params.map((p: any) => p.name));
          if (param) {
            console.log(`DEBUG: Found param "${pathParts[0]}":`, param);
            value = param;
            
            // Navigate through the path parts
            for (let i = 0; i < pathParts.length; i++) {
              const part = pathParts[i];
              if (i === 0) {
                // First part is the parameter name, already found
                continue;
              }
              
              // Handle array access notation like "orders[0]"
              let arrayIndex: number | null = null;
              let partName = part;
              if (part && part.includes('[') && part.includes(']')) {
                const match = part.match(/^(.+)\[(\d+)\]$/);
                if (match && match[1] && match[2]) {
                  partName = match[1];
                  arrayIndex = parseInt(match[2]);
                }
              }
              
              // For nested tuple structures, check both 'value' and 'components'
              if (value && typeof value === 'object') {
                console.log(`Processing part "${partName}" with array index ${arrayIndex}`, {
                  hasComponents: !!value.components,
                  hasValue: !!value.value,
                  valueType: typeof value.value,
                  valueKeys: value.value ? Object.keys(value.value) : null
                });
                
                if (value.components && Array.isArray(value.components)) {
                  // This is a tuple parameter, find the component by name
                  const component = value.components.find((c: any) => c.name === partName);
                  if (component) {
                    console.log(`Found component "${partName}":`, component);
                    // For tuple components, the value is directly in the component.value field
                    value = component.value;
                    console.log(`Extracted component value:`, value);
                    // If there's an array index, access that specific element
                    if (arrayIndex !== null && Array.isArray(value)) {
                      if (arrayIndex < value.length) {
                        value = value[arrayIndex];
                        console.log(`Accessed array index ${arrayIndex}:`, value);
                      } else {
                        console.log(`Array index ${arrayIndex} out of bounds for array length ${value.length}`);
                        value = undefined;
                        break;
                      }
                    }
                  } else {
                    console.log(`Component "${partName}" not found in components:`, value.components.map((c: any) => c.name));
                    value = undefined;
                    break;
                  }
                } else if (value.value && typeof value.value === 'object') {
                  // Direct access to nested value
                  if (partName && value.value[partName] !== undefined) {
                    value = { value: value.value[partName] };
                    console.log(`Direct value access "${partName}":`, value);
                    // If there's an array index, access that specific element
                    if (arrayIndex !== null && value.value && Array.isArray(value.value)) {
                      if (arrayIndex < value.value.length) {
                        value = { value: value.value[arrayIndex] };
                        console.log(`Accessed nested array index ${arrayIndex}:`, value);
                      } else {
                        console.log(`Nested array index ${arrayIndex} out of bounds`);
                        value = undefined;
                        break;
                      }
                    }
                  } else {
                    console.log(`Property "${partName}" not found in value object:`, value.value ? Object.keys(value.value) : 'null');
                    value = undefined;
                    break;
                  }
                } else if (partName && value[partName] !== undefined) {
                  // Direct property access
                  value = value[partName];
                  console.log(`Direct property access "${partName}":`, value);
                  // If there's an array index, access that specific element
                  if (arrayIndex !== null && Array.isArray(value)) {
                    if (arrayIndex < value.length) {
                      value = value[arrayIndex];
                      console.log(`Accessed property array index ${arrayIndex}:`, value);
                    } else {
                      console.log(`Property array index ${arrayIndex} out of bounds`);
                      value = undefined;
                      break;
                    }
                  }
                } else {
                  console.log(`Property "${partName}" not found in object:`, Object.keys(value));
                  value = undefined;
                  break;
                }
              } else {
                console.log(`Value is not an object, cannot access "${partName}":`, value);
                value = undefined;
                break;
              }
            }
            
            // Extract the final value
            if (value && typeof value === 'object' && value.value !== undefined) {
              // Only extract .value if we haven't already extracted a component value
              if (typeof value.value === 'string' || typeof value.value === 'number') {
                value = value.value;
              }
            }
            
            console.log('DEBUG: Final extracted value for path', path, ':', value);
            
          } else {
            value = undefined;
          }
        } else {
          // Legacy path format - try inner decoded transaction first for token transfers
          const dataParam = contextData.methodCall.params.find((p: any) => p.name === 'data' && p.valueDecoded);
          
          if (dataParam && dataParam.valueDecoded && dataParam.valueDecoded.params) {
            // First try to find the parameter in the inner decoded transaction
            const innerParam = dataParam.valueDecoded.params.find((p: any) => p.name === pathParts[0]);
            if (innerParam) {
              value = innerParam.value;
              
              // Navigate through any remaining path parts
              for (let i = 1; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (value && typeof value === 'object' && part) {
                  if (value[part] !== undefined) {
                    value = value[part];
                  } else {
                    value = undefined;
                    break;
                  }
                } else {
                  value = undefined;
                  break;
                }
              }
            } else {
              // Fall back to outer transaction parameters
              const rootParam = contextData.methodCall.params.find((p: any) => p.name === pathParts[0]);
              if (rootParam) {
                value = rootParam.value || rootParam;
              } else {
                value = undefined;
              }
            }
          } else {
            // No inner decoded transaction, use outer parameters
            const rootParam = contextData.methodCall.params.find((p: any) => p.name === pathParts[0]);
            if (rootParam) {
              value = rootParam.value || rootParam;
            } else {
              value = undefined;
            }
          }
        }
      } else {
        value = undefined;
      }

      console.log('DEBUG: Processing value before formatting:', {
        path,
        format,
        rawValue: value,
        valueType: typeof value
      });

      if (value !== undefined) {
                 // Format the value based on the format type
         switch (format) {
           case "tokenAmount":
             const rawValue = value.toString();
             console.log('DEBUG tokenAmount:', {
               rawValue,
               hasField: !!field,
               fieldParams: field?.params,
               tokenPath: field?.params?.tokenPath,
               metadataEntriesCount: metadataEntries.length
             });
             
             // If field has tokenPath, find matching metadata with token info
             if (field.params?.tokenPath) {
               const tokenAddress = field.params.tokenPath;
               console.log('DEBUG: Looking for token metadata for address:', tokenAddress);
               
               const tokenMetadata = metadataEntries.find(entry => 
                 entry.metadata.context?.contract?.deployments?.some(dep => 
                   dep.address === tokenAddress
                 )
               );
               
               console.log('DEBUG: tokenMetadata found:', !!tokenMetadata);
               console.log('DEBUG: tokenMetadata.metadata keys:', Object.keys(tokenMetadata?.metadata || {}));
               console.log('DEBUG: tokenMetadata.metadata.metadata exists:', !!tokenMetadata?.metadata?.metadata);
               
               if (tokenMetadata?.metadata?.metadata?.token?.decimals) {
                 const decimals = tokenMetadata.metadata.metadata.token.decimals;
                 const ticker = tokenMetadata.metadata.metadata.token.ticker;
                 console.log('DEBUG: Using token info:', { decimals, ticker });
                 const formattedAmount = (parseInt(rawValue) / Math.pow(10, decimals)).toString();
                 return `${formattedAmount} ${ticker}`;
               } else {
                 console.log('DEBUG: No token decimals found in metadata');
               }
             } else {
               console.log('DEBUG: No tokenPath in field params');
             }
             
             return rawValue;
           case "addressName":
             const addressValue = value.toString();
             if (addressValue.startsWith('0x') && addressValue.length === 42) {
               return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
             }
             return addressValue;
           case "tokenAmount":
           case "amount":
             if (value === "0") return "0";
             // Try to get token info from addressesMeta for proper decimal formatting
             const rawAmount = value.toString();
             if (transactionData?.addressesMeta && field.params?.tokenPath) {
               let tokenAddress;
               // Check if tokenPath is a direct address or a field path
               if (field.params.tokenPath.startsWith('0x')) {
                 tokenAddress = field.params.tokenPath;
               } else {
                 // It's a field path, resolve it
                 tokenAddress = getFieldValueFromTransaction(field.params.tokenPath, "raw", field);
               }
               
               if (tokenAddress && transactionData.addressesMeta[tokenAddress]) {
                 const tokenMeta = transactionData.addressesMeta[tokenAddress];
                 if (tokenMeta && tokenMeta.decimals) {
                   const decimals = tokenMeta.decimals;
                   const formattedAmount = (parseInt(rawAmount) / Math.pow(10, decimals)).toString();
                   return `${formattedAmount} ${tokenMeta.tokenSymbol || ''}`;
                 }
               }
             }
             return rawAmount;
           case "raw":
             const rawValueStr = value.toString();
             // For long hex strings (like signatures), show shortened format
             if (rawValueStr.startsWith('0x') && rawValueStr.length > 42) {
               return `${rawValueStr.slice(0, 10)}...${rawValueStr.slice(-7)}`;
             }
             return rawValueStr;
           default:
             return value.toString();
         }
      }
    } catch (error) {
      console.error("Error getting field value:", error);
    }

    return `Mock ${format} value`;
  };

  const getOperationForViewing = (): Operation | null => {
    if (activeTab === "simple") {
      if (!parsedData || !selectedOperation || !parsedData.display?.formats) {
        return null;
      }
      return parsedData.display.formats[selectedOperation] || null;
    } else {
      // Multi-metadata mode with Safe hierarchy validation
      if (!selectedMetadataId || !selectedOperation) {
        return null;
      }
      
      const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
      if (!selectedMetadata || !selectedMetadata.metadata.display?.formats) {
        return null;
      }
      
      // No hardcoded operation assumptions - just return what's in the metadata
      
      return selectedMetadata.metadata.display.formats[selectedOperation] || null;
    }
  };

  const getOperationMetadata = () => {
    if (activeTab === "simple") {
      if (!parsedData || !selectedOperation) {
        return null;
      }
      const operation = parsedData.display?.formats?.[selectedOperation];
      const intent = operation?.intent;
      
      return {
        operationName: typeof intent === "string" ? intent : selectedOperation,
        metadata: parsedData.metadata || null,
      };
    } else {
      // Multi-metadata mode
      if (!selectedMetadataId || !selectedOperation) {
        return null;
      }
      
      const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
      if (!selectedMetadata) {
        return null;
      }
      
      const operation = selectedMetadata.metadata.display?.formats?.[selectedOperation];
      const intent = operation?.intent;
      
      return {
        operationName: typeof intent === "string" ? intent : selectedOperation,
        metadata: selectedMetadata.metadata.metadata || null,
      };
    }
  };


  // Function to check if bytecode matches any available metadata
  const findMetadataForBytecode = (bytecode: string): {operation: Operation, metadata: any} | null => {
    if (!bytecode || !bytecode.startsWith('0x') || bytecode.length < 10) {
      return null;
    }
    
    // For now, we rely on the existing valueDecoded structure
    // since proper selector calculation requires crypto libraries
    // This function will work when the transaction already has valueDecoded data
    
    return null;
  };

  // Function to get all operations for current transaction (including nested)
  const getAllOperationsForTransaction = (transactionData: DecodedTransaction | null): Array<{operation: Operation, metadata: any, context: string, nestedData?: any}> => {
    if (!transactionData) return [];
    
    console.log('DEBUG: getAllOperationsForTransaction called with:', transactionData);
    console.log('DEBUG: Available metadata entries:', metadataEntries);
    console.log('DEBUG: Method name:', transactionData.methodCall?.name);
    console.log('DEBUG: Method params:', transactionData.methodCall?.params?.map(p => p.name));
    
    const operations: Array<{operation: Operation, metadata: any, context: string, nestedData?: any}> = [];
    
    // Check if current transaction has an operation that matches metadata
    const currentSelector = getTransactionFunctionSelector(transactionData);
    console.log('🔥 AAVE DEBUG: Generated selector:', currentSelector);
    console.log('🔥 AAVE DEBUG: Number of metadata entries:', metadataEntries.length);
    
    if (currentSelector) {
      for (const entry of metadataEntries) {
        const formats = entry.metadata.display?.formats;
        console.log('🔥 AAVE DEBUG: Entry name:', entry.name);
        console.log('🔥 AAVE DEBUG: Available formats:', formats ? Object.keys(formats) : 'No formats');
        console.log('🔥 AAVE DEBUG: Looking for selector:', currentSelector);
        console.log('🔥 AAVE DEBUG: Selector exists:', formats ? (currentSelector in formats) : false);
        
        if (formats && formats[currentSelector]) {
          console.log('🔥 AAVE DEBUG: ✅ MATCH FOUND!');
          operations.push({
            operation: formats[currentSelector],
            metadata: entry.metadata.metadata,
            context: 'main'
          });
          break;
        } else {
          console.log('🔥 AAVE DEBUG: ❌ No match in this entry');
        }
      }
    }
    
    console.log('🔥 AAVE DEBUG: Final operations count:', operations.length);
    
    // Look specifically for nested operations in the transaction data
    if (transactionData.methodCall?.params) {
      // Handle multiSend transactions 
      if (transactionData.methodCall.name === 'multiSend') {
        const transactionsParam = transactionData.methodCall.params.find((p: any) => p.name === 'transactions' && p.valueDecoded);
        if (transactionsParam && transactionsParam.valueDecoded && transactionsParam.valueDecoded.params) {
          // The actual transactions are in params[0].components
          const txComponents = transactionsParam.valueDecoded.params[0]?.components;
          if (txComponents && Array.isArray(txComponents)) {
            console.log('DEBUG: Found multiSend with transactions:', txComponents.length);
            
            // Process each transaction component
            txComponents.forEach((txComponent: any, index: number) => {
              // Each component is a tuple with nested valueDecoded containing execTransaction
              const execTxData = txComponent.components?.find((comp: any) => comp.name === 'data' && comp.valueDecoded);
              if (execTxData && execTxData.valueDecoded && execTxData.valueDecoded.name === 'execTransaction') {
                // Look for the nested transfer call within the execTransaction data
                const dataParam = execTxData.valueDecoded.params?.find((p: any) => p.name === 'data' && p.valueDecoded);
                if (dataParam && dataParam.valueDecoded && dataParam.valueDecoded.name === 'transfer') {
                  console.log(`DEBUG: MultiSend tx ${index} - found transfer:`, dataParam.valueDecoded);
                  const transferData = dataParam.valueDecoded;
                  const nestedSelector = `${transferData.name}(${transferData.params?.map((p: any) => p.type).join(',') || ''})`;
                  console.log('DEBUG: Looking for multiSend nested selector:', nestedSelector);
                  
                  // Find matching metadata for this transfer
                  for (const entry of metadataEntries) {
                    if (entry.metadata.display?.formats?.[nestedSelector]) {
                      console.log('DEBUG: Found exact match for multiSend nested operation:', nestedSelector);
                      operations.push({
                        operation: entry.metadata.display.formats[nestedSelector] as Operation,
                        metadata: entry.metadata.metadata,
                        context: 'nested',
                        nestedData: {
                          methodCall: {
                            name: transferData.name,
                            params: transferData.params?.map((p: any) => ({ name: p.name, value: p.value })) || []
                          }
                        }
                      });
                      break;
                    }
                  }
                }
              }
            });
          }
        }
      }
      
      for (const param of transactionData.methodCall.params) {
        // Check if this is a 'data' parameter with decoded value (common in Safe transactions)
        if (param.name === 'data' && param.valueDecoded) {
          const nestedTx = param.valueDecoded;
          console.log('DEBUG: Found nested transaction in data param:', nestedTx);
          
          // Check if we have metadata for this nested operation
          const nestedSelector = (nestedTx as any).signature || nestedTx.name;
          console.log('DEBUG: Looking for nested selector:', nestedSelector);
          
          if (nestedSelector) {
            for (const entry of metadataEntries) {
              const formats = entry.metadata.display?.formats;
              if (formats) {
                // Check for exact match first
                if (formats[nestedSelector]) {
                  console.log('DEBUG: Found exact match for nested operation:', nestedSelector);
                  operations.push({
                    operation: formats[nestedSelector] as Operation,
                    metadata: entry.metadata.metadata,
                    context: 'nested',
                    nestedData: {
                      methodCall: {
                        name: nestedTx.name,
                        params: nestedTx.params
                      }
                    }
                  });
                  break;
                }
                // Check for function name match (e.g., "transfer" matches "transfer(address,uint256)")
                else {
                  const matchingFormat = Object.keys(formats).find(formatKey => 
                    formatKey.startsWith(nestedTx.name + '(') || formatKey === nestedTx.name
                  );
                  if (matchingFormat) {
                    console.log('DEBUG: Found function name match for nested operation:', matchingFormat);
                    operations.push({
                      operation: formats[matchingFormat] as Operation,
                      metadata: entry.metadata.metadata,
                      context: 'nested',
                      nestedData: {
                        methodCall: {
                          name: nestedTx.name,
                          params: nestedTx.params
                        }
                      }
                    });
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return operations;
  };

  // Enhanced getScreensForOperation that uses real transaction data
  const getScreensForOperationWithRealData = (operation: Operation) => {
    const displays = operation.fields.filter((field) => {
      const label = field && "label" in field ? field.label : undefined;
      return !(label === undefined || label === null || label === "");
    });

    const ITEM_PER_SCREEN = 4;
    const screens: Array<Array<{label: string; isActive?: boolean; displayValue: string}>> = [];
    let screen: Array<{label: string; isActive?: boolean; displayValue: string}> = [];

    for (let i = 0; i < displays.length; i++) {
      const isLastItem = i === displays.length - 1;
      const displayItem = displays[i];
      const label = displayItem && "label" in displayItem ? displayItem.label : undefined;

      if (label === undefined || label === null || label === "") continue;
      if (!displayItem) continue;

      const hasFormat = "format" in displayItem;
      const format = hasFormat ? displayItem.format : "raw";
      const path = displayItem.path || "";
      
      let displayValue;
      if (path === "separator") {
        displayValue = "";
      } else if (activeTab === "advanced" && transactionData) {
        displayValue = getFieldValueFromTransaction(path, format || "raw", displayItem);
      } else {
        displayValue = hasFormat && format ? `Mock ${format} value` : "displayValue";
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
  };

  const operation = getOperationForViewing();
  const operationMetadata = getOperationMetadata();
  
  console.log('DEBUG: Current state:', {
    activeTab,
    selectedMetadataId,
    selectedOperation,
    metadataEntriesCount: metadataEntries.length,
    hasTransactionData: !!transactionData,
    operation: !!operation,
    operationMetadata: !!operationMetadata
  });

  const renderHardwareUI = () => {
    // Get all operations for this transaction (including nested)
    const allOperations = activeTab === "advanced" && transactionData ? getAllOperationsForTransaction(transactionData) : [];
    console.log('DEBUG: activeTab:', activeTab, 'transactionData exists:', !!transactionData);
    
    // For Safe transactions with nested operations, show the proper flow
    console.log('DEBUG: allOperations.length:', allOperations.length, 'allOperations:', allOperations);
    if (allOperations.length > 1) {
      const mainOperation = allOperations.find(op => op.context === 'main');
      const nestedOperations = allOperations.filter(op => op.context !== 'main');
      console.log('DEBUG: mainOperation:', mainOperation, 'nestedOperations:', nestedOperations);
      
      if (mainOperation && nestedOperations.length > 0) {
        const firstNestedOp = nestedOperations[0];
        
        if (firstNestedOp && firstNestedOp.operation) {
          // Combine both operations into one complete flow: Review → Details → Sign
          // Use the USDC metadata directly for the nested operation
          const usdcMetadata = metadataEntries.find(entry => 
            entry.metadata.display?.formats?.['transfer(address,uint256)']
          );
          
          const modifiedNestedOperation = {
            ...firstNestedOp.operation,
            fields: firstNestedOp.operation.fields.map(field => {
              console.log('DEBUG: Creating field with nestedData:', firstNestedOp.nestedData);
              return {
                ...field,
                nestedTransactionData: firstNestedOp.nestedData
              };
            })
          };
          
          const nestedScreens = getScreensForOperationWithRealData(modifiedNestedOperation);
          const combinedOperationMeta = {
            operationName: `${typeof mainOperation.operation.intent === 'string' ? mainOperation.operation.intent : 'Execute Transaction'} → ${typeof firstNestedOp.operation.intent === 'string' ? firstNestedOp.operation.intent : 'Transfer'}`,
            metadata: firstNestedOp.metadata
          };
          const allScreens = operationScreens(nestedScreens, combinedOperationMeta);
          
          return (
            <div className="mx-auto flex max-w-96 flex-col">
              <div className="text-center text-sm text-gray-600 mb-4">
                {combinedOperationMeta.operationName}
              </div>
              <Carousel setApi={setApi}>
                <CarouselContent>
                  {allScreens.map((screen, index) => (
                    <CarouselItem
                      key={index}
                      className="flex w-full items-center justify-center"
                    >
                      <Device.Frame>{screen}</Device.Frame>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex" />
                <CarouselNext className="hidden md:flex" />
              </Carousel>
              <div className="mx-auto flex flex-row items-center gap-4 p-2">
                {allScreens.map((_, index) => (
                  <div
                    key={"carousel-thumbnail-" + index}
                    className={cn("w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                      "ring-2": index === selected,
                    })}
                    onClick={() => api?.scrollTo(index)}
                  >
                    <Device.Frame size="small">{index + 1}</Device.Frame>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      }
    }
    
    // Single operation display (fallback)
    if (allOperations.length === 1) {
      const mainOperation = allOperations[0];
      if (mainOperation) {
        const screens = getScreensForOperationWithRealData(mainOperation.operation);
        const operationMeta = {
          operationName: typeof mainOperation.operation.intent === 'string' ? mainOperation.operation.intent : 'Execute Transaction',
          metadata: mainOperation.metadata
        };
        const fullOperationScreens = operationScreens(screens, operationMeta);
        
        return (
        <div className="mx-auto flex max-w-96 flex-col">
          <Carousel setApi={setApi}>
            <CarouselContent>
              {fullOperationScreens.map((screen, index) => (
                <CarouselItem
                  key={index}
                  className="flex w-full items-center justify-center"
                >
                  <Device.Frame>{screen}</Device.Frame>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex" />
            <CarouselNext className="hidden md:flex" />
          </Carousel>
          <div className="mx-auto flex flex-row items-center gap-4 p-2">
            {fullOperationScreens.map((_, index) => (
              <div
                key={"carousel-thumbnail-" + index}
                className={cn("w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                  "ring-2": index === selected,
                })}
                onClick={() => api?.scrollTo(index)}
              >
                <Device.Frame size="small">{index + 1}</Device.Frame>
              </div>
            ))}
          </div>
        </div>
        );
      }
    }
    
    // Fallback to single operation display
    console.log('DEBUG: Using fallback - operation exists:', !!operation, 'operationMetadata exists:', !!operationMetadata);
    if (!operation || !operationMetadata) {
      return (
        <div className="text-center text-gray-500 py-8">
          {activeTab === "simple" 
            ? "Please provide valid ERC7730 metadata and select an operation to preview"
            : "Please add metadata files, select a metadata file, and choose an operation to preview"
          }
        </div>
      );
    }

    if (!operation.intent || operation.intent === "") {
      return (
        <div className="text-center text-gray-500 py-8">
          Transaction is not clear sign
        </div>
      );
    }

    console.log('DEBUG: Rendering final fallback operation:', operation);
    const screens = getScreensForOperationWithRealData(operation);
    const fullOperationScreens = operationScreens(screens, operationMetadata);

    return (
      <div className="mx-auto flex max-w-96 flex-col">
        <Carousel setApi={setApi}>
          <CarouselContent>
            {fullOperationScreens.map((screen, index) => (
              <CarouselItem
                key={index}
                className="flex w-full items-center justify-center"
              >
                <Device.Frame>{screen}</Device.Frame>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
        <div className="mx-auto flex flex-row items-center gap-4 p-2">
          {fullOperationScreens.map((_, index) => (
            <div
              key={"carousel-thumbnail-" + index}
              className={cn("w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                "ring-2": index === selected,
              })}
              onClick={() => api?.scrollTo(index)}
            >
              <Device.Frame size="small">{index + 1}</Device.Frame>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            ERC7730 Metadata Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple">Simple Mode</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Mode</TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-input">Paste your ERC7730 JSON metadata</Label>
                <Textarea
                  id="json-input"
                  placeholder="Paste your ERC7730 JSON here..."
                  value={jsonInput}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              
              <Button onClick={loadSampleData} variant="outline" className="w-full">
                Load Sample Data
              </Button>

              {parsedData && parsedData.display?.formats && (
                <div className="space-y-2">
                  <Label htmlFor="operation-select">Select Operation</Label>
                  <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an operation to view" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(parsedData.display.formats).map((operationName) => (
                        <SelectItem key={operationName} value={operationName}>
                          {operationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Multi-Metadata + Real Data mode: Input multiple ERC7730 metadata files and decoded transaction data
                </div>
                <div className="flex items-center justify-between">
                  <Label>ERC7730 Metadata Files</Label>
                  <div className="flex gap-2">
                    <Button onClick={addMetadataEntry} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Metadata
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sample Sets</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => loadSampleSet('erc7730-1inch-aggregation-router-v6.json', {
                        "txHash": "0x8e36953374f7b71fe4c20898c8ade628cf71d5d0303ec8ad368b254629db2985",
                        "methodCall": {
                          "name": "swap",
                          "signature": "swap(address,(address,address,address,address,uint256,uint256,uint256),bytes)",
                          "params": [
                            {
                              "name": "executor",
                              "type": "address",
                              "value": "0xE37e799D5077682FA0a244D46E5649F71457BD09"
                            },
                            {
                              "name": "desc",
                              "type": "tuple",
                              "components": [
                                {
                                  "name": "srcToken",
                                  "type": "address",
                                  "value": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
                                },
                                {
                                  "name": "dstToken",
                                  "type": "address",
                                  "value": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
                                },
                                {
                                  "name": "amount",
                                  "type": "uint256",
                                  "value": "9649057979"
                                },
                                {
                                  "name": "minReturnAmount",
                                  "type": "uint256",
                                  "value": "3806705089377441405"
                                },
                                {
                                  "name": "dstReceiver",
                                  "type": "address",
                                  "value": "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF4448"
                                }
                              ]
                            }
                          ]
                        }
                      })} 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                    >
                      1inch Swap
                    </Button>
                    <Button 
                      onClick={() => {
                        console.log('🔥 AAVE DEBUG: Clicking Aave button');
                        loadSampleSet('erc7730-aave-v2-lending-pool.json', {
                        "txHash": "0xc0bd04d7e94542e58709f51879f64946ff4a744e1c37f5f920cea3d478e115d7",
                        "methodCall": {
                          "name": "repay",
                          "signature": "repay(address,uint256,uint256,address)",
                          "params": [
                            {
                              "name": "asset",
                              "type": "address",
                              "value": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
                            },
                            {
                              "name": "amount",
                              "type": "uint256",
                              "value": "1238350000"
                            },
                            {
                              "name": "rateMode",
                              "type": "uint256",
                              "value": "2"
                            },
                            {
                              "name": "onBehalfOf",
                              "type": "address",
                              "value": "0xf89a3799b90593317E0a1Eb74164fbc1755A297A"
                            }
                          ]
                        },
                        "addressesMeta": {
                          "0xdAC17F958D2ee523a2206206994597C13D831ec7": {
                            "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                            "contractName": "Tether USD",
                            "tokenSymbol": "USDT",
                            "decimals": 6,
                            "type": "ERC20",
                            "chainID": 1
                          }
                        }
                      });
                      }} 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                    >
                      Aave Repay
                    </Button>
                    <Button 
                      onClick={() => loadSampleSet(['erc7730-safe-wallet-enhanced.json', 'erc7730-usdc-mainnet.json'], {
                        "txHash": "0x8e36953374f7b71fe4c20898c8ade628cf71d5d0303ec8ad368b254629db2985",
                        "methodCall": {
                          "name": "execTransaction",
                          "signature": "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)",
                          "params": [
                            {
                              "name": "to",
                              "type": "address",
                              "value": "0xA0b86a33E6441D52e5d6f83b7d68a80B6d3E97C7"
                            },
                            {
                              "name": "value",
                              "type": "uint256",
                              "value": "0"
                            },
                            {
                              "name": "data",
                              "type": "bytes",
                              "value": "0xa9059cbb0000000000000000000000008db97c7cece249c2b98bdc0226cc4c2a57bf44480000000000000000000000000000000000000000000000000000000002faf080",
                              "valueDecoded": {
                                "name": "transfer",
                                "params": [
                                  {
                                    "name": "to",
                                    "type": "address",
                                    "value": "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF4448"
                                  },
                                  {
                                    "name": "value",
                                    "type": "uint256",
                                    "value": "50000000"
                                  }
                                ]
                              }
                            },
                            {
                              "name": "operation",
                              "type": "uint8",
                              "value": "0"
                            },
                            {
                              "name": "safeTxGas",
                              "type": "uint256",
                              "value": "0"
                            },
                            {
                              "name": "baseGas",
                              "type": "uint256",
                              "value": "0"
                            },
                            {
                              "name": "gasPrice",
                              "type": "uint256",
                              "value": "0"
                            },
                            {
                              "name": "gasToken",
                              "type": "address",
                              "value": "0x0000000000000000000000000000000000000000"
                            },
                            {
                              "name": "refundReceiver",
                              "type": "address",
                              "value": "0x0000000000000000000000000000000000000000"
                            },
                            {
                              "name": "signatures",
                              "type": "bytes",
                              "value": "0x000000000000000000000000f89a3799b90593317e0a1eb74164fbc1755a297a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"
                            }
                          ]
                        },
                        "addressesMeta": {
                          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
                            "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                            "contractName": "USD Coin",
                            "tokenSymbol": "USDC",
                            "decimals": 6,
                            "type": "ERC20"
                          }
                        }
                      })} 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                    >
                      Safe + USDC
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Choose a sample set to load matching metadata + transaction data
                  </div>
                </div>
                
                <div className="text-center">
                  <a 
                    href="https://loop-decoder-web.vercel.app/decode" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline text-sm"
                  >
                    Get transaction data from Loop Decoder
                  </a>
                </div>

                {metadataEntries.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateMetadataName(entry.id, e.target.value)}
                        className="font-medium bg-transparent border-none outline-none"
                      />
                      <Button
                        onClick={() => removeMetadataEntry(entry.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Paste ERC7730 metadata JSON..."
                      value={JSON.stringify(entry.metadata, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          updateMetadataEntry(entry.id, parsed);
                        } catch (err) {
                          // Invalid JSON, but don't error immediately
                        }
                      }}
                      className="min-h-[150px] font-mono text-xs"
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Transaction Data (Decoded)</Label>
                  </div>
                  <Textarea
                    placeholder="Paste decoded transaction data JSON..."
                    value={transactionData ? JSON.stringify(transactionData, null, 2) : ""}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setTransactionData(normalizeTransactionData(parsed));
                      } catch (err) {
                        if (e.target.value === "") {
                          setTransactionData(null);
                        }
                      }
                    }}
                    className="min-h-[200px] font-mono text-xs"
                  />
                </div>

                {metadataEntries.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Metadata to View</Label>
                    <Select value={selectedMetadataId} onValueChange={setSelectedMetadataId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose metadata file" />
                      </SelectTrigger>
                      <SelectContent>
                        {metadataEntries.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedMetadataId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Operation</Label>
                      {transactionData && (
                        <div className="text-xs text-gray-500 break-all">
                          Detected: {getTransactionFunctionSelector(transactionData) || "Unknown"}
                        </div>
                      )}
                    </div>
                    <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an operation to view" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
                          if (!selectedMetadata?.metadata.display?.formats) return null;
                          
                          // Get detected function selector from transaction
                          const detectedSelector = getTransactionFunctionSelector(transactionData);
                          
                          // Check if Safe metadata exists
                          const safeMetadataExists = metadataEntries.some(entry => {
                            const formats = entry.metadata.display?.formats;
                            return formats && Object.keys(formats).length > 0;
                          });
                          
                          return Object.keys(selectedMetadata.metadata.display.formats)
                            .filter(operationName => {
                              // Filter operations based on transaction data
                              return operationMatchesTransaction(operationName, transactionData);
                            })
                            .map((operationName) => {
                              const isTokenOperation = operationName === "transfer" || operationName.includes("transfer");
                              const isDisabled = isTokenOperation && !safeMetadataExists;
                              const isExactMatch = detectedSelector === operationName;
                              
                              return (
                                <SelectItem 
                                  key={operationName} 
                                  value={operationName}
                                  disabled={isDisabled}
                                >
                                  {operationName} 
                                  {isExactMatch ? " ✓" : ""}
                                  {isDisabled ? " (Requires Safe metadata)" : ""}
                                </SelectItem>
                              );
                            });
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Hardware Wallet Preview
            {activeTab === "advanced" && transactionData && (
              <span className="text-sm font-normal text-green-600">
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderHardwareUI()}
        </CardContent>
      </Card>
    </div>
  );
};

export default HardwareViewer; 