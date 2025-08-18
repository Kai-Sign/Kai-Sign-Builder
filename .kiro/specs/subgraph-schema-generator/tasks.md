# Implementation Plan

- [ ] 1. Create contract event analysis tool
  - Write a script to parse the contract source code and extract all event definitions
  - Compare extracted events with current subgraph schema entities
  - Generate a detailed comparison report showing differences
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Update GraphQL schema with new and modified events
  - Remove obsolete entities (LogAssertSpecInvalid, LogAssertSpecValid)
  - Add new event entities (LogCommitSpec, LogRevealSpec, LogIncentiveCreated, LogIncentiveClaimed, LogIncentiveClawback, LogContractSpecAdded, LogEmergencyPause, LogEmergencyUnpause)
  - Update existing LogCreateSpec entity with new field structure
  - Validate GraphQL schema syntax
  - _Requirements: 1.1, 1.3_

- [x] 3. Generate new contract ABI from source code
  - Extract ABI from the contract source code provided in the GitHub issue
  - Replace the existing KaiSign.json ABI file with the new version
  - Ensure all events are properly defined in the ABI
  - _Requirements: 2.1, 2.2_

- [x] 4. Update subgraph configuration
  - Update subgraph.yaml with new contract address (0xA2119F82f3F595DB34fa059785BeA2f4F78D418B)
  - Add event handlers for new events in the mapping configuration
  - Remove handlers for obsolete events
  - Update entity list in the mapping configuration
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Create event handler functions
  - Write TypeScript handlers for LogCommitSpec events
  - Write TypeScript handlers for LogRevealSpec events
  - Write TypeScript handlers for LogIncentiveCreated events
  - Write TypeScript handlers for LogIncentiveClaimed events
  - Write TypeScript handlers for LogIncentiveClawback events
  - Write TypeScript handlers for LogContractSpecAdded events
  - Write TypeScript handlers for LogEmergencyPause events
  - Write TypeScript handlers for LogEmergencyUnpause events
  - Update existing handlers for modified events (LogCreateSpec)
  - _Requirements: 1.1, 1.3_

- [x] 6. Test and validate subgraph configuration
  - Run graph codegen to generate TypeScript types
  - Run graph build to compile the subgraph
  - Validate that all event handlers compile without errors
  - Test schema validation
  - _Requirements: 2.3, 2.4_

- [x] 7. Deploy subgraph to new contract address
  - Deploy the updated subgraph configuration
  - Verify deployment is successful and indexing starts
  - Confirm subgraph is indexing events from the new contract address
  - Monitor initial indexing for any errors
  - _Requirements: 2.1, 2.2, 2.4_