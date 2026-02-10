#!/usr/bin/env node
/**
 * Submit LiFi Diamond Facet Metadata
 *
 * This script uses the autonomous-submitter.js to submit all LiFi facet metadata.
 * It modifies the submission-state.json to track progress across all facets.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/submit-lifi-facets.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MANIFEST_PATH = path.join(__dirname, 'lifi-facet-metadata', 'manifest.json');
const AUTONOMOUS_SUBMITTER = path.join(__dirname, 'autonomous-submitter.js');

async function main() {
  // Verify manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest not found. Run generate-lifi-metadata.cjs first.');
    process.exit(1);
  }

  // Load manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Found ${manifest.files.length} LiFi facet metadata files\n`);

  // Check for private key
  if (!process.env.PRIVATE_KEY) {
    console.error('PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  // Create updated autonomous-submitter.js with facet files
  const submitterContent = fs.readFileSync(AUTONOMOUS_SUBMITTER, 'utf-8');

  // Find the METADATA_FILES array and replace it
  const facetPaths = manifest.files.map(f =>
    `path.join(__dirname, 'lifi-facet-metadata', '${path.basename(f.file)}')`
  );

  const newMetadataFilesBlock = `const METADATA_FILES = [
${facetPaths.map(p => `  ${p}`).join(',\n')}
];`;

  // Find and replace the METADATA_FILES declaration
  const metadataFilesRegex = /const METADATA_FILES = \[[\s\S]*?\];/;
  const updatedSubmitter = submitterContent.replace(metadataFilesRegex, newMetadataFilesBlock);

  // Write temp submitter
  const tempSubmitter = path.join(__dirname, 'lifi-facet-submitter-temp.js');
  fs.writeFileSync(tempSubmitter, updatedSubmitter);

  console.log('Generated temporary submitter with LiFi facet metadata files');
  console.log(`Submitting ${manifest.files.length} facet metadata files:\n`);

  for (const file of manifest.files) {
    console.log(`  - ${file.address} (${file.functions} functions)`);
  }

  console.log('\n');

  // Run the submitter
  try {
    execSync(`node ${tempSubmitter}`, {
      stdio: 'inherit',
      env: process.env
    });
  } catch (error) {
    console.error('Submission failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempSubmitter)) {
      fs.unlinkSync(tempSubmitter);
    }
  }
}

main().catch(console.error);
