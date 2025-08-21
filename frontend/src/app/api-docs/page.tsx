'use client';

import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

export default function ApiDocsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeExamples = [
    {
      title: "Get All Specs",
      description: "Retrieve all contract specifications from the subgraph",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(first: 10) { id user ipfs targetContract chainID blockTimestamp status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Get Specs by Contract Address",
      description: "Get specifications for a specific contract",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {targetContract: \\"0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf\\"}) { ipfs targetContract status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Get Finalized Specs Only",
      description: "Retrieve only specs that have been processed by handleResult",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {status: FINALIZED}) { ipfs targetContract } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Fetch IPFS Metadata",
      description: "Get contract metadata from IPFS using the hash from specs",
      code: `curl -s "https://gateway.pinata.cloud/ipfs/QmQeU4y197HgXt54UNWE61xfSodW8XUTpYn33DNdZprNJD"`
    },
    {
      title: "Complete Shell Script",
      description: "Save as query.sh and run to get specs and fetch their IPFS metadata",
      code: `#!/bin/bash
URL="https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"
CONTRACT_ADDRESS="0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf"

echo "Getting specs for contract $CONTRACT_ADDRESS..."
SPECS=$(curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d "{\\"query\\":\\"{ specs(where: {targetContract: \\\\\\"$CONTRACT_ADDRESS\\\\\\"}) { ipfs targetContract status } }\\"}" \\
  "$URL")

echo "$SPECS"

IPFS_HASH=$(echo "$SPECS" | jq -r '.data.specs[0].ipfs')

if [ "$IPFS_HASH" != "null" ]; then
  echo -e "\\n\\nFetching metadata from IPFS: $IPFS_HASH"
  curl -s "https://gateway.pinata.cloud/ipfs/$IPFS_HASH"
else
  echo "No specs found for this contract"
fi`
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
# Change CONTRACT_ADDRESS="0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf"
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
          <h1 className="text-3xl font-bold text-white mb-2">KaiSign Subgraph API Documentation</h1>
          <p className="text-gray-300 mb-8">
            Learn how to query the KaiSign subgraph to retrieve contract specifications and metadata.
          </p>

          {/* No API Key Required */}
          <div className="mb-8 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-400 mb-2">✅ No API Key Required</h2>
            <p className="text-gray-300 text-sm">
              The subgraph endpoint is public and doesn't require authentication. Just use the URL directly in your requests.
            </p>
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
                <li><code className="bg-gray-600 px-1 rounded">ipfs</code> - IPFS hash containing metadata</li>
                <li><code className="bg-gray-600 px-1 rounded">targetContract</code> - Contract address</li>
                <li><code className="bg-gray-600 px-1 rounded">chainID</code> - Blockchain chain ID</li>
                <li><code className="bg-gray-600 px-1 rounded">blockTimestamp</code> - Creation timestamp</li>
                <li><code className="bg-gray-600 px-1 rounded">status</code> - SUBMITTED, FINALIZED, etc.</li>
              </ul>
            </div>
          </div>

          {/* Code Examples */}
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-white">Examples</h2>
            
            {codeExamples.map((example, index) => (
              <div key={index} className="border border-gray-600 rounded-lg">
                <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
                  <h3 className="font-medium text-white">{example.title}</h3>
                  <p className="text-sm text-gray-300 mt-1">{example.description}</p>
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
              </div>
            ))}
          </div>

          {/* IPFS Gateways */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">IPFS Gateways</h2>
            <p className="text-gray-300 mb-4">
              Use these public IPFS gateways to fetch metadata from IPFS hashes:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://gateway.pinata.cloud/ipfs/[hash]
                </code>
                <span className="text-green-400 text-sm">(Recommended)</span>
              </li>
              <li>
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://ipfs.io/ipfs/[hash]
                </code>
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
                href="https://sepolia.etherscan.io/address/0xb55d4406916e20df5b965e15dd3ff85fa8b11dcf#events"
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