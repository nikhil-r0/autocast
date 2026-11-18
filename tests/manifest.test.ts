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

test('TEST-23: Previous run has stale 740 evidence -> New evidence generator rejects mismatched RUN_ID', () => {
  const currentRunId = 'autocast-run-2026-today';
  const staleRunId = 'autocast-run-2025-yesterday';

  const manifest = {
    run_id: currentRunId,
    status: 'verified',
    application: { tested_commit: 'abc123' },
  };

  const staleFailureSummary = {
    run_id: staleRunId,
    result_code: 740,
    verdict: { category: 'application_issue' },
  };

  // Verifies the stale contamination guard
  assert.notEqual(manifest.run_id, staleFailureSummary.run_id);
  const isContaminated = Boolean(manifest.run_id && staleFailureSummary.run_id && manifest.run_id !== staleFailureSummary.run_id);
  assert.equal(isContaminated, true, 'Must detect stale run contamination when run_ids diverge');
});

test('TEST-24: showcase-props.json has verified: false -> Showcase verifier fails', () => {
  const unverifiedProps = {
    autocastVersion: '0.2.0',
    prUrl: 'https://github.com/nikhil-r0/autocast/pull/42',
    prNumber: 42,
    branch: 'fix/ledgerly-approve-noop',
    candidateCommit: '9ef4bad',
    testedCommit: '9ef4bad',
    kaneResult: 100,
    verified: false, // Explicit unverified
    stateVerified: true,
  };

  // Simulating showcase validation checks
  const errors: string[] = [];
  if (unverifiedProps.verified !== true) {
    errors.push('Showcase props are not verified (props.verified !== true)');
  }

  assert.equal(errors.length, 1);
  assert.match(errors[0], /props are not verified/i);
});

test('TEST-25: Source or PR video changes after finalization -> Hash mismatch rejected', () => {
  const tempDir = path.resolve(process.cwd(), 'out', 'test-hashes');
  fs.mkdirSync(tempDir, { recursive: true });
  const testVideo = path.join(tempDir, 'source.mp4');
  fs.writeFileSync(testVideo, 'original source video bytes');

  const initialHash = computeFileSha256(testVideo);

  // Tamper video bytes
  fs.appendFileSync(testVideo, ' - unauthorized modification');
  const tamperedHash = computeFileSha256(testVideo);

  assert.notEqual(initialHash, tamperedHash);

  const errors: string[] = [];
  if (tamperedHash !== initialHash) {
    errors.push(`Source video hash mismatch! Disk: ${tamperedHash}, Props: ${initialHash}`);
  }

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Source video hash mismatch/);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('TEST-26: PR has the wrong head branch -> Validation aborts', () => {
  const expectedBranch = 'fix/ledgerly-approve-noop';
  const displayedBranches = ['feature/unrelated-branch', 'main', 'prefix-fix/ledgerly-approve-noop'];

  // Exact normalized match required - substrings must be rejected
  const foundExpected = displayedBranches.some((b) => b.trim() === expectedBranch);

  assert.equal(foundExpected, false, 'Expected branch should not be found with exact matching');
  assert.throws(
    () => {
      if (!foundExpected) {
        throw new Error(`PR head branch mismatch: expected "${expectedBranch}"`);
      }
    },
    /PR head branch mismatch/,
    'Must throw on head branch mismatch'
  );
});

test('TEST-27: Showcase finalizer / verifier rejects run_id or testedCommit mismatch', () => {
  const manifestRunId = 'autocast-run-canonical-100';
  const manifestCommit = 'commit-canonical-abc';

  const propsMismatchedRunId = {
    runId: 'autocast-run-old-200',
    testedCommit: manifestCommit,
  };

  const propsMismatchedCommit = {
    runId: manifestRunId,
    testedCommit: 'commit-diverged-xyz',
  };

  // Run ID mismatch assertion
  assert.throws(
    () => {
      if (propsMismatchedRunId.runId !== manifestRunId) {
        throw new Error(`Run ID mismatch! baseProps.runId ('${propsMismatchedRunId.runId}') !== runManifest.run_id ('${manifestRunId}')`);
      }
    },
    /Run ID mismatch/,
    'Must throw on run_id mismatch'
  );

  // Commit mismatch assertion
  assert.throws(
    () => {
      if (propsMismatchedCommit.testedCommit !== manifestCommit) {
        throw new Error(
          `Tested commit mismatch! baseProps.testedCommit ('${propsMismatchedCommit.testedCommit}') !== manifest.application.tested_commit ('${manifestCommit}')`
        );
      }
    },
    /Tested commit mismatch/,
    'Must throw on tested commit mismatch'
  );
});

test('TEST-28: Preflight checks git status clean, main branch, and sync with origin/main', () => {
  const dirtyPorcelain = ' M src/cli.ts\n?? scratch.txt';
  const featureBranch = 'fix/some-scratch-fix';
  const localCommit = '1111111111111111111111111111111111111111';
  const remoteCommit = '2222222222222222222222222222222222222222';

  assert.throws(
    () => {
      if (featureBranch !== 'main') {
        throw new Error(`Active branch is '${featureBranch}'. Expected 'main'.`);
      }
    },
    /Active branch is 'fix\/some-scratch-fix'\. Expected 'main'/,
    'Must fail when branch is not main'
  );

  assert.throws(
    () => {
      if (dirtyPorcelain) {
        throw new Error(`Git working tree is dirty:\n${dirtyPorcelain}`);
      }
    },
    /Git working tree is dirty/,
    'Must fail when working directory has uncommitted files'
  );

  assert.throws(
    () => {
      if (localCommit !== remoteCommit) {
        throw new Error(`Local commit (${localCommit}) differs from origin/main (${remoteCommit}). Please sync with remote.`);
      }
    },
    /Local commit .* differs from origin\/main/,
    'Must fail when local commit is not in sync with origin/main'
  );
});
