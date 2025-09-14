import { NextRequest, NextResponse } from "next/server";

// EthStorage blob posting - now handled client-side with wallet connection
// This API endpoint provides storage cost estimation and validation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.json === "undefined") {
      return NextResponse.json({ error: "Expected { json }" }, { status: 400 });
    }

    // This endpoint now returns instructions for client-side blob posting
    // The actual blob posting happens in the frontend with wallet connection
    
    return NextResponse.json({
      success: true,
      requiresWallet: true,
      message: "EthStorage blob posting requires wallet connection",
      instructions: {
        step1: "Connect wallet with sufficient ETH for storage fees",
        step2: "Use EthStorage service to post blob with wallet signer", 
        step3: "Blob will be stored permanently on EthStorage Layer 2",
        estimatedCost: "~0.001 ETH for storage fees"
      }
    });

  } catch (err: any) {
    console.error('Blob submit error:', err);
    return NextResponse.json(
      { error: "Blob submission failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}