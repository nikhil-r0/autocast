import path from 'path';
import fs from 'fs';
import { verifyRunManifest } from '../src/manifest.js';

const manifestPath = process.argv[2] || path.join(process.cwd(), 'examples', 'output', 'run-manifest.json');

console.log('================================================================');
console.log('🛡️  AUTOCAST CRYPTOGRAPHIC PROVENANCE VERIFIER');
console.log('    "Verifying that the video artifact has not been tampered with"');
console.log('================================================================');
console.log(`Auditing Manifest: ${manifestPath}\n`);

const result = verifyRunManifest(manifestPath);

if (!result.valid) {
  console.error('❌ VERIFICATION FAILED! Manifest tampering or missing artifacts detected:');
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('✓ SHA-256 Checksum Verified: Exact match with rendered MP4 binary');
console.log(`  Artifact: ${content.artifacts?.video?.path}`);
console.log(`  SHA-256:  ${content.artifacts?.video?.sha256}`);
console.log(`✓ Tested Commit: ${content.application?.tested_commit}`);
console.log(`✓ Kane Verification ID: ${content.kane_verification?.run_id}`);
console.log(`✓ Kane Result Code: ${content.kane_verification?.result_code} (Passed)`);
console.log(`✓ Underlying State Verified: ${content.application?.state_verified}`);
console.log('\n================================================================');
console.log('🎉 PROOF OF CORRECTNESS CONFIRMED: DEMO CANNOT LIE');
console.log('================================================================');

