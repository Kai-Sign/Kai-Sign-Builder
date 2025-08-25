import { BigInt, Bytes, ipfs, json, JSONValue, TypedMap } from "@graphprotocol/graph-ts"
import {
  LogCommitSpec as LogCommitSpecEvent,
  LogRevealSpec as LogRevealSpecEvent,
  LogCreateSpec as LogCreateSpecEvent,
  LogHandleResult as LogHandleResultEvent,
  LogProposeSpec as LogProposeSpecEvent,
  LogIncentiveCreated as LogIncentiveCreatedEvent,
  LogIncentiveClaimed as LogIncentiveClaimedEvent,
  LogIncentiveClawback as LogIncentiveClawbackEvent,
  LogContractSpecAdded as LogContractSpecAddedEvent,
  LogEmergencyPause as LogEmergencyPauseEvent,
  LogEmergencyUnpause as LogEmergencyUnpauseEvent
} from "../generated/KaiSign/KaiSign"
import {
  Contract,
  Function,
  LogCommitSpec,
  LogRevealSpec,
  LogCreateSpec,
  LogHandleResult,
  LogProposeSpec,
  LogIncentiveCreated,
  LogIncentiveClaimed,
  LogIncentiveClawback,
  LogContractSpecAdded,
  LogEmergencyPause,
  LogEmergencyUnpause,
  Spec
} from "../generated/schema"

export function handleLogCommitSpec(event: LogCommitSpecEvent): void {
  let entity = new LogCommitSpec(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.committer = event.params.committer
  entity.commitmentId = event.params.commitmentId
  entity.targetContract = event.params.targetContract
  entity.chainId = event.params.chainId
  entity.bondAmount = event.params.bondAmount
  entity.revealDeadline = event.params.revealDeadline

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogRevealSpec(event: LogRevealSpecEvent): void {
  let entity = new LogRevealSpec(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.creator = event.params.creator
  entity.specID = event.params.specID
  entity.commitmentId = event.params.commitmentId
  entity.blobHash = event.params.blobHash
  entity.targetContract = event.params.targetContract
  entity.chainId = event.params.chainId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogCreateSpec(event: LogCreateSpecEvent): void {
  // Save the log entity
  let logEntity = new LogCreateSpec(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  logEntity.creator = event.params.creator
  logEntity.specID = event.params.specID
  logEntity.blobHash = event.params.blobHash
  logEntity.targetContract = event.params.targetContract
  logEntity.chainId = event.params.chainId
  logEntity.timestamp = event.params.timestamp
  logEntity.incentiveId = event.params.incentiveId

  logEntity.blockNumber = event.block.number
  logEntity.blockTimestamp = event.block.timestamp
  logEntity.transactionHash = event.transaction.hash
  logEntity.save()

  // Create or update the Spec entity
  let spec = new Spec(event.params.specID)
  spec.user = event.params.creator
  spec.blobHash = event.params.blobHash
  spec.targetContract = event.params.targetContract
  spec.chainID = event.params.chainId.toString()
  spec.status = "SUBMITTED"
  spec.blockTimestamp = event.block.timestamp
  spec.eventTimestamp = event.params.timestamp
  spec.incentiveId = event.params.incentiveId
  spec.isFinalized = false
  spec.isAccepted = false
  
  // Note: Blob data cannot be accessed directly in The Graph
  // Additional metadata would need to be included in the event or retrieved off-chain
  
  spec.save()
}

export function handleLogHandleResult(event: LogHandleResultEvent): void {
  // Save the log entity
  let logEntity = new LogHandleResult(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  logEntity.specID = event.params.specID
  logEntity.isAccepted = event.params.isAccepted

  logEntity.blockNumber = event.block.number
  logEntity.blockTimestamp = event.block.timestamp
  logEntity.transactionHash = event.transaction.hash
  logEntity.save()

  // Update the Spec entity
  let spec = Spec.load(event.params.specID)
  if (spec != null) {
    spec.isFinalized = true
    spec.isAccepted = event.params.isAccepted
    
    if (event.params.isAccepted) {
      spec.status = "FINALIZED"
      // Process approved spec if it's the latest
      processApprovedSpecIfLatest(spec)
    } else {
      spec.status = "CANCELLED"
    }
    
    spec.save()
  }
}

export function handleLogProposeSpec(event: LogProposeSpecEvent): void {
  let logEntity = new LogProposeSpec(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  logEntity.user = event.params.user
  logEntity.specID = event.params.specID
  logEntity.questionId = event.params.questionId
  logEntity.bond = event.params.bond

  logEntity.blockNumber = event.block.number
  logEntity.blockTimestamp = event.block.timestamp
  logEntity.transactionHash = event.transaction.hash
  logEntity.save()

  // Update the Spec entity
  let spec = Spec.load(event.params.specID)
  if (spec != null) {
    spec.questionId = event.params.questionId
    spec.status = "PROPOSED"
    spec.proposedTimestamp = event.block.timestamp
    spec.save()
  }
}

export function handleLogIncentiveCreated(event: LogIncentiveCreatedEvent): void {
  let entity = new LogIncentiveCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.incentiveId = event.params.incentiveId
  entity.creator = event.params.creator
  entity.targetContract = event.params.targetContract
  entity.chainId = event.params.chainId
  entity.amount = event.params.amount
  entity.deadline = event.params.deadline
  entity.description = event.params.description

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogIncentiveClaimed(event: LogIncentiveClaimedEvent): void {
  let entity = new LogIncentiveClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.incentiveId = event.params.incentiveId
  entity.claimer = event.params.claimer
  entity.specID = event.params.specID
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogIncentiveClawback(event: LogIncentiveClawbackEvent): void {
  let entity = new LogIncentiveClawback(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.incentiveId = event.params.incentiveId
  entity.creator = event.params.creator
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogContractSpecAdded(event: LogContractSpecAddedEvent): void {
  let entity = new LogContractSpecAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.targetContract = event.params.targetContract
  entity.specID = event.params.specID
  entity.creator = event.params.creator
  entity.chainId = event.params.chainId
  entity.blobHash = event.params.blobHash

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogEmergencyPause(event: LogEmergencyPauseEvent): void {
  let entity = new LogEmergencyPause(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.admin = event.params.admin

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogEmergencyUnpause(event: LogEmergencyUnpauseEvent): void {
  let entity = new LogEmergencyUnpause(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.admin = event.params.admin

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

// Process approved spec only if it's the latest for this contract+chain
function processApprovedSpecIfLatest(spec: Spec): void {
  if (!spec.chainID || !spec.targetContract) return
  
  // Create contract ID: address + chainID
  let chainIdString = spec.chainID !== null ? spec.chainID!.toString() : "unknown"
  let contractId = spec.targetContract.toHex() + "-" + chainIdString
  let contract = Contract.load(contractId)
  
  if (!contract) {
    // First approved spec for this contract+chain
    contract = new Contract(contractId)
    contract.address = spec.targetContract
    contract.chainID = chainIdString
    contract.hasApprovedMetadata = false
    contract.functionCount = 0
    contract.createdAt = spec.blockTimestamp
    contract.latestSpecTimestamp = spec.blockTimestamp
    contract.latestApprovedSpecID = spec.id.toHex()
    contract.name = ""
    contract.version = ""
    contract.updatedAt = spec.blockTimestamp
  } else {
    // Check if this spec is newer than current latest
    if (spec.blockTimestamp <= contract.latestSpecTimestamp) {
      // This spec is older, don't update Contract/Functions
      return
    }
    
    // This is newer - update latest tracking
    contract.latestSpecTimestamp = spec.blockTimestamp
    contract.latestApprovedSpecID = spec.id.toHex()
    contract.updatedAt = spec.blockTimestamp
    
    // Clear old functions - we'll recreate from latest spec
    clearContractFunctions(contractId)
  }
  
  // Process the latest spec metadata
  processSpecMetadata(contract, spec)
}

function clearContractFunctions(_contractId: string): void {
  // Note: In AssemblyScript/The Graph, we can't easily delete entities
  // The Function entities will be overwritten with new data from the latest spec
  // since they use the same ID format: contract-chainID-selector
}

function processSpecMetadata(contract: Contract, spec: Spec): void {
  // Note: Cannot fetch blob content directly in The Graph
  // Metadata processing would need to be handled off-chain
  // For now, just mark that we have approved metadata but don't process it
  
  contract.hasApprovedMetadata = true
  contract.functionCount = 0 // Cannot extract function data from blob
  contract.name = "Unknown" // Would need to get from off-chain
  contract.version = "Unknown"
  
  contract.save()
}

// Function removed: processSelectors() 
// Cannot process selector data from blobs in The Graph indexer
