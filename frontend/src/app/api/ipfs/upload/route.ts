// Deprecated: IPFS upload route replaced by blob upload. Keeping file to avoid 404s.
import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "IPFS upload is disabled. Use /api/blob/upload instead." }, { status: 410 });
}
