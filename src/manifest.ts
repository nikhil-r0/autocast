import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApplicationEnvironment, RunManifest } from './types.js';
import {
  TrustedKeyMap,
  computePublicKeyId,
  loadTrustedKeys,
  signOracleManifest,
  verifyManifestSignature,
} from './oracle/sign.js';
import { normalizeSha256Hex } from './oracle/spec.js';

export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * When verifying a sealed manifest on a fresh clone, out/ is gitignored.
 * Committed examples/output copies keep the same SHA-256 as the sealed paths.
 */
const COMMITTED_ARTIFACT_ALIASES: Record<string, string[]> = {
  'out/demo.mp4': ['examples/output/sample-demo.mp4'],
  'out/poster.jpg': ['examples/output/poster.jpg'],
};

export function resolveArtifactPath(declaredPath: string): string | null {
  const normalized = declaredPath.replace(/\\/g, '/');
  const candidates = [
    path.resolve(process.cwd(), declaredPath),
    ...(COMMITTED_ARTIFACT_ALIASES[normalized] || []).map((alias) =>
      path.resolve(process.cwd(), alias)
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function verifyDeclaredArtifacts(manifest: RunManifest, requireArtifacts: boolean): string[] {
  const errors: string[] = [];

  if (requireArtifacts) {
    if (!manifest.artifacts?.video) {
      errors.push('Manifest missing required video artifact entry');
    }
    if (!manifest.artifacts?.poster) {
      errors.push('Manifest missing required poster artifact entry');
    }
  }

  if (manifest.artifacts?.video) {
    const videoFile = resolveArtifactPath(manifest.artifacts.video.path);
    if (!videoFile) {
      errors.push(`Video artifact missing on disk: ${manifest.artifacts.video.path}`);
    } else {
      const actualHash = computeFileSha256(videoFile);
      if (actualHash !== manifest.artifacts.video.sha256) {
        errors.push(`Video SHA-256 mismatch! Manifest: ${manifest.artifacts.video.sha256}, Actual: ${actualHash}`);
      }
    }
  }

  if (manifest.artifacts?.poster) {
    const posterFile = resolveArtifactPath(manifest.artifacts.poster.path);
    if (!posterFile) {
      errors.push(`Poster artifact missing on disk: ${manifest.artifacts.poster.path}`);
    } else {
      const actualHash = computeFileSha256(posterFile);
      if (actualHash !== manifest.artifacts.poster.sha256) {
        errors.push(`Poster SHA-256 mismatch! Manifest: ${manifest.artifacts.poster.sha256}, Actual: ${actualHash}`);
      }
    }
  }

  return errors;
}

export function generateRunManifest(params: {
  outputPath?: string;
  additionalOutputPaths?: string[];
  mode?: 'demo' | 'oracle';
  status: RunManifest['status'];
  runId?: string;
  applicationUrl: string;
  applicationEnvironment?: ApplicationEnvironment;
  baselineCommit?: string;
  testedCommit?: string;
  integrationCommit?: string;
  stateVerified: boolean;
  kaneVerification?: RunManifest['kane_verification'];
  closedLoopRepair?: RunManifest['closed_loop_repair'];
  visualQa?: RunManifest['visual_qa'];
  securityScan?: RunManifest['security_scan'];
  oracle?: RunManifest['oracle'];
  signature?: RunManifest['signature'];
  signingKey?: string;
  videoPath?: string;
  posterPath?: string;
}): RunManifest {
  if (!params.status) {
    throw new Error('generateRunManifest requires an explicit status (no default fallback allowed)');
  }

  const mode = params.mode || (params.oracle ? 'oracle' : 'demo');
  if (mode === 'oracle') {
    if (!params.oracle) {
      throw new Error('Oracle manifest generation requires oracle metadata');
    }
    if (params.closedLoopRepair?.occurred === true) {
      throw new Error('Oracle manifest cannot record closed_loop_repair.occurred = true');
    }
  }

  const outputPath = params.outputPath || path.join(process.cwd(), 'out', 'run-manifest.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const artifacts: RunManifest['artifacts'] = {};

  if (params.videoPath && fs.existsSync(params.videoPath)) {
    const stats = fs.statSync(params.videoPath);
    artifacts.video = {
      path: path.relative(process.cwd(), params.videoPath),
      sha256: computeFileSha256(params.videoPath),
      size_bytes: stats.size,
    };
  }

  if (params.posterPath && fs.existsSync(params.posterPath)) {
    artifacts.poster = {
      path: path.relative(process.cwd(), params.posterPath),
      sha256: computeFileSha256(params.posterPath),
    };
  }

  let closedLoopRepair = params.closedLoopRepair;
  if (mode === 'oracle') {
    closedLoopRepair = { occurred: false };
  }

  let manifest: RunManifest = {
    autocast_version: '0.2.0',
    run_id: params.runId,
    generated_at: new Date().toISOString(),
    ...(params.mode ? { mode: params.mode } : mode === 'oracle' ? { mode: 'oracle' } : {}),
    status: params.status,
    application: {
      url: params.applicationUrl,
      ...(params.applicationEnvironment ? { environment: params.applicationEnvironment } : {}),
      baseline_commit: params.baselineCommit,
      tested_commit: params.testedCommit,
      integration_commit: params.integrationCommit,
      state_verified: params.stateVerified,
    },
    kane_verification: params.kaneVerification,
    closed_loop_repair: closedLoopRepair,
    visual_qa: params.visualQa,
    security_scan: params.securityScan,
    ...(params.oracle ? { oracle: params.oracle } : {}),
    artifacts,
    ...(params.signature ? { signature: params.signature } : {}),
  };

  const resolvedSigningKey =
    params.signingKey ?? (mode === 'oracle' ? process.env.ORACLE_SIGNING_KEY : undefined);

  if (resolvedSigningKey && !params.signature) {
    manifest = signOracleManifest(manifest, resolvedSigningKey);
  }

  const serialized = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(outputPath, serialized, 'utf-8');
  for (const extraPath of params.additionalOutputPaths || []) {
    if (path.resolve(extraPath) !== path.resolve(outputPath)) {
      fs.mkdirSync(path.dirname(extraPath), { recursive: true });
      fs.writeFileSync(extraPath, serialized, 'utf-8');
    }
  }
  console.log(`[Provenance] Sealed tamper-evident run-manifest.json -> ${outputPath}`);
  return manifest;
}

export function verifyRunManifest(
  manifestPath: string,
  options: { requireVerifiedStatus?: boolean; requireArtifacts?: boolean } = { requireVerifiedStatus: true }
): { valid: boolean; errors: string[] } {
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, errors: [`Manifest file not found: ${manifestPath}`] };
  }

  const errors: string[] = [];
  const content = fs.readFileSync(manifestPath, 'utf-8');
  let manifest: RunManifest;
  try {
    manifest = JSON.parse(content);
  } catch {
    return { valid: false, errors: ['Manifest is not valid JSON'] };
  }

  // Mandatory Release Gate: status must be 'verified'
  if (options.requireVerifiedStatus && manifest.status !== 'verified') {
    errors.push(`Manifest status is not 'verified' (current status: '${manifest.status}')`);
  }

  // Mandatory Release Gate: application state must be verified
  if (options.requireVerifiedStatus && manifest.application?.state_verified !== true) {
    errors.push('Underlying application state was not verified (application.state_verified !== true)');
  }

  // Mandatory Release Gate: Kane verification result code must be 100
  if (options.requireVerifiedStatus) {
    if (!manifest.kane_verification) {
      errors.push('Manifest missing required kane_verification entry');
    } else if (manifest.kane_verification.result_code !== 100) {
      errors.push(`Kane verification result code is not 100 (got: ${manifest.kane_verification.result_code})`);
    }
  }

  // Mandatory Release Gate: Visual QA must be passed
  if (options.requireVerifiedStatus) {
    if (!manifest.visual_qa) {
      errors.push('Manifest missing required visual_qa entry');
    } else if (manifest.visual_qa.status !== 'passed') {
      errors.push(`Visual QA is not passed (status: '${manifest.visual_qa.status}')`);
    }
  }

  // Mandatory Release Gate: Security OCR scan must be clean
  if (options.requireVerifiedStatus) {
    if (!manifest.security_scan) {
      errors.push('Manifest missing required security_scan entry');
    } else if (manifest.security_scan.status !== 'clean') {
      errors.push(`Security scan detected issues (status: '${manifest.security_scan.status}')`);
    }
  }

  errors.push(...verifyDeclaredArtifacts(manifest, Boolean(options.requireArtifacts)));

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface VerifyOracleManifestOptions {
  expectedSpecSha256: string;
  expectedCommit: string;
  trustedKeysPath?: string;
  trustedKeys?: TrustedKeyMap;
  publicKeyPem?: string;
}

export function verifyOracleManifest(
  manifestPath: string,
  options: VerifyOracleManifestOptions
): { valid: boolean; errors: string[]; manifest?: RunManifest } {
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, errors: [`Manifest file not found: ${manifestPath}`] };
  }

  const errors: string[] = [];
  const content = fs.readFileSync(manifestPath, 'utf-8');
  let manifest: RunManifest;
  try {
    manifest = JSON.parse(content);
  } catch {
    return { valid: false, errors: ['Manifest is not valid JSON'] };
  }

  let expectedSpecSha256: string;
  try {
    expectedSpecSha256 = normalizeSha256Hex(options.expectedSpecSha256, 'expectedSpecSha256');
  } catch (err: any) {
    return { valid: false, errors: [err.message], manifest };
  }

  if (manifest.mode !== 'oracle') {
    errors.push(`Manifest mode must be 'oracle' (got: '${manifest.mode || 'undefined'}')`);
  }

  if (manifest.status !== 'verified') {
    errors.push(`Manifest status must be 'verified' for payment release (got: '${manifest.status}')`);
  }

  if (!manifest.oracle) {
    errors.push('Manifest missing required oracle metadata');
  } else {
    if (manifest.oracle.verdict !== 'release') {
      errors.push(
        `Oracle verdict is '${manifest.oracle.verdict}'${manifest.oracle.hold_reason ? ` (${manifest.oracle.hold_reason})` : ''}; expected 'release'`
      );
    }
    if (manifest.oracle.hold_reason) {
      errors.push(`Oracle manifest contains hold_reason '${manifest.oracle.hold_reason}'`);
    }
    if (manifest.oracle.spec_sha256 !== expectedSpecSha256) {
      errors.push(
        `Spec SHA-256 mismatch! Expected '${expectedSpecSha256}', manifest has '${manifest.oracle.spec_sha256}'`
      );
    }
    if (manifest.oracle.expected_commit?.toLowerCase() !== options.expectedCommit.toLowerCase()) {
      errors.push(
        `Oracle expected_commit mismatch! Expected '${options.expectedCommit}', manifest has '${manifest.oracle.expected_commit}'`
      );
    }
  }

  if (!manifest.kane_verification) {
    errors.push('Manifest missing required kane_verification entry');
  } else if (manifest.kane_verification.result_code !== 100) {
    errors.push(`Kane verification result_code must be 100 (got: ${manifest.kane_verification.result_code})`);
  }

  if (manifest.application?.state_verified !== true) {
    errors.push('Underlying backend state was not verified (application.state_verified !== true)');
  }

  if (manifest.closed_loop_repair?.occurred !== false) {
    errors.push(
      `Oracle manifest must record closed_loop_repair.occurred === false (got: ${String(manifest.closed_loop_repair?.occurred)})`
    );
  }

  if (manifest.application?.tested_commit?.toLowerCase() !== options.expectedCommit.toLowerCase()) {
    errors.push(
      `Tested commit mismatch! Expected '${options.expectedCommit}', manifest has '${manifest.application?.tested_commit}'`
    );
  }

  const appEnv = manifest.application?.environment;
  if (appEnv !== 'runner_pinned' && appEnv !== 'deployment_attested') {
    errors.push(
      `Oracle application.environment must be 'runner_pinned' or 'deployment_attested' (got: '${appEnv || 'undefined'}')`
    );
  }

  // Signature verification (always required in oracle mode; fails closed if no trusted keys provided)
  try {
    let trustedKeys: TrustedKeyMap;
    if (options.trustedKeys) {
      trustedKeys = loadTrustedKeys(options.trustedKeys);
    } else if (options.publicKeyPem) {
      const pubObj = crypto.createPublicKey(options.publicKeyPem.replace(/\\n/g, '\n'));
      const keyId = computePublicKeyId(pubObj);
      trustedKeys = { [keyId]: pubObj.export({ type: 'spki', format: 'pem' }).toString() };
    } else {
      trustedKeys = loadTrustedKeys(options.trustedKeysPath);
    }

    const sigCheck = verifyManifestSignature(manifest, trustedKeys);
    if (!sigCheck.valid) {
      errors.push(sigCheck.error || 'Manifest signature verification failed');
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  // Optional cinematic artifacts: never required, but verify hashes if attached
  errors.push(...verifyDeclaredArtifacts(manifest, false));

  return {
    valid: errors.length === 0,
    errors,
    manifest,
  };
}

/**
 * Cryptographically verifies a signed HOLD manifest (e.g. C_bug) against the agreed
 * spec hash, expected commit, non-repair invariant, and trusted runner keys.
 */
export function verifyOracleHoldManifest(
  manifestPath: string,
  options: VerifyOracleManifestOptions
): { valid: boolean; errors: string[]; manifest?: RunManifest } {
  if (!fs.existsSync(manifestPath)) {
    return { valid: false, errors: [`Manifest file not found: ${manifestPath}`] };
  }

  const errors: string[] = [];
  let manifest: RunManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { valid: false, errors: ['Manifest is not valid JSON'] };
  }

  let expectedSpecSha256: string;
  try {
    expectedSpecSha256 = normalizeSha256Hex(options.expectedSpecSha256, 'expectedSpecSha256');
  } catch (err: any) {
    return { valid: false, errors: [err.message], manifest };
  }

  if (manifest.mode !== 'oracle') {
    errors.push(`Hold manifest mode must be 'oracle' (got: '${manifest.mode || 'undefined'}')`);
  }
  if (manifest.status !== 'failed') {
    errors.push(`Hold manifest status must be 'failed' (got: '${manifest.status}')`);
  }
  if (!manifest.oracle) {
    errors.push('Hold manifest missing required oracle metadata');
  } else {
    if (manifest.oracle.verdict !== 'hold') {
      errors.push(`Expected verdict 'hold', got '${manifest.oracle.verdict}'`);
    }
    if (!manifest.oracle.hold_reason) {
      errors.push('Hold manifest missing required hold_reason');
    }
    if (manifest.oracle.spec_sha256 !== expectedSpecSha256) {
      errors.push(
        `Hold manifest spec_sha256 mismatch! Expected '${expectedSpecSha256}', got '${manifest.oracle.spec_sha256}'`
      );
    }
    if (manifest.oracle.expected_commit?.toLowerCase() !== options.expectedCommit.toLowerCase()) {
      errors.push(
        `Hold manifest expected_commit mismatch! Expected '${options.expectedCommit}', got '${manifest.oracle.expected_commit}'`
      );
    }
  }

  if (manifest.closed_loop_repair?.occurred !== false) {
    errors.push(
      `Hold manifest must record closed_loop_repair.occurred === false (got: ${String(manifest.closed_loop_repair?.occurred)})`
    );
  }

  if (
    manifest.oracle?.hold_reason !== 'commit_mismatch' &&
    manifest.oracle?.hold_reason !== 'spec_mismatch' &&
    manifest.application?.tested_commit?.toLowerCase() !== options.expectedCommit.toLowerCase()
  ) {
    errors.push(
      `Hold manifest tested_commit mismatch! Expected '${options.expectedCommit}', got '${manifest.application?.tested_commit}'`
    );
  }

  const appEnv = manifest.application?.environment;
  if (appEnv !== 'runner_pinned' && appEnv !== 'deployment_attested') {
    errors.push(
      `Hold manifest application.environment must be 'runner_pinned' or 'deployment_attested' (got: '${appEnv || 'undefined'}')`
    );
  }

  try {
    let trustedKeys: TrustedKeyMap;
    if (options.trustedKeys) {
      trustedKeys = loadTrustedKeys(options.trustedKeys);
    } else if (options.publicKeyPem) {
      const pubObj = crypto.createPublicKey(options.publicKeyPem.replace(/\\n/g, '\n'));
      const keyId = computePublicKeyId(pubObj);
      trustedKeys = { [keyId]: pubObj.export({ type: 'spki', format: 'pem' }).toString() };
    } else {
      trustedKeys = loadTrustedKeys(options.trustedKeysPath);
    }

    const sigCheck = verifyManifestSignature(manifest, trustedKeys);
    if (!sigCheck.valid) {
      errors.push(sigCheck.error || 'Hold manifest signature verification failed');
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest,
  };
}
