import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { verifyOracleManifest } from '../src/manifest.js';
import { loadAcceptanceSpec, validateCommitSha40 } from '../src/oracle/spec.js';
import { runOraclePipeline } from '../src/oracle/runner.js';
import type { OracleVerdict } from '../src/types.js';

dotenv.config();

interface ReverifyCliArgs {
  specPath?: string;
  commit?: string;
  manifestPath?: string;
  trustedKeysPath?: string;
  reshoot: boolean;
}

function parseArgs(argv: string[]): ReverifyCliArgs {
  let specPath: string | undefined;
  let commit: string | undefined;
  let manifestPath: string | undefined;
  let trustedKeysPath: string | undefined;
  let reshoot = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--spec' && argv[i + 1]) {
      specPath = argv[++i];
    } else if (arg.startsWith('--spec=')) {
      specPath = arg.slice('--spec='.length);
    } else if (arg === '--commit' && argv[i + 1]) {
      commit = argv[++i];
    } else if (arg.startsWith('--commit=')) {
      commit = arg.slice('--commit='.length);
    } else if (arg === '--manifest' && argv[i + 1]) {
      manifestPath = argv[++i];
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = arg.slice('--manifest='.length);
    } else if (arg === '--trusted-keys' && argv[i + 1]) {
      trustedKeysPath = argv[++i];
    } else if (arg.startsWith('--trusted-keys=')) {
      trustedKeysPath = arg.slice('--trusted-keys='.length);
    } else if (arg === '--reshoot') {
      reshoot = true;
    } else if (!arg.startsWith('-') && !manifestPath) {
      manifestPath = arg;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return { specPath, commit, manifestPath, trustedKeysPath, reshoot };
}

export interface ReverifyResult {
  status: 'verified' | 'reproduced' | 'inconclusive' | 'failed';
  exitCode: 0 | 1 | 2 | 4;
  originalVerdict?: OracleVerdict;
  reshootVerdict?: OracleVerdict;
  errors: string[];
}

export async function reverifyOracle(options: {
  specPath: string;
  commit: string;
  manifestPath: string;
  trustedKeysPath?: string;
  reshoot?: boolean;
  outDir?: string;
  runOracleFn?: typeof runOraclePipeline;
}): Promise<ReverifyResult> {
  const expectedCommit = validateCommitSha40(options.commit, '--commit');
  const loaded = loadAcceptanceSpec(options.specPath);

  const offlineCheck = verifyOracleManifest(options.manifestPath, {
    expectedSpecSha256: loaded.specSha256,
    expectedCommit,
    trustedKeysPath: options.trustedKeysPath,
  });

  if (!options.reshoot) {
    return {
      status: offlineCheck.valid ? 'verified' : 'failed',
      exitCode: offlineCheck.valid ? 0 : 1,
      originalVerdict: offlineCheck.manifest?.oracle?.verdict,
      errors: offlineCheck.errors,
    };
  }

  // Online reshoot path: run oracle mode on an isolated run directory and diff verdict
  const originalManifest = offlineCheck.manifest;
  if (!originalManifest || !originalManifest.oracle) {
    return {
      status: 'failed',
      exitCode: 1,
      errors: offlineCheck.errors.length > 0 ? offlineCheck.errors : ['Original manifest missing oracle section'],
    };
  }

  // Reject tampered or untrusted original manifests before reshooting unless it is an authentic signed hold
  const isSignedHold = originalManifest.oracle.verdict === 'hold';
  const holdReason = originalManifest.oracle.hold_reason;
  const nonVerdictErrors = isSignedHold
    ? offlineCheck.errors.filter((err) => {
        if (
          err.startsWith('Manifest status must be') ||
          err.startsWith('Oracle verdict is') ||
          err.startsWith('Oracle manifest contains hold_reason') ||
          err.startsWith('Kane verification result_code') ||
          err.startsWith('Underlying backend state was not verified') ||
          err.startsWith('Manifest missing required kane_verification entry')
        ) {
          return false;
        }
        if (
          (holdReason === 'commit_mismatch' || holdReason === 'spec_mismatch') &&
          err.startsWith('Tested commit mismatch!')
        ) {
          return false;
        }
        return true;
      })
    : offlineCheck.errors;
  if (nonVerdictErrors.length > 0) {
    return {
      status: 'failed',
      exitCode: 1,
      originalVerdict: originalManifest.oracle.verdict,
      errors: nonVerdictErrors,
    };
  }

  const runOracleFn = options.runOracleFn || runOraclePipeline;
  const reshootRunId = `reverify-${Date.now()}`;
  const reshootOutDir = options.outDir || path.join(process.cwd(), 'out', 'reverify', reshootRunId);
  fs.mkdirSync(reshootOutDir, { recursive: true });

  const reshootOutcome = await runOracleFn({
    specPath: options.specPath,
    commit: expectedCommit,
    expectSpecSha256: loaded.specSha256,
    requireExpectSpecSha256: true,
    runId: reshootRunId,
    outDir: reshootOutDir,
    manifestOutPath: path.join(reshootOutDir, 'run-manifest.json'),
  });

  const originalVerdict = originalManifest.oracle.verdict;
  const reshootVerdict = reshootOutcome.verdict;

  if (!reshootVerdict) {
    return {
      status: 'inconclusive',
      exitCode: 4,
      originalVerdict,
      errors: [
        `Reshoot failed to produce an oracle verdict (exit=${reshootOutcome.exitCode}): ${reshootOutcome.error || 'unknown error'}`,
      ],
    };
  }

  if (reshootVerdict !== originalVerdict) {
    return {
      status: 'inconclusive',
      exitCode: 4,
      originalVerdict,
      reshootVerdict,
      errors: [
        `Verdict divergence detected: original manifest sealed '${originalVerdict}', reshoot produced '${reshootVerdict}' (reported as inconclusive, not hold).`,
      ],
    };
  }

  return {
    status: originalVerdict === 'inconclusive' ? 'inconclusive' : 'reproduced',
    exitCode: originalVerdict === 'release' ? 0 : originalVerdict === 'inconclusive' ? 4 : 1,
    originalVerdict,
    reshootVerdict,
    errors: [],
  };
}

async function main(): Promise<void> {
  let args: ReverifyCliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err: any) {
    console.error(`❌ Argument error: ${err.message}`);
    console.error(
      'Usage: npm run reverify:oracle -- --spec <spec.json> --commit <sha> --manifest <manifest.json> [--trusted-keys <path>] [--reshoot]'
    );
    process.exit(2);
  }

  if (!args.specPath || !args.commit || !args.manifestPath) {
    console.error('❌ --spec, --commit, and --manifest are all required.');
    process.exit(2);
  }

  try {
    const result = await reverifyOracle({
      specPath: args.specPath,
      commit: args.commit,
      manifestPath: args.manifestPath,
      trustedKeysPath: args.trustedKeysPath,
      reshoot: args.reshoot,
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.exitCode);
  } catch (err: any) {
    console.error(`❌ Re-verification error: ${err.message}`);
    process.exit(2);
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]).endsWith('reverify-oracle.ts');
if (isEntrypoint) {
  main();
}
