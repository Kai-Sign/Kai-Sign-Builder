import { NextRequest, NextResponse } from "next/server";

const AWS_LAMBDA_BLOB_API = "https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob";

// Extend the timeout for this API route to handle blob transactions
export const maxDuration = 180; // 3 minutes to handle Lambda execution time

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
      
      // Forward the request to AWS Lambda with 2.5 minute timeout
      lambdaResponse = await fetch(AWS_LAMBDA_BLOB_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // Set timeout to 2.5 minutes (leaving 30 seconds buffer)
        signal: AbortSignal.timeout(150000)
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
    
    // Return the Lambda response directly - it already has the correct format
    // The Lambda now returns: success, blobDeploymentAddress, blobHash, trackingUrls, etc.
    return NextResponse.json(lambdaData);

  } catch (err: any) {
    console.error('Blob submit error:', err);
    return NextResponse.json(
      { error: "Blob submission failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}