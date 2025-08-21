import { NextRequest, NextResponse } from 'next/server';
import { KaiSignGraphClient } from '~/lib/graphClient';

// Get the graph endpoint from environment variables
const GRAPH_ENDPOINT = process.env.KAISIGN_GRAPH_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/kai-sign/kaisign-sepolia';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, data, value, chainId, gasLimit } = body;

    // Validate required parameters
    if (!to) {
      return NextResponse.json(
        { error: 'Missing required field: to' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Missing required field: data' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { error: 'Missing required field: chainId' },
        { status: 400 }
      );
    }

    // Validate data format
    if (typeof data !== 'string' || !data.startsWith('0x') || data.length < 10) {
      return NextResponse.json(
        { error: 'Invalid transaction data format' },
        { status: 400 }
      );
    }

    // Extract function selector
    const selector = data.slice(0, 10);
    const params = data.slice(10);

    const client = new KaiSignGraphClient(GRAPH_ENDPOINT);
    const metadata = await client.getTransactionMetadata(to, selector, chainId);

    // Format ETH value
    const formatValue = (val: string) => {
      if (!val || val === '0') return null;
      try {
        const eth = BigInt(val) / BigInt(10**18);
        return `${eth} ETH`;
      } catch {
        return val;
      }
    };

    const response = {
      success: true,
      transaction: {
        to,
        data,
        value: value || '0',
        chainId,
        gasLimit,
        selector,
        parametersHex: params || null
      },
      analysis: {
        recognized: metadata !== null,
        metadata: metadata ? {
          functionName: metadata.name,
          intent: metadata.intent,
          displayFormat: metadata.displayFormat,
          parameterTypes: metadata.parameterTypes
        } : null
      },
      preview: {
        action: metadata ? metadata.intent : 'Unknown function call',
        formattedValue: formatValue(value || '0'),
        isContract: true, // We're only dealing with contract calls in this context
        riskLevel: metadata ? 'LOW' : 'HIGH' // Higher risk for unrecognized functions
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to analyze transaction:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to analyze transaction'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'Use POST to analyze transactions',
    expectedFormat: {
      to: 'string - contract address',
      data: 'string - transaction calldata (0x...)',
      chainId: 'string - blockchain chain ID',
      value: 'string - ETH value (optional)',
      gasLimit: 'string - gas limit (optional)'
    }
  }, { status: 405 });
}
