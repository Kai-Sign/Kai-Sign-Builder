/**
 * Function Selector Registry
 *
 * Central, single source of truth for all function selectors used across
 * KaiSign test suites and scripts.  Every hardcoded 4-byte selector in a
 * test or fixture MUST be exported from here so that:
 *
 *   1. A selector change requires only one edit.
 *   2. Cross-referencing selectors across protocols is trivial.
 *   3. On-chain function-signature deprecations are easy to audit.
 *
 * Naming convention:  PROTOCOL_FUNCTION
 *   e.g.  SAFE_CREATE_PROXY_WITH_NONCE, LIFI_SWAP_SINGLE
 *
 * Selectors are derived via keccak256(fnSignature).slice(0, 10).
 *
 * ── How to add a new selector ───────────────────────────────────────────
 *   const { ethers } = require('ethers');
 *   ethers.id('myFunction(uint256)').slice(0, 10);
 *   // → '0x…'
 */

// =========================================================================
// Account Abstraction — Safe (Gnosis)
// =========================================================================
export const SAFE_CREATE_PROXY_WITH_NONCE = '0x1688f0b9';
export const SAFE_MULTI_SEND = '0x8d80ff0a';
export const SAFE_EXEC_TRANSACTION = '0x6a761202';
export const SAFE_ADD_OWNER_WITH_THRESHOLD = '0x0d582f13';

// =========================================================================
// Account Abstraction — ERC-4337
// =========================================================================
export const ENTRY_POINT_DEPOSIT_TO = '0xb760faf9';
export const ENTRY_POINT_HANDLE_OPS = '0x1fad948c';

// =========================================================================
// Account Abstraction — EIP-7702 (Ambire)
// =========================================================================
export const AMBIRE_EXECUTE_MULTIPLE = '0xabc5345e';
export const AMBIRE_EXECUTE = '0xb61d27f6';

// =========================================================================
// Token Standards — ERC-20 / ERC-721
// =========================================================================
export const ERC20_APPROVE = '0x095ea7b3';
export const ERC20_TRANSFER = '0xa9059cbb';
export const ERC20_TRANSFER_FROM = '0x23b872dd';
export const ERC721_SET_APPROVAL_FOR_ALL = '0xa22cb465';
export const WETH_WITHDRAW = '0x2e1a7d4d';

// =========================================================================
// DEX — 0x Exchange Proxy
// =========================================================================
export const ZERO_X_TRANSFORM_ERC20 = '0x415565b0';

// =========================================================================
// DEX — Balancer V2
// =========================================================================
export const BALANCER_SWAP = '0x52bbbe29';
export const BALANCER_JOIN_POOL = '0xb95cac28';
export const BALANCER_EXIT_POOL = '0x8bdb3913';

// =========================================================================
// DEX — Uniswap
// =========================================================================
export const UNISWAP_UNIVERSAL_ROUTER_EXECUTE = '0x3593564c';
export const UNISWAP_V3_FACTORY_CREATE_POOL = '0xa1671295';

// =========================================================================
// DEX — LiFi (LI.FI Diamond)
// =========================================================================
export const LIFI_SWAP_TOKENS_SINGLE_V3_ERC20TOERC20 = '0x4666fc80';
export const LIFI_SWAP_TOKENS_MULTIPLE_V3_ERC20TOERC20 = '0x5fd9ae2e';
export const LIFI_SWAP_AND_START_BRIDGE_TOKENS_VIA_SQUID = '0xa8f66666';

// Note: LiFi metadata has stored selector 0xdd081734 for
// swapTokensMultipleV3ERC20ToERC20 — the canonical (keccak256-derived)
// selector is 0x5fd9ae2e.  See popup-render-pipeline.test.js for the
// keccak256 match logic.

// =========================================================================
// DEX — CoW Protocol
// =========================================================================
export const COW_SETTLEMENT_SETTLE = '0xec6cb13f';

// =========================================================================
// DeFi — Fluid
// =========================================================================
export const FLUID_DEPOSIT = '0x6e553f65';

// =========================================================================
// LiFi non-canonical mirror (production metadata stores this one)
// =========================================================================
export const LIFI_SWAP_TOKENS_MULTIPLE_V3_STORED = '0xdd081734';

// =========================================================================
// Export selector lookup map
// =========================================================================
export const SELECTOR_MAP = {
  '0x1688f0b9': 'Safe createProxyWithNonce',
  '0x8d80ff0a': 'Safe multiSend',
  '0x6a761202': 'Safe execTransaction',
  '0x0d582f13': 'Safe addOwnerWithThreshold',
  '0xb760faf9': 'EntryPoint depositTo',
  '0x1fad948c': 'EntryPoint handleOps',
  '0xabc5345e': 'Ambire executeMultiple',
  '0xb61d27f6': 'Ambire execute',
  '0x095ea7b3': 'ERC-20 approve',
  '0xa9059cbb': 'ERC-20 transfer',
  '0xa22cb465': 'ERC-721 setApprovalForAll',
  '0x2e1a7d4d': 'WETH withdraw',
  '0x415565b0': '0x transformERC20',
  '0x52bbbe29': 'Balancer swap',
  '0xb95cac28': 'Balancer joinPool',
  '0x8bdb3913': 'Balancer exitPool',
  '0x3593564c': 'Uniswap UniversalRouter execute',
  '0xa1671295': 'Uniswap V3 Factory createPool',
  '0x4666fc80': 'LiFi swapTokensSingleV3ERC20ToERC20',
  '0x5fd9ae2e': 'LiFi swapTokensMultipleV3ERC20ToERC20 (canonical)',
  '0xa8f66666': 'LiFi swapAndStartBridgeTokensViaSquid',
  '0xdd081734': 'LiFi swapTokensMultipleV3ERC20ToERC20 (stored)',
  '0xec6cb13f': 'CoW Protocol settle',
  '0x6e553f65': 'Fluid deposit',
};
