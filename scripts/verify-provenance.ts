import path from 'path';
import fs from 'fs';
import { verifyRunManifest } from '../src/manifest.js';

function resolveManifestPath(): string {
  if (process.argv[2]) {
    return process.argv[2];
  }

  const localManifest = path.join(process.cwd(), 'out', 'run-manifest.json');
  if (fs.existsSync(localManifest)) {
    return localManifest;
  }

  const committedManifest = path.join(process.cwd(), 'examples', 'output', 'run-manifest.json');
  if (fs.existsSync(committedManifest)) {
    console.log('[Provenance] out/run-manifest.json not found; using committed examples/output evidence.\n');
    return committedManifest;
  }

  return localManifest;
}

const manifestPath = resolveManifestPath();

if (fs.existsSync(manifestPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (raw?.mode === 'oracle') {
      console.error('❌ This manifest was produced in oracle mode (mode: "oracle").');
      console.error('Use the payment gate verifier instead:');
      console.error('  npm run verify:oracle -- <manifest> --spec <spec.json> --commit <sha>');
      process.exit(1);
    }
  } catch {
    // Let verifyRunManifest emit the standard JSON parse error below.
  }
}

console.log('================================================================');
console.log('🛡️  AUTOCAST HASH-VERIFIED PROVENANCE MANIFEST AUDITOR');
console.log('    "Verifying that the video artifact has not been tampered with"');
console.log('================================================================');
console.log(`Auditing Manifest: ${manifestPath}\n`);

const result = verifyRunManifest(manifestPath, {
  requireVerifiedStatus: true,
  requireArtifacts: true,
});

if (!result.valid) {
  console.error('❌ VERIFICATION FAILED! Manifest failed mandatory release gates:');
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('✓ Release Gate 1: Manifest Status -> "verified"');
console.log(`✓ Release Gate 2: Underlying DB State Verified -> ${content.application?.state_verified}`);
console.log(`✓ Release Gate 3: Kane Verification Result -> ${content.kane_verification?.result_code} (Passed)`);
console.log(`✓ Release Gate 4: Loop 2 Visual QA Status -> ${content.visual_qa?.status}`);
console.log(`✓ Release Gate 5: Pixel Safety OCR Status -> ${content.security_scan?.status}`);
console.log('✓ Release Gate 6: SHA-256 Checksums Verified -> Exact binary match on disk');
console.log(`  Video:  ${content.artifacts?.video?.path} (${content.artifacts?.video?.sha256})`);
console.log(`  Poster: ${content.artifacts?.poster?.path} (${content.artifacts?.poster?.sha256})`);
console.log(`✓ Tested Commit: ${content.application?.tested_commit}`);
console.log(`✓ Kane Verification ID: ${content.kane_verification?.run_id}`);

console.log('\n================================================================');
console.log('🎉 PROOF OF CORRECTNESS CONFIRMED: DEMO CANNOT LIE');
console.log('================================================================');
