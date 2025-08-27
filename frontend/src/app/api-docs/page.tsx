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
  -d '{"query":"{ specs(first: 10) { id user blobHash targetContract chainID blockTimestamp status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Get Specs by Contract Address",
      description: "Get specifications for a specific contract",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {targetContract: \\"0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719\\"}) { blobHash targetContract status } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Get Finalized Specs Only",
      description: "Retrieve only specs that have been processed by handleResult",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {status: FINALIZED}) { blobHash targetContract } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Fetch Blob Data",
      description: "Get contract metadata from blob using the hash from specs",
      code: `curl -s "https://sepolia.etherscan.io/blob/0x0192d6c8c1e4f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3f8e3"`
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
  echo -e "\\n\\nFetching metadata from blob: $BLOB_HASH"
  curl -s "https://sepolia.etherscan.io/blob/$BLOB_HASH"
else
  echo "No specs found for this contract"
fi`
    },
    {
      title: "Get Proposed Metadata for Contract",
      description: "Fetch proposed ERC-7730 metadata for the KaiSign contract",
      code: `# Get proposed specs from subgraph
curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ specs(where: {targetContract: \\"0x4dfea0c2b472a14cd052a8f9df9f19fa5cf03719\\", status: \\"PROPOSED\\"}) { blobHash blockTimestamp user } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"

# Note: The 'blobHash' field contains the EIP-4844 blob versioned hash
# Status values: COMMITTED, SUBMITTED, PROPOSED, FINALIZED, CANCELLED`
    },
    {
      title: "Submit Blob with Metadata",
      description: "Submit ERC-7730 metadata to blob storage",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"json": {"context": {"contract": {"address": "0x4dFEA0C2B472a14cD052a8f9DF9f19fa5CF03719", "chainId": 11155111}}, "metadata": {"functions": [{"selector": "0xa9059cbb", "name": "transfer", "intent": "Transfer tokens"}]}}}' \\
  "https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob"`
    },
    {
      title: "Query All Incentives (When Deployed)",
      description: "Get incentive data from the subgraph",
      code: `# Query for created incentives
curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ logIncentiveCreateds(first: 10) { incentiveId creator targetContract amount deadline description blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"

# Query for claimed incentives
curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ logIncentiveClaimeds(first: 10) { incentiveId claimer specID amount blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest"`
    },
    {
      title: "Query User's Specs",
      description: "Get all specs created by a specific user",
      code: `# Replace USER_ADDRESS with the actual address
USER_ADDRESS="0xbb6e6d6dabd150c4a000d1fd8a7de46a750477f4"

curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d "{\\"query\\":\\"{ specs(where: {user: \\\\\\"$USER_ADDRESS\\\\\\"}) { id blobHash targetContract status blockTimestamp incentiveId } }\\"" \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest" | jq`
    },
    {
      title: "Combined Dashboard Query",
      description: "Get multiple data types in one request",
      code: `curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ proposedSpecs: specs(where: {status: \\"PROPOSED\\"}, first: 5) { id user blobHash targetContract blockTimestamp } finalizedSpecs: specs(where: {status: \\"FINALIZED\\"}, first: 5) { id user blobHash targetContract isAccepted } recentSpecs: specs(first: 5, orderBy: blockTimestamp, orderDirection: desc) { id status blockTimestamp } }"}' \\
  "https://api.studio.thegraph.com/query/117022/kaisign-subgraph/version/latest" | jq`
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

          {/* Blob Explorer */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">Blob Data Access</h2>
            <p className="text-gray-300 mb-4">
              Use Etherscan to view blob data from blob hashes:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://sepolia.etherscan.io/blob/[blobHash]
                </code>
                <span className="text-green-400 text-sm">(Sepolia Testnet)</span>
              </li>
              <li>
                <code className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-200">
                  https://etherscan.io/blob/[blobHash]
                </code>
                <span className="text-gray-400 text-sm">(Mainnet)</span>
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