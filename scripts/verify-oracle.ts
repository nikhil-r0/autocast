import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { verifyOracleManifest } from '../src/manifest.js';
import { loadAcceptanceSpec, normalizeSha256Hex } from '../src/oracle/spec.js';

dotenv.config();

interface VerifyOracleCliArgs {
  manifestPath: string;
  specPath?: string;
  specSha256?: string;
  commit?: string;
  trustedKeysPath?: string;
}

function parseArgs(argv: string[]): VerifyOracleCliArgs {
  let manifestPath: string | undefined;
  let specPath: string | undefined;
  let specSha256: string | undefined;
  let commit: string | undefined;
  let trustedKeysPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--spec' && argv[i + 1]) {
      specPath = argv[++i];
    } else if (arg.startsWith('--spec=')) {
      specPath = arg.slice('--spec='.length);
    } else if (arg === '--spec-sha256' && argv[i + 1]) {
      specSha256 = arg[++i];
    } else if (arg.startsWith('--spec-sha256=')) {
      specSha256 = arg.slice('--spec-sha256='.length);
    } else if (arg === '--commit' && argv[i + 1]) {
      commit = arg[++i];
    } else if (arg.startsWith('--commit=')) {
      commit = arg.slice('--commit='.length);
    } else if (arg === '--trusted-keys' && argv[i + 1]) {
      trustedKeysPath = argv[++i];
    } else if (arg.startsWith('--trusted-keys=')) {
      trustedKeysPath = arg.slice('--trusted-keys='.length);
    } else if (arg === '--manifest' && argv[i + 1]) {
      manifestPath = argv[++i];
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = arg.slice('--manifest='.length);
    } else if (!arg.startsWith('-') && !manifestPath) {
      manifestPath = arg;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return {
    manifestPath: manifestPath || path.join(process.cwd(), 'out', 'run-manifest.json'),
    specPath,
    specSha256,
    commit,
    trustedKeysPath,
  };
}

function main(): void {
  let parsed: VerifyOracleCliArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err: any) {
    console.error(`❌ Argument error: ${err.message}`);
    console.error('Usage: npm run verify:oracle -- <manifest> --spec <spec.json> --commit <sha> [--trusted-keys <path>]');
    process.exit(2);
  }

  if (!parsed.specPath && !parsed.specSha256) {
    console.error('❌ Missing required --spec <spec.json> (or --spec-sha256 <hash>).');
    process.exit(2);
  }
  if (!parsed.commit) {
    console.error('❌ Missing required --commit <sha>.');
    process.exit(2);
  }

  let expectedSpecSha256: string;
  try {
    if (parsed.specPath) {
      const loaded = loadAcceptanceSpec(parsed.specPath);
      expectedSpecSha256 = loaded.specSha256;
      if (parsed.specSha256) {
        const explicit = normalizeSha256Hex(parsed.specSha256, '--spec-sha256');
        if (explicit !== expectedSpecSha256) {
          console.error(`❌ Spec hash mismatch: computed ${expectedSpecSha256} !== --spec-sha256 ${explicit}`);
          process.exit(2);
        }
      }
      if (loaded.spec.target.expected_commit !== parsed.commit) {
        console.error(
          `❌ Commit mismatch between spec (${loaded.spec.target.expected_commit}) and --commit (${parsed.commit}).`
        );
        process.exit(1);
      }
    } else {
      expectedSpecSha256 = normalizeSha256Hex(parsed.specSha256!, '--spec-sha256');
    }
  } catch (err: any) {
    console.error(`❌ Spec error: ${err.message}`);
    process.exit(2);
  }

  console.log('================================================================');
  console.log('⚖️  AUTOCAST ORACLE PAYMENT GATE VERIFIER');
  console.log('================================================================');
  console.log(`Manifest:        ${parsed.manifestPath}`);
  console.log(`Expected Spec:   ${expectedSpecSha256}`);
  console.log(`Expected Commit: ${parsed.commit}\n`);

  const result = verifyOracleManifest(parsed.manifestPath, {
    expectedSpecSha256,
    expectedCommit: parsed.commit,
    trustedKeysPath: parsed.trustedKeysPath,
  });

  if (!result.valid) {
    console.error('❌ ORACLE VERIFICATION FAILED (HOLD):');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const m = result.manifest!;
  console.log('✓ Gate 1: Mode -> "oracle"');
  console.log(`✓ Gate 2: Status & Verdict -> "${m.status}" / "${m.oracle?.verdict}"`);
  console.log(`✓ Gate 3: Kane Verification -> result_code ${m.kane_verification?.result_code}`);
  console.log(`✓ Gate 4: Backend State Verified -> ${m.application.state_verified}`);
  console.log(`✓ Gate 5: Closed-Loop Repair Disabled -> occurred=${m.closed_loop_repair?.occurred}`);
  console.log(`✓ Gate 6: Pinned Commit Match -> ${m.application.tested_commit}`);
  console.log(`✓ Gate 7: Spec SHA-256 Match -> ${m.oracle?.spec_sha256}`);
  console.log(`✓ Gate 8: Ed25519 Signature Valid -> key_id=${m.signature?.key_id}`);
  if (fs.existsSync(parsed.manifestPath)) {
    console.log(`✓ Runner ID: ${m.oracle?.runner_id}`);
  }
  console.log('\n================================================================');
  console.log('🎉 ORACLE PAYMENT VERDICT: RELEASE CONFIRMED');
  console.log('================================================================');
}

main();
