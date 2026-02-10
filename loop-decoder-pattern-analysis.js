#!/usr/bin/env node

/**
 * Analysis of Loop Decoder systematic path patterns
 * Testing if we can programmatically determine path structure
 */

import fs from 'fs';

// Load sample transaction data
const sampleSets = JSON.parse(fs.readFileSync('frontend/public/samples/sample-sets.json', 'utf8'));
const kyberswapData = JSON.parse(fs.readFileSync('frontend/public/samples/kyberswap-swap-sample.json', 'utf8'));

console.log('🔍 Analyzing Loop Decoder Systematic Path Patterns\n');

// Function to analyze parameter structure depth and nesting
function analyzeParameterStructure(params, currentPath = '', level = 0) {
  const analysis = [];
  
  if (!Array.isArray(params)) {
    return analysis;
  }
  
  params.forEach((param, index) => {
    const paramPath = currentPath ? `${currentPath}.${param.name}` : param.name;
    
    analysis.push({
      path: `#.${paramPath}`,
      level: level,
      type: param.type,
      hasValue: param.value !== undefined,
      hasComponents: param.components !== undefined,
      hasValueDecoded: param.valueDecoded !== undefined,
      isArray: param.type?.includes('[]'),
      position: index
    });
    
    // Recurse into components (tuples)
    if (param.components) {
      const nestedAnalysis = analyzeParameterStructure(param.components, paramPath, level + 1);
      analysis.push(...nestedAnalysis);
    }
    
    // Recurse into valueDecoded (nested function calls)
    if (param.valueDecoded && param.valueDecoded.params) {
      const decodedPath = `${paramPath}.valueDecoded`;
      const nestedAnalysis = analyzeParameterStructure(param.valueDecoded.params, decodedPath, level + 1);
      analysis.push(...nestedAnalysis);
    }
  });
  
  return analysis;
}

// Function to generate all possible paths for a transaction
function generateAllPaths(transactionData) {
  if (!transactionData.methodCall || !transactionData.methodCall.params) {
    return [];
  }
  
  return analyzeParameterStructure(transactionData.methodCall.params);
}

// Function to detect nesting patterns
function detectNestingPatterns(pathAnalysis) {
  const patterns = {
    maxDepth: 0,
    levelCounts: {},
    typeDistribution: {},
    arrayFields: [],
    tupleFields: [],
    decodedFields: []
  };
  
  pathAnalysis.forEach(item => {
    // Track max depth
    patterns.maxDepth = Math.max(patterns.maxDepth, item.level);
    
    // Count items per level
    patterns.levelCounts[item.level] = (patterns.levelCounts[item.level] || 0) + 1;
    
    // Track type distribution
    patterns.typeDistribution[item.type] = (patterns.typeDistribution[item.type] || 0) + 1;
    
    // Categorize special field types
    if (item.isArray) {
      patterns.arrayFields.push(item.path);
    }
    if (item.hasComponents) {
      patterns.tupleFields.push(item.path);
    }
    if (item.hasValueDecoded) {
      patterns.decodedFields.push(item.path);
    }
  });
  
  return patterns;
}

// Test systematic path detection
console.log('='.repeat(80));
console.log('SYSTEMATIC PATH DETECTION ANALYSIS');
console.log('='.repeat(80));

// Test with each sample
const testCases = [
  { name: 'Aave Repay', data: sampleSets.sampleSets.find(s => s.id === 'aave-repay').transactionData },
  { name: '1inch Swap', data: sampleSets.sampleSets.find(s => s.id === 'oneinch').transactionData },
  { name: 'Safe USDC', data: sampleSets.sampleSets.find(s => s.id === 'safe-usdc').transactionData },
  { name: 'KyberSwap', data: kyberswapData }
];

testCases.forEach(testCase => {
  console.log(`\n📊 ${testCase.name} Transaction Analysis:`);
  console.log('-'.repeat(50));
  
  const paths = generateAllPaths(testCase.data);
  const patterns = detectNestingPatterns(paths);
  
  console.log(`Function: ${testCase.data.methodCall.name}`);
  console.log(`Total Parameters: ${testCase.data.methodCall.params.length}`);
  console.log(`Total Paths: ${paths.length}`);
  console.log(`Max Nesting Depth: ${patterns.maxDepth}`);
  console.log(`Level Distribution:`, patterns.levelCounts);
  
  console.log('\n🎯 All Available Paths:');
  paths.forEach(path => {
    const indent = '  '.repeat(path.level);
    const typeInfo = path.isArray ? `${path.type} (array)` : path.type;
    const specialFlags = [
      path.hasComponents ? 'tuple' : '',
      path.hasValueDecoded ? 'decoded' : ''
    ].filter(Boolean).join(', ');
    
    console.log(`${indent}${path.path} : ${typeInfo}${specialFlags ? ` [${specialFlags}]` : ''}`);
  });
  
  if (patterns.arrayFields.length > 0) {
    console.log('\n📋 Array Fields:', patterns.arrayFields);
  }
  if (patterns.tupleFields.length > 0) {
    console.log('🔗 Tuple Fields:', patterns.tupleFields);
  }
  if (patterns.decodedFields.length > 0) {
    console.log('🔓 Decoded Fields:', patterns.decodedFields);
  }
});

// Test systematic path generation
console.log('\n' + '='.repeat(80));
console.log('SYSTEMATIC PATH GENERATION TEST');
console.log('='.repeat(80));

function generateSystematicPaths(transactionData) {
  const paths = generateAllPaths(transactionData);
  const systematicPaths = {};
  
  // Group by level
  const byLevel = {};
  paths.forEach(path => {
    if (!byLevel[path.level]) byLevel[path.level] = [];
    byLevel[path.level].push(path);
  });
  
  // Generate systematic patterns
  Object.keys(byLevel).forEach(level => {
    systematicPaths[`level_${level}`] = byLevel[level].map((path, index) => ({
      systematicPath: `#.level${level}_param${index}`,
      actualPath: path.path,
      type: path.type
    }));
  });
  
  return systematicPaths;
}

// Test on complex KyberSwap transaction
console.log('\n🧪 Testing Systematic Path Generation on KyberSwap:');
const kyberSystematic = generateSystematicPaths(kyberswapData);

Object.keys(kyberSystematic).forEach(levelKey => {
  console.log(`\n${levelKey.toUpperCase()}:`);
  kyberSystematic[levelKey].forEach(mapping => {
    console.log(`  ${mapping.systematicPath} → ${mapping.actualPath} (${mapping.type})`);
  });
});

// Test position-based access vs name-based access
console.log('\n' + '='.repeat(80));
console.log('POSITION-BASED vs NAME-BASED ACCESS COMPARISON');
console.log('='.repeat(80));

function compareAccessMethods(transactionData) {
  const params = transactionData.methodCall.params;
  
  console.log(`\nFunction: ${transactionData.methodCall.name}`);
  console.log('Position-based (ChainTools style) vs Name-based (Loop Decoder):');
  
  params.forEach((param, index) => {
    console.log(`  param${index} ↔ ${param.name} (${param.type})`);
    
    // Show nested access patterns
    if (param.components) {
      param.components.forEach((comp, compIndex) => {
        console.log(`    param${index}.param${compIndex} ↔ ${param.name}.${comp.name} (${comp.type})`);
      });
    }
    
    if (param.valueDecoded && param.valueDecoded.params) {
      param.valueDecoded.params.forEach((decoded, decodedIndex) => {
        console.log(`    param${index}.decoded.param${decodedIndex} ↔ ${param.name}.valueDecoded.${decoded.name} (${decoded.type})`);
      });
    }
  });
}

testCases.forEach(testCase => {
  compareAccessMethods(testCase.data);
});

console.log('\n' + '='.repeat(80));
console.log('CONCLUSION: LOOP DECODER SYSTEMATIC ANALYSIS');
console.log('='.repeat(80));

console.log(`
✅ LOOP DECODER IS SYSTEMATIC:
   - Parameter count is deterministic: methodCall.params.length
   - Nesting levels are detectable: by analyzing 'components' and 'valueDecoded'
   - Path structure is consistent: name-based navigation
   - Array fields are identifiable: type.includes('[]')
   - Tuple structures are explicit: components array exists

✅ SYSTEMATIC PATH GENERATION IS POSSIBLE:
   - Level 0: Direct parameters (methodCall.params[i])
   - Level 1: Tuple components (param.components[j]) 
   - Level 2: Nested decoded calls (param.valueDecoded.params[k])
   - Array access: param.value[index] for array types

✅ ADVANTAGES OVER CHAINTOOLS:
   - Self-documenting structure (names provide context)
   - Type information available (enables validation)
   - Nested depth is explicit (not guessed)
   - Rich metadata included (contract names, symbols)

❌ COMPLEXITY vs CHAINTOOLS:
   - Requires recursive traversal vs direct property access
   - Name-based lookup vs position-based access
   - Variable structure vs fixed param0/param1 pattern

🎯 RECOMMENDATION UPDATE:
   Loop Decoder IS systematic and provides better tooling for
   automatic path generation and validation than initially assessed.
`);