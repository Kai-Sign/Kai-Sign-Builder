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

    // Retry logic for blob posting
    let lambdaResponse;
    let lastError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Attempt ${attempt} to post blob...`);
        
        // Forward the request to AWS Lambda with longer timeout
        lambdaResponse = await fetch(AWS_LAMBDA_BLOB_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          // Set a longer timeout to match our maxDuration
          signal: AbortSignal.timeout(240000) // 4 minutes
        });
        
        // If we get here, the request succeeded
        break;
        
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt < 3) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 10s max
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all attempts failed
    if (!lambdaResponse) {
      throw lastError || new Error('All retry attempts failed');
    }

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text().catch(() => '');
      console.error('Lambda API error:', errorText);
      
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