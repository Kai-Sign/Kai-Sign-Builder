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

const HardwareViewer = () => {
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

  const sampleUSDCMetadata = {
    "$schema": "https://schemas.ledger.com/erc7730/1.0.0",
    "context": {
      "contract": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "chainId": 1
      }
    },
    "metadata": {
      "owner": "Circle",
      "info": {
        "url": "https://circle.com",
        "legalName": "Circle"
      }
    },
    "display": {
      "formats": {
        "transfer": {
          "intent": "Transfer USDC",
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
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        contractName: "USD Coin",
        tokenSymbol: "USDC",
        decimals: 6,
        type: "ERC20"
      }
    }
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

  const loadSampleMultiMetadata = () => {
    setMetadataEntries([
      {
        id: "safe",
        name: "Safe Contract",
        metadata: sampleSafeMetadata as unknown as Erc7730
      },
      {
        id: "usdc",
        name: "USDC Token",
        metadata: sampleUSDCMetadata as unknown as Erc7730
      }
    ]);
    setTransactionData(sampleTransactionData);
    setSelectedMetadataId("safe");
    setSelectedOperation("execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)");
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

  // Get the actual field value from decoded transaction data
  const getFieldValueFromTransaction = (path: string, format: string): string => {
    if (!transactionData) {
      return `Mock ${format} value`;
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
      let value: any = transactionData;
      
      if (transactionData.methodCall && transactionData.methodCall.params) {
        if (isDirectParam) {
          // Direct parameter access for ERC7730 format (e.g., "#.to", "#.value", "#.operation")
          const param = transactionData.methodCall.params.find((p: any) => p.name === pathParts[0]);
          if (param) {
            value = param.value;
            
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
            value = undefined;
          }
        } else {
          // Legacy path format - try inner decoded transaction first for USDC transfers
          const dataParam = transactionData.methodCall.params.find((p: any) => p.name === 'data' && p.valueDecoded);
          
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
              const rootParam = transactionData.methodCall.params.find((p: any) => p.name === pathParts[0]);
              if (rootParam) {
                value = rootParam.value || rootParam;
              } else {
                value = undefined;
              }
            }
          } else {
            // No inner decoded transaction, use outer parameters
            const rootParam = transactionData.methodCall.params.find((p: any) => p.name === pathParts[0]);
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
                 // Format the value based on the format type
         switch (format) {
           case "tokenAmount":
             if (transactionData.transfers && transactionData.transfers.length > 0) {
               const transfer = transactionData.transfers[0];
               if (transfer) {
                 return `${transfer.amount} ${transfer.symbol}`;
               }
             }
             // Fallback: format raw value with decimals if available
             const rawValue = value.toString();
             if (transactionData.addressesMeta) {
               // Try to find token info for decimal conversion
               for (const [address, meta] of Object.entries(transactionData.addressesMeta)) {
                 if (meta.type === "ERC20" && meta.decimals) {
                   const decimals = meta.decimals;
                   const formattedAmount = (parseInt(rawValue) / Math.pow(10, decimals)).toString();
                   return `${formattedAmount} ${meta.tokenSymbol}`;
                 }
               }
             }
             return rawValue;
           case "addressName":
             const addressValue = value.toString();
             if (transactionData.addressesMeta && transactionData.addressesMeta[addressValue]) {
               const meta = transactionData.addressesMeta[addressValue];
               if (meta) {
                 return meta.contractName || meta.tokenSymbol || addressValue;
               }
             }
             // For addresses not in metadata, show shortened format
             if (addressValue.startsWith('0x') && addressValue.length === 42) {
               return `${addressValue.slice(0, 6)}...${addressValue.slice(-4)}`;
             }
             return addressValue;
           case "amount":
             if (value === "0") return "0 ETH";
             return value.toString();
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
      
      // Check if we're trying to view a token operation
      const isTokenOperation = selectedOperation === "transfer" || selectedOperation.includes("transfer");
      
      if (isTokenOperation) {
        // For token operations, we must have a Safe execTransaction first
        const safeMetadata = metadataEntries.find(entry => {
          const formats = entry.metadata.display?.formats;
          return formats && Object.keys(formats).some(key => key.includes("execTransaction"));
        });
        
        if (!safeMetadata) {
          return null; // No Safe metadata found, cannot show token operation
        }
        
        // Check if transaction data has execTransaction with inner decoded data
        if (!transactionData?.methodCall?.name?.includes("execTransaction")) {
          return null; // Not a Safe execTransaction
        }
        
        // Check if there's inner decoded data matching the token operation
        const dataParam = transactionData.methodCall.params?.find((p: any) => p.name === 'data' && p.valueDecoded);
        if (!dataParam?.valueDecoded?.name?.includes("transfer")) {
          return null; // No inner transfer operation
        }
      }
      
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
      
      const displayValue = activeTab === "advanced" && transactionData
        ? getFieldValueFromTransaction(path, format || "raw")
        : (hasFormat && format
          ? `Mock ${format} value`
          : "displayValue");

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
    if (!operation || !operationMetadata) {
      // Enhanced error messaging for multi-metadata mode
      if (activeTab === "advanced" && selectedMetadataId && selectedOperation) {
        const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
        const isTokenOperation = selectedOperation === "transfer" || selectedOperation.includes("transfer");
        
        if (isTokenOperation && selectedMetadata) {
          const safeMetadataExists = metadataEntries.some(entry => {
            const formats = entry.metadata.display?.formats;
            return formats && Object.keys(formats).some(key => key.includes("execTransaction"));
          });
          
          if (!safeMetadataExists) {
            return (
              <div className="text-center text-red-500 py-8">
                <div className="font-medium mb-2">Cannot display token operation</div>
                <div className="text-sm">
                  Token operations like "{selectedOperation}" can only be viewed when there's a Safe contract metadata with "execTransaction" operation.
                  <br /><br />
                  Please add Safe metadata first, then view token operations as inner transactions.
                </div>
              </div>
            );
          }
          
          if (!transactionData?.methodCall?.name?.includes("execTransaction")) {
            return (
              <div className="text-center text-orange-500 py-8">
                <div className="font-medium mb-2">Invalid transaction structure</div>
                <div className="text-sm">
                  The transaction data must contain an "execTransaction" method call to view token operations.
                  <br /><br />
                  Current transaction: {transactionData?.methodCall?.name || "None"}
                </div>
              </div>
            );
          }
          
          const dataParam = transactionData.methodCall.params?.find((p: any) => p.name === 'data' && p.valueDecoded);
          if (!dataParam?.valueDecoded?.name?.includes("transfer")) {
            return (
              <div className="text-center text-orange-500 py-8">
                <div className="font-medium mb-2">No inner token operation found</div>
                <div className="text-sm">
                  The Safe transaction's "data" parameter must contain a decoded "{selectedOperation}" operation.
                  <br /><br />
                  Current inner operation: {dataParam?.valueDecoded?.name || "None"}
                </div>
              </div>
            );
          }
        }
      }
      
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
                  <Button onClick={addMetadataEntry} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Metadata
                  </Button>
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
                  <Label>Transaction Data (Decoded)</Label>
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

                <Button onClick={loadSampleMultiMetadata} variant="outline" className="w-full">
                  <FileJson className="h-4 w-4 mr-2" />
                  Load Sample Safe + USDC Transaction
                </Button>

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
                    <Label>Select Operation</Label>
                    <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an operation to view" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const selectedMetadata = metadataEntries.find(entry => entry.id === selectedMetadataId);
                          if (!selectedMetadata?.metadata.display?.formats) return null;
                          
                          // Check if Safe metadata exists
                          const safeMetadataExists = metadataEntries.some(entry => {
                            const formats = entry.metadata.display?.formats;
                            return formats && Object.keys(formats).some(key => key.includes("execTransaction"));
                          });
                          
                          return Object.keys(selectedMetadata.metadata.display.formats).map((operationName) => {
                            const isTokenOperation = operationName === "transfer" || operationName.includes("transfer");
                            const isDisabled = isTokenOperation && !safeMetadataExists;
                            
                            return (
                              <SelectItem 
                                key={operationName} 
                                value={operationName}
                                disabled={isDisabled}
                              >
                                {operationName} {isDisabled ? "(Requires Safe metadata)" : ""}
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
                (Using Real Transaction Data)
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