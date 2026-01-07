/**
 * Keccak256 implementation for function selector calculation
 * Uses native implementation without external dependencies
 */

const KECCAK_ROUNDS = 24;

const KECCAK_RC: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const KECCAK_ROTC = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const KECCAK_PILN = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];

function rotl64(x: bigint, y: number): bigint {
  return ((x << BigInt(y)) | (x >> BigInt(64 - y))) & 0xffffffffffffffffn;
}

function keccakF(state: bigint[]): void {
  for (let round = 0; round < KECCAK_ROUNDS; round++) {
    const c: bigint[] = new Array(5).fill(0n);

    for (let x = 0; x < 5; x++) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }

    for (let x = 0; x < 5; x++) {
      const t = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) {
        state[x + y] ^= t;
      }
    }

    let t = state[1];
    for (let i = 0; i < 24; i++) {
      const j = KECCAK_PILN[i];
      const tmp = state[j];
      state[j] = rotl64(t, KECCAK_ROTC[i]);
      t = tmp;
    }

    for (let y = 0; y < 25; y += 5) {
      const t0 = state[y];
      const t1 = state[y + 1];
      const t2 = state[y + 2];
      const t3 = state[y + 3];
      const t4 = state[y + 4];
      state[y] = t0 ^ (~t1 & t2);
      state[y + 1] = t1 ^ (~t2 & t3);
      state[y + 2] = t2 ^ (~t3 & t4);
      state[y + 3] = t3 ^ (~t4 & t0);
      state[y + 4] = t4 ^ (~t0 & t1);
    }

    state[0] ^= KECCAK_RC[round];
  }
}

/**
 * Calculate keccak256 hash of a string message
 * @param message - UTF-8 string to hash
 * @returns 0x-prefixed hex hash string
 */
export function keccak256(message: string): string {
  const encoder = new TextEncoder();
  const input = encoder.encode(message);
  const blockSize = 136; // Rate for keccak256
  const state: bigint[] = new Array(25).fill(0n);

  // Pad input: 0x01 || zeros || 0x80
  const padded = new Uint8Array(Math.ceil((input.length + 1) / blockSize) * blockSize);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  // Absorb
  for (let i = 0; i < padded.length; i += blockSize) {
    for (let j = 0; j < blockSize && j < 200; j += 8) {
      if (i + j + 8 <= padded.length) {
        let val = 0n;
        for (let k = 0; k < 8; k++) {
          val |= BigInt(padded[i + j + k]) << BigInt(k * 8);
        }
        state[Math.floor(j / 8)] ^= val;
      }
    }
    keccakF(state);
  }

  // Squeeze - output 32 bytes (256 bits)
  let hash = '0x';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      hash += ((state[i] >> BigInt(j * 8)) & 0xffn).toString(16).padStart(2, '0');
    }
  }

  return hash;
}

/**
 * Calculate keccak256 hash of raw bytes
 * @param bytes - Uint8Array of bytes to hash
 * @returns 0x-prefixed hex hash string
 */
export function keccak256Bytes(bytes: Uint8Array): string {
  const blockSize = 136;
  const state: bigint[] = new Array(25).fill(0n);

  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / blockSize) * blockSize);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let i = 0; i < padded.length; i += blockSize) {
    for (let j = 0; j < blockSize && j < 200; j += 8) {
      if (i + j + 8 <= padded.length) {
        let val = 0n;
        for (let k = 0; k < 8; k++) {
          val |= BigInt(padded[i + j + k]) << BigInt(k * 8);
        }
        state[Math.floor(j / 8)] ^= val;
      }
    }
    keccakF(state);
  }

  let hash = '0x';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      hash += ((state[i] >> BigInt(j * 8)) & 0xffn).toString(16).padStart(2, '0');
    }
  }

  return hash;
}

/**
 * Calculate function selector from function signature
 * @param signature - Function signature like "transfer(address,uint256)"
 * @returns 4-byte selector like "0xa9059cbb"
 */
export function calculateSelector(signature: string): string {
  const hash = keccak256(signature);
  return hash.slice(0, 10); // First 4 bytes = 10 hex chars including 0x
}

/**
 * Extract function selector from calldata
 * @param data - Calldata hex string
 * @returns 4-byte selector or null if invalid
 */
export function extractSelector(data: string): string | null {
  if (!data || typeof data !== 'string') return null;
  const normalized = data.startsWith('0x') ? data : '0x' + data;
  if (normalized.length < 10) return null;
  return normalized.slice(0, 10).toLowerCase();
}
