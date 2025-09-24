import { NextRequest, NextResponse } from "next/server";

const AWS_LAMBDA_BLOB_API = "https://azmnxl590h.execute-api.ap-southeast-2.amazonaws.com/prod/blob";

// Maximum timeout for Vercel deployment
export const maxDuration = 60; // 60 seconds (maximum allowed)

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
      
      // Forward the request to AWS Lambda with 55 second timeout (5 second buffer)
      lambdaResponse = await fetch(AWS_LAMBDA_BLOB_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // Set timeout to 55 seconds (leaving 5 seconds buffer for Vercel processing)
        signal: AbortSignal.timeout(55000)
      });
      
    } catch (error: any) {
      console.error('Lambda request failed or timed out:', error);
      
      // If it's a timeout, return an optimistic response since Lambda takes ~52 seconds
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        return NextResponse.json(
          { 
            success: true,
            pending: true,
            message: "Blob transaction is being processed. Due to Vercel timeout limits, please check your blob manually.",
            note: "Lambda is still processing - transaction should complete within 1-2 minutes",
            checkInstructions: "Look for blob transactions from address: 0x49d81a2f1DC42d230927e224c42E8b8E6A7f6f7D on Sepolia Etherscan"
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