import { NextRequest, NextResponse } from 'next/server';
import { KaiSignGraphClient } from '~/lib/graphClient';

// Get the graph endpoint from environment variables
const GRAPH_ENDPOINT = process.env.KAISIGN_GRAPH_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia';

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { searchParams } = new URL(request.url);
  const chainID = searchParams.get('chainId');
  const contractAddress = params.address;

  // Validate required parameters
  if (!chainID) {
    return NextResponse.json(
      { error: 'Missing required parameter: chainId' },
      { status: 400 }
    );
  }

  if (!contractAddress || contractAddress.length !== 42) {
    return NextResponse.json(
      { error: 'Invalid contract address format' },
      { status: 400 }
    );
  }

  try {
    const client = new KaiSignGraphClient(GRAPH_ENDPOINT);
    
    // Get contract functions
    const functions = await client.getContractFunctions(contractAddress, chainID);
    
    if (functions.length === 0) {
      return NextResponse.json(
        { 
          error: 'Contract not found',
          message: 'No metadata found for this contract',
          recognized: false
        },
        { status: 404 }
      );
    }

    // Get spec history
    const specHistory = await client.getContractSpecHistory(contractAddress, chainID);

    return NextResponse.json({
      success: true,
      recognized: true,
      data: {
        contract: contractAddress,
        chainId: chainID,
        functions: functions.map(func => ({
          selector: func.selector,
          name: func.name,
          intent: func.intent,
          displayFormat: func.displayFormat,
          parameterTypes: func.parameterTypes
        })),
        specHistory: specHistory.map(spec => ({
          id: spec.id,
          creator: spec.creator,
          blobHash: spec.blobHash,
          timestamp: spec.createdTimestamp,
          status: spec.status
        })),
        totalFunctions: functions.length,
        lastUpdated: specHistory[0]?.createdTimestamp
      }
    });

  } catch (error) {
    console.error('Failed to get contract data:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
