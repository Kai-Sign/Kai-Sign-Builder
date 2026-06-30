/**
 * Deployment Configuration
 *
 * Central registry of deployed contract addresses, RPC endpoints, and
 * merkle-root constants.  Every hardcoded address, RPC URL, or merkle
 * root in a test or script MUST be exported from here.
 *
 * ── How to update ───────────────────────────────────────────────────────
 * Registry addresses come from the latest KaiSignRegistry deployment.
 * Merkle roots are pinned from `build-seed-frontier.mjs` output and live in
 *   ../data/seed-frontier.json
 * Tests that compare against the live root import it from here so a
 * re-bake of the seed frontier propagates everywhere automatically.
 */

// =========================================================================
// Registry Contracts (Sepolia)
// =========================================================================

/** Current KaiSignRegistry on Sepolia — latest deployment. */
export const REGISTRY_NEW_SEPOLIA = '0x655084b6A0f2Ee600bd31A71820b5E068b7870d0';

/** Previous (v2) KaiSignRegistry on Sepolia — superseded. */
export const REGISTRY_PREVIOUS_SEPOLIA = '0x51052A4d116F2c50C8bAac6E3b6f9F9D04846A4C';

/** Original (v1) KaiSignRegistry on Sepolia — superseded. */
export const REGISTRY_OLD_SEPOLIA = '0xC203e8C22eFCA3C9218a6418f6d4281Cb7744dAa';

// =========================================================================
// RPC Endpoints
// =========================================================================

/** Public Sepolia RPC for test and deploy workflows. */
export const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

// =========================================================================
// Merkle Root — Pinned from live contract
// =========================================================================

/**
 * Live Sepolia merkle root for the new registry, verified 2026-04-25.
 *
 * When the seed frontier is re-baked with `build-seed-frontier.mjs`, update
 * this constant after verifying the on-chain root matches the new frontier.
 * Alternatively, read dynamically from seed-frontier.json at test-time
 * (see merkle-catchup.test.js for the dynamic approach).
 */
export const EXPECTED_NEW_REGISTRY_MERKLE_ROOT =
  '0xe09fe7b34856157aeb42654fd475355743230cb73574d5ad3cb157979aca062d';

// =========================================================================
// Known availability leaves (for P3 seed-presence tests)
// =========================================================================

/**
 * A known production availability leaf used to verify the bundled seed
 * frontier contains (or excludes) specific leaves.
 */
export const EXPORT_AVAILABILITY_LEAF_TX1 =
  '0xbe54c9ccb95cdbb64a7c9c4bf4b738e127d13fae4b8a0facc71577e300831578';

// =========================================================================
// Dynamic frontier reader
// =========================================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the path to seed-frontier.json relative to this file's location
 * in backend/metadata/.  Falls back to a common sibling path.
 */
export function resolveSeedFrontierPath() {
  // From backend/metadata/deployment.js → backend/data/seed-frontier.json
  return resolve(__dirname, '../data/seed-frontier.json');
}

/**
 * Load the live seed frontier from disk.
 * Returns null if the file doesn't exist.
 */
export function loadSeedFrontier() {
  const frontierPath = resolveSeedFrontierPath();
  if (!existsSync(frontierPath)) return null;
  return JSON.parse(readFileSync(frontierPath, 'utf8'));
}
