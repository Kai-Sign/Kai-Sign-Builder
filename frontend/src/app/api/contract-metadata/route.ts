import { NextRequest, NextResponse } from 'next/server';

// Simple API to fetch JSON metadata from smart contracts
// No bytecode decoding - just pure JSON metadata retrieval

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractAddress = searchParams.get('address');
  const chainId = searchParams.get('chainId');

  // Validate required parameters
  if (!contractAddress) {
    return NextResponse.json(
      { 
        error: 'Missing required parameter: address',
        example: '/api/contract-metadata?address=0x123...&chainId=1'
      },
      { status: 400 }
    );
  }

  if (!chainId) {
    return NextResponse.json(
      { 
        error: 'Missing required parameter: chainId',
        example: '/api/contract-metadata?address=0x123...&chainId=1'
      },
      { status: 400 }
    );
  }

  try {
    // Call our existing KaiSign service to get metadata
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kai-sign-production.up.railway.app';
    
    // Try to get complete metadata from our KaiSign graph with IPFS data
    const client = new (await import('~/lib/graphClient')).KaiSignGraphClient(
      process.env.NEXT_PUBLIC_KAISIGN_GRAPH_URL || 'https://api.studio.thegraph.com/query/117022/kaisign-subgraph/v0.0.7'
    );
    
    let contractMetadata = null;
    let ipfsMetadata = null;
    
    try {
      const completeData = await client.getCompleteContractMetadata(contractAddress, chainId);
      if (completeData.specs && completeData.specs.length > 0) {
        contractMetadata = completeData.specs;
        ipfsMetadata = completeData.ipfsMetadata;
      }
    } catch (graphError) {
      console.log('Graph metadata not available:', graphError);
    }

    // Try to get IPFS-based metadata from Railway API as fallback
    if (!ipfsMetadata) {
      try {
        const ipfsResponse = await fetch(`${apiUrl}/api/py/getIPFSMetadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contract_address: contractAddress,
            chain_id: parseInt(chainId)
          })
        });

        if (ipfsResponse.ok) {
          ipfsMetadata = await ipfsResponse.json();
        }
      } catch (ipfsError) {
        console.log('IPFS metadata not available:', ipfsError);
      }
    }

    // Return combined metadata with full ERC-7730 specification
    const response = {
      success: true,
      contractAddress,
      chainId: parseInt(chainId),
      metadata: {
        // Basic contract info
        address: contractAddress,
        chainId: parseInt(chainId),
        // Graph-based spec data
        ...(contractMetadata && {
          specs: contractMetadata,
          recognized: true,
          graph: true
        }),
        // Complete ERC-7730 metadata
        ...(ipfsMetadata && {
          erc7730: ipfsMetadata,
          // Extract function information for easier access
          functions: ipfsMetadata.metadata?.functions ? Object.entries(ipfsMetadata.metadata.functions).map(([selector, func]: [string, any]) => ({
            selector,
            name: selector,
            intent: func.intent,
            fields: func.fields
          })) : [],
          // Extract constants and enums
          constants: ipfsMetadata.metadata?.constants || {},
          enums: ipfsMetadata.metadata?.enums || {},
          // Contract info
          owner: ipfsMetadata.metadata?.owner,
          info: ipfsMetadata.metadata?.info
        }),
      },
      // Indicate which sources provided data
      sources: {
        graph: !!contractMetadata,
        ipfs: !!ipfsMetadata,
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to get contract metadata:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        contractAddress,
        chainId: parseInt(chainId || '0'),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for batch requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts } = body;

    if (!Array.isArray(contracts)) {
      return NextResponse.json(
        { 
          error: 'Invalid request body. Expected { contracts: Array<{address: string, chainId: number}> }',
          example: {
            contracts: [
              { address: '0x123...', chainId: 1 },
              { address: '0x456...', chainId: 137 }
            ]
          }
        },
        { status: 400 }
      );
    }

    // Process contracts in parallel
    const results = await Promise.allSettled(
      contracts.map(async (contract: { address: string; chainId: number }) => {
        const response = await fetch(`${request.nextUrl.origin}/api/contract-metadata?address=${contract.address}&chainId=${contract.chainId}`, {
          method: 'GET',
        });
        return response.json();
      })
    );

    const batchResponse = {
      success: true,
      total: contracts.length,
      results: results.map((result, index) => ({
        index,
        contract: contracts[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      })),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(batchResponse);

  } catch (error) {
    console.error('Failed to process batch request:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
