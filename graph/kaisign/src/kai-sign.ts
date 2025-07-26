import { BigInt, Bytes, ipfs, json, JSONValue, TypedMap } from "@graphprotocol/graph-ts"
import {
  LogAssertSpecInvalid as LogAssertSpecInvalidEvent,
  LogAssertSpecValid as LogAssertSpecValidEvent,
  LogCreateSpec as LogCreateSpecEvent,
  LogHandleResult as LogHandleResultEvent,
  LogProposeSpec as LogProposeSpecEvent
} from "../generated/KaiSign/KaiSign"
import {
  Contract,
  Function,
  LogAssertSpecInvalid,
  LogAssertSpecValid,
  LogCreateSpec,
  LogHandleResult,
  LogProposeSpec,
  Spec
} from "../generated/schema"

export function handleLogAssertSpecInvalid(
  event: LogAssertSpecInvalidEvent
): void {
  let entity = new LogAssertSpecInvalid(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.specID = event.params.specID
  entity.questionId = event.params.questionId
  entity.bond = event.params.bond

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleLogAssertSpecValid(event: LogAssertSpecValidEvent): void {
  let entity = new LogAssertSpecValid(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.user = event.params.user
  entity.specID = event.params.specID
  entity.questionId = event.params.questionId
  entity.bond = event.params.bond

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
  logEntity.user = event.params.user
  logEntity.specID = event.params.specID
  logEntity.ipfs = event.params.ipfs

  logEntity.blockNumber = event.block.number
  logEntity.blockTimestamp = event.block.timestamp
  logEntity.transactionHash = event.transaction.hash
  logEntity.save()

  // Create or update the Spec entity
  let spec = new Spec(event.params.specID)
  spec.user = event.params.user
  spec.ipfs = event.params.ipfs
  spec.status = "SUBMITTED"
  spec.blockTimestamp = event.block.timestamp
  spec.isFinalized = false
  spec.isAccepted = false
  
  // Extract chainID and contract address from IPFS metadata
  let metadata = ipfs.cat(event.params.ipfs)
  if (metadata) {
    let jsonData = json.fromBytes(metadata as Bytes)
    if (jsonData) {
      let jsonObject = jsonData.toObject()
      if (jsonObject) {
        let context = jsonObject.get("context")
        if (context) {
          let contextObj = context.toObject()
          if (contextObj) {
            let chainId = contextObj.get("chainId")
            if (chainId) {
              spec.chainID = chainId.toString()
            }
            // Get contract address from context
            let contract = contextObj.get("contract")
            if (contract) {
              let contractObj = contract.toObject()
              if (contractObj) {
                let deployedTo = contractObj.get("deployedTo")
                if (deployedTo) {
                  spec.targetContract = Bytes.fromHexString(deployedTo.toString())
                }
              }
            }
          }
        }
      }
    }
  }
  
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

function clearContractFunctions(contractId: string): void {
  // Note: In AssemblyScript/The Graph, we can't easily delete entities
  // The Function entities will be overwritten with new data from the latest spec
  // since they use the same ID format: contract-chainID-selector
}

function processSpecMetadata(contract: Contract, spec: Spec): void {
  // Fetch IPFS content
  let metadata = ipfs.cat(spec.ipfs)
  if (!metadata) return
  
  let jsonData = json.fromBytes(metadata as Bytes)
  if (!jsonData) return
  
  let jsonObject = jsonData.toObject()
  if (!jsonObject) return
  
  // Extract metadata
  let metadataObj = jsonObject.get("metadata")
  if (metadataObj) {
    let metadata = metadataObj.toObject()
    if (metadata) {
      let name = metadata.get("name")
      let version = metadata.get("version") 
      let description = metadata.get("description")
      
      if (name) contract.name = name.toString()
      if (version) contract.version = version.toString()
      if (description) contract.description = description.toString()
    }
  }
  
  contract.hasApprovedMetadata = true
  
  // Process selectors and create Function entities
  let selectors = jsonObject.get("selectors")
  let displayFormats = jsonObject.get("display")
  
  if (selectors && displayFormats) {
    let selectorsObj = selectors.toObject()
    let displayObj = displayFormats.toObject()
    
    if (selectorsObj && displayObj) {
      let formats = displayObj.get("formats")
      if (formats) {
        let formatsObj = formats.toObject()
        if (formatsObj) {
          processSelectors(contract, selectorsObj as TypedMap<string, JSONValue>, formatsObj as TypedMap<string, JSONValue>, spec.blockTimestamp)
        }
      }
    }
  }
  
  contract.save()
}

function processSelectors(
  contract: Contract,
  selectors: TypedMap<string, JSONValue>,
  formats: TypedMap<string, JSONValue>,
  timestamp: BigInt
): void {
  let functionCount = 0
  
  // Get entries as array for iteration
  let selectorEntries = selectors.entries
  for (let i = 0; i < selectorEntries.length; i++) {
    let entry = selectorEntries[i]
    let selector = entry.key
    let selectorData = entry.value.toObject()
    
    if (!selectorData) continue
    
    let formatName = selectorData.get("format")
    if (!formatName) continue
    
    let format = formats.get(formatName.toString())
    if (!format) continue
    
    let formatObj = format.toObject()
    if (!formatObj) continue
    
    let intent = formatObj.get("intent")
    if (!intent) continue
    
    // Create Function entity with unique ID: contract+chainID+selector
    let functionId = contract.id + "-" + selector
    let func = new Function(functionId)
    
    func.contract = contract.id
    func.selector = selector
    func.chainID = contract.chainID
    func.name = formatName.toString()
    func.intent = intent.toString()
    func.displayFormat = formatName.toString()
    func.createdAt = timestamp
    
    // Extract parameter types
    let params = selectorData.get("params")
    if (params) {
      let paramsArray = params.toArray()
      let paramTypes: string[] = []
      
      for (let j = 0; j < paramsArray.length; j++) {
        let param = paramsArray[j].toObject()
        if (param) {
          let abiType = param.get("abiType")
          if (abiType) {
            paramTypes.push(abiType.toString())
          }
        }
      }
      
      func.parameterTypes = paramTypes
    }
    
    func.save()
    functionCount++
  }
  
  contract.functionCount = functionCount
}
