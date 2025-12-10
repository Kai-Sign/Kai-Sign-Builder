import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Dynamically import c-kzg only at runtime (avoid bundler resolution)
let cKzg: any;
try {
  const req = eval('require') as (m: string) => any;
  cKzg = req("c-kzg");
} catch {}

// Minimum size for cost-effective blob upload (24KB)
const MIN_BLOB_DATA_SIZE = 24 * 1024;
// Padding marker to identify padded content
const PADDING_MARKER = "\n\n/* ERC7730_BLOB_PADDING_START */\n";

function toBlob(data: string): Uint8Array {
  const BLOB_SIZE = 131072; // 4096 * 32
  const blob = new Uint8Array(BLOB_SIZE);
  const bytes = Buffer.from(data);
  let blobIndex = 0;
  for (let i = 0; i < bytes.length; i++) {
    const fieldIndex = Math.floor(blobIndex / 31);
    const byteIndex = blobIndex % 31;
    if (fieldIndex >= 4096) break;
    const byteVal = bytes[i] ?? 0;
    blob[fieldIndex * 32 + byteIndex + 1] = byteVal;
    blobIndex++;
  }
  return blob;
}

/**
 * Add padding to data if it's too small for cost-effective blob upload.
 * The padding is clearly marked so it can be stripped when reading.
 */
function addPaddingIfNeeded(data: string): { paddedData: string; wasPadded: boolean } {
  if (data.length >= MIN_BLOB_DATA_SIZE) {
    return { paddedData: data, wasPadded: false };
  }

  const paddingNeeded = MIN_BLOB_DATA_SIZE - data.length - PADDING_MARKER.length;
  if (paddingNeeded <= 0) {
    return { paddedData: data, wasPadded: false };
  }

  // Create padding with repeating pattern for easy identification
  const paddingPattern = "0";
  const padding = paddingPattern.repeat(paddingNeeded);

  return {
    paddedData: data + PADDING_MARKER + padding,
    wasPadded: true
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.json === "undefined") {
      return NextResponse.json({ error: "Expected { json }" }, { status: 400 });
    }

    // Use PublicNode RPC which supports post-Fusaka blob transactions
    const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

    if (!cKzg) {
      return NextResponse.json({ error: "c-kzg not available on server" }, { status: 500 });
    }

    // Initialize KZG iff not loaded
    try {
      // Safe to call multiple times
      cKzg.loadTrustedSetup(0, cKzg.DEFAULT_TRUSTED_SETUP_PATH);
    } catch {}

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    let wallet: ethers.Signer;
    if (process.env.KEYSTORE_JSON && process.env.KEYSTORE_PASSWORD) {
      const hd = await ethers.Wallet.fromEncryptedJson(
        process.env.KEYSTORE_JSON,
        process.env.KEYSTORE_PASSWORD
      );
      wallet = hd.connect(provider);
    } else if (process.env.PRIVATE_KEY) {
      wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    } else {
      return NextResponse.json({ error: "No signer configured. Provide KEYSTORE_JSON+KEYSTORE_PASSWORD or PRIVATE_KEY." }, { status: 500 });
    }

    // Get original data string
    const originalDataStr = typeof body.json === "string" ? body.json : JSON.stringify(body.json);

    // Calculate metadata hash BEFORE padding (this is the semantic hash)
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(originalDataStr));

    // Add padding if needed for cost-effective blob upload
    const { paddedData, wasPadded } = addPaddingIfNeeded(originalDataStr);

    const blob = toBlob(paddedData);

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
    const baseFee = (latest && latest.baseFeePerGas !== undefined)
      ? latest.baseFeePerGas
      : ethers.parseUnits("1", "gwei");

    const tx = {
      type: 3,
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: 0n,
      chainId: 11155111,
      nonce,
      gasLimit: 21000n,
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      maxFeePerGas: (baseFee ?? ethers.parseUnits("1", "gwei")) * 2n + ethers.parseUnits("2", "gwei"),
      maxFeePerBlobGas: ethers.parseUnits("30", "gwei"),
      blobVersionedHashes: [versionedHash],
      kzg: cKzg,
      blobs: [blob],
    } as any;

    const resp = await wallet.sendTransaction(tx);
    const receipt = await resp.wait();

    return NextResponse.json({
      success: true,
      txHash: resp.hash,
      blockNumber: receipt?.blockNumber ?? null,
      blobVersionedHash: versionedHash,
      metadataHash: metadataHash, // Semantic hash (before padding)
      wasPadded: wasPadded,
      originalSize: originalDataStr.length,
      paddedSize: paddedData.length,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${resp.hash}`,
      blobscanUrl: `https://sepolia.blobscan.com/tx/${resp.hash}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Blob upload failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}


