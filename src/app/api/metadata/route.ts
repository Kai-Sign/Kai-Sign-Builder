import { NextRequest, NextResponse } from 'next/server';
import { KaiSignGraphClient } from '~/lib/graphClient';

// Get the graph endpoint from environment variables
const GRAPH_ENDPOINT = process.env.KAISIGN_GRAPH_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainID = searchParams.get('chainId');
  const contractAddress = searchParams.get('contract');
  const selector = searchParams.get('selector');

  // Validate required parameters
  if (!chainID) {
    return NextResponse.json(
      { error: 'Missing required parameter: chainId' },
      { status: 400 }
    );
  }

  if (!contractAddress) {
    return NextResponse.json(
      { error: 'Missing required parameter: contract' },
      { status: 400 }
    );
  }

  if (!selector) {
    return NextResponse.json(
      { error: 'Missing required parameter: selector' },
      { status: 400 }
    );
  }

  try {
    const client = new KaiSignGraphClient(GRAPH_ENDPOINT);
    const metadata = await client.getTransactionMetadata(contractAddress, selector, chainID);

    if (!metadata) {
      return NextResponse.json(
        { 
          error: 'Function not found',
          message: 'No metadata found for this contract function',
          recognized: false
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recognized: true,
      data: {
        selector: metadata.selector,
        name: metadata.name,
        intent: metadata.intent,
        displayFormat: metadata.displayFormat,
        parameterTypes: metadata.parameterTypes,
        contract: contractAddress,
        chainId: chainID
      }
    });

  } catch (error) {
    console.error('Failed to get transaction metadata:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
