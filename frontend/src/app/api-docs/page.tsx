'use client';

import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

// Blob testing hook
const useBlobTester = () => {
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const testBlobEndpoint = async (blobHash: string, network: 'sepolia' | 'mainnet' = 'sepolia') => {
    const baseUrls = {
      sepolia: 'https://api.sepolia.blobscan.com',
      mainnet: 'https://api.blobscan.com'
    };

    const testKey = `${network}-${blobHash}`;
    setTesting(prev => ({ ...prev, [testKey]: true }));

    const endpoints = [
      `/blobs/${blobHash}`,          // Metadata endpoint (should work)
      `/blobs/${blobHash}/data`      // Data endpoint (requires auth)
    ];

    const results: any[] = [];
    const baseUrl = baseUrls[network];

    for (const endpoint of endpoints) {
      const fullUrl = baseUrl + endpoint;
      
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'KaiSign-API-Docs/1.0'
          }
        });

        const contentType = response.headers.get('content-type') || '';
        let data = '';
        
        try {
          if (contentType.includes('application/json')) {
            data = JSON.stringify(await response.json(), null, 2);
          } else {
            data = await response.text();
          }
        } catch (e) {
          data = 'Could not parse response';
        }

        const isJson = contentType.includes('application/json');
        const isSuccess = response.status === 200;
        const requiresAuth = response.status === 401 && data.includes('UNAUTHORIZED');
        
        results.push({
          endpoint,
          fullUrl,
          status: response.status,
          success: isSuccess,
          authRequired: requiresAuth,
          isJson: isJson,
          data: isJson ? data.substring(0, 1000) + (data.length > 1000 ? '...' : '') : data,
          contentType
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        results.push({
          endpoint,
          fullUrl,
          status: 'Error',
          success: false,
          authRequired: false,
          error: error.message,
          contentType: ''
        });
      }
    }

    const finalResult = {
      network,
      blobHash,
      tested: new Date().toISOString(),
      workingEndpoints: results.filter(r => r.success),
      authEndpoints: results.filter(r => r.authRequired),
      failedEndpoints: results.filter(r => !r.success && !r.authRequired),
      allResults: results
    };

    setTestResults(prev => ({ ...prev, [testKey]: finalResult }));
    setTesting(prev => ({ ...prev, [testKey]: false }));

    return finalResult;
  };

  return { testResults, testing, testBlobEndpoint };
};

export default function ApiDocsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [blobDataResults, setBlobDataResults] = useState<Record<string, any>>({});
  const [fetchingBlobData, setFetchingBlobData] = useState<Record<string, boolean>>({});
  const [queryBlobHash, setQueryBlobHash] = useState<string>('0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239');
  const [queryNetwork, setQueryNetwork] = useState<'sepolia' | 'mainnet'>('sepolia');
  const [queryResults, setQueryResults] = useState<{testResult: any, dataResult: any} | null>(null);
  const [queryTesting, setQueryTesting] = useState(false);
  const [exampleResults, setExampleResults] = useState<Record<number, any>>({});
  const [exampleLoading, setExampleLoading] = useState<Record<number, boolean>>({});
  const { testResults, testing, testBlobEndpoint } = useBlobTester();

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const testBlobFromExample = async (blobHash: string, network: 'sepolia' | 'mainnet' = 'sepolia', cardIndex: number) => {
    const cardKey = `card-${cardIndex}`;
    setExampleLoading(prev => ({ ...prev, [cardKey]: true }));
    
    try {
      const result = await testBlobEndpoint(blobHash, network);
      setExampleResults(prev => ({
        ...prev,
        [cardKey]: {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
          type: 'api-test'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [cardKey]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'api-test'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [cardKey]: false }));
    }
  };

  const fetchBlobDataForCard = async (blobHash: string, network: 'sepolia' | 'mainnet' = 'sepolia', cardIndex: number) => {
    const cardKey = `card-${cardIndex}-blob`;
    setExampleLoading(prev => ({ ...prev, [cardKey]: true }));
    
    try {
      const result = await fetchBlobData(blobHash, network);
      setExampleResults(prev => ({
        ...prev,
        [cardKey]: {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
          type: 'blob-data'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [cardKey]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'blob-data'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [cardKey]: false }));
    }
  };

  const validateBlobHash = (hash: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  };

  const handleQueryBlob = async () => {
    if (!validateBlobHash(queryBlobHash)) {
      alert('Invalid blob hash format. Must be 0x followed by 64 hex characters.');
      return;
    }

    setQueryTesting(true);
    setQueryResults(null);

    try {
      // Run both queries independently for the query section
      const [testResult, dataResult] = await Promise.all([
        testBlobEndpoint(queryBlobHash, queryNetwork),
        fetchBlobData(queryBlobHash, queryNetwork)
      ]);

      // Set isolated results for query section
      setQueryResults({
        testResult,
        dataResult
      });
    } catch (error) {
      console.error('Query failed:', error);
    } finally {
      setQueryTesting(false);
    }
  };

  const executeGraphQLQuery = async (query: string, exampleIndex: number) => {
    setExampleLoading(prev => ({ ...prev, [exampleIndex]: true }));
    
    try {
      const response = await fetch('https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          type: 'graphql'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'graphql'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [exampleIndex]: false }));
    }
  };

  const executeBlobRequest = async (blobHash: string, exampleIndex: number) => {
    setExampleLoading(prev => ({ ...prev, [exampleIndex]: true }));
    
    try {
      // Get blob metadata
      const metadataResponse = await fetch(`https://api.sepolia.blobscan.com/blobs/${blobHash}`);
      const metadata = await metadataResponse.json();
      
      // Get blob data if storage URL exists
      let blobData = null;
      const googleStorage = metadata.dataStorageReferences?.find((ref: any) => ref.storage === 'google');
      if (googleStorage) {
        const dataResponse = await fetch(googleStorage.url);
        blobData = await dataResponse.text();
      }

      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: true,
          metadata,
          blobData,
          timestamp: new Date().toISOString(),
          type: 'blob'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'blob'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [exampleIndex]: false }));
    }
  };

  const executeComplexScript = async (exampleIndex: number) => {
    setExampleLoading(prev => ({ ...prev, [exampleIndex]: true }));
    
    try {
      // Step 1: Query subgraph for specs
      const graphqlQuery = `{ 
        specs(where: {targetContract: "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719"}) { 
          blobHash 
          targetContract 
          status 
        } 
      }`;
      
      const subgraphResponse = await fetch('https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQuery })
      });
      
      const subgraphData = await subgraphResponse.json();
      
      // Step 2: Get blob data if we have a blob hash
      let blobData = null;
      let blobMetadata = null;
      
      if (subgraphData?.data?.specs?.[0]?.blobHash) {
        const blobHash = subgraphData.data.specs[0].blobHash;
        
        try {
          const metadataResponse = await fetch(`https://api.sepolia.blobscan.com/blobs/${blobHash}`);
          blobMetadata = await metadataResponse.json();
          
          const googleStorage = blobMetadata.dataStorageReferences?.find((ref: any) => ref.storage === 'google');
          if (googleStorage) {
            const dataResponse = await fetch(googleStorage.url);
            blobData = await dataResponse.text();
          }
        } catch (blobError) {
          console.warn('Failed to fetch blob data:', blobError);
        }
      }

      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: true,
          subgraphData,
          blobMetadata,
          blobData,
          timestamp: new Date().toISOString(),
          type: 'complex'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'complex'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [exampleIndex]: false }));
    }
  };

  const executeApiRequest = async (exampleIndex: number) => {
    setExampleLoading(prev => ({ ...prev, [exampleIndex]: true }));
    
    try {
      const response = await fetch('https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            context: {
              contract: {
                address: "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719",
                chainId: 11155111
              }
            },
            metadata: {
              functions: [{
                selector: "0xa9059cbb",
                name: "transfer",
                intent: "Transfer tokens"
              }]
            }
          }
        })
      });

      const data = await response.text();
      
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: response.ok,
          data,
          status: response.status,
          timestamp: new Date().toISOString(),
          type: 'api'
        }
      }));
    } catch (error: any) {
      setExampleResults(prev => ({
        ...prev,
        [exampleIndex]: {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          type: 'api'
        }
      }));
    } finally {
      setExampleLoading(prev => ({ ...prev, [exampleIndex]: false }));
    }
  };

  const fetchBlobData = async (blobHash: string, network: 'sepolia' | 'mainnet' = 'sepolia') => {
    const fetchKey = `${network}-${blobHash}-data`;
    setFetchingBlobData(prev => ({ ...prev, [fetchKey]: true }));

    const baseUrls = {
      sepolia: 'https://api.sepolia.blobscan.com',
      mainnet: 'https://api.blobscan.com'
    };

    try {
      // Get blob metadata first
      const metadataResponse = await fetch(`${baseUrls[network]}/blobs/${blobHash}`);
      if (!metadataResponse.ok) {
        throw new Error(`Metadata fetch failed: ${metadataResponse.status}`);
      }
      
      const metadata = await metadataResponse.json();
      
      // Find Google Cloud Storage URL
      const googleStorage = metadata.dataStorageReferences?.find((ref: any) => ref.storage === 'google');
      if (!googleStorage) {
        throw new Error('No Google Cloud storage URL found');
      }

      // Fetch the actual blob data
      const blobDataResponse = await fetch(googleStorage.url);
      if (!blobDataResponse.ok) {
        throw new Error(`Blob data fetch failed: ${blobDataResponse.status}`);
      }

      const blobData = await blobDataResponse.text();
      const result = {
        success: true,
        metadata,
        blobData,
        storageUrl: googleStorage.url,
        network,
        blobHash,
        fetchedAt: new Date().toISOString()
      };

      setBlobDataResults(prev => ({ ...prev, [fetchKey]: result }));
      setFetchingBlobData(prev => ({ ...prev, [fetchKey]: false }));
      return result;
    } catch (error: any) {
      const result = {
        success: false,
        error: error.message,
        network,
        blobHash,
        fetchedAt: new Date().toISOString()
      };
      setBlobDataResults(prev => ({ ...prev, [fetchKey]: result }));
      setFetchingBlobData(prev => ({ ...prev, [fetchKey]: false }));
      return result;
    }
  };

  const extractBlobHashFromCode = (code: string): string | null => {
    const match = code.match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  };

  const BlobTestResults = ({ results }: { results: any }) => {
    if (!results) return null;

    const { workingEndpoints, authEndpoints, failedEndpoints, network, blobHash } = results;

    return (
      <div className="mt-4 bg-gray-800 border border-gray-600 rounded-lg p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-blue-400" />
          <h4 className="font-medium text-white">Blob API Test Results</h4>
          <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-300 rounded">
            {network.toUpperCase()}
          </span>
        </div>
        
        <div className="space-y-3 text-sm break-words">
          {workingEndpoints.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-green-400" />
                <span className="font-medium text-green-400">Working Endpoints ({workingEndpoints.length})</span>
              </div>
              {workingEndpoints.map((endpoint: any, idx: number) => (
                <div key={idx} className="ml-5 bg-green-900/20 border border-green-500/30 rounded p-2">
                  <div className="font-mono text-xs text-green-300 mb-1 break-all">{endpoint.fullUrl}</div>
                  <div className="text-xs text-gray-300">
                    Status: {endpoint.status} | Type: {endpoint.contentType}
                    {endpoint.isJson && <span className="ml-2 px-2 py-0.5 bg-green-600 text-green-100 rounded text-xs">JSON API</span>}
                  </div>
                  {endpoint.data && (
                    <div className="mt-2 bg-gray-900 p-2 rounded text-xs max-h-60 overflow-y-auto">
                      <pre className="text-gray-300 whitespace-pre-wrap break-all overflow-wrap-anywhere">{endpoint.data}</pre>
                      {endpoint.success && endpoint.isJson && (
                        <div className="mt-2 text-green-300 text-xs">
                          ✅ Perfect! This API endpoint returns blob metadata in JSON format.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {authEndpoints.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-yellow-400" />
                <span className="font-medium text-yellow-400">Auth Required ({authEndpoints.length})</span>
              </div>
              {authEndpoints.map((endpoint: any, idx: number) => (
                <div key={idx} className="ml-5 bg-yellow-900/20 border border-yellow-500/30 rounded p-2">
                  <div className="font-mono text-xs text-yellow-300 break-all">{endpoint.fullUrl}</div>
                  <div className="text-xs text-gray-300">Status: {endpoint.status}</div>
                </div>
              ))}
            </div>
          )}

          {failedEndpoints.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={14} className="text-red-400" />
                <span className="font-medium text-red-400">Failed ({failedEndpoints.length})</span>
              </div>
              <div className="ml-5 text-xs text-gray-400">
                {failedEndpoints.length} endpoints returned errors or 404s
              </div>
            </div>
          )}

          {workingEndpoints.length === 0 && authEndpoints.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              <XCircle size={20} className="mx-auto mb-2 text-red-400" />
              <p>No working endpoints found for this blob hash on {network.toUpperCase()}</p>
              <p className="text-xs mt-1">
                This blob hash may not exist on {network} network. 
                {network === 'mainnet' ? ' Try switching to Sepolia testnet.' : ' Try switching to mainnet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const BlobDataResults = ({ results }: { results: any }) => {
    if (!results) return null;

    return (
      <div className="mt-4 bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-purple-400" />
          <h4 className="font-medium text-white">UTF-8 Blob Data</h4>
          <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-300 rounded">
            {results.network.toUpperCase()}
          </span>
        </div>

        {results.success ? (
          <div className="space-y-3 text-sm">
            <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-green-400" />
                <span className="font-medium text-green-400">UTF-8 Data Retrieved</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400 text-xs">Storage URL:</span>
                  <div className="font-mono text-xs text-green-300 break-all">{results.storageUrl}</div>
                </div>
                
                <div>
                  <span className="text-gray-400 text-xs">Data Size:</span>
                  <span className="ml-2 text-xs text-white">{results.blobData.length} characters</span>
                </div>
                
                <div>
                  <span className="text-gray-400 text-xs">UTF-8 Blob Content:</span>
                  <div className="mt-2 bg-gray-900 p-3 rounded text-xs max-h-80 overflow-y-auto">
                    <pre className="text-gray-200 whitespace-pre-wrap font-mono">{results.blobData}</pre>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-600">
                  <div className="text-green-300 text-xs">
                    ✅ Raw UTF-8 blob data successfully retrieved from Google Cloud Storage
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={14} className="text-red-400" />
              <span className="font-medium text-red-400">Failed to Retrieve Data</span>
            </div>
            <div className="text-xs text-red-300">{results.error}</div>
            {results.error.includes('404') && (
              <div className="mt-2 text-xs text-yellow-300">
                💡 This blob hash doesn't exist on {results.network}. Try switching networks.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const ExampleResults = ({ result }: { result: any }) => {
    if (!result) return null;

    return (
      <div className="mt-4 bg-gray-800 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-green-400" />
          <h4 className="font-medium text-white">Execution Results</h4>
          <span className="text-xs px-2 py-1 bg-green-900/30 text-green-300 rounded">
            {result.type.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {result.success ? (
          <div className="space-y-3 text-sm">
            {result.type === 'graphql' && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-blue-400" />
                  <span className="font-medium text-blue-400">GraphQL Query Success</span>
                </div>
                <div className="bg-gray-900 p-3 rounded text-xs max-h-80 overflow-y-auto">
                  <pre className="text-gray-200 whitespace-pre-wrap font-mono">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {result.type === 'blob' && (
              <>
                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="font-medium text-green-400">Blob Metadata</span>
                  </div>
                  <div className="bg-gray-900 p-3 rounded text-xs max-h-60 overflow-y-auto">
                    <pre className="text-gray-200 whitespace-pre-wrap font-mono">
                      {JSON.stringify(result.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
                
                {result.blobData && (
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} className="text-purple-400" />
                      <span className="font-medium text-purple-400">UTF-8 Blob Data</span>
                    </div>
                    <div className="bg-gray-900 p-3 rounded text-xs max-h-80 overflow-y-auto">
                      <pre className="text-gray-200 whitespace-pre-wrap font-mono">{result.blobData}</pre>
                    </div>
                  </div>
                )}
              </>
            )}

            {result.type === 'complex' && (
              <>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={14} className="text-blue-400" />
                    <span className="font-medium text-blue-400">Subgraph Data</span>
                  </div>
                  <div className="bg-gray-900 p-3 rounded text-xs max-h-60 overflow-y-auto">
                    <pre className="text-gray-200 whitespace-pre-wrap font-mono">
                      {JSON.stringify(result.subgraphData, null, 2)}
                    </pre>
                  </div>
                </div>
                
                {result.blobData && (
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} className="text-purple-400" />
                      <span className="font-medium text-purple-400">Retrieved Blob Data</span>
                    </div>
                    <div className="bg-gray-900 p-3 rounded text-xs max-h-80 overflow-y-auto">
                      <pre className="text-gray-200 whitespace-pre-wrap font-mono">{result.blobData}</pre>
                    </div>
                  </div>
                )}
              </>
            )}

            {result.type === 'api' && (
              <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="font-medium text-green-400">API Request Success</span>
                  <span className="text-xs px-2 py-0.5 bg-green-600 text-green-100 rounded">
                    Status: {result.status}
                  </span>
                </div>
                <div className="bg-gray-900 p-3 rounded text-xs max-h-80 overflow-y-auto">
                  <pre className="text-gray-200 whitespace-pre-wrap font-mono">{result.data}</pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-red-900/20 border border-red-500/30 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={14} className="text-red-400" />
              <span className="font-medium text-red-400">Execution Failed</span>
            </div>
            <div className="text-xs text-red-300">{result.error}</div>
          </div>
        )}
      </div>
    );
  };

  const codeExamples = [
    {
      title: "Get All Specs",
      description: "Retrieve all contract specifications from the subgraph",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(first: 10) { id user blobHash targetContract chainID blockTimestamp status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ specs(first: 10) { id user blobHash targetContract chainID blockTimestamp status } }'
    },
    {
      title: "Get Specs by Contract Address",
      description: "Get specifications for a specific contract",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {targetContract: \\"0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719\\"}) { blobHash targetContract status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ specs(where: {targetContract: "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719"}) { blobHash targetContract status } }'
    },
    {
      title: "Get Finalized Specs Only",
      description: "Retrieve only specs that have been processed by handleResult",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {status: FINALIZED}) { blobHash targetContract } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ specs(where: {status: "FINALIZED"}) { blobHash targetContract } }'
    },
    {
      title: "Fetch Blob Data (UTF-8 Metadata)",
      description: "Get the actual UTF-8 blob data directly",
      code: `curl -s "https://storage.googleapis.com/blobscan-production/11155111/01/96/d7/0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239.bin" | tr -d '\\0'`,
      blobHash: "0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239",
      executable: true,
      executeType: 'blob'
    },
    {
      title: "Complete Shell Script",
      description: "Save as query.sh and run to get specs and fetch their blob metadata",
      code: `#!/bin/bash
URL="https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"
CONTRACT_ADDRESS="0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719"

echo "Getting specs for contract $CONTRACT_ADDRESS..."
SPECS=$(curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d "{\\"query\\":\\"{ specs(where: {targetContract: \\\\\\"$CONTRACT_ADDRESS\\\\\\"}) { blobHash targetContract status } }\\"}" \\
  "$URL")

echo "$SPECS"

BLOB_HASH=$(echo "$SPECS" | jq -r '.data.specs[0].blobHash')

if [ "$BLOB_HASH" != "null" ]; then
  echo -e "\\n\\nFetching UTF-8 metadata from blob: $BLOB_HASH"
  
  # Get storage URL from API
  STORAGE_URL=$(curl -s "https://api.sepolia.blobscan.com/blobs/$BLOB_HASH" | jq -r '.dataStorageReferences[] | select(.storage=="google") | .url')
  
  # Get actual UTF-8 blob data
  curl -s "$STORAGE_URL"
else
  echo "No specs found for this contract"
fi`,
      executable: true,
      executeType: 'complex'
    },
    {
      title: "Get Proposed Metadata for Contract",
      description: "Fetch proposed ERC-7730 metadata for the KaiSign contract",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {targetContract: \\"0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719\\", status: \\"PROPOSED\\"}) { blobHash blockTimestamp user } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ specs(where: {targetContract: "0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719", status: "PROPOSED"}) { blobHash blockTimestamp user } }'
    },
    {
      title: "Query Created Incentives",
      description: "Get created incentives data from the subgraph",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ logIncentiveCreateds(first: 10) { incentiveId creator targetContract amount deadline description blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ logIncentiveCreateds(first: 10) { incentiveId creator targetContract amount deadline description blockTimestamp } }'
    },
    {
      title: "Query Claimed Incentives",
      description: "Get claimed incentives data from the subgraph",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ logIncentiveClaimeds(first: 10) { incentiveId claimer specID amount blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ logIncentiveClaimeds(first: 10) { incentiveId claimer specID amount blockTimestamp } }'
    },
    {
      title: "Query User's Specs",
      description: "Get all specs created by a specific user",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {user: \\"0x89839eF5911343a6134c28B96342f7fb3ae5D483\\"}) { id blobHash targetContract status blockTimestamp incentiveId } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ specs(where: {user: "0x89839eF5911343a6134c28B96342f7fb3ae5D483"}) { id blobHash targetContract status blockTimestamp incentiveId } }'
    },
    {
      title: "Combined Dashboard Query",
      description: "Get multiple data types in one request",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ proposedSpecs: specs(where: {status: \\"PROPOSED\\"}, first: 5) { id user blobHash targetContract blockTimestamp } finalizedSpecs: specs(where: {status: \\"FINALIZED\\"}, first: 5) { id user blobHash targetContract isAccepted } recentSpecs: specs(first: 5, orderBy: blockTimestamp, orderDirection: desc) { id status blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`,
      executable: true,
      executeType: 'graphql',
      query: '{ proposedSpecs: specs(where: {status: "PROPOSED"}, first: 5) { id user blobHash targetContract blockTimestamp } finalizedSpecs: specs(where: {status: "FINALIZED"}, first: 5) { id user blobHash targetContract isAccepted } recentSpecs: specs(first: 5, orderBy: blockTimestamp, orderDirection: desc) { id status blockTimestamp } }'
    },
    {
      title: "How to Use the Script",
      description: "Step-by-step instructions to run the shell script",
      code: `# 1. Save the script to a file
echo '#!/bin/bash...' > query.sh

# 2. Make it executable
chmod +x query.sh

# 3. Run the script
./query.sh

# 4. To use a different contract address, edit the script:
# Change CONTRACT_ADDRESS="0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719"
# to your desired contract address

# 5. Requirements:
# - curl (usually pre-installed)
# - jq (install with: brew install jq on macOS or apt install jq on Ubuntu)`
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-2">KaiSign API Documentation</h1>
          <p className="text-gray-300 mb-8">
            Learn how to query the KaiSign subgraph to retrieve contract specifications and blob metadata (EIP-4844).
          </p>

          {/* No API Key Required */}
          <div className="mb-8 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-400 mb-2">✅ No API Key Required</h2>
            <p className="text-gray-300 text-sm">
              The subgraph endpoint is public and doesn't require authentication. Just use the URL directly in your requests.
            </p>
          </div>

          {/* Blob Query Interface */}
          <div className="mb-8 bg-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">🔍 Query Any Blob</h2>
            <p className="text-gray-300 text-sm mb-4">
              Test any blob hash to see API endpoints and fetch UTF-8 metadata directly in your browser.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Network</label>
                <select
                  value={queryNetwork}
                  onChange={(e) => setQueryNetwork(e.target.value as 'sepolia' | 'mainnet')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sepolia">Sepolia Testnet</option>
                  <option value="mainnet">Ethereum Mainnet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Blob Hash</label>
                <input
                  type="text"
                  value={queryBlobHash}
                  onChange={(e) => setQueryBlobHash(e.target.value)}
                  placeholder="0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="mt-1 text-xs text-gray-400">
                  Enter a 66-character blob versioned hash (0x + 64 hex characters)
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleQueryBlob}
                  disabled={queryTesting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {queryTesting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Querying...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Query Blob
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setQueryBlobHash('0x0196d7c56bbc18b22ea2ac4e65b968e39c918bfed9f7ac0c0fccabda8d0e2239');
                    setQueryNetwork('sepolia');
                    setQueryResults(null); // Clear previous results
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
                >
                  Use Example Hash
                </button>
                
                <button
                  onClick={() => setQueryResults(null)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Clear Results
                </button>
              </div>
            </div>

            {/* Query Results */}
            {queryResults && (
              <div className="mt-6 pt-4 border-t border-gray-600">
                <h3 className="text-lg font-medium text-white mb-3">Query Results</h3>
                
                {queryResults.testResult && (
                  <BlobTestResults results={queryResults.testResult} />
                )}
                
                {queryResults.dataResult && (
                  <BlobDataResults results={queryResults.dataResult} />
                )}
              </div>
            )}
          </div>

          {/* API Endpoint */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">API Endpoint</h2>
            <div className="bg-gray-700 rounded-lg p-4 relative">
              <code className="text-sm text-gray-200">
                https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest
              </code>
              <button
                onClick={() => copyToClipboard("https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest", -1)}
                className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Available Fields */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Available Fields</h2>
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">Spec Entity:</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li><code className="bg-gray-600 px-1 rounded">id</code> - Unique identifier</li>
                <li><code className="bg-gray-600 px-1 rounded">user</code> - Creator address</li>
                <li><code className="bg-gray-600 px-1 rounded">blobHash</code> - Blob hash containing metadata (EIP-4844)</li>
                <li><code className="bg-gray-600 px-1 rounded">targetContract</code> - Contract address</li>
                <li><code className="bg-gray-600 px-1 rounded">chainID</code> - Blockchain chain ID</li>
                <li><code className="bg-gray-600 px-1 rounded">blockTimestamp</code> - Creation timestamp</li>
                <li><code className="bg-gray-600 px-1 rounded">status</code> - PROPOSED, SUBMITTED, FINALIZED, REJECTED</li>
              </ul>
            </div>
          </div>

          {/* Code Examples */}
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-white">Examples</h2>
            
            {codeExamples.map((example, index) => {
              const blobHash = (example as any).blobHash || extractBlobHashFromCode(example.code);
              const isTestable = (example as any).testable || (example as any).blobTestable;
              const isExecutable = (example as any).executable;
              const executeType = (example as any).executeType;
              
              // Card-specific state keys
              const isExecuting = exampleLoading[index];
              const isTestingCard = exampleLoading[`card-${index}`];
              const isFetchingBlob = exampleLoading[`card-${index}-blob`];
              
              // Card-specific results - only show results for THIS card
              const executeResult = exampleResults[index];
              const testResult = exampleResults[`card-${index}`];
              const blobResult = exampleResults[`card-${index}-blob`];
              const showDataButton = blobHash && blobHash.length === 66; // Valid blob hash

              const handleExecute = async () => {
                if (executeType === 'graphql') {
                  await executeGraphQLQuery((example as any).query, index);
                } else if (executeType === 'blob' && blobHash) {
                  await executeBlobRequest(blobHash, index);
                } else if (executeType === 'complex') {
                  await executeComplexScript(index);
                } else if (executeType === 'api') {
                  await executeApiRequest(index);
                }
              };

              return (
                <div key={index} className="border border-gray-600 rounded-lg">
                  <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">{example.title}</h3>
                        <p className="text-sm text-gray-300 mt-1">{example.description}</p>
                      </div>
                      <div className="flex gap-2">
                        {isExecutable && (
                          <button
                            onClick={handleExecute}
                            disabled={isExecuting}
                            className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                            title="Execute in browser"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Executing...
                              </>
                            ) : (
                              <>
                                <Play size={12} />
                                Run in Browser
                              </>
                            )}
                          </button>
                        )}
                        {isTestable && blobHash && (
                          <button
                            onClick={() => testBlobFromExample(blobHash, 'sepolia', index)}
                            disabled={isTestingCard}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                            title="Test blob endpoints"
                          >
                            {isTestingCard ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <Play size={12} />
                                Test API
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-sm">
                      <code>{example.code}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(example.code, index)}
                      className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-200"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === index ? (
                        <span className="text-green-400 text-xs">Copied!</span>
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                  {executeResult && (
                    <ExampleResults result={executeResult} />
                  )}
                  {testResult && (
                    <ExampleResults result={testResult} />
                  )}
                  {blobResult && (
                    <ExampleResults result={blobResult} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Blob Explorer */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">Blob API Access</h2>
            <p className="text-gray-300 mb-4">
              Use the Blobscan REST API to get blob metadata and data:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://api.sepolia.blobscan.com/blobs/[blobHash]
                </code>
                <span className="text-green-400 text-sm">(Sepolia Metadata API)</span>
              </li>
              <li className="flex items-center gap-2">
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://api.blobscan.com/blobs/[blobHash]
                </code>
                <span className="text-blue-400 text-sm">(Mainnet Metadata API)</span>
              </li>
              <li className="flex items-center gap-2">
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://sepolia.blobscan.com/blob/[blobHash]
                </code>
                <span className="text-gray-400 text-sm">(Sepolia Web Interface)</span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="mt-8 pt-8 border-t border-gray-600">
            <h2 className="text-xl font-semibold text-white mb-4">External Resources</h2>
            <div className="space-y-2">
              <a
                href="https://thegraph.com/docs/en/querying/graphql-api/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                The Graph GraphQL API Documentation
                <ExternalLink size={16} />
              </a>
              <a
                href="https://sepolia.etherscan.io/address/0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719#events"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                KaiSign Contract Events on Etherscan
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}