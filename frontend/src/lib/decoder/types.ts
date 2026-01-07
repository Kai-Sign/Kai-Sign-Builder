/**
 * TypeScript type definitions for the KaiSign decoder
 * Handles raw bytecode decoding and ERC-7730 metadata
 */

// ============================================
// Input Types
// ============================================

export interface RawCalldataInput {
  type: 'raw';
  data: string; // 0x-prefixed calldata
  contractAddress: string;
  chainId: number;
}

export interface RLPTransactionInput {
  type: 'rlp';
  data: string; // Full RLP-encoded transaction
  chainId?: number; // Optional, can be extracted from RLP
}

export interface ParsedTransactionInput {
  type: 'parsed';
  data: string;
  to?: string;
  value?: string;
  chainId: number;
  nonce?: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: AccessListItem[];
  authorizationList?: AuthorizationTuple[]; // EIP-7702
}

export type TransactionInput = RawCalldataInput | RLPTransactionInput | ParsedTransactionInput;

// ============================================
// Transaction Types
// ============================================

export const TX_TYPES = {
  LEGACY: 0x0,
  ACCESS_LIST: 0x1,
  EIP1559: 0x2,
  EIP7702: 0x4,
} as const;

export type TransactionType = typeof TX_TYPES[keyof typeof TX_TYPES];

export interface AccessListItem {
  address: string;
  storageKeys: string[];
}

export interface AuthorizationTuple {
  chainId: number | string;
  address: string;
  nonce: number | string;
  yParity?: number | string;
  r?: string;
  s?: string;
}

// ============================================
// ABI Types
// ============================================

export interface AbiInput {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiInput[];
  internalType?: string;
}

export interface AbiOutput {
  name: string;
  type: string;
  components?: AbiOutput[];
  internalType?: string;
}

export interface AbiFunction {
  type: 'function';
  name: string;
  inputs: AbiInput[];
  outputs?: AbiOutput[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  selector?: string;
}

export interface AbiEvent {
  type: 'event';
  name: string;
  inputs: AbiInput[];
  anonymous?: boolean;
}

export interface AbiError {
  type: 'error';
  name: string;
  inputs: AbiInput[];
}

export interface AbiConstructor {
  type: 'constructor';
  inputs: AbiInput[];
  stateMutability?: 'nonpayable' | 'payable';
}

export interface AbiFallback {
  type: 'fallback' | 'receive';
  stateMutability?: 'payable';
}

export type AbiItem = AbiFunction | AbiEvent | AbiError | AbiConstructor | AbiFallback;

// ============================================
// Decoded Parameter Types
// ============================================

export interface BigNumberLike {
  _isBigNumber: true;
  _hex: string;
  toString: () => string;
}

export interface DecodedParameter {
  name: string;
  type: string;
  value: string | number | boolean | bigint | DecodedParameter[] | Record<string, unknown>;
  components?: DecodedParameter[];
  valueDecoded?: DecodedCall; // For nested calldata
}

// ============================================
// Decoded Call/Transaction Types
// ============================================

export interface FormattedField {
  label: string;
  value: string;
  rawValue?: string;
  format: string;
  description?: string;
  params?: Record<string, unknown>;
}

export interface DecodedCall {
  success: boolean;
  selector: string;
  function?: string; // Full signature like "transfer(address,uint256)"
  functionName?: string;
  params: Record<string, string>;
  rawParams?: Record<string, unknown>;
  formatted: Record<string, FormattedField>;
  intent: string;
  error?: string;
  decodedCommands?: DecodedCommand[]; // For Universal Router
  fieldPaths?: Record<string, FieldPathInfo>;
}

export interface FieldPathInfo {
  paramName: string;
  componentName?: string;
  type: string;
  arrayIndex?: number;
}

export interface DecodedCommand {
  command: string;
  name: string;
  intent: string;
  params: Record<string, unknown>;
}

export interface NestedCall {
  index: number;
  target: string;
  bytecode: string;
  selector: string | null;
  value: string;
  callType: 'CALL' | 'DELEGATECALL' | 'USEROP' | 'EMBEDDED' | 'PATTERN_DETECTED';
  parentCall: string;
  parameterName?: string;
  tupleFields?: Record<string, unknown>;
  decoded?: DecodedCall;
  intent?: string;
  depth: number;
  delegationContext?: Delegation;
  actualExecutionTarget?: string;
  deadline?: number;
  command?: number;
  note?: string;
}

export interface Delegation {
  chainId: number | string;
  address: string;
  nonce: number | string;
  yParity?: number | string;
  r?: string;
  s?: string;
  isRevocation: boolean;
  delegateCode: string | null;
  delegateMetadata: ERC7730Metadata | null;
}

export interface DecodedTransaction {
  success: boolean;
  txType: 'legacy' | 'EIP-1559' | 'EIP-7702' | 'unknown';
  chainId: number;
  nonce?: number;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  gasLimit?: string;
  to?: string;
  value?: string;
  data?: string;
  accessList?: AccessListItem[];
  authorizationList?: AuthorizationTuple[];
  mainCall?: DecodedCall;
  nestedCalls?: NestedCall[];
  nestedIntents?: string[];
  allIntents?: string[];
  aggregatedIntent?: string;
  delegations?: Delegation[];
  intent: string;
  error?: string;
}

// ============================================
// ERC-7730 Metadata Types
// ============================================

export interface ERC7730Metadata {
  $schema?: string;
  context?: {
    contract?: {
      abi: AbiItem[];
      deployments?: ContractDeployment[];
      name?: string;
      symbol?: string;
      decimals?: number;
      selectorFallbacks?: Record<string, string>;
    };
    eip712?: {
      domain?: Record<string, unknown>;
      schemas?: Record<string, unknown>[];
    };
  };
  display?: {
    formats: Record<string, FormatDefinition>;
  };
  metadata?: {
    owner?: string;
    info?: {
      url?: string;
      legalName?: string;
    };
    token?: TokenInfo;
    name?: string;
    symbol?: string;
    decimals?: number;
  };
  parsing?: {
    multicallStructure?: MulticallStructure;
  };
  messages?: Record<string, MessageFormat>;
  commandRegistries?: Record<string, CommandRegistry>;
}

export interface ContractDeployment {
  chainId: number;
  address: string;
}

export interface FormatDefinition {
  intent?: string | IntentConfig;
  interpolatedIntent?: string;
  fields?: FieldDefinition[];
}

export interface IntentConfig {
  type?: 'composite' | 'interpolated';
  template?: string;
  registry?: string;
  source?: string;
  separator?: string;
  maxDisplay?: number;
  overflow?: string;
  format?: IntentFormatItem[];
}

export interface IntentFormatItem {
  type: 'text' | 'container' | 'calldata' | 'multicallDecoder' | 'multicallSummary';
  value?: string;
  format?: string;
  fields?: IntentFormatItem[];
  path?: string;
  label?: string;
  to?: string;
  params?: Record<string, unknown>;
}

export interface FieldDefinition {
  path: string;
  label?: string;
  format?: string;
  description?: string;
  type?: string;
  to?: string;
  params?: FieldParams;
}

export interface FieldParams {
  decimals?: number;
  symbol?: string;
  tokenPath?: string;
  calleePath?: string;
  [key: string]: unknown;
}

export interface TokenInfo {
  name?: string;
  symbol?: string;
  decimals?: number;
  address?: string;
}

export interface MulticallStructure {
  fields?: MulticallField[];
  operation?: { type: string; size: number };
  to?: { type: string; size: number };
  value?: { type: string; size: number };
  dataLength?: { type: string; size: number };
  data?: { type: string; dynamic: boolean };
  [key: string]: unknown;
}

export interface MulticallField {
  name: string;
  type: string;
  size?: number;
  dynamic?: boolean;
}

export interface MessageFormat {
  label?: string;
  fields?: FieldDefinition[];
}

export interface CommandRegistry {
  [commandCode: string]: CommandDefinition;
}

export interface CommandDefinition {
  name: string;
  intent?: string;
  inputs?: AbiInput[];
}

// ============================================
// Recursive Decoder Types
// ============================================

export interface RecursiveDecodeResult extends DecodedCall {
  depth: number;
  nestedDecodes?: NestedDecodeEntry[];
  nestedIntents?: string[];
  aggregatedIntent?: string;
  wrapperIntent?: string;
  truncated?: boolean;
}

export interface NestedDecodeEntry {
  fieldPath: string;
  targetAddress?: string;
  type?: 'calldata' | 'multicall';
  result: RecursiveDecodeResult | MulticallResult;
}

export interface MulticallResult {
  operations: MulticallOperation[];
  totalCount: number;
  truncated: boolean;
  intents: string[];
}

export interface MulticallOperation {
  index: number;
  operation?: number;
  operationType?: { name: string; color: string };
  to: string;
  value: string;
  data: string;
  selector: string | null;
  decoded?: DecodedCall;
}

// ============================================
// Metadata Service Types
// ============================================

export interface MetadataServiceConfig {
  apiBaseUrl?: string;
  subgraphUrl?: string;
  blobscanBaseUrl?: string;
  cacheTTL?: number;
}

export interface CachedMetadata {
  data: ERC7730Metadata;
  timestamp: number;
}

export interface CachedToken {
  data: TokenInfo;
  timestamp: number;
}

// ============================================
// Decoder Options
// ============================================

export interface DecoderOptions {
  maxDepth?: number;
  maxBytecodeNesting?: number;
}

export interface RecursiveDecoderOptions {
  maxDepth?: number;
}

// ============================================
// Utility Types
// ============================================

export type HexString = `0x${string}`;

export function isHexString(value: unknown): value is HexString {
  return typeof value === 'string' && /^0x[a-fA-F0-9]*$/.test(value);
}

export function isBigNumberLike(value: unknown): value is BigNumberLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_isBigNumber' in value &&
    (value as BigNumberLike)._isBigNumber === true
  );
}
