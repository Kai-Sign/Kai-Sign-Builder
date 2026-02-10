#!/usr/bin/env node

// ITERATION 62 - Test browser automation to verify hardware viewer
import fs from 'fs';

console.log('ITERATION 62 - Testing browser automation');

// Since we can't directly control the browser, let's test the compiled JavaScript
// that would be running in the browser

// Test if the hardware viewer TypeScript compiles and exports the right functions
console.log('Testing if hardware viewer functions can be imported...');

try {
  // Check if the compiled JS file exists
  const possiblePaths = [
    'frontend/.next/server/app/hardware-viewer/page.js',
    'frontend/.next/static/chunks/app/hardware-viewer/page.js',
    'frontend/src/app/hardware-viewer/hardwareViewer.tsx'
  ];
  
  let foundPath = null;
  for (const path of possiblePaths) {
    try {
      fs.accessSync(path);
      foundPath = path;
      break;
    } catch (e) {
      // File doesn't exist, continue
    }
  }
  
  if (foundPath) {
    console.log('✅ Hardware viewer file found at:', foundPath);
    
    // Read the file to check for key functions
    const content = fs.readFileSync(foundPath, 'utf8');
    
    const hasSmartPathResolver = content.includes('SmartPathResolver') || content.includes('pathMap');
    const hasFieldValueFromTransaction = content.includes('getFieldValueFromTransaction');
    const hasExecuteBatch = content.includes('executeBatch');
    const hasBatchPrioritization = content.includes('executeBatchOps') || content.includes('prioritiz');
    
    console.log('✅ SmartPathResolver:', hasSmartPathResolver ? '✅' : '❌');
    console.log('✅ getFieldValueFromTransaction:', hasFieldValueFromTransaction ? '✅' : '❌');
    console.log('✅ executeBatch support:', hasExecuteBatch ? '✅' : '❌');
    console.log('✅ Batch prioritization:', hasBatchPrioritization ? '✅' : '❌');
    
    if (hasSmartPathResolver && hasFieldValueFromTransaction && hasExecuteBatch) {
      console.log('🎉 Hardware viewer has all required functions!');
    } else {
      console.log('❌ Hardware viewer missing some functions');
    }
  } else {
    console.log('❌ Hardware viewer file not found');
  }
} catch (error) {
  console.log('❌ Error testing hardware viewer:', error.message);
}

// Test the metadata file directly again to make sure it's still correct
console.log('\\nTesting metadata file consistency...');
try {
  const metadata = JSON.parse(fs.readFileSync('frontend/public/erc7730/0x0000000071727de22e5e9d8baf0edac6f37da032.json', 'utf8'));
  
  const executeBatchFormats = Object.keys(metadata.display.formats).filter(f => f.includes('executeBatch'));
  console.log('ExecuteBatch formats:', executeBatchFormats.length);
  
  let totalFields = 0;
  let pathFields = 0;
  let valueFields = 0;
  
  executeBatchFormats.forEach(format => {
    const fields = metadata.display.formats[format].fields;
    totalFields += fields.length;
    
    fields.forEach(field => {
      if (field.path) pathFields++;
      if (field.value) valueFields++;
    });
  });
  
  console.log('Total fields across all formats:', totalFields);
  console.log('Fields with paths:', pathFields);
  console.log('Fields with static values:', valueFields);
  console.log('Coverage:', Math.round(((pathFields + valueFields) / totalFields) * 100) + '%');
  
  if ((pathFields + valueFields) === totalFields) {
    console.log('✅ All fields have either paths or values');
  } else {
    console.log('❌ Some fields missing paths or values');
  }
  
} catch (error) {
  console.log('❌ Error testing metadata:', error.message);
}

console.log('\\nITERATION 62 complete - Browser automation test done');