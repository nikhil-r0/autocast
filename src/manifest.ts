import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RunManifest } from './types.js';

export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

export function generateRunManifest(params: {
  outputPath?: string;
  status?: RunManifest['status'];
  applicationUrl: string;
  baselineCommit?: string;
  testedCommit?: string;
  stateVerified: boolean;
  kaneVerification?: RunManifest['kane_verification'];
  closedLoopRepair?: RunManifest['closed_loop_repair'];
  visualQa?: RunManifest['visual_qa'];
  securityScan?: RunManifest['security_scan'];
  videoPath?: string;
  posterPath?: string;
}): RunManifest {
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

  const manifest: RunManifest = {
    autocast_version: '0.2.0',
    generated_at: new Date().toISOString(),
    status: params.status || 'verified',
    application: {
      url: params.applicationUrl,
      baseline_commit: params.baselineCommit,
      tested_commit: params.testedCommit,
      state_verified: params.stateVerified,
    },
    kane_verification: params.kaneVerification,
    closed_loop_repair: params.closedLoopRepair,
    visual_qa: params.visualQa,
    security_scan: params.securityScan,
    artifacts,
  };

  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
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
  if (options.requireVerifiedStatus && !manifest.application?.state_verified) {
    errors.push('Underlying application state was not verified (application.state_verified !== true)');
  }

  // Mandatory Release Gate: Kane verification result code must be 100
  if (options.requireVerifiedStatus && manifest.kane_verification) {
    if (manifest.kane_verification.result_code !== undefined && manifest.kane_verification.result_code !== 100) {
      errors.push(`Kane verification result code is not 100 (got: ${manifest.kane_verification.result_code})`);
    }
  }

  // Mandatory Release Gate: Visual QA must be passed if present
  if (options.requireVerifiedStatus && manifest.visual_qa) {
    if (manifest.visual_qa.status !== 'passed') {
      errors.push(`Visual QA is not passed (status: '${manifest.visual_qa.status}')`);
    }
  }

  // Mandatory Release Gate: Security OCR scan must be clean
  if (options.requireVerifiedStatus && manifest.security_scan) {
    if (manifest.security_scan.status !== 'clean') {
      errors.push(`Security scan detected issues (status: '${manifest.security_scan.status}')`);
    }
  }

  // Mandatory Artifact: Video must exist if required
  if (options.requireArtifacts && !manifest.artifacts?.video) {
    errors.push('Manifest missing required video artifact entry');
  }

  // Verify video hash
  if (manifest.artifacts?.video) {
    const videoFile = path.resolve(process.cwd(), manifest.artifacts.video.path);
    if (!fs.existsSync(videoFile)) {
      errors.push(`Video artifact missing on disk: ${videoFile}`);
    } else {
      const actualHash = computeFileSha256(videoFile);
      if (actualHash !== manifest.artifacts.video.sha256) {
        errors.push(`Video SHA-256 mismatch! Manifest: ${manifest.artifacts.video.sha256}, Actual: ${actualHash}`);
      }
    }
  }

  // Verify poster hash
  if (manifest.artifacts?.poster) {
    const posterFile = path.resolve(process.cwd(), manifest.artifacts.poster.path);
    if (!fs.existsSync(posterFile)) {
      errors.push(`Poster artifact missing on disk: ${posterFile}`);
    } else {
      const actualHash = computeFileSha256(posterFile);
      if (actualHash !== manifest.artifacts.poster.sha256) {
        errors.push(`Poster SHA-256 mismatch! Manifest: ${manifest.artifacts.poster.sha256}, Actual: ${actualHash}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

