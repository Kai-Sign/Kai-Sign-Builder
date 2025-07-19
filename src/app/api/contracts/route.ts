import { NextRequest, NextResponse } from 'next/server';
import { KaiSignGraphClient } from '~/lib/graphClient';

// Get the graph endpoint from environment variables
const GRAPH_ENDPOINT = process.env.KAISIGN_GRAPH_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainID = searchParams.get('chainId');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Validate required parameters
  if (!chainID) {
    return NextResponse.json(
      { error: 'Missing required parameter: chainId' },
      { status: 400 }
    );
  }

  if (limit > 100) {
    return NextResponse.json(
      { error: 'Limit cannot exceed 100' },
      { status: 400 }
    );
  }

  try {
    const client = new KaiSignGraphClient(GRAPH_ENDPOINT);
    let contracts;

    if (search) {
      contracts = await client.searchContracts(search, chainID);
    } else {
      contracts = await client.getContractsWithMetadata(chainID);
    }

    // Apply pagination
    const paginatedContracts = contracts.slice(offset, offset + limit);
    const total = contracts.length;

    return NextResponse.json({
      success: true,
      data: {
        contracts: paginatedContracts.map(contract => ({
          address: contract.address,
          chainId: contract.chainID,
          name: contract.name,
          version: contract.version,
          description: contract.description,
          hasApprovedMetadata: contract.hasApprovedMetadata,
          functionCount: contract.functionCount,
          lastUpdated: contract.latestSpecTimestamp
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Failed to get contracts:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
