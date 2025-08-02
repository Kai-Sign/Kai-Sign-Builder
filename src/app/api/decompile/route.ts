import { NextRequest, NextResponse } from 'next/server';
import { analyzeBytecode } from '../../../lib/bytecodeDecompiler';
import { analyzeWithERC7730 } from '../../../lib/erc7730Matcher';
import { ClearSigningResolver, type Transaction } from '../../../lib/clearSigningResolver';
import { type Address } from 'viem';

// Helper to convert BigInt to string in JSON
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function POST(request: NextRequest) {
  try {
    const { bytecode, contractAddress, chainId } = await request.json();
    
    if (!bytecode) {
      return NextResponse.json(
        { error: 'Missing required field: bytecode' },
        { status: 400 }
      );
    }
    
    // Initialize Clear Signing Resolver (Ledger approach)
    const resolver = new ClearSigningResolver();
    
    // Create transaction object for resolver
    const transaction: Transaction = {
      to: contractAddress || '0x0000000000000000000000000000000000000000',
      data: bytecode,
      chainId: chainId || 1
    };
    
    // Analyze bytecode using original decompiler
    const analysis = await analyzeBytecode(
      bytecode,
      contractAddress as Address,
      chainId || 1
    );
    
    // Use Clear Signing Resolver for enhanced analysis
    const resolution = await resolver.resolveTransaction(transaction, {
      erc20: true,
      nft: true,
      externalPlugins: true,
      domains: ['ENS']
    });
    
    const summary = resolver.getResolutionSummary(resolution);
    
    if (analysis.decompiled.error && !resolution.contractMethod) {
      return NextResponse.json({
        success: false,
        error: analysis.decompiled.error,
        analysis,
        ledgerResolution: resolution,
        summary
      });
    }
    
    // Try to match with ERC-7730 metadata
    const erc7730Analysis = contractAddress ? await analyzeWithERC7730(
      bytecode,
      contractAddress as Address,
      chainId || 1,
      analysis.decompiled
    ) : { metadata: null, matched: {}, hardwareDisplay: [] };
    
    return NextResponse.json(serializeBigInt({
      success: true,
      analysis,
      ledgerResolution: resolution,
      summary,
      erc7730: {
        metadata: erc7730Analysis.metadata,
        matched: erc7730Analysis.matched,
        hardwareDisplay: erc7730Analysis.hardwareDisplay
      }
    }));
    
  } catch (error) {
    console.error('Decompilation error:', error);
    return NextResponse.json(
      { error: 'Failed to decompile bytecode', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}