# Design Document

## Overview

This design implements a two-step process to update the KaiSign subgraph for the new contract deployment. First, we'll analyze the contract source code to identify all events and compare them with the current schema. Second, we'll update the subgraph configuration to point to the new contract address and redeploy.

## Architecture

The solution consists of two main components:

1. **Schema Comparison Tool**: Analyzes the contract source code and compares events with the current GraphQL schema
2. **Subgraph Deployment Tool**: Updates configuration files and redeploys the subgraph

## Components and Interfaces

### 1. Contract Event Analyzer

**Purpose**: Extract all event definitions from the KaiSign contract source code

**Input**: 
- Contract source code (from GitHub issue #7)
- Current ABI file (`graph/kaisign/abis/KaiSign.json`)

**Output**: 
- List of all events with their parameters and types
- Comparison report showing differences

**Key Events Identified in New Contract**:
- `LogCommitSpec(address indexed committer, bytes32 indexed commitmentId, address indexed targetContract, uint256 chainId, uint256 bondAmount, uint64 revealDeadline)`
- `LogRevealSpec(address indexed creator, bytes32 indexed specID, bytes32 indexed commitmentId, string ipfs, address targetContract, uint256 chainId)`
- `LogCreateSpec(address indexed creator, bytes32 indexed specID, string ipfs, address indexed targetContract, uint256 chainId, uint256 timestamp, bytes32 incentiveId)`
- `LogProposeSpec(address indexed user, bytes32 indexed specID, bytes32 questionId, uint256 bond)`
- `LogHandleResult(bytes32 indexed specID, bool isAccepted)`
- `LogIncentiveCreated(bytes32 indexed incentiveId, address indexed creator, address indexed targetContract, uint256 chainId, address token, uint256 amount, uint64 deadline, string description)`
- `LogIncentiveClaimed(bytes32 indexed incentiveId, address indexed claimer, bytes32 indexed specID, uint256 amount)`
- `LogIncentiveClawback(bytes32 indexed incentiveId, address indexed creator, uint256 amount)`
- `LogContractSpecAdded(address indexed targetContract, bytes32 indexed specID, address indexed creator, uint256 chainId)`
- `LogEmergencyPause(address indexed admin)`
- `LogEmergencyUnpause(address indexed admin)`

### 2. Schema Comparison Engine

**Purpose**: Compare extracted events with current GraphQL schema entities

**Current Schema Analysis**:
- Has entities for: `LogAssertSpecInvalid`, `LogAssertSpecValid`, `LogCreateSpec`, `LogHandleResult`, `LogProposeSpec`
- Missing entities for new events: `LogCommitSpec`, `LogRevealSpec`, `LogIncentiveCreated`, `LogIncentiveClaimed`, `LogIncentiveClawback`, `LogContractSpecAdded`, `LogEmergencyPause`, `LogEmergencyUnpause`
- `LogCreateSpec` signature has changed significantly

**Differences Identified**:
1. **Removed Events**: `LogAssertSpecInvalid` and `LogAssertSpecValid` are no longer present in the new contract (as noted in the contract comments)
2. **New Events**: `LogCommitSpec`, `LogRevealSpec`, `LogIncentiveCreated`, `LogIncentiveClaimed`, `LogIncentiveClawback`, `LogContractSpecAdded`, `LogEmergencyPause`, `LogEmergencyUnpause`
3. **Modified Events**: 
   - `LogCreateSpec` now has parameters: `(address indexed creator, bytes32 indexed specID, string ipfs, address indexed targetContract, uint256 chainId, uint256 timestamp, bytes32 incentiveId)`
   - `LogProposeSpec` now has parameters: `(address indexed user, bytes32 indexed specID, bytes32 questionId, uint256 bond)`
   - `LogHandleResult` now has parameters: `(bytes32 indexed specID, bool isAccepted)`

### 3. Configuration Updater

**Purpose**: Update subgraph configuration files with new contract address and event handlers

**Files to Update**:
- `graph/kaisign/subgraph.yaml`: Update contract address from `0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf` to `0xA2119F82f3F595DB34fa059785BeA2f4F78D418B`
- `graph/kaisign/schema.graphql`: Add missing event entities and update existing ones
- `graph/kaisign/src/kai-sign.ts`: Add/update event handlers for new events

### 4. Deployment Manager

**Purpose**: Execute the subgraph deployment process

**Steps**:
1. Generate updated ABI from contract source
2. Update schema with new/modified entities
3. Update subgraph.yaml with new address and event handlers
4. Build and deploy using Graph CLI

## Data Models

### New Entity Types Needed

```graphql
type LogCommitSpec @entity(immutable: true) {
  id: Bytes!
  committer: Bytes! # address
  commitmentId: Bytes! # bytes32
  targetContract: Bytes! # address
  chainId: BigInt! # uint256
  bondAmount: BigInt! # uint256
  revealDeadline: BigInt! # uint64
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogRevealSpec @entity(immutable: true) {
  id: Bytes!
  creator: Bytes! # address
  specID: Bytes! # bytes32
  commitmentId: Bytes! # bytes32
  ipfs: String! # string
  targetContract: Bytes! # address
  chainId: BigInt! # uint256
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogIncentiveCreated @entity(immutable: true) {
  id: Bytes!
  incentiveId: Bytes! # bytes32
  creator: Bytes! # address
  targetContract: Bytes! # address
  chainId: BigInt! # uint256
  token: Bytes! # address
  amount: BigInt! # uint256
  deadline: BigInt! # uint64
  description: String! # string
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogIncentiveClaimed @entity(immutable: true) {
  id: Bytes!
  incentiveId: Bytes! # bytes32
  claimer: Bytes! # address
  specID: Bytes! # bytes32
  amount: BigInt! # uint256
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogIncentiveClawback @entity(immutable: true) {
  id: Bytes!
  incentiveId: Bytes! # bytes32
  creator: Bytes! # address
  amount: BigInt! # uint256
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogContractSpecAdded @entity(immutable: true) {
  id: Bytes!
  targetContract: Bytes! # address
  specID: Bytes! # bytes32
  creator: Bytes! # address
  chainId: BigInt! # uint256
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogEmergencyPause @entity(immutable: true) {
  id: Bytes!
  admin: Bytes! # address
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type LogEmergencyUnpause @entity(immutable: true) {
  id: Bytes!
  admin: Bytes! # address
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

### Updated Event Entities

```graphql
# Updated LogCreateSpec - completely different signature
type LogCreateSpec @entity(immutable: true) {
  id: Bytes!
  creator: Bytes! # address (was 'user')
  specID: Bytes! # bytes32
  ipfs: String! # string
  targetContract: Bytes! # address (new field)
  chainId: BigInt! # uint256 (new field)
  timestamp: BigInt! # uint256 (new field)
  incentiveId: Bytes! # bytes32 (new field)
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

# Updated LogProposeSpec - same signature but need to verify handler
type LogProposeSpec @entity(immutable: true) {
  id: Bytes!
  user: Bytes! # address
  specID: Bytes! # bytes32
  questionId: Bytes! # bytes32
  bond: BigInt! # uint256
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

# Updated LogHandleResult - same signature but need to verify handler
type LogHandleResult @entity(immutable: true) {
  id: Bytes!
  specID: Bytes! # bytes32
  isAccepted: Boolean! # bool
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

## Error Handling

1. **Contract Analysis Errors**: If contract source parsing fails, provide clear error messages about syntax issues
2. **Schema Validation Errors**: Validate GraphQL schema syntax before deployment
3. **Deployment Errors**: Handle Graph CLI deployment failures with retry logic
4. **Network Errors**: Handle network connectivity issues during deployment

## Testing Strategy

1. **Unit Tests**: Test event extraction and schema comparison logic
2. **Integration Tests**: Test full workflow with mock contract data
3. **Deployment Tests**: Test subgraph deployment on testnet before mainnet
4. **Schema Validation**: Validate generated GraphQL schema syntax
5. **Event Handler Tests**: Test that new event handlers correctly process events

## Implementation Notes

- The new contract uses a commit-reveal pattern with `LogCommitSpec` and `LogRevealSpec` events
- Incentive system is new and requires tracking creation, claiming, and clawback events
- Emergency pause functionality is new and should be tracked
- The contract address needs to be updated from the old deployment to `0xA2119F82f3F595DB34fa059785BeA2f4F78D418B`
- Event signatures have changed, requiring ABI updates and new event handlers