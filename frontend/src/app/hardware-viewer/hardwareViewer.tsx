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
  metadataBasePath?: string;
  samplesBasePath?: string;
}

const HardwareViewer = ({ 
  initialTransactionData, 
  metadataBasePath = '/erc7730',
  samplesBasePath = '/samples'
}: HardwareViewerProps = {}) => {
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

  // State for dynamically loaded sample sets
  const [sampleSets, setSampleSets] = useState<any[]>([]);

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

  // Dynamic loading of sample data
  const loadSampleSetsConfig = async () => {
    console.log("loadSampleSetsConfig called, samplesBasePath:", samplesBasePath);
    try {
      const response = await fetch(`${samplesBasePath}/sample-sets.json`);
      console.log("sample-sets.json response:", response);
      if (response.ok) {
        const config = await response.json();
        console.log("sample-sets.json config:", config);
        setSampleSets(config.sampleSets || []);
      }
    } catch (error) {
      console.error("Error loading sample sets:", error);
    }
  };

  // Dynamic sample set loading
  const loadSampleSet = async (sampleSetId: string) => {
    console.log("loadSampleSet called with:", sampleSetId);
    console.log("Available sampleSets:", sampleSets);
    try {
      const sampleSet = sampleSets.find(set => set.id === sampleSetId);
      console.log("Found sampleSet:", sampleSet);
      if (!sampleSet) return;

      const entries = [];
      
      // Load metadata files
      for (const metadataFile of sampleSet.metadataFiles) {
        const response = await fetch(`${metadataBasePath}/${metadataFile}`);
        if (response.ok) {
          const metadata = await response.json();
          entries.push({
            id: `metadata-${Date.now()}-${entries.length}`,
            name: metadata.metadata?.owner || "Metadata",
            metadata: metadata as unknown as Erc7730
          });
        }
      }
      
      setMetadataEntries(entries);
      
      // Load transaction data if available
      if (sampleSet.transactionData) {
        const normalizedTxData = normalizeTransactionData(sampleSet.transactionData);
        setTransactionData(normalizedTxData);
        setActiveTab("advanced");
        
        if (entries.length > 0) {
          setSelectedMetadataId(entries[0].id);
          
          // Auto-select matching operation
          const firstEntry = entries[0];
          if (firstEntry?.metadata.display?.formats) {
            const detectedSelector = getTransactionFunctionSelector(normalizedTxData);
            
            const availableOperations = Object.keys(firstEntry.metadata.display.formats);
            const exactMatch = availableOperations.find(op => op === detectedSelector);
            
            if (exactMatch) {
              setSelectedOperation(exactMatch);
            } else {
              const firstOperation = availableOperations[0];
              if (firstOperation) {
                setSelectedOperation(firstOperation);
              }
            }
          }
        }
      }
    } catch (error) {
      setError('Failed to load sample set');
    }
  };

  // Function to normalize transaction data format
  const normalizeTransactionData = (data: any): DecodedTransaction => {
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
    loadSampleSetsConfig();
  }, [samplesBasePath]);

  useEffect(() => {
    if (!api) {
      return;
    }

    setSelected(api.selectedScrollSnap());

    api.on("select", () => {
      setSelected(api.selectedScrollSnap());
    });
  }, [api]);

  // Don't load anything on mount - start empty

  // Load initial transaction data if provided
  useEffect(() => {
    if (initialTransactionData) {
      setTransactionData(initialTransactionData);
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
    console.log(`Getting field value for path: ${path}, format: ${format}`);
    // Use nested transaction data if available in the field, otherwise use main transaction data
    const contextData = field?.nestedTransactionData || transactionData;
    
    if (!contextData) {
      return `Mock ${format} value`;
    }
    
    // Check if this field should use nested transaction context
    const useNestedContext = field && field.useNestedContext;
    const hasNestedTransactionData = field && field.nestedTransactionData;
    
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
          // SIMPLE path resolution - just traverse the object structure
          let current = contextData.methodCall.params.find((p: any) => p.name === pathParts[0]);
          
          for (let i = 1; i < pathParts.length && current; i++) {
            const part = pathParts[i];
            
            // Numeric index - find in components array
            if (/^\d+$/.test(part)) {
              const idx = parseInt(part);
              if (current.components && current.components[idx]) {
                current = current.components[idx];
              } else {
                current = null;
              }
            }
            // Property name - find in components by name
            else {
              if (current.components) {
                current = current.components.find((c: any) => c.name === part);
              } else {
                // If no components but we have a value and this is the last part, we're done
                if (i === pathParts.length - 1 && current.name === part && current.value !== undefined) {
                  // We found the field we're looking for
                  break;
                } else {
                  current = null;
                }
              }
            }
          }
          
          value = current?.value;
          console.log(`Final value resolved for ${path}:`, value);
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

      if (value !== undefined) {
        console.log(`Formatting value for ${path}: ${value} with format: ${format}`);
        // Format the value based on the format type
        switch (format) {
          case "tokenAmount":
            const rawValue = value.toString();
            
            // For ETH (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE), format as ETH
            if (field?.params?.tokenPath === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
              const ethValue = (parseInt(rawValue) / Math.pow(10, 18)).toString();
              return `${ethValue} ETH`;
            }
            
            // If field has tokenPath, find matching metadata with token info
            if (field?.params?.tokenPath) {
              const tokenAddress = field.params.tokenPath;
              
              const tokenMetadata = metadataEntries.find(entry => 
                entry.metadata.context?.contract?.deployments?.some(dep => 
                  dep.address === tokenAddress
                )
              );
              
              if (tokenMetadata?.metadata?.metadata?.token?.decimals) {
                const decimals = tokenMetadata.metadata.metadata.token.decimals;
                const ticker = tokenMetadata.metadata.metadata.token.ticker;
                const formattedAmount = (parseInt(rawValue) / Math.pow(10, decimals)).toString();
                return `${formattedAmount} ${ticker}`;
              }
            }
            
            return rawValue;
          case "addressName":
            const addressValue = value.toString();
            if (addressValue.startsWith('0x') && addressValue.length === 42) {
              return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
            }
            return addressValue;
          case "amount":
            if (value === "0") return "0";
            // For Aave repay operations, try to get token info from addressesMeta
            const rawAmount = value.toString();
            if (transactionData?.addressesMeta && transactionData.methodCall?.params) {
              // Find the asset parameter to get token info
              const assetParam = transactionData.methodCall.params.find((p: any) => p.name === 'asset');
              if (assetParam && transactionData.addressesMeta[assetParam.value]) {
                const tokenMeta = transactionData.addressesMeta[assetParam.value];
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
      console.error('Error processing path:', path, error);
    }

    const mockValue = `Mock ${format} value`;
    console.log(`Returning mock value for ${path}: ${mockValue}`);
    return mockValue;
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
    
    
    const operations: Array<{operation: Operation, metadata: any, context: string, nestedData?: any}> = [];
    
    // Check if current transaction has an operation that matches metadata
    const currentSelector = getTransactionFunctionSelector(transactionData);
    if (currentSelector) {
      for (const entry of metadataEntries) {
        const formats = entry.metadata.display?.formats;
        if (formats && formats[currentSelector]) {
          operations.push({
            operation: formats[currentSelector],
            metadata: entry.metadata.metadata,
            context: 'main'
          });
          break;
        }
      }
    }
    
    // Look specifically for nested operations in the transaction data
    if (transactionData.methodCall?.params) {
      // Handle multiSend transactions 
      if (transactionData.methodCall.name === 'multiSend') {
        const transactionsParam = transactionData.methodCall.params.find((p: any) => p.name === 'transactions' && p.valueDecoded);
        if (transactionsParam && transactionsParam.valueDecoded && transactionsParam.valueDecoded.params) {
          // The actual transactions are in params[0].components
          const txComponents = transactionsParam.valueDecoded.params[0]?.components;
          if (txComponents && Array.isArray(txComponents)) {
            
            // Process each transaction component
            txComponents.forEach((txComponent: any, index: number) => {
              // Each component is a tuple with nested valueDecoded containing execTransaction
              const execTxData = txComponent.components?.find((comp: any) => comp.name === 'data' && comp.valueDecoded);
              if (execTxData && execTxData.valueDecoded && execTxData.valueDecoded.name === 'execTransaction') {
                // Look for the nested transfer call within the execTransaction data
                const dataParam = execTxData.valueDecoded.params?.find((p: any) => p.name === 'data' && p.valueDecoded);
                if (dataParam && dataParam.valueDecoded && dataParam.valueDecoded.name === 'transfer') {
                  const transferData = dataParam.valueDecoded;
                  const nestedSelector = `${transferData.name}(${transferData.params?.map((p: any) => p.type).join(',') || ''})`;
                  
                  // Find matching metadata for this transfer
                  for (const entry of metadataEntries) {
                    if (entry.metadata.display?.formats?.[nestedSelector]) {
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
          
          // Check if we have metadata for this nested operation
          const nestedSelector = (nestedTx as any).signature || nestedTx.name;
          
          if (nestedSelector) {
            for (const entry of metadataEntries) {
              const formats = entry.metadata.display?.formats;
              if (formats) {
                // Check for exact match first
                if (formats[nestedSelector]) {
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
      } else if (transactionData) {
        displayValue = getFieldValueFromTransaction(path, format || "raw", displayItem);
        console.log(`${label}: path=${path}, displayValue=${displayValue}`);
      } else {
        displayValue = hasFormat && format ? `Mock ${format} value` : "displayValue";
        console.log(`${label}: using mock because no transactionData`);
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

  const renderHardwareUI = () => {
    // Get all operations for this transaction (including nested)
    const allOperations = activeTab === "advanced" && transactionData ? getAllOperationsForTransaction(transactionData) : [];
    
    
    // For Safe transactions with nested operations, show the proper flow
    if (allOperations.length > 1) {
      const mainOperation = allOperations.find(op => op.context === 'main');
      const nestedOperations = allOperations.filter(op => op.context !== 'main');
      
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
              <div className="mx-auto flex flex-row items-center gap-2 p-2 max-w-full overflow-x-auto">
                <div className="flex flex-row items-center gap-2 min-w-0">
                  {allScreens.map((_, index) => (
                    <div
                      key={"carousel-thumbnail-" + index}
                      className={cn("flex-shrink-0 w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                        "ring-2": index === selected,
                      })}
                      onClick={() => api?.scrollTo(index)}
                    >
                      <Device.Frame size="small">{index + 1}</Device.Frame>
                    </div>
                  ))}
                </div>
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
          <div className="mx-auto flex flex-row items-center gap-2 p-2 max-w-full overflow-x-auto">
            <div className="flex flex-row items-center gap-2 min-w-0">
              {fullOperationScreens.map((_, index) => (
                <div
                  key={"carousel-thumbnail-" + index}
                  className={cn("flex-shrink-0 w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                    "ring-2": index === selected,
                  })}
                  onClick={() => api?.scrollTo(index)}
                >
                  <Device.Frame size="small">{index + 1}</Device.Frame>
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      }
    }
    
    // Fallback to single operation display
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
        <div className="mx-auto flex flex-row items-center gap-2 p-2 max-w-full overflow-x-auto">
          <div className="flex flex-row items-center gap-2 min-w-0">
            {fullOperationScreens.map((_, index) => (
              <div
                key={"carousel-thumbnail-" + index}
                className={cn("flex-shrink-0 w-fit rounded p-1 ring-primary hover:ring-2 cursor-pointer", {
                  "ring-2": index === selected,
                })}
                onClick={() => api?.scrollTo(index)}
              >
                <Device.Frame size="small">{index + 1}</Device.Frame>
              </div>
            ))}
          </div>
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
                    {sampleSets.length > 0 ? (
                      sampleSets.map((sampleSet) => (
                        <Button 
                          key={sampleSet.id}
                          onClick={() => loadSampleSet(sampleSet.id)} 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                        >
                          {sampleSet.name}
                        </Button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">
                        Loading sample sets... (Check /samples/sample-sets.json)
                      </div>
                    )}
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
                        setTransactionData(parsed);
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