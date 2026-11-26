import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { generateRunManifest, verifyOracleHoldManifest, verifyOracleManifest } from '../src/manifest.js';
import {
  computePublicKeyId,
  loadTrustedKeys,
  signOracleManifest,
  verifyManifestSignature,
} from '../src/oracle/sign.js';
import { RunManifest } from '../src/types.js';

function createEd25519Pair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const keyId = computePublicKeyId(publicKey);
  return { privatePem, publicPem, keyId };
}

const SPEC_SHA = 'a'.repeat(64);
const COMMIT_SHA = '1111222233334444555566667777888899990000';

test('verifyOracleManifest passes on signed oracle release manifest without visual_qa or video artifact', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-sign-'));
  const manifestPath = path.join(tmpDir, 'run-manifest.json');
  const trustedPath = path.join(tmpDir, 'trusted.json');
  const { privatePem, publicPem, keyId } = createEd25519Pair();

  fs.writeFileSync(trustedPath, JSON.stringify({ [keyId]: publicPem }, null, 2), 'utf-8');

  const manifest = generateRunManifest({
    outputPath: manifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-run-1',
    applicationUrl: 'http://localhost:8080/?logged_in=true',
    applicationEnvironment: 'runner_pinned',
    applicationIsolation: 'container',
    baselineCommit: COMMIT_SHA,
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: {
      run_id: 'kane-sess-1',
      kane_cli_version: '0.10.4',
      session_id: '/tmp/kane-sess-1',
      result_code: 100,
    },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  assert.equal(manifest.visual_qa, undefined);
  assert.equal(manifest.artifacts.video, undefined);
  assert.equal(manifest.signature?.alg, 'ed25519');
  assert.equal(manifest.signature?.key_id, keyId);

  const check = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeysPath: trustedPath,
  });
  assert.equal(check.valid, true, `Expected valid manifest, got errors: ${check.errors.join('; ')}`);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Tampering with any manifest field after signing fails verifyOracleManifest', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-tamper-'));
  const manifestPath = path.join(tmpDir, 'run-manifest.json');
  const { privatePem, publicPem, keyId } = createEd25519Pair();

  const signed = generateRunManifest({
    outputPath: manifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-run-2',
    applicationUrl: 'http://localhost:8080/?logged_in=true',
    applicationEnvironment: 'runner_pinned',
    applicationIsolation: 'container',
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-sess-2', kane_cli_version: '0.10.4', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  // Tamper application.tested_commit, oracle.runner_id, and status
  const tamperedCases: Array<(m: RunManifest) => void> = [
    (m) => {
      m.oracle!.runner_id = 'spoofed-runner';
    },
    (m) => {
      m.application.state_verified = false;
    },
    (m) => {
      m.kane_verification!.result_code = 740;
    },
    (m) => {
      m.closed_loop_repair!.occurred = true;
    },
    (m) => {
      m.run_id = 'other-run-id';
    },
  ];

  for (const mutate of tamperedCases) {
    const clone: RunManifest = JSON.parse(JSON.stringify(signed));
    mutate(clone);
    fs.writeFileSync(manifestPath, JSON.stringify(clone, null, 2), 'utf-8');

    const check = verifyOracleManifest(manifestPath, {
      expectedSpecSha256: SPEC_SHA,
      expectedCommit: COMMIT_SHA,
      trustedKeys: { [keyId]: publicPem },
    });
    assert.equal(check.valid, false, 'Tampered manifest must fail verification');
    assert.ok(
      check.errors.some((e) => /signature/i.test(e)),
      `Expected signature verification failure, got: ${check.errors.join('; ')}`
    );
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('verifyOracleManifest rejects untrusted key_id and tampered optional video artifact', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-untrusted-'));
  const manifestPath = path.join(tmpDir, 'run-manifest.json');
  const videoPath = path.join(tmpDir, 'optional.mp4');
  fs.writeFileSync(videoPath, 'original optional bytes');

  const signer = createEd25519Pair();
  const otherTrusted = createEd25519Pair();

  generateRunManifest({
    outputPath: manifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-run-3',
    applicationUrl: 'http://localhost:8080/?logged_in=true',
    applicationEnvironment: 'runner_pinned',
    applicationIsolation: 'container',
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-sess-3', kane_cli_version: '0.10.4', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    videoPath,
    signingKey: signer.privatePem,
  });

  // Untrusted key check
  const untrustedCheck = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [otherTrusted.keyId]: otherTrusted.publicPem },
  });
  assert.equal(untrustedCheck.valid, false);
  assert.ok(untrustedCheck.errors.some((e) => /untrusted/i.test(e)));

  // Trusted key, but optional video tampered
  fs.appendFileSync(videoPath, 'tampered');
  const videoTamperedCheck = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [signer.keyId]: signer.publicPem },
  });
  assert.equal(videoTamperedCheck.valid, false);
  assert.ok(videoTamperedCheck.errors.some((e) => /video sha-256 mismatch/i.test(e)));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('signOracleManifest matches disk JSON round-trip with undefined optional fields', () => {
  const { privatePem, publicPem, keyId } = createEd25519Pair();
  const inMemory: RunManifest = {
    autocast_version: '0.2.0',
    run_id: undefined,
    generated_at: '2026-11-25T00:00:00.000Z',
    mode: 'oracle',
    status: 'verified',
    application: {
      url: 'http://localhost:8080',
      baseline_commit: undefined,
      tested_commit: COMMIT_SHA,
      state_verified: true,
    },
    closed_loop_repair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'runner-1',
      verdict: 'release',
    },
    artifacts: {},
  };

  const signed = signOracleManifest(inMemory, privatePem);
  const reloaded: RunManifest = JSON.parse(JSON.stringify(signed));
  const trusted = loadTrustedKeys({ [keyId]: publicPem });
  const verifyRes = verifyManifestSignature(reloaded, trusted);
  assert.equal(verifyRes.valid, true, verifyRes.error);
});

test('verifyOracleManifest rejects non-runner_pinned environments and verifyOracleHoldManifest validates signed holds', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-env-gate-'));
  const externalManifestPath = path.join(tmpDir, 'external-manifest.json');
  const legacyAttestedPath = path.join(tmpDir, 'legacy-attested-manifest.json');
  const holdManifestPath = path.join(tmpDir, 'hold-manifest.json');
  const { privatePem, publicPem, keyId } = createEd25519Pair();

  generateRunManifest({
    outputPath: externalManifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-ext-1',
    applicationUrl: 'https://external.example.com',
    applicationEnvironment: 'external_unverified',
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-ext-1', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  const extCheck = verifyOracleManifest(externalManifestPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
  });
  assert.equal(extCheck.valid, false);
  assert.ok(extCheck.errors.some((e) => /environment must be 'runner_pinned'/i.test(e)));

  generateRunManifest({
    outputPath: legacyAttestedPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-legacy-env',
    applicationUrl: 'https://external.example.com',
    applicationEnvironment: 'deployment_attested' as any,
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-ext-2', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  const legacyCheck = verifyOracleManifest(legacyAttestedPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
  });
  assert.equal(legacyCheck.valid, false);
  assert.ok(legacyCheck.errors.some((e) => /environment must be 'runner_pinned'/i.test(e)));

  generateRunManifest({
    outputPath: holdManifestPath,
    mode: 'oracle',
    status: 'failed',
    runId: 'oracle-hold-1',
    applicationUrl: 'http://localhost:8080',
    applicationEnvironment: 'runner_pinned',
    testedCommit: COMMIT_SHA,
    stateVerified: false,
    kaneVerification: { run_id: 'kane-hold-1', result_code: 740 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'hold',
      hold_reason: 'kane_failed',
    },
    signingKey: privatePem,
  });

  const holdCheck = verifyOracleHoldManifest(holdManifestPath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
  });
  assert.equal(holdCheck.valid, true, holdCheck.errors.join('; '));

  // Gate 10: unisolated beta release manifest ('none') MUST be rejected by default
  const betaReleasePath = path.join(tmpDir, 'beta-release-manifest.json');
  generateRunManifest({
    outputPath: betaReleasePath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-beta-none',
    applicationUrl: 'http://localhost:8080',
    applicationEnvironment: 'runner_pinned',
    applicationIsolation: 'none',
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-beta-1', kane_cli_version: '0.10.4', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  const strictIsolationCheck = verifyOracleManifest(betaReleasePath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
  });
  assert.equal(strictIsolationCheck.valid, false);
  assert.ok(strictIsolationCheck.errors.some((e) => /isolation must be 'container'/i.test(e)));

  const optInBetaCheck = verifyOracleManifest(betaReleasePath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
    allowUnisolatedBeta: true,
  });
  assert.equal(optInBetaCheck.valid, true, optInBetaCheck.errors.join('; '));

  // Gate 3: untested kane_cli_version rejected even with allowUnisolatedBeta
  const untestedKanePath = path.join(tmpDir, 'untested-kane-manifest.json');
  generateRunManifest({
    outputPath: untestedKanePath,
    mode: 'oracle',
    status: 'verified',
    runId: 'oracle-kane-011',
    applicationUrl: 'http://localhost:8080',
    applicationEnvironment: 'runner_pinned',
    applicationIsolation: 'container',
    testedCommit: COMMIT_SHA,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-011', kane_cli_version: '0.11.0', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: SPEC_SHA,
      seed_id: 'ledgerly-default-v1',
      expected_commit: COMMIT_SHA,
      runner_id: 'ci-runner-1',
      verdict: 'release',
    },
    signingKey: privatePem,
  });

  const untestedKaneCheck = verifyOracleManifest(untestedKanePath, {
    expectedSpecSha256: SPEC_SHA,
    expectedCommit: COMMIT_SHA,
    trustedKeys: { [keyId]: publicPem },
  });
  assert.equal(untestedKaneCheck.valid, false);
  assert.ok(untestedKaneCheck.errors.some((e) => /Untested Kane CLI version/i.test(e)));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
