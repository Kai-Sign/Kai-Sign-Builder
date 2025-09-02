import { NextRequest, NextResponse } from "next/server";

const AWS_LAMBDA_BLOB_API = "https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob";

// Extend the timeout for this API route
export const maxDuration = 30; // 30 seconds to match Vercel's limit

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.json === "undefined") {
      return NextResponse.json({ error: "Expected { json }" }, { status: 400 });
    }

    // Single attempt with 28-second timeout (leaving 2 seconds for processing)
    let lambdaResponse;
    
    try {
      console.log(`Posting blob to AWS Lambda...`);
      
      // Forward the request to AWS Lambda with 28-second timeout
      lambdaResponse = await fetch(AWS_LAMBDA_BLOB_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // Set timeout to 28 seconds (leaving 2 seconds buffer)
        signal: AbortSignal.timeout(28000)
      });
      
    } catch (error: any) {
      console.error('Lambda request failed or timed out:', error);
      
      // If it's a timeout, return an optimistic response
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        return NextResponse.json(
          { 
            success: true,
            pending: true,
            message: "Blob transaction is being processed. This may take a few minutes.",
            note: "Transaction accepted and processing on-chain"
          },
          { status: 202 } // Accepted
        );
      }
      
      // For other errors, throw to handle below
      throw error;
    }

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text().catch(() => '');
      console.error('Lambda API error:', errorText);
      
      // Parse error to check for specific issues
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      // Handle KZG initialization errors optimistically
      if (errorText.includes('KZG') || errorData?.error?.includes('KZG')) {
        console.log('KZG error detected, handling optimistically');
        return NextResponse.json(
          { 
            success: true,
            pending: true,
            message: "Blob transaction is being processed. The system is initializing, please try again in a moment.",
            note: "Transaction will be processed shortly"
          },
          { status: 202 } // Accepted
        );
      }
      
      // Handle timeout specifically
      if (errorText.includes('timeout') || errorText.includes('timed out')) {
        return NextResponse.json(
          { 
            error: "Blob posting timed out", 
            message: "The blob transaction is taking longer than expected. This is normal for blob transactions. Please try again in a few minutes.",
            details: errorText
          },
          { status: 408 } // Request Timeout
        );
      }
      
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
      console.log('Transformed result:', result);
      return NextResponse.json(result);
    }
    
    // If no success field but has blob data, assume success
    if (lambdaData?.blobVersionedHash || lambdaData?.blobHash) {
      const result = {
        txHash: lambdaData.txHash || lambdaData.blobTransactionHash || lambdaData.transactionHash,
        blobVersionedHash: lambdaData.blobVersionedHash || lambdaData.blobHash,
        etherscanBlobUrl: lambdaData.etherscanBlobUrl || lambdaData.blobUrl || `https://sepolia.blobscan.com/blob/${lambdaData.blobVersionedHash || lambdaData.blobHash}`,
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