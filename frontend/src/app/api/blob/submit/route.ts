import { NextRequest, NextResponse } from "next/server";

const AWS_LAMBDA_BLOB_API = "https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob";

// Extend the timeout for this API route
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.json === "undefined") {
      return NextResponse.json({ error: "Expected { json }" }, { status: 400 });
    }

    // Forward the request to AWS Lambda with longer timeout
    const lambdaResponse = await fetch(AWS_LAMBDA_BLOB_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // No timeout - let it run as long as needed
    });

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text().catch(() => '');
      console.error('Lambda API error:', errorText);
      return NextResponse.json(
        { error: "AWS Lambda blob posting failed", message: errorText || `HTTP ${lambdaResponse.status}` },
        { status: lambdaResponse.status }
      );
    }

    const lambdaData = await lambdaResponse.json();
    
    console.log('Lambda response:', lambdaData); // Debug log
    
    // Check for success field and blob hash (the restored Lambda returns "blobHash")
    if (lambdaData?.success && lambdaData?.blobHash) {
      // Transform to expected frontend format
      const result = {
        txHash: lambdaData.blobTransactionHash,
        blobVersionedHash: lambdaData.blobHash,
        etherscanBlobUrl: lambdaData.blobUrl,
        blockNumber: lambdaData.blockNumber,
        success: true
      };
      return NextResponse.json(result);
    }
    
    // If no success field but has blob data, assume success
    if (lambdaData?.blobVersionedHash || lambdaData?.blobHash) {
      const result = {
        txHash: lambdaData.txHash || lambdaData.blobTransactionHash || lambdaData.transactionHash,
        blobVersionedHash: lambdaData.blobVersionedHash || lambdaData.blobHash,
        etherscanBlobUrl: lambdaData.etherscanBlobUrl || lambdaData.blobUrl || `https://sepolia.etherscan.io/blob/${lambdaData.blobVersionedHash || lambdaData.blobHash}`,
        blockNumber: lambdaData.blockNumber,
        success: true
      };
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Lambda response missing blob data", response: lambdaData }, { status: 500 });

  } catch (err: any) {
    console.error('Blob submit error:', err);
    return NextResponse.json(
      { error: "Blob submission failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}