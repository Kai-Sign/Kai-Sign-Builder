"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Eye, Upload, AlertCircle, Plus, Trash2 } from "lucide-react";
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
      components?: Array<{
        name: string;
        type: string;
        value: string;
      }>;
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
      } else if (sampleSet.transactionFile) {
        // Load external transaction file
        console.log("Loading transaction file:", sampleSet.transactionFile);
        const response = await fetch(`${samplesBasePath}/${sampleSet.transactionFile}`);
        if (response.ok) {
          const txData = await response.json();
          console.log("Loaded transaction data:", txData);
          const normalizedTxData = normalizeTransactionData(txData);
          setTransactionData(normalizedTxData);
          setActiveTab("advanced");
        } else {
          console.error("Failed to load transaction file:", sampleSet.transactionFile);
        }
        
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
    
    // Use the actual signature from transaction if available, otherwise build it
    if (transactionData.methodCall.signature) {
      return transactionData.methodCall.signature;
    }
    
    // Fallback: build function signature from parameter types with tuple expansion
    const expandTupleType = (param: any): string => {
      if (param.type === 'tuple' && param.components) {
        console.log(`   🔍 Expanding tuple with ${param.components.length} components:`, param.components.map((c: any) => c.type));
        const componentTypes = param.components.map(expandTupleType).join(',');
        return `(${componentTypes})`;
      }
      return param.type;
    };
    
    const paramTypes = params.map(expandTupleType).join(',');
    const functionSignature = `${functionName}(${paramTypes})`;
    console.log(`   🎯 Built signature: ${functionSignature}`);
    
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



  const addMetadataEntry = () => {
    const newId = `metadata-${Date.now()}`;
    setMetadataEntries([...metadataEntries, {
      id: newId,
      name: `Metadata ${metadataEntries.length + 1}`,
      metadata: {} as unknown as Erc7730
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

  // Dynamic metadata loading based on contract addresses
  useEffect(() => {
    if (!transactionData) return;
    
    // Extract contract addresses from transaction
    const extractContractAddresses = (data: any): string[] => {
      const addresses: string[] = [];
      
      const traverse = (obj: any, depth: number = 0) => {
        if (obj && typeof obj === 'object' && depth < 20) {
          // Look for direct target property
          if (obj.target && typeof obj.target === 'string' && obj.target.startsWith('0x')) {
            addresses.push(obj.target.toLowerCase());
          }
          
          // Look for target parameters (the real pattern in batch transactions)
          if (obj.name === 'target' && obj.value && typeof obj.value === 'string' && obj.value.startsWith('0x')) {
            console.log(`   📍 Found target param: ${obj.value}`);
            addresses.push(obj.value.toLowerCase());
          }
          
          if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, depth + 1));
          } else {
            Object.values(obj).forEach(value => traverse(value, depth + 1));
          }
        }
      };
      
      traverse(data);
      return [...new Set(addresses)];
    };

    const contractAddresses = extractContractAddresses(transactionData);
    
    // Load metadata for addresses not already loaded
    contractAddresses.forEach(address => {
      const isAlreadyLoaded = metadataEntries.some(entry => 
        (entry.metadata.context as any)?.contract?.deployments?.some(
          (deployment: any) => deployment.address?.toLowerCase() === address.toLowerCase()
        )
      );
      
      if (!isAlreadyLoaded) {
        console.log(`📥 Loading metadata for contract: ${address}`);
        fetch(`/erc7730/${address.toLowerCase()}.json`)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error(`No metadata found for ${address}`);
          })
          .then(contractMetadata => {
            console.log(`✅ Loaded metadata for ${address}`);
            
            const newMetadataEntry = {
              id: `contract-${address.toLowerCase()}`,
              name: `Contract ${address.slice(0, 6)}...${address.slice(-4)}`,
              metadata: contractMetadata as unknown as Erc7730
            };
            
            setMetadataEntries(prev => [...prev, newMetadataEntry]);
          })
          .catch(error => {
            console.log(`❌ Error loading metadata for ${address}:`, error.message);
          });
      }
    });
  }, [transactionData, metadataEntries]);




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




  // LEVEL-BASED METADATA MAPPING - NO HARDCODED NESTING
  const getAllOperationsForTransaction = (transactionData: DecodedTransaction | null): Array<{operation: Operation, metadata: any, context: string, functionCall: any, level: number}> => {
    if (!transactionData) return [];
    
    console.log('🎯 LEVEL-BASED METADATA MAPPING');
    console.log(`📋 Available metadata entries: ${metadataEntries.length}`);
    metadataEntries.forEach(entry => {
      console.log(`   - ${entry.name}: ${Object.keys(entry.metadata.display?.formats || {}).length} formats`);
    });
    
    const operations: Array<{operation: Operation, metadata: any, context: string, functionCall: any, level: number}> = [];
    
    // Extract ALL function calls from ANYWHERE in the transaction structure
    const extractFunctionCallsWithLevels = (data: any, level: number = 0, path: string = ''): Array<{name: string, signature: string, level: number, data: any, params: any[]}> => {
      const calls: Array<{name: string, signature: string, level: number, data: any, params: any[]}> = [];
      
      // Recursively find ALL function calls in the transaction
      const findAllFunctionCalls = (obj: any, currentLevel: number = 0, currentPath: string = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        // Check if this object represents a function call
        if (obj.name && obj.params) {
          let signature;
          if (obj.signature) {
            signature = obj.signature;
          } else {
            // Build signature from name and params
            const expandTupleType = (param: any): string => {
              if (param.type === 'tuple' && param.components) {
                const componentTypes = param.components.map(expandTupleType).join(',');
                return `(${componentTypes})`;
              }
              return param.type;
            };
            
            const paramTypes = obj.params.map(expandTupleType).join(',');
            signature = `${obj.name}(${paramTypes})`;
          }
          
          console.log(`   🔍 Found function call: ${obj.name} at level ${currentLevel} (${currentPath})`);
          
          calls.push({
            name: obj.name,
            signature: signature,
            level: currentLevel,
            data: obj,
            params: obj.params || []
          });
        }
        
        // Recursively traverse all properties
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => findAllFunctionCalls(item, currentLevel, `${currentPath}[${index}]`));
        } else {
          Object.entries(obj).forEach(([key, value]) => {
            // Increase level when we go into valueDecoded (nested function calls)
            const nextLevel = key === 'valueDecoded' ? currentLevel + 1 : currentLevel;
            if (key === 'valueDecoded') {
              console.log(`   🔄 Entering valueDecoded at level ${currentLevel} → ${nextLevel} (${currentPath}.${key})`);
            }
            findAllFunctionCalls(value, nextLevel, `${currentPath}.${key}`);
          });
        }
      };
      
      findAllFunctionCalls(data, level, path);
      return calls;
    };
    
    const allFunctionCalls = extractFunctionCallsWithLevels(transactionData);
    
    // Keep all function calls including batch duplicates - DO NOT deduplicate
    const uniqueFunctionCalls = allFunctionCalls;
    
    console.log(`   Found ${allFunctionCalls.length} functions at levels: ${[...new Set(uniqueFunctionCalls.map(f => f.level))].join(', ')}`);
    
    // Find metadata for each function call based on level
    uniqueFunctionCalls.forEach((functionCall) => {
      // Find metadata for this level - allow reuse across levels
      let levelMetadata = metadataEntries.filter(entry => {
        // Primary assignment: metadata index matches level
        const metadataLevel = metadataEntries.indexOf(entry);
        return metadataLevel === functionCall.level;
      });
      
      // If no metadata at this level, allow reusing any available metadata
      if (levelMetadata.length === 0) {
        console.log(`   🔄 No metadata at level ${functionCall.level}, checking all available metadata for reuse`);
        levelMetadata = metadataEntries;
      }
      
      let matchedMetadata = null;
      let matchedOperation = null;
      
      console.log(`   🔍 Checking ${levelMetadata.length} metadata entries for signature: ${functionCall.signature}`);
      
      for (const metadataEntry of levelMetadata) {
        const formats = metadataEntry.metadata.display?.formats;
        if (!formats) {
          console.log(`   ❌ No formats in metadata: ${metadataEntry.name || 'unnamed'}`);
          continue;
        }
        
        console.log(`   🔍 Checking metadata "${metadataEntry.name}" with formats:`, Object.keys(formats));
        
        // Exact signature match
        if (formats[functionCall.signature]) {
          console.log(`   ✅ Exact signature match found!`);
          matchedMetadata = metadataEntry.metadata;
          matchedOperation = formats[functionCall.signature];
          break;
        }
        
        // Function name match
        if (formats[functionCall.name]) {
          console.log(`   ✅ Function name match found!`);
          matchedMetadata = metadataEntry.metadata;
          matchedOperation = formats[functionCall.name];
          break;
        }
        
        console.log(`   ❌ No match in this metadata`);
      }
      
      if (matchedMetadata && matchedOperation) {
        console.log(`   ✅ L${functionCall.level}: ${functionCall.signature} → ${matchedOperation.intent || functionCall.name}`);
        
        // Resolve field values for this specific function context
        const resolvedFields = matchedOperation.fields.map((field: any) => {
          let resolvedValue = undefined;
          
          console.log(`🔍 Resolving field: ${field.label} → ${field.path}`);
          
          if (field.value !== undefined) {
            resolvedValue = field.value;
            console.log(`   ✅ Static value: ${resolvedValue}`);
          } else if (field.path) {
            if (field.path.startsWith('#.')) {
              // Resolve path in function context
              const pathParts = field.path.substring(2).split('.');
              let current = functionCall.params;
              
              console.log(`   🎯 Path parts: ${pathParts.join(' → ')}`);
              console.log(`   📊 Function params:`, functionCall.params?.map((p: any) => `${p.name}:${p.type}`));
              
              for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const nextPart = pathParts[i + 1];
                
                if (!current) break;
                
                // LEVEL BOUNDARY CHECK: Check if we can navigate to valueDecoded
                if (part === 'valueDecoded') {
                  // Extract all operation names from the transaction data dynamically
                  const findOperationNames = (data: any): string[] => {
                    const operations: string[] = [];
                    
                    const traverse = (obj: any) => {
                      if (obj && typeof obj === 'object') {
                        if (obj.valueDecoded?.name) {
                          operations.push(obj.valueDecoded.name);
                        }
                        if (obj.methodCall?.name) {
                          operations.push(obj.methodCall.name);
                        }
                        
                        // Recursively traverse
                        if (Array.isArray(obj)) {
                          obj.forEach(traverse);
                        } else {
                          Object.values(obj).forEach(traverse);
                        }
                      }
                    };
                    
                    traverse(data);
                    return [...new Set(operations)]; // Remove duplicates
                  };
                  
                  const transactionOperations = findOperationNames(transactionData);
                  console.log(`   🔍 Found operations in transaction: ${transactionOperations.join(', ')}`);
                  
                  // Extract contract addresses from nested calls
                  const extractContractAddresses = (data: any): string[] => {
                    const addresses: string[] = [];
                    
                    const traverse = (obj: any, depth: number = 0) => {
                      if (obj && typeof obj === 'object' && depth < 20) { // Prevent infinite recursion
                        // Look for direct target property
                        if (obj.target && typeof obj.target === 'string' && obj.target.startsWith('0x')) {
                          console.log(`   📍 Found contract address: ${obj.target}`);
                          addresses.push(obj.target.toLowerCase());
                        }
                        
                        // Look for target parameters (the real pattern in batch transactions)
                        if (obj.name === 'target' && obj.value && typeof obj.value === 'string' && obj.value.startsWith('0x')) {
                          console.log(`   📍 Found target param: ${obj.value}`);
                          addresses.push(obj.value.toLowerCase());
                        }
                        
                        // Recursively traverse all properties
                        if (Array.isArray(obj)) {
                          obj.forEach(item => traverse(item, depth + 1));
                        } else {
                          Object.values(obj).forEach(value => traverse(value, depth + 1));
                        }
                      }
                    };
                    
                    traverse(data);
                    const uniqueAddresses = [...new Set(addresses)]; // Remove duplicates
                    console.log(`   🎯 Extracted ${uniqueAddresses.length} unique contract addresses: ${uniqueAddresses.join(', ')}`);
                    return uniqueAddresses;
                  };
                  
                  const contractAddresses = extractContractAddresses(transactionData);
                  console.log(`   🔍 Found contract addresses: ${contractAddresses.join(', ')}`);
                  
                  // Note: Metadata loading moved to separate useEffect to prevent infinite loops
                  
                  // Check if any metadata has formats for the detected operations
                  const hasNestedMetadata = metadataEntries.some(entry => {
                    const formats = entry.metadata.display?.formats;
                    if (!formats) return false;
                    
                    // Check if any format key contains the detected operations
                    return Object.keys(formats).some(formatKey => 
                      transactionOperations.some(operation => 
                        formatKey.includes(operation)
                      )
                    );
                  }) || contractAddresses.length > 0; // Allow if we have contract addresses to load
                  
                  if (!hasNestedMetadata) {
                    console.log(`   🚫 Level boundary: valueDecoded requires metadata for operations [${transactionOperations.join(', ')}] or contract addresses [${contractAddresses.join(', ')}] (not available) - keeping hex value`);
                    // Keep current value (the hex) instead of setting to undefined
                    break;
                  } else {
                    console.log(`   ✅ Level boundary: Found reusable metadata for operations [${transactionOperations.join(', ')}] or can load for contracts [${contractAddresses.join(', ')}]`);
                    // Continue processing valueDecoded
                  }
                }
                
                if (Array.isArray(current)) {
                  const param = current.find((p: any) => p?.name === part);
                  if (param) {
                    // Special handling for ERC-4337 nested tuples (ops.ops pattern)
                    if (param.name === 'ops' && param.type === 'tuple' && param.components && param.components.length === 1 && param.components[0]?.name === 'ops') {
                      // This is the outer 'ops' parameter, navigate to the inner 'ops' in components
                      current = param.components;
                      console.log(`   ✅ Found nested tuple param ${part}, navigating to components → ${current?.length} items`);
                    } else if (param.components && param.type === 'tuple') {
                      // Regular tuple - use components
                      current = param.components;
                      console.log(`   ✅ Found tuple param ${part}, using components → ${current?.length} items`);
                    } else {
                      // Check if next part is valueDecoded - if so, keep param object, otherwise use value
                      if (nextPart === 'valueDecoded') {
                        current = param;
                        console.log(`   ✅ Found param ${part} → keeping param object for valueDecoded access`);
                      } else {
                        current = param.value !== undefined ? param.value : param;
                        console.log(`   ✅ Found param ${part} → ${current}`);
                      }
                    }
                  } else {
                    console.log(`   ❌ Param ${part} not found in:`, Array.isArray(current) ? current.map((p: any) => p?.name) : 'not an array');
                    current = null as any;
                    break;
                  }
                } else if (current && typeof current === 'object' && current[part] !== undefined) {
                  current = current[part];
                  console.log(`   ✅ Found property ${part} → ${current}`);
                } else {
                  console.log(`   ❌ Property ${part} not found in:`, current && typeof current === 'object' ? Object.keys(current) : 'not an object');
                  current = null as any;
                  break;
                }
              }
              
              resolvedValue = current;
            } else if (field.path.startsWith('@.')) {
              // Transaction metadata paths
              console.log(`   🎯 Transaction metadata path: ${field.path}`);
              const pathParts = field.path.substring(2).split('.');
              let current = transactionData;
              
              for (const part of pathParts) {
                if (!current || (typeof current !== 'object')) break;
                
                // Handle array access like transfers[0]
                if (part.includes('[') && part.includes(']')) {
                  const [arrayName, indexPart] = part.split('[');
                  const index = parseInt(indexPart.replace(']', ''));
                  const arrayData = (current as any)[arrayName];
                  if (Array.isArray(arrayData) && index >= 0 && index < arrayData.length) {
                    current = arrayData[index];
                  } else {
                    current = null as any;
                    break;
                  }
                } else {
                  current = (current as any)[part];
                }
              }
              
              resolvedValue = current;
              console.log(`   ✅ Transaction metadata resolved: ${resolvedValue}`);
            }
          }
          
          // Apply formatting
          let displayValue = '[unmapped]';
          if (resolvedValue !== undefined) {
            switch (field.format) {
              case 'addressName':
                if (typeof resolvedValue === 'string' && resolvedValue.startsWith('0x') && resolvedValue.length === 42) {
                  displayValue = `${resolvedValue.slice(0, 6)}...${resolvedValue.slice(-4)}`;
                } else {
                  displayValue = String(resolvedValue);
                }
                break;
              case 'amount':
              case 'tokenAmount':
                // Apply decimal formatting if metadata is available
                if (matchedMetadata?.metadata?.token?.decimals && typeof matchedMetadata.metadata.token.decimals === 'number') {
                  const decimals = matchedMetadata.metadata.token.decimals;
                  const numValue = BigInt(String(resolvedValue));
                  const divisor = BigInt(10 ** decimals);
                  const wholePart = numValue / divisor;
                  const fractionalPart = numValue % divisor;
                  
                  if (fractionalPart === 0n) {
                    displayValue = wholePart.toString();
                  } else {
                    const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
                    displayValue = `${wholePart}.${fractionalStr}`;
                  }
                } else {
                  displayValue = String(resolvedValue);
                }
                break;
              case 'raw':
                const rawStr = String(resolvedValue);
                if (rawStr.startsWith('0x') && rawStr.length > 42) {
                  displayValue = `${rawStr.slice(0, 10)}...${rawStr.slice(-7)}`;
                } else {
                  displayValue = rawStr;
                }
                break;
              default:
                displayValue = String(resolvedValue);
            }
          }
          
          return { ...field, displayValue };
        });
        
        operations.push({
          operation: { ...matchedOperation, fields: resolvedFields },
          metadata: matchedMetadata.metadata,
          context: functionCall.level === 0 ? 'main' : 'nested',
          functionCall: {
            ...functionCall.data,
            level: functionCall.level,
            signature: functionCall.signature
          },
          level: functionCall.level
        });
      } else {
        console.log(`   ❌ L${functionCall.level}: ${functionCall.signature} → No metadata at level ${functionCall.level}`);
      }
    });
    
    console.log(`✅ LEVEL-BASED MAPPING: ${operations.length} operations created`);
    return operations;
  };

  // GENERIC BATCH PROCESSING - METADATA-DRIVEN ONLY
  const processBatchTransaction = (transactionData: DecodedTransaction | null): Array<{operation: Operation, metadata: any, context: string, functionCall: any, level: number, batchIndex?: number}> => {
    if (!transactionData) return [];
    
    console.log(`🔄 PROCESSING TRANSACTION WITH LEVEL-BASED MAPPING`);
    
    // Use the existing level-based mapping which already handles all nested operations
    const allOperations = getAllOperationsForTransaction(transactionData);
    
    console.log(`   ✅ Found ${allOperations.length} operations through level-based mapping`);
    return allOperations;
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

    // LEVEL-BASED PATH RESOLUTION - NO OLD SMARTPATHRESOLVER VALIDATION

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
      } else if ('displayValue' in displayItem && displayItem.displayValue !== undefined) {
        // USE LEVEL-BASED CALCULATED VALUE - ALREADY RESOLVED!
        displayValue = displayItem.displayValue;
        if (displayValue === "[unmapped]") {
          console.log(`   ❌ ${label}: ${path} → [unmapped]`);
        }
      } else {
        displayValue = hasFormat && format ? `Mock ${format} value` : "displayValue";
      }

      screen.push({
        label,
        isActive: true,
        displayValue: String(displayValue || '[undefined]')
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

  // Memoize batch operation processing to prevent infinite loops
  const allOperations = useMemo(() => {
    return activeTab === "advanced" && transactionData ? processBatchTransaction(transactionData) : [];
  }, [activeTab, transactionData, metadataEntries]);

  const renderHardwareUI = () => {
    // Get all operations for this transaction (including batched and nested)
    
    console.log(`Found ${allOperations.length} operations:`, allOperations.map(op => `${op.context}:${op.functionCall.name} (level ${op.level})`));
    
    // METADATA-DRIVEN MULTI-OPERATION HANDLING
    if (allOperations.length > 1) {
      // Filter to only show the lowest (deepest) level operations
      const maxLevel = Math.max(...allOperations.map(op => op.level));
      const lowestLevelOperations = allOperations.filter(op => op.level === maxLevel);
      
      console.log(`Filtering to lowest level ${maxLevel}: ${lowestLevelOperations.length} operations`);
      
      // Sort operations by nesting level (main first, then by level)
      const sortedOperations = lowestLevelOperations.sort((a, b) => a.level - b.level);
      
      // Consolidate transfer operations into single review/sign screens
      const consolidatedScreens: any[] = [];
      const allTransferData: any[] = [];
      
      // Collect all transfer operation data
      sortedOperations.forEach((operation) => {
        if (operation.operation) {
          // Create operation with function call context for proper path resolution
          const contextualOperation = {
            ...operation.operation,
            fields: operation.operation.fields.map(field => ({
              ...field,
              functionCall: operation.functionCall
            }))
          };
          
          const screens = getScreensForOperationWithRealData(contextualOperation);
          
          // Build operation name from metadata intent or function name
          const operationName = typeof operation.operation.intent === 'string' 
            ? operation.operation.intent 
            : operation.functionCall.name;
          
          // Add batch info if this is a batch operation
          const batchInfo = operation.batchIndex !== undefined ? ` [${operation.batchIndex + 1}]` : '';
          const levelInfo = operation.level > 0 ? ` (L${operation.level})` : '';
          
          allTransferData.push({
            operationName: `${operationName}${batchInfo}${levelInfo}`,
            screens,
            metadata: operation.metadata
          });
        }
      });
      
      // Create consolidated screens using the operationScreens function
      if (allTransferData.length > 0) {
        // Consolidate all field data with proper screen pagination
        const allFields: Array<{label: string; isActive?: boolean; displayValue: string}> = [];
        
        allTransferData.forEach((transfer, index) => {
          // Add transfer header
          allFields.push({
            label: `Transfer ${index + 1}`,
            displayValue: transfer.operationName,
            isActive: true
          });
          
          // Add all fields from this transfer
          transfer.screens.forEach((screen: Array<{label: string; isActive?: boolean; displayValue: string}>) => {
            allFields.push(...screen);
          });
        });
        
        // Break into multiple screens with proper pagination (4 items per screen)
        const ITEMS_PER_SCREEN = 4;
        const paginatedScreens: Array<Array<{label: string; isActive?: boolean; displayValue: string}>> = [];
        
        for (let i = 0; i < allFields.length; i += ITEMS_PER_SCREEN) {
          const screenFields = allFields.slice(i, i + ITEMS_PER_SCREEN);
          paginatedScreens.push(screenFields);
        }
        
        // Create consolidated operation metadata using the actual operation intent from metadata
        const firstOperation = allTransferData[0];
        const baseOperationName = firstOperation?.operationName?.split(' [')[0]?.split(' (L')[0] || 'Operation';
        const consolidatedMeta = {
          operationName: `${baseOperationName} (${allTransferData.length} operations)`,
          metadata: firstOperation?.metadata
        };
        
        // Use operationScreens to create proper screens with review and sign
        const consolidatedOperationScreens = operationScreens(paginatedScreens, consolidatedMeta);
        consolidatedScreens.push(...consolidatedOperationScreens);
      }
      
      if (consolidatedScreens.length > 0) {
        const batchInfo = allOperations.some(op => op.batchIndex !== undefined);
        const batchCount = batchInfo ? new Set(allOperations.map(op => op.batchIndex)).size : 0;
        const levelCount = new Set(allOperations.map(op => op.level)).size;
        
        let description = '';
        if (batchInfo && batchCount > 1) {
          description = `Batch Transaction (${batchCount} items, ${levelCount} levels, ${sortedOperations.length} operations)`;
        } else if (levelCount > 1) {
          description = `Multi-Level Transaction (${levelCount} levels, ${sortedOperations.length} operations)`;
        } else {
          description = `Transaction (${sortedOperations.length} operations)`;
        }
        
        return (
          <div className="mx-auto flex max-w-96 flex-col">
            <div className="text-center text-sm text-gray-600 mb-4">
              {description}
            </div>
            <Carousel setApi={setApi}>
              <CarouselContent>
                {consolidatedScreens.map((screen, index) => (
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
                {consolidatedScreens.map((_, index) => (
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
        
        const operationName = typeof operation.operation.intent === 'string' ? operation.operation.intent : operation.functionCall.name;
        const batchInfo = operation.batchIndex !== undefined ? ` [${operation.batchIndex + 1}]` : '';
        const levelInfo = operation.level > 0 ? ` (L${operation.level})` : '';
        
        const operationMeta = {
          operationName: `${operationName}${batchInfo}${levelInfo}`,
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
        // Apply decimal formatting if metadata is available
        if (metadata?.token?.decimals && typeof metadata.token.decimals === 'number') {
          const decimals = metadata.token.decimals;
          const numValue = BigInt(rawValue);
          const divisor = BigInt(10 ** decimals);
          const wholePart = numValue / divisor;
          const fractionalPart = numValue % divisor;
          
          if (fractionalPart === 0n) {
            return wholePart.toString();
          } else {
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
            return `${wholePart}.${fractionalStr}`;
          }
        }
        return rawValue;
        
      case "addressName":
        const addressValue = value.toString();
        if (addressValue.startsWith('0x') && addressValue.length === 42) {
          // Always format addresses as shortened form, regardless of metadata
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