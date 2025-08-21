import { NextRequest, NextResponse } from "next/server";

// Server-side IPFS upload using Pinata pinJSONToIPFS
// Keeps secrets on the server; the client calls this route with JSON payload

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || (typeof body.json === "undefined" && typeof body.content === "undefined")) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: "Expected { json: object | string } or { content: object | string }",
        },
        { status: 400 },
      );
    }

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return NextResponse.json(
        {
          error: "Server not configured",
          details: "Missing PINATA_JWT environment variable on the server",
        },
        { status: 500 },
      );
    }

    // Normalize payload
    const jsonPayload = typeof body.json !== "undefined" ? body.json : body.content;

    // Build pinJSONToIPFS request
    const pinataUrl = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
    const pinBody = {
      pinataMetadata: {
        name: body.name || "ERC7730-Specification",
        keyvalues: {
          type: body.type || "erc7730",
          timestamp: new Date().toISOString(),
        },
      },
      pinataOptions: {
        cidVersion: 0,
      },
      pinataContent: jsonPayload,
    };

    const resp = await fetch(pinataUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        {
          error: "Pinata upload failed",
          details: text || `${resp.status} ${resp.statusText}`,
        },
        { status: 502 },
      );
    }

    const result = await resp.json();
    if (!result.IpfsHash) {
      return NextResponse.json(
        { error: "Pinata response missing IpfsHash" },
        { status: 502 },
      );
    }

    return NextResponse.json({ IpfsHash: result.IpfsHash });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: err?.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}


