# Requirements Document

## Introduction

This feature will implement tooling to check if the current subgraph schema matches the events in the deployed KaiSign contract, and then redeploy the subgraph to the new contract address. The focus is on ensuring the existing subgraph configuration is compatible with the new contract deployment.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to check if the current subgraph schema matches all events in the KaiSign contract, so that I can identify any discrepancies before redeploying.

#### Acceptance Criteria

1. WHEN the KaiSign contract source code is analyzed THEN the system SHALL extract all event definitions
2. WHEN the current schema.graphql is read THEN the system SHALL identify all existing entity types and their fields
3. WHEN events are compared with schema entities THEN the system SHALL detect missing events, extra entities, or field mismatches
4. WHEN differences are found THEN the system SHALL provide a clear report of what needs to be updated

### Requirement 2

**User Story:** As a developer, I want to redeploy the subgraph to the new KaiSign contract address, so that the subgraph indexes events from the correct deployed contract.

#### Acceptance Criteria

1. WHEN the subgraph configuration is updated THEN the system SHALL change the contract address to 0xA2119F82f3F595DB34fa059785BeA2f4F78D418B
2. WHEN the subgraph.yaml is modified THEN the system SHALL update the data source configuration with the new address
3. WHEN the deployment is initiated THEN the system SHALL use the appropriate Graph CLI commands
4. WHEN the deployment completes THEN the system SHALL verify the subgraph is successfully indexing from the new address