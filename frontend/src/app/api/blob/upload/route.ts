import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Dynamically import c-kzg only on the server
let cKzg: any;
try {
  // @ts-ignore
  cKzg = require("c-kzg");
} catch {}

function toBlob(data: string): Uint8Array {
  const BLOB_SIZE = 131072; // 4096 * 32
  const blob = new Uint8Array(BLOB_SIZE);
  const bytes = Buffer.from(data);
  let blobIndex = 0;
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;
    if (fieldIndex >= 4096) break;
    blob[fieldIndex * 32 + byteIndex + 1] = bytes[i];
    blobIndex++;
  }
  return blob;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.json === "undefined") {
      return NextResponse.json({ error: "Expected { json }" }, { status: 400 });
    }

    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    if (!PRIVATE_KEY || !RPC_URL) {
      return NextResponse.json({ error: "Missing PRIVATE_KEY or SEPOLIA_RPC_URL" }, { status: 500 });
    }
    if (!cKzg) {
      return NextResponse.json({ error: "c-kzg not available on server" }, { status: 500 });
    }

    // Initialize KZG iff not loaded
    try {
      // Safe to call multiple times
      cKzg.loadTrustedSetup(0, cKzg.DEFAULT_TRUSTED_SETUP_PATH);
    } catch {}

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const dataStr = typeof body.json === "string" ? body.json : JSON.stringify(body.json);
    const blob = toBlob(dataStr);

    const commitment: Uint8Array = cKzg.blobToKzgCommitment(blob);
    const proof: Uint8Array = cKzg.computeBlobKzgProof(blob, commitment);
    const isValid: boolean = cKzg.verifyBlobKzgProof(blob, commitment, proof);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid KZG proof" }, { status: 400 });
    }

    const commitmentHash = ethers.sha256(commitment);
    const versionedHash = ("0x01" + commitmentHash.substring(4)) as `0x${string}`;

    const nonce = await wallet.getNonce();
    const latest = await provider.getBlock("latest");
    const baseFee = latest?.baseFeePerGas ?? ethers.parseUnits("1", "gwei");

    const tx = {
      type: 3,
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: 0n,
      chainId: 11155111,
      nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      maxFeePerGas: baseFee + ethers.parseUnits("5", "gwei"),
      maxFeePerBlobGas: ethers.parseUnits("30", "gwei"),
      blobVersionedHashes: [versionedHash],
      kzg: cKzg,
      blobs: [blob],
    } as any;

    const resp = await wallet.sendTransaction(tx);
    const receipt = await resp.wait();

    return NextResponse.json({
      txHash: resp.hash,
      blockNumber: receipt?.blockNumber ?? null,
      blobVersionedHash: versionedHash,
      etherscanBlobUrl: `https://sepolia.etherscan.io/blob/${versionedHash}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Blob upload failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}


