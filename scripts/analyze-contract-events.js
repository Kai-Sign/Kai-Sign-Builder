#!/usr/bin/env node

/**
 * Contract Event Analysis Tool
 * 
 * This script analyzes the KaiSign contract source code to extract all event definitions
 * and compares them with the current subgraph schema entities to identify differences.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContractEventAnalyzer {
    constructor() {
        // Use absolute paths from project root
        const projectRoot = path.resolve(__dirname, '..');
        this.contractPath = path.join(projectRoot, 'contracts/src/KaiSign.sol');
        this.schemaPath = path.join(projectRoot, 'graph/kaisign/schema.graphql');
        this.abiPath = path.join(projectRoot, 'graph/kaisign/abis/KaiSign.json');
        
        this.contractEvents = [];
        this.schemaEntities = [];
        this.abiEvents = [];
        this.differences = {
            missingInSchema: [],
            extraInSchema: [],
            fieldMismatches: [],
            signatureChanges: []
        };
    }

    /**
     * Parse Solidity contract source code to extract event definitions
     */
    parseContractEvents(contractSource) {
        const events = [];
        
        // Regex to match event definitions
        const eventRegex = /event\s+(\w+)\s*\((.*?)\)\s*;/gs;
        let match;
        
        while ((match = eventRegex.exec(contractSource)) !== null) {
            const eventName = match[1];
            const parametersStr = match[2];
            
            // Parse parameters
            const parameters = this.parseEventParameters(parametersStr);
            
            events.push({
                name: eventName,
                parameters: parameters,
                signature: `${eventName}(${parameters.map(p => `${p.type}${p.indexed ? ' indexed' : ''} ${p.name}`).join(', ')})`
            });
        }
        
        return events;
    }

    /**
     * Parse event parameters from parameter string
     */
    parseEventParameters(parametersStr) {
        if (!parametersStr.trim()) return [];
        
        const parameters = [];
        const paramParts = parametersStr.split(',');
        
        for (let part of paramParts) {
            part = part.trim();
            if (!part) continue;
            
            const indexed = part.includes('indexed');
            const cleanPart = part.replace('indexed', '').trim();
            const tokens = cleanPart.split(/\s+/);
            
            if (tokens.length >= 2) {
                const type = tokens[0];
                const name = tokens[tokens.length - 1];
                
                parameters.push({
                    name: name,
                    type: type,
                    indexed: indexed
                });
            }
        }
        
        return parameters;
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
     * Parse ABI JSON to extract event definitions
     */
    parseAbiEvents(abiJson) {
        const events = [];
        
        for (const item of abiJson) {
            if (item.type === 'event') {
                const parameters = item.inputs.map(input => ({
                    name: input.name,
                    type: input.type,
                    indexed: input.indexed || false
                }));
                
                events.push({
                    name: item.name,
                    parameters: parameters,
                    signature: `${item.name}(${parameters.map(p => `${p.type}${p.indexed ? ' indexed' : ''} ${p.name}`).join(', ')})`
                });
            }
        }
        
        return events;
    }

    /**
     * Compare contract events with schema entities
     */
    compareEventsWithSchema() {
        // Find events missing in schema
        for (const event of this.contractEvents) {
            const schemaEntity = this.schemaEntities.find(e => e.name === event.name);
            if (!schemaEntity) {
                this.differences.missingInSchema.push(event);
            } else {
                // Check for field mismatches
                this.compareEventFields(event, schemaEntity);
            }
        }

        // Find extra entities in schema (not in contract)
        for (const entity of this.schemaEntities) {
            const contractEvent = this.contractEvents.find(e => e.name === entity.name);
            if (!contractEvent) {
                this.differences.extraInSchema.push(entity);
            }
        }

        // Compare with ABI events for signature changes
        this.compareWithAbi();
    }

    /**
     * Compare event parameters with schema entity fields
     */
    compareEventFields(event, entity) {
        const mismatches = [];
        
        // Check if all event parameters have corresponding fields
        for (const param of event.parameters) {
            const field = entity.fields.find(f => f.name === param.name);
            if (!field) {
                mismatches.push({
                    type: 'missing_field',
                    eventName: event.name,
                    parameterName: param.name,
                    parameterType: param.type
                });
            } else {
                // Check type compatibility
                const expectedType = this.mapSolidityTypeToGraphQL(param.type);
                if (field.type !== expectedType) {
                    mismatches.push({
                        type: 'type_mismatch',
                        eventName: event.name,
                        fieldName: param.name,
                        expectedType: expectedType,
                        actualType: field.type,
                        solidityType: param.type
                    });
                }
            }
        }

        // Check for extra fields in schema
        for (const field of entity.fields) {
            const param = event.parameters.find(p => p.name === field.name);
            if (!param) {
                mismatches.push({
                    type: 'extra_field',
                    eventName: event.name,
                    fieldName: field.name,
                    fieldType: field.type
                });
            }
        }

        if (mismatches.length > 0) {
            this.differences.fieldMismatches.push({
                eventName: event.name,
                mismatches: mismatches
            });
        }
    }

    /**
     * Compare contract events with ABI events to detect signature changes
     */
    compareWithAbi() {
        for (const contractEvent of this.contractEvents) {
            const abiEvent = this.abiEvents.find(e => e.name === contractEvent.name);
            if (abiEvent && contractEvent.signature !== abiEvent.signature) {
                this.differences.signatureChanges.push({
                    eventName: contractEvent.name,
                    contractSignature: contractEvent.signature,
                    abiSignature: abiEvent.signature
                });
            }
        }
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

        // Handle array types
        if (solidityType.endsWith('[]')) {
            const baseType = solidityType.slice(0, -2);
            const mappedBase = typeMap[baseType] || 'String';
            return `[${mappedBase}!]`;
        }

        return typeMap[solidityType] || 'String';
    }

    /**
     * Generate detailed comparison report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                contractEventsCount: this.contractEvents.length,
                schemaEntitiesCount: this.schemaEntities.length,
                abiEventsCount: this.abiEvents.length,
                missingInSchemaCount: this.differences.missingInSchema.length,
                extraInSchemaCount: this.differences.extraInSchema.length,
                fieldMismatchesCount: this.differences.fieldMismatches.length,
                signatureChangesCount: this.differences.signatureChanges.length
            },
            contractEvents: this.contractEvents,
            schemaEntities: this.schemaEntities,
            abiEvents: this.abiEvents,
            differences: this.differences,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.differences.missingInSchema.length > 0) {
            recommendations.push({
                type: 'add_entities',
                priority: 'high',
                description: `Add ${this.differences.missingInSchema.length} missing event entities to schema.graphql`,
                events: this.differences.missingInSchema.map(e => e.name)
            });
        }

        if (this.differences.extraInSchema.length > 0) {
            recommendations.push({
                type: 'remove_entities',
                priority: 'medium',
                description: `Remove ${this.differences.extraInSchema.length} obsolete entities from schema.graphql`,
                entities: this.differences.extraInSchema.map(e => e.name)
            });
        }

        if (this.differences.fieldMismatches.length > 0) {
            recommendations.push({
                type: 'update_fields',
                priority: 'high',
                description: `Update field definitions for ${this.differences.fieldMismatches.length} entities`,
                entities: this.differences.fieldMismatches.map(m => m.eventName)
            });
        }

        if (this.differences.signatureChanges.length > 0) {
            recommendations.push({
                type: 'update_abi',
                priority: 'critical',
                description: `Update ABI file - ${this.differences.signatureChanges.length} events have signature changes`,
                events: this.differences.signatureChanges.map(s => s.eventName)
            });
        }

        return recommendations;
    }

    /**
     * Format report for console output
     */
    formatConsoleReport(report) {
        let output = '\n';
        output += '='.repeat(80) + '\n';
        output += '                    CONTRACT EVENT ANALYSIS REPORT\n';
        output += '='.repeat(80) + '\n';
        output += `Generated: ${report.timestamp}\n\n`;

        // Summary
        output += 'SUMMARY:\n';
        output += '-'.repeat(40) + '\n';
        output += `Contract Events Found: ${report.summary.contractEventsCount}\n`;
        output += `Schema Entities Found: ${report.summary.schemaEntitiesCount}\n`;
        output += `ABI Events Found: ${report.summary.abiEventsCount}\n`;
        output += `Missing in Schema: ${report.summary.missingInSchemaCount}\n`;
        output += `Extra in Schema: ${report.summary.extraInSchemaCount}\n`;
        output += `Field Mismatches: ${report.summary.fieldMismatchesCount}\n`;
        output += `Signature Changes: ${report.summary.signatureChangesCount}\n\n`;

        // Contract Events
        output += 'CONTRACT EVENTS:\n';
        output += '-'.repeat(40) + '\n';
        for (const event of report.contractEvents) {
            output += `• ${event.name}\n`;
            output += `  Signature: ${event.signature}\n`;
            for (const param of event.parameters) {
                output += `    - ${param.name}: ${param.type}${param.indexed ? ' (indexed)' : ''}\n`;
            }
            output += '\n';
        }

        // Schema Entities
        output += 'SCHEMA ENTITIES:\n';
        output += '-'.repeat(40) + '\n';
        for (const entity of report.schemaEntities) {
            output += `• ${entity.name}\n`;
            for (const field of entity.fields) {
                output += `    - ${field.name}: ${field.type}${field.required ? '!' : ''}\n`;
            }
            output += '\n';
        }

        // Differences
        if (report.differences.missingInSchema.length > 0) {
            output += 'MISSING IN SCHEMA:\n';
            output += '-'.repeat(40) + '\n';
            for (const event of report.differences.missingInSchema) {
                output += `• ${event.name} - ${event.signature}\n`;
            }
            output += '\n';
        }

        if (report.differences.extraInSchema.length > 0) {
            output += 'EXTRA IN SCHEMA (NOT IN CONTRACT):\n';
            output += '-'.repeat(40) + '\n';
            for (const entity of report.differences.extraInSchema) {
                output += `• ${entity.name}\n`;
            }
            output += '\n';
        }

        if (report.differences.fieldMismatches.length > 0) {
            output += 'FIELD MISMATCHES:\n';
            output += '-'.repeat(40) + '\n';
            for (const mismatch of report.differences.fieldMismatches) {
                output += `• ${mismatch.eventName}:\n`;
                for (const issue of mismatch.mismatches) {
                    switch (issue.type) {
                        case 'missing_field':
                            output += `    - Missing field: ${issue.parameterName} (${issue.parameterType})\n`;
                            break;
                        case 'type_mismatch':
                            output += `    - Type mismatch: ${issue.fieldName} - expected ${issue.expectedType}, got ${issue.actualType}\n`;
                            break;
                        case 'extra_field':
                            output += `    - Extra field: ${issue.fieldName} (${issue.fieldType})\n`;
                            break;
                    }
                }
                output += '\n';
            }
        }

        if (report.differences.signatureChanges.length > 0) {
            output += 'SIGNATURE CHANGES (CONTRACT vs ABI):\n';
            output += '-'.repeat(40) + '\n';
            for (const change of report.differences.signatureChanges) {
                output += `• ${change.eventName}:\n`;
                output += `    Contract: ${change.contractSignature}\n`;
                output += `    ABI:      ${change.abiSignature}\n\n`;
            }
        }

        // Recommendations
        output += 'RECOMMENDATIONS:\n';
        output += '-'.repeat(40) + '\n';
        for (const rec of report.recommendations) {
            output += `• [${rec.priority.toUpperCase()}] ${rec.description}\n`;
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
            console.log('Starting contract event analysis...');
            console.log('Contract path:', this.contractPath);
            console.log('Schema path:', this.schemaPath);
            console.log('ABI path:', this.abiPath);
            
            // Read contract source
            console.log('Reading contract source code...');
            const contractSource = fs.readFileSync(this.contractPath, 'utf8');
            this.contractEvents = this.parseContractEvents(contractSource);
            console.log(`Found ${this.contractEvents.length} events in contract`);

            // Read schema
            console.log('Reading GraphQL schema...');
            const schemaSource = fs.readFileSync(this.schemaPath, 'utf8');
            this.schemaEntities = this.parseSchemaEntities(schemaSource);
            console.log(`Found ${this.schemaEntities.length} event entities in schema`);

            // Read ABI
            console.log('Reading ABI file...');
            const abiSource = fs.readFileSync(this.abiPath, 'utf8');
            const abiJson = JSON.parse(abiSource);
            this.abiEvents = this.parseAbiEvents(abiJson);
            console.log(`Found ${this.abiEvents.length} events in ABI`);

            // Compare
            console.log('Comparing events with schema...');
            this.compareEventsWithSchema();

            // Generate report
            const report = this.generateReport();
            
            // Save detailed report to file
            const projectRoot = path.resolve(__dirname, '..');
            const reportPath = path.join(projectRoot, 'contract-event-analysis-report.json');
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
    console.log('Running analysis...');
    const analyzer = new ContractEventAnalyzer();
    analyzer.analyze().catch(console.error);
}

export default ContractEventAnalyzer;