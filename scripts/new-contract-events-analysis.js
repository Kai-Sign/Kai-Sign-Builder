#!/usr/bin/env node

/**
 * New Contract Event Analysis Tool
 * 
 * This script analyzes the expected new KaiSign contract events (from the design document)
 * and compares them with the current subgraph schema to identify what needs to be updated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NewContractEventAnalyzer {
    constructor() {
        const projectRoot = path.resolve(__dirname, '..');
        this.schemaPath = path.join(projectRoot, 'graph/kaisign/schema.graphql');
        this.abiPath = path.join(projectRoot, 'graph/kaisign/abis/KaiSign.json');
        
        // Expected new contract events based on design document
        this.expectedEvents = [
            {
                name: 'LogCommitSpec',
                parameters: [
                    { name: 'committer', type: 'address', indexed: true },
                    { name: 'commitmentId', type: 'bytes32', indexed: true },
                    { name: 'targetContract', type: 'address', indexed: true },
                    { name: 'chainId', type: 'uint256', indexed: false },
                    { name: 'bondAmount', type: 'uint256', indexed: false },
                    { name: 'revealDeadline', type: 'uint64', indexed: false }
                ]
            },
            {
                name: 'LogRevealSpec',
                parameters: [
                    { name: 'creator', type: 'address', indexed: true },
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'commitmentId', type: 'bytes32', indexed: true },
                    { name: 'ipfs', type: 'string', indexed: false },
                    { name: 'targetContract', type: 'address', indexed: false },
                    { name: 'chainId', type: 'uint256', indexed: false }
                ]
            },
            {
                name: 'LogCreateSpec',
                parameters: [
                    { name: 'creator', type: 'address', indexed: true },
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'ipfs', type: 'string', indexed: false },
                    { name: 'targetContract', type: 'address', indexed: true },
                    { name: 'chainId', type: 'uint256', indexed: false },
                    { name: 'timestamp', type: 'uint256', indexed: false },
                    { name: 'incentiveId', type: 'bytes32', indexed: false }
                ]
            },
            {
                name: 'LogProposeSpec',
                parameters: [
                    { name: 'user', type: 'address', indexed: true },
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'questionId', type: 'bytes32', indexed: false },
                    { name: 'bond', type: 'uint256', indexed: false }
                ]
            },
            {
                name: 'LogHandleResult',
                parameters: [
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'isAccepted', type: 'bool', indexed: false }
                ]
            },
            {
                name: 'LogIncentiveCreated',
                parameters: [
                    { name: 'incentiveId', type: 'bytes32', indexed: true },
                    { name: 'creator', type: 'address', indexed: true },
                    { name: 'targetContract', type: 'address', indexed: true },
                    { name: 'chainId', type: 'uint256', indexed: false },
                    { name: 'token', type: 'address', indexed: false },
                    { name: 'amount', type: 'uint256', indexed: false },
                    { name: 'deadline', type: 'uint64', indexed: false },
                    { name: 'description', type: 'string', indexed: false }
                ]
            },
            {
                name: 'LogIncentiveClaimed',
                parameters: [
                    { name: 'incentiveId', type: 'bytes32', indexed: true },
                    { name: 'claimer', type: 'address', indexed: true },
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'amount', type: 'uint256', indexed: false }
                ]
            },
            {
                name: 'LogIncentiveClawback',
                parameters: [
                    { name: 'incentiveId', type: 'bytes32', indexed: true },
                    { name: 'creator', type: 'address', indexed: true },
                    { name: 'amount', type: 'uint256', indexed: false }
                ]
            },
            {
                name: 'LogContractSpecAdded',
                parameters: [
                    { name: 'targetContract', type: 'address', indexed: true },
                    { name: 'specID', type: 'bytes32', indexed: true },
                    { name: 'creator', type: 'address', indexed: true },
                    { name: 'chainId', type: 'uint256', indexed: false }
                ]
            },
            {
                name: 'LogEmergencyPause',
                parameters: [
                    { name: 'admin', type: 'address', indexed: true }
                ]
            },
            {
                name: 'LogEmergencyUnpause',
                parameters: [
                    { name: 'admin', type: 'address', indexed: true }
                ]
            }
        ];
        
        this.currentSchemaEntities = [];
        this.differences = {
            missingInSchema: [],
            extraInSchema: [],
            modifiedEvents: [],
            obsoleteEvents: []
        };
    }

    /**
     * Parse GraphQL schema to extract event entity definitions
     */
    parseSchemaEntities(schemaSource) {
        const entities = [];
        
        // Regex to match entity type definitions that start with "Log"
        const entityRegex = /type\s+(Log\w+)\s+@entity[^{]*\{([^}]+)\}/gs;
        let match;
        
        while ((match = entityRegex.exec(schemaSource)) !== null) {
            const entityName = match[1];
            const fieldsStr = match[2];
            
            // Parse fields
            const fields = this.parseEntityFields(fieldsStr);
            
            entities.push({
                name: entityName,
                fields: fields
            });
        }
        
        return entities;
    }

    /**
     * Parse entity fields from fields string
     */
    parseEntityFields(fieldsStr) {
        const fields = [];
        const lines = fieldsStr.split('\n');
        
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            
            // Match field definition: fieldName: Type!
            const fieldMatch = line.match(/(\w+):\s*(\w+)(!?)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2];
                const required = fieldMatch[3] === '!';
                
                // Skip standard subgraph fields
                if (['id', 'blockNumber', 'blockTimestamp', 'transactionHash'].includes(fieldName)) {
                    continue;
                }
                
                fields.push({
                    name: fieldName,
                    type: fieldType,
                    required: required
                });
            }
        }
        
        return fields;
    }

    /**
     * Compare expected events with current schema
     */
    compareWithSchema() {
        // Find events missing in schema
        for (const expectedEvent of this.expectedEvents) {
            const schemaEntity = this.currentSchemaEntities.find(e => e.name === expectedEvent.name);
            if (!schemaEntity) {
                this.differences.missingInSchema.push(expectedEvent);
            } else {
                // Check if the event has been modified
                const modifications = this.compareEventFields(expectedEvent, schemaEntity);
                if (modifications.length > 0) {
                    this.differences.modifiedEvents.push({
                        eventName: expectedEvent.name,
                        modifications: modifications,
                        expectedEvent: expectedEvent,
                        currentEntity: schemaEntity
                    });
                }
            }
        }

        // Find obsolete entities in schema (events that should be removed)
        const obsoleteEventNames = ['LogAssertSpecInvalid', 'LogAssertSpecValid'];
        for (const entity of this.currentSchemaEntities) {
            if (obsoleteEventNames.includes(entity.name)) {
                this.differences.obsoleteEvents.push(entity);
            } else {
                // Check if this entity exists in expected events
                const expectedEvent = this.expectedEvents.find(e => e.name === entity.name);
                if (!expectedEvent) {
                    this.differences.extraInSchema.push(entity);
                }
            }
        }
    }

    /**
     * Compare event parameters with schema entity fields
     */
    compareEventFields(expectedEvent, currentEntity) {
        const modifications = [];
        
        // Check if all expected parameters have corresponding fields
        for (const param of expectedEvent.parameters) {
            const field = currentEntity.fields.find(f => f.name === param.name);
            if (!field) {
                modifications.push({
                    type: 'missing_field',
                    parameterName: param.name,
                    parameterType: param.type,
                    expectedGraphQLType: this.mapSolidityTypeToGraphQL(param.type)
                });
            } else {
                // Check type compatibility
                const expectedType = this.mapSolidityTypeToGraphQL(param.type);
                if (field.type !== expectedType) {
                    modifications.push({
                        type: 'type_mismatch',
                        fieldName: param.name,
                        expectedType: expectedType,
                        actualType: field.type,
                        solidityType: param.type
                    });
                }
            }
        }

        // Check for extra fields in current schema
        for (const field of currentEntity.fields) {
            const param = expectedEvent.parameters.find(p => p.name === field.name);
            if (!param) {
                modifications.push({
                    type: 'extra_field',
                    fieldName: field.name,
                    fieldType: field.type
                });
            }
        }

        return modifications;
    }

    /**
     * Map Solidity types to GraphQL types
     */
    mapSolidityTypeToGraphQL(solidityType) {
        const typeMap = {
            'address': 'Bytes',
            'bytes32': 'Bytes',
            'bytes': 'Bytes',
            'string': 'String',
            'bool': 'Boolean',
            'uint256': 'BigInt',
            'uint64': 'BigInt',
            'uint32': 'BigInt',
            'uint8': 'Int',
            'int256': 'BigInt'
        };

        return typeMap[solidityType] || 'String';
    }

    /**
     * Generate GraphQL entity definitions for missing events
     */
    generateMissingEntityDefinitions() {
        const definitions = [];
        
        for (const event of this.differences.missingInSchema) {
            let entityDef = `type ${event.name} @entity(immutable: true) {\n`;
            entityDef += `  id: Bytes!\n`;
            
            for (const param of event.parameters) {
                const graphqlType = this.mapSolidityTypeToGraphQL(param.type);
                entityDef += `  ${param.name}: ${graphqlType}! # ${param.type}\n`;
            }
            
            entityDef += `  blockNumber: BigInt!\n`;
            entityDef += `  blockTimestamp: BigInt!\n`;
            entityDef += `  transactionHash: Bytes!\n`;
            entityDef += `}\n`;
            
            definitions.push({
                eventName: event.name,
                definition: entityDef
            });
        }
        
        return definitions;
    }

    /**
     * Generate updated entity definitions for modified events
     */
    generateUpdatedEntityDefinitions() {
        const definitions = [];
        
        for (const modifiedEvent of this.differences.modifiedEvents) {
            const event = modifiedEvent.expectedEvent;
            let entityDef = `type ${event.name} @entity(immutable: true) {\n`;
            entityDef += `  id: Bytes!\n`;
            
            for (const param of event.parameters) {
                const graphqlType = this.mapSolidityTypeToGraphQL(param.type);
                entityDef += `  ${param.name}: ${graphqlType}! # ${param.type}\n`;
            }
            
            entityDef += `  blockNumber: BigInt!\n`;
            entityDef += `  blockTimestamp: BigInt!\n`;
            entityDef += `  transactionHash: Bytes!\n`;
            entityDef += `}\n`;
            
            definitions.push({
                eventName: event.name,
                definition: entityDef,
                modifications: modifiedEvent.modifications
            });
        }
        
        return definitions;
    }

    /**
     * Generate comprehensive analysis report
     */
    generateReport() {
        const missingEntityDefs = this.generateMissingEntityDefinitions();
        const updatedEntityDefs = this.generateUpdatedEntityDefinitions();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                expectedEventsCount: this.expectedEvents.length,
                currentSchemaEntitiesCount: this.currentSchemaEntities.length,
                missingInSchemaCount: this.differences.missingInSchema.length,
                modifiedEventsCount: this.differences.modifiedEvents.length,
                obsoleteEventsCount: this.differences.obsoleteEvents.length,
                extraInSchemaCount: this.differences.extraInSchema.length
            },
            expectedEvents: this.expectedEvents,
            currentSchemaEntities: this.currentSchemaEntities,
            differences: this.differences,
            generatedEntityDefinitions: {
                missing: missingEntityDefs,
                updated: updatedEntityDefs
            },
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.differences.missingInSchema.length > 0) {
            recommendations.push({
                type: 'add_entities',
                priority: 'high',
                description: `Add ${this.differences.missingInSchema.length} new event entities to schema.graphql`,
                events: this.differences.missingInSchema.map(e => e.name),
                action: 'Add the generated entity definitions to your schema.graphql file'
            });
        }

        if (this.differences.modifiedEvents.length > 0) {
            recommendations.push({
                type: 'update_entities',
                priority: 'high',
                description: `Update ${this.differences.modifiedEvents.length} existing event entities in schema.graphql`,
                events: this.differences.modifiedEvents.map(m => m.eventName),
                action: 'Replace existing entity definitions with the updated versions'
            });
        }

        if (this.differences.obsoleteEvents.length > 0) {
            recommendations.push({
                type: 'remove_entities',
                priority: 'medium',
                description: `Remove ${this.differences.obsoleteEvents.length} obsolete event entities from schema.graphql`,
                entities: this.differences.obsoleteEvents.map(e => e.name),
                action: 'Delete these entity definitions as they are no longer emitted by the new contract'
            });
        }

        recommendations.push({
            type: 'update_abi',
            priority: 'critical',
            description: 'Generate new ABI from the updated contract source code',
            action: 'Extract ABI from the new contract deployment and replace the existing KaiSign.json file'
        });

        recommendations.push({
            type: 'update_subgraph_config',
            priority: 'high',
            description: 'Update subgraph.yaml with new contract address and event handlers',
            action: 'Change contract address to 0xA2119F82f3F595DB34fa059785BeA2f4F78D418B and add handlers for new events'
        });

        return recommendations;
    }

    /**
     * Format report for console output
     */
    formatConsoleReport(report) {
        let output = '\n';
        output += '='.repeat(80) + '\n';
        output += '              NEW CONTRACT EVENT ANALYSIS REPORT\n';
        output += '='.repeat(80) + '\n';
        output += `Generated: ${report.timestamp}\n\n`;

        // Summary
        output += 'SUMMARY:\n';
        output += '-'.repeat(40) + '\n';
        output += `Expected Events (New Contract): ${report.summary.expectedEventsCount}\n`;
        output += `Current Schema Entities: ${report.summary.currentSchemaEntitiesCount}\n`;
        output += `Missing in Schema: ${report.summary.missingInSchemaCount}\n`;
        output += `Modified Events: ${report.summary.modifiedEventsCount}\n`;
        output += `Obsolete Events: ${report.summary.obsoleteEventsCount}\n`;
        output += `Extra in Schema: ${report.summary.extraInSchemaCount}\n\n`;

        // Missing Events
        if (report.differences.missingInSchema.length > 0) {
            output += 'MISSING EVENTS (Need to Add to Schema):\n';
            output += '-'.repeat(40) + '\n';
            for (const event of report.differences.missingInSchema) {
                output += `• ${event.name}\n`;
                for (const param of event.parameters) {
                    output += `    - ${param.name}: ${param.type}${param.indexed ? ' (indexed)' : ''}\n`;
                }
                output += '\n';
            }
        }

        // Modified Events
        if (report.differences.modifiedEvents.length > 0) {
            output += 'MODIFIED EVENTS (Need to Update in Schema):\n';
            output += '-'.repeat(40) + '\n';
            for (const modified of report.differences.modifiedEvents) {
                output += `• ${modified.eventName}:\n`;
                for (const mod of modified.modifications) {
                    switch (mod.type) {
                        case 'missing_field':
                            output += `    + Add field: ${mod.parameterName} (${mod.parameterType} -> ${mod.expectedGraphQLType})\n`;
                            break;
                        case 'type_mismatch':
                            output += `    ~ Update field: ${mod.fieldName} - change ${mod.actualType} to ${mod.expectedType}\n`;
                            break;
                        case 'extra_field':
                            output += `    - Remove field: ${mod.fieldName} (${mod.fieldType})\n`;
                            break;
                    }
                }
                output += '\n';
            }
        }

        // Obsolete Events
        if (report.differences.obsoleteEvents.length > 0) {
            output += 'OBSOLETE EVENTS (Should Remove from Schema):\n';
            output += '-'.repeat(40) + '\n';
            for (const event of report.differences.obsoleteEvents) {
                output += `• ${event.name} - No longer emitted by new contract\n`;
            }
            output += '\n';
        }

        // Generated Entity Definitions
        if (report.generatedEntityDefinitions.missing.length > 0) {
            output += 'GENERATED ENTITY DEFINITIONS (Missing Events):\n';
            output += '-'.repeat(40) + '\n';
            for (const def of report.generatedEntityDefinitions.missing) {
                output += `${def.definition}\n`;
            }
        }

        if (report.generatedEntityDefinitions.updated.length > 0) {
            output += 'UPDATED ENTITY DEFINITIONS (Modified Events):\n';
            output += '-'.repeat(40) + '\n';
            for (const def of report.generatedEntityDefinitions.updated) {
                output += `${def.definition}\n`;
            }
        }

        // Recommendations
        output += 'RECOMMENDATIONS:\n';
        output += '-'.repeat(40) + '\n';
        for (const rec of report.recommendations) {
            output += `• [${rec.priority.toUpperCase()}] ${rec.description}\n`;
            output += `  Action: ${rec.action}\n`;
            if (rec.events) {
                output += `  Events: ${rec.events.join(', ')}\n`;
            }
            if (rec.entities) {
                output += `  Entities: ${rec.entities.join(', ')}\n`;
            }
            output += '\n';
        }

        output += '='.repeat(80) + '\n';
        return output;
    }

    /**
     * Run the complete analysis
     */
    async analyze() {
        try {
            console.log('Starting new contract event analysis...');
            
            // Read current schema
            console.log('Reading current GraphQL schema...');
            const schemaSource = fs.readFileSync(this.schemaPath, 'utf8');
            this.currentSchemaEntities = this.parseSchemaEntities(schemaSource);
            console.log(`Found ${this.currentSchemaEntities.length} event entities in current schema`);

            // Compare with expected events
            console.log('Comparing expected events with current schema...');
            this.compareWithSchema();

            // Generate report
            const report = this.generateReport();
            
            // Save detailed report to file
            const projectRoot = path.resolve(__dirname, '..');
            const reportPath = path.join(projectRoot, 'new-contract-analysis-report.json');
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`Detailed report saved to: ${reportPath}`);

            // Display console report
            console.log(this.formatConsoleReport(report));

            return report;

        } catch (error) {
            console.error('Error during analysis:', error.message);
            throw error;
        }
    }
}

// Run analysis if called directly
const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1];

if (currentFile === executedFile) {
    console.log('Running new contract analysis...');
    const analyzer = new NewContractEventAnalyzer();
    analyzer.analyze().catch(console.error);
}

export default NewContractEventAnalyzer;