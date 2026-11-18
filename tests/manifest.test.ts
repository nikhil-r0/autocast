import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { generateRunManifest, verifyRunManifest, computeFileSha256 } from '../src/manifest.js';

test('computeFileSha256 computes valid 64-char hex string', () => {
  const tempFile = path.resolve(process.cwd(), 'out', 'test-file.txt');
  fs.mkdirSync(path.dirname(tempFile), { recursive: true });
  fs.writeFileSync(tempFile, 'Hello Autocast AI');

  const sha = computeFileSha256(tempFile);
  assert.equal(sha.length, 64);
  assert.match(sha, /^[a-f0-9]{64}$/);

  fs.rmSync(tempFile, { force: true });
});

test('TEST-13: --skip-review flag enabled -> manifest stamped UNVERIFIED DRAFT and visual_qa status is flagged', () => {
  const tempManifest = path.resolve(process.cwd(), 'out', 'unverified-manifest.json');
  fs.mkdirSync(path.dirname(tempManifest), { recursive: true });

  const manifest = generateRunManifest({
    outputPath: tempManifest,
    status: 'unverified_draft',
    applicationUrl: 'http://localhost:8080',
    stateVerified: true,
    visualQa: {
      status: 'flagged',
      attempts: 0,
    },
  });

  assert.equal(manifest.status, 'unverified_draft');
  assert.equal(manifest.visual_qa?.status, 'flagged');

  // Strict verification rejects unverified draft
  const strictCheck = verifyRunManifest(tempManifest, { requireVerifiedStatus: true });
  assert.equal(strictCheck.valid, false);
  assert.ok(strictCheck.errors.some((e) => e.includes('unverified_draft')));

  // Non-strict verification allows checking format
  const formatCheck = verifyRunManifest(tempManifest, { requireVerifiedStatus: false });
  assert.equal(formatCheck.valid, true);

  fs.rmSync(tempManifest, { force: true });
});

test('TEST-19: MP4 bytes modified after manifest generation -> SHA-256 verification detects tampering', () => {
  const tempVideo = path.resolve(process.cwd(), 'out', 'test-demo.mp4');
  const tempManifest = path.resolve(process.cwd(), 'out', 'test-manifest.json');
  fs.mkdirSync(path.dirname(tempVideo), { recursive: true });

  fs.writeFileSync(tempVideo, 'Original video bytes 12345');

  // Generate manifest
  generateRunManifest({
    outputPath: tempManifest,
    applicationUrl: 'http://localhost:8080',
    stateVerified: true,
    kaneVerification: { run_id: 'kane-test', result_code: 100 },
    visualQa: { status: 'passed', attempts: 1 },
    securityScan: { status: 'clean', ocr_frames_scanned: 1 },
    videoPath: tempVideo,
  });

  // Verify before tamper
  const initialCheck = verifyRunManifest(tempManifest);
  assert.equal(initialCheck.valid, true);

  // Tamper video bytes!
  fs.appendFileSync(tempVideo, ' - malicious injection');

  // Verify after tamper
  const tamperedCheck = verifyRunManifest(tempManifest);
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.errors.length, 1);
  assert.match(tamperedCheck.errors[0], /video sha-256 mismatch/i);

  // Clean up
  fs.rmSync(tempVideo, { force: true });
  fs.rmSync(tempManifest, { force: true });
});

test('TEST-21: Manifest missing required verification fields or artifacts fails closed', () => {
  const tempManifest = path.resolve(process.cwd(), 'out', 'test-missing-fields-manifest.json');
  fs.mkdirSync(path.dirname(tempManifest), { recursive: true });

  // Incomplete manifest missing kane_verification, visual_qa, and security_scan
  const incompleteManifest = {
    autocast_version: '0.2.0',
    generated_at: new Date().toISOString(),
    status: 'verified',
    application: {
      url: 'http://localhost:8080',
      baseline_commit: 'abc',
      tested_commit: 'def',
      state_verified: true,
    },
    artifacts: {
      video: {
        path: 'out/test-video.mp4',
        sha256: 'a'.repeat(64),
      },
    },
  };

  fs.writeFileSync(tempManifest, JSON.stringify(incompleteManifest, null, 2), 'utf-8');

  const check = verifyRunManifest(tempManifest, { requireVerifiedStatus: true, requireArtifacts: true });
  assert.equal(check.valid, false);
  assert.ok(check.errors.some((e) => e.includes('kane_verification')));
  assert.ok(check.errors.some((e) => e.includes('visual_qa')));
  assert.ok(check.errors.some((e) => e.includes('security_scan')));
  assert.ok(check.errors.some((e) => e.includes('poster')));

  fs.rmSync(tempManifest, { force: true });
});


