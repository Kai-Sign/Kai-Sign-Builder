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

// Smart Path Resolver for automatic nesting detection
class SmartPathResolver {
  public pathMap: Map<string, any> = new Map();
  
  analyzeTransaction(transaction: any): void {
    this.pathMap.clear();
    if (!transaction.methodCall?.params) return;
    this.buildPathMap(transaction.methodCall.params, '', 0);
  }
  
  private buildPathMap(params: any[], parentPath: string, level: number): void {
    params.forEach((param) => {
      const currentPath = parentPath ? `${parentPath}.${param.name}` : param.name;
      const fullPath = `#.${currentPath}`;
      
      this.pathMap.set(fullPath, {
        path: fullPath,
        level,
        type: param.type,
        value: param.value,
        isArray: param.type?.includes('[]'),
        isTuple: !!param.components,
        hasDecoded: !!param.valueDecoded
      });
      
      if (param.components) {
        this.buildPathMap(param.components, currentPath, level + 1);
      }
      
      if (param.valueDecoded?.params) {
        const decodedPath = `${currentPath}.valueDecoded`;
        this.buildPathMap(param.valueDecoded.params, decodedPath, level + 1);
      }
    });
  }
  
  resolveMetadataPath(transaction: any, metadataPath: string): any {
    if (!this.pathMap.has(metadataPath)) {
      return undefined;
    }
    
    const pathWithoutRoot = metadataPath.substring(2);
    const pathParts = pathWithoutRoot.split('.');
    
    let current = transaction.methodCall?.params;
    if (!current) return undefined;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (part === 'valueDecoded') {
        if (current && current.valueDecoded) {
          current = current.valueDecoded.params;
          continue;
        }
        return undefined;
      }
      
      if (Array.isArray(current)) {
        const param = current.find((p: any) => p.name === part);
        if (!param) return undefined;
        
        if (i === pathParts.length - 1) {
          return param.value;
        }
        
        if (param.components) {
          current = param.components;
        } else {
          current = param;
        }
      } else {
        if (current[part] !== undefined) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }
    
    return current?.value !== undefined ? current.value : current;
  }
}

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
        
        if (entries.length > 0 && entries[0]) {
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
        type: data.methodCall.type,
        signature: data.methodCall.signature,
        params: data.methodCall.params || []
      } : undefined,
      transfers: data.transfers || [],
      addressesMeta: data.addressesMeta || {}
    };
  };

  // Function to get function selector from transaction data (ERC-7730 compliant)
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

  // ERC-7730 compliant function selector computation with Keccak-256
  const computeFunctionSelector = (signature: string): string => {
    // Note: In a real implementation, this would use keccak256 from ethers
    // For now, return the signature for matching since we don't have the hash in our test data
    return signature;
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

  // Sample decoded transaction data (Loop Decoder format)
  const sampleTransactionData = {
    txHash: "0x22a244794f155ce4a5765588353cf82dfc842c33ee3ed98e95ef488f6964f4fb",
    txType: "contract interaction",
    fromAddress: "0x049bdd0528e2d5f2e579e1bdd133Daed7c935DFC",
    toAddress: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
    contractName: "",
    contractType: "SAFE-PROXY",
    methodCall: {
      name: "execTransaction",
      type: "function",
      signature: "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)",
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
            signature: "transfer(address,uint256)",
            type: "function",
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
    transfers: [
      {
        type: "ERC20",
        name: "USD Coin",
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amount: "521.419831",
        to: "0xA1371748D65baEF4509A3c067b3fe3a1b79183aE",
        from: "0x6092722B33FcF90af6e99C93F5F9349473869e23"
      }
    ],
    addressesMeta: {
      "0x6092722B33FcF90af6e99C93F5F9349473869e23": {
        contractAddress: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
        contractName: "",
        tokenSymbol: "",
        decimals: null,
        type: "SAFE-PROXY",
        address: "0x6092722B33FcF90af6e99C93F5F9349473869e23",
        chainID: 1
      },
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        contractName: "USD Coin",
        tokenSymbol: "USDC",
        decimals: 6,
        type: "ERC20",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        chainID: 1
      }
    }
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

  // Auto-select matching operation when transaction data changes - METADATA-DRIVEN ONLY
  useEffect(() => {
    if (transactionData && selectedMetadataId) {
      const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
      if (selectedMetadata?.metadata.display?.formats) {
        const detectedSelector = getTransactionFunctionSelector(transactionData);
        
        const availableOperations = Object.keys(selectedMetadata.metadata.display.formats);
        
        // Exact signature match takes priority
        const exactMatch = availableOperations.find(op => op === detectedSelector);
        
        if (exactMatch) {
          setSelectedOperation(exactMatch);
        } else {
          // Function name match (without hardcoded assumptions)
          const txFunctionName = transactionData.methodCall?.name;
          if (txFunctionName) {
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
  }, [transactionData, selectedMetadataId, metadataEntries]);

  // ERC-7730 COMPLIANT PATH RESOLVER
  const resolveValueAtPath = (data: any, metadata: any, path: string): any => {
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
      
      if (current.valueDecoded?.params && part !== 'valueDecoded') {
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
  };

  // SMART PATH RESOLVER - Automatic nesting detection and metadata-driven translation
  const smartPathResolver = React.useMemo(() => {
    if (!transactionData) return null;
    
    const resolver = new SmartPathResolver();
    resolver.analyzeTransaction(transactionData);
    return resolver;
  }, [transactionData]);

  // ERC-7730 SMART FIELD VALUE EXTRACTION
  const getFieldValueFromTransaction = (path: string, format: string, field?: any): string => {
    if (!transactionData || !smartPathResolver) {
      return `Mock ${format} value`;
    }
    
    // Get metadata context for the current entry
    const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
    const metadata = selectedMetadata?.metadata || metadataEntries[0]?.metadata || {};
    
    // Handle nested context path resolution
    let resolvedPath = path;
    if (field?.functionCall?.level === 0) {
      // Level 0 (main transaction): use path directly
      resolvedPath = path;
    } else if (field?.functionCall?.level > 0 && field?.functionCall?.nestedPath) {
      // For nested operations, prefix the path with the nested context
      const pathWithoutHash = path.substring(2); // Remove '#.'
      resolvedPath = `${field.functionCall.nestedPath}.${pathWithoutHash}`;
      console.log(`🔗 Nested path mapping: ${path} → ${resolvedPath} (level ${field.functionCall.level})`);
    } else {
      // Fallback for level > 0 but no nested path
      resolvedPath = path;
    }
    
    // Use smart resolver to get value - only resolves if path exists in transaction
    const value = smartPathResolver.resolveMetadataPath(transactionData, resolvedPath);
    
    if (value === undefined) {
      // Path not available in transaction structure
      console.log(`❌ Path resolution failed: ${path} → ${resolvedPath} [MISSING]`);
      return "[unmapped]";
    }
    
    // Format the value based on the format type
    switch (format) {
      case "tokenAmount":
        const rawValue = value.toString();
        
        // Use metadata-defined token information only
        if (field?.params?.tokenPath) {
          const tokenAddress = field.params.tokenPath;
          
          const tokenMetadata = metadataEntries.find(entry => {
            const context = entry.metadata.context;
            if ('contract' in context && context.contract?.deployments) {
              return context.contract.deployments.some((dep: any) => 
                dep.address === tokenAddress
              );
            }
            return false;
          });
          
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
          // Check if we have metadata for this address
          if (transactionData?.addressesMeta && transactionData.addressesMeta[addressValue]) {
            const addressMeta = transactionData.addressesMeta[addressValue];
            return addressMeta.contractName || `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
          }
          return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
        }
        return addressValue;
        
      case "amount":
        if (value === "0" || value === 0) return "0";
        const rawAmount = value.toString();
        
        // Only format if metadata provides token information through field params
        if (field?.params?.tokenPath) {
          const tokenInfo = smartPathResolver.resolveMetadataPath(transactionData, field.params.tokenPath);
          if (tokenInfo && tokenInfo.decimals) {
            const decimals = tokenInfo.decimals;
            const formattedAmount = (parseInt(rawAmount) / Math.pow(10, decimals)).toString();
            return `${formattedAmount} ${tokenInfo.symbol || ''}`;
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



  // ERC-7730 COMPLIANT NESTED FUNCTION EXTRACTION
  const extractAllFunctionCalls = (data: any, path: string = '', level: number = 0): Array<{name: string, params: any[], signature: string, path: string, level: number, context: any}> => {
    const functionCalls: Array<{name: string, params: any[], signature: string, path: string, level: number, context: any}> = [];
    
    // Base case: if this looks like a function call
    if (data && typeof data === 'object' && data.name && data.params) {
      const paramTypes = Array.isArray(data.params) ? data.params.map((p: any) => {
        if (p.type === 'tuple' && p.components) {
          // For tuple types, generate the full signature with component types
          const componentTypes = p.components.map((c: any) => c.type).join(',');
          return `(${componentTypes})`;
        }
        return p.type;
      }).join(',') : '';
      const signature = `${data.name}(${paramTypes})`;
      
      functionCalls.push({
        name: data.name,
        params: data.params,
        signature: signature,
        path: path,
        level: level,
        context: data
      });
    }
    
    // Recursively search through all properties, focusing on common nested locations
    if (data && typeof data === 'object') {
      // Search in valueDecoded for nested function calls
      if (data.valueDecoded) {
        const newPath = path ? `${path}.valueDecoded` : 'valueDecoded';
        functionCalls.push(...extractAllFunctionCalls(data.valueDecoded, newPath, level + 1));
      }
      
      // Search in params array
      if (Array.isArray(data.params)) {
        data.params.forEach((param: any, index: number) => {
          // Use parameter name instead of positional index for Loop Decoder compatibility
          const paramName = param.name || `param${index}`;
          const newPath = path ? `${path}.${paramName}` : paramName;
          functionCalls.push(...extractAllFunctionCalls(param, newPath, level + 1));
        });
      }
      
      // Search in methodCall
      if (data.methodCall) {
        const newPath = path ? `${path}.methodCall` : 'methodCall';
        functionCalls.push(...extractAllFunctionCalls(data.methodCall, newPath, level + 1));
      }
    }
    
    return functionCalls;
  };

  // STRICT METADATA MATCHING - ONLY EXACT MATCHES
  const findMetadataForSignature = (signature: string): {metadata: any, operation: Operation} | null => {
    for (const entry of metadataEntries) {
      const formats = entry.metadata.display?.formats;
      if (formats) {
        // Exact signature match only
        if (formats[signature]) {
          return {
            metadata: entry.metadata.metadata,
            operation: formats[signature] as Operation
          };
        }
        
        // Function name match (only if no parentheses in format key)
        const functionName = signature.split('(')[0];
        const matchingFormat = Object.keys(formats).find(formatKey => {
          // Only match if the format key is exactly the function name (no signature)
          if (formatKey === functionName) {
            return true;
          }
          // Or if it's a full signature match
          if (formatKey === signature) {
            return true;
          }
          return false;
        });
        
        if (matchingFormat) {
          return {
            metadata: entry.metadata.metadata,
            operation: formats[matchingFormat] as Operation
          };
        }
      }
    }
    return null;
  };

  // METADATA-DRIVEN NESTED OPERATION DISCOVERY  
  const getAllOperationsForTransaction = (transactionData: DecodedTransaction | null): Array<{operation: Operation, metadata: any, context: string, functionCall: any, level: number}> => {
    if (!transactionData) return [];
    
    const operations: Array<{operation: Operation, metadata: any, context: string, functionCall: any, level: number}> = [];
    
    // Only extract function calls that have matching metadata
    const allFunctionCalls = extractAllFunctionCalls(transactionData);
    
    // Match each function call to metadata - only add if metadata exists
    for (const functionCall of allFunctionCalls) {
      const match = findMetadataForSignature(functionCall.signature);
      if (match) {
        // Add nested path information for path resolution
        // Adjust level: methodCall should be level 0
        const adjustedLevel = functionCall.path === 'methodCall' ? 0 : functionCall.level;
        
        // Construct proper nested path
        let nestedPath = null;
        if (adjustedLevel > 0) {
          // Remove 'methodCall.' prefix and construct proper path
          const cleanPath = functionCall.path.replace(/^methodCall\./, '');
          nestedPath = `#.${cleanPath}`;
        }
        
        const enhancedFunctionCall = {
          ...functionCall.context,
          level: adjustedLevel,
          nestedPath: nestedPath
        };
        
        console.log(`🔧 Operation: ${functionCall.name}, Level: ${adjustedLevel}, Path: ${functionCall.path}, NestedPath: ${nestedPath}`);
        
        operations.push({
          operation: match.operation,
          metadata: match.metadata,
          context: functionCall.level === 0 ? 'main' : 'nested',
          functionCall: enhancedFunctionCall,
          level: functionCall.level
        });
      }
    }
    
    return operations;
  };

  // Enhanced getScreensForOperation that uses smart path resolver
  const getScreensForOperationWithRealData = (operation: Operation) => {
    const displays = operation.fields.filter((field) => {
      const label = field && "label" in field ? field.label : undefined;
      return !(label === undefined || label === null || label === "");
    });

    const ITEM_PER_SCREEN = 4;
    const screens: Array<Array<{label: string; isActive?: boolean; displayValue: string}>> = [];
    let screen: Array<{label: string; isActive?: boolean; displayValue: string}> = [];

    // Log smart resolver analysis if available
    if (smartPathResolver && transactionData) {
      const pathMap = Array.from(smartPathResolver.pathMap.entries());
      console.log('📊 Smart Resolver Analysis:');
      console.log(`  Total available paths: ${pathMap.length}`);
      console.log('  Available paths:', pathMap.map(([path]) => path));
      
      // Validate metadata paths
      const metadataPaths = operation.fields.map(f => f.path).filter(Boolean);
      const validPaths = metadataPaths.filter(path => smartPathResolver.pathMap.has(path));
      const invalidPaths = metadataPaths.filter(path => !smartPathResolver.pathMap.has(path));
      
      console.log(`  ✅ Valid metadata paths (${validPaths.length}):`, validPaths);
      if (invalidPaths.length > 0) {
        console.log(`  ❌ Invalid metadata paths (${invalidPaths.length}):`, invalidPaths);
      }
    }

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
      } else if (transactionData && smartPathResolver) {
        const pathExists = smartPathResolver.pathMap.has(path);
        displayValue = getFieldValueFromTransaction(path, format || "raw", displayItem);
        console.log(`🔍 ${label}: path=${path} → ${displayValue} [${pathExists ? 'EXISTS' : 'MISSING'}]`);
      } else {
        displayValue = hasFormat && format ? `Mock ${format} value` : "displayValue";
        console.log(`🎭 ${label}: using mock because no transactionData or resolver`);
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
    
    console.log(`Found ${allOperations.length} operations:`, allOperations.map(op => `${op.context}:${op.functionCall.name} (level ${op.level})`));
    
    // METADATA-DRIVEN MULTI-OPERATION HANDLING
    if (allOperations.length > 1) {
      // Sort operations by nesting level (main first, then by level)
      const sortedOperations = allOperations.sort((a, b) => a.level - b.level);
      
      // Generate screens for ALL operations at all nesting levels
      const allScreensFromAllOperations: any[] = [];
      
      sortedOperations.forEach((operation, opIndex) => {
        if (operation.operation) {
          console.log(`🎬 Generating screens for operation ${opIndex + 1}/${sortedOperations.length}: ${operation.functionCall.name} (level ${operation.level})`);
          
          // Create operation with function call context for proper path resolution
          const contextualOperation = {
            ...operation.operation,
            fields: operation.operation.fields.map(field => ({
              ...field,
              functionCall: operation.functionCall
            }))
          };
          
          console.log(`🔧 Fields for ${operation.functionCall.name}:`, contextualOperation.fields.map(f => f.path));
          
          const screens = getScreensForOperationWithRealData(contextualOperation);
          console.log(`📺 Generated ${screens.length} screens for ${operation.functionCall.name}`);
          
          // Build operation name from metadata intent or function name
          const operationName = typeof operation.operation.intent === 'string' 
            ? operation.operation.intent 
            : operation.functionCall.name;
          
          const operationMeta = {
            operationName: `${operationName} (Level ${operation.level})`,
            metadata: operation.metadata
          };
          
          // Add operation screens with level context
          const operationScreens_local = operationScreens(screens, operationMeta);
          console.log(`✅ Added ${operationScreens_local.length} screens from ${operationName} to carousel`);
          allScreensFromAllOperations.push(...operationScreens_local);
        }
      });
      
      if (allScreensFromAllOperations.length > 0) {
        return (
          <div className="mx-auto flex max-w-96 flex-col">
            <div className="text-center text-sm text-gray-600 mb-4">
              Multi-Level Transaction ({sortedOperations.length} operations)
            </div>
            <Carousel setApi={setApi}>
              <CarouselContent>
                {allScreensFromAllOperations.map((screen, index) => (
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
                {allScreensFromAllOperations.map((_, index) => (
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
    
    // Single operation display
    if (allOperations.length === 1) {
      const operation = allOperations[0];
      if (operation) {
        // Create operation with function call context for proper path resolution
        const contextualOperation = {
          ...operation.operation,
          fields: operation.operation.fields.map(field => ({
            ...field,
            functionCall: operation.functionCall
          }))
        };
        
        const screens = getScreensForOperationWithRealData(contextualOperation);
        const operationMeta = {
          operationName: typeof operation.operation.intent === 'string' ? operation.operation.intent : operation.functionCall.name,
          metadata: operation.metadata
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
                          
                          return Object.keys(selectedMetadata.metadata.display.formats)
                            .filter(operationName => {
                              // Filter operations based on transaction data
                              return operationMatchesTransaction(operationName, transactionData);
                            })
                            .map((operationName) => {
                              const isExactMatch = detectedSelector === operationName;
                              
                              return (
                                <SelectItem 
                                  key={operationName} 
                                  value={operationName}
                                >
                                  {operationName} 
                                  {isExactMatch ? " ✓" : ""}
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

// Export functions for CLI usage
export function resolveValueAtPathExport(data: any, metadata: any, path: string): any {
  if (!data || !path) return undefined;
  
  if (path === "separator") return "";
  
  // Parse root node and path according to ERC-7730 spec
  const rootNode = path.charAt(0); // #, $, or @
  if (!["#", "$", "@"].includes(rootNode)) {
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
          if (current.methodCall && current.methodCall.params && Array.isArray(current.methodCall.params)) {
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
    if (part === 'params' && current.methodCall && current.methodCall.params) {
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
  return current && current.value !== undefined ? current.value : current;
}

export function getFieldValueFromTransactionExport(path: string, format: string, transactionData: any, metadata: any = {}): string {
  if (!transactionData) {
    return `Mock ${format} value`;
  }

  try {
    // ERC-7730 compliant path resolution
    const value = resolveValueAtPathExport(transactionData, metadata, path);
    
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

export default HardwareViewer; 