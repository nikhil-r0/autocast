import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { generateRunManifest } from '../src/manifest.js';
import { computePublicKeyId } from '../src/oracle/sign.js';
import { computeSpecSha256 } from '../src/oracle/spec.js';
import {
  buildVerdictPayload,
  EvmVerdictPublisher,
  NotImplementedError,
  publishVerdict,
  verifyWebhookSignature,
} from '../src/oracle/publish.js';
import { reverifyOracle } from '../scripts/reverify-oracle.js';
import { finalizeOracleDrop } from '../scripts/finalize-oracle-drop.js';
import { AcceptanceSpec } from '../src/types.js';

function makePair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    keyId: computePublicKeyId(publicKey),
  };
}

const COMMIT = 'feedface1234567890abcdef1234567890abcdef';
const SAMPLE_SPEC: AcceptanceSpec = {
  version: 1,
  title: 'Oracle Publish & Reverify Test Spec',
  objective: 'Click Review, approve INV-1042, verify Approved.',
  outcome_specs: [
    {
      id: 'api-approved',
      verification: {
        type: 'api_state',
        endpoint: '/api/invoices/INV-1042',
        jsonPath: 'status',
        expected: 'Approved',
      },
    },
  ],
  target: {
    url: 'http://localhost:8080/?logged_in=true',
    seed_id: 'ledgerly-default-v1',
  },
  contract_id: 'contract-reverify-1',
  milestone_id: 'milestone-42',
};

test('publishVerdict supports stdout-json, webhook with HMAC signature, and evm stub', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-pub-'));
  const keys = makePair();
  const { specSha256 } = computeSpecSha256(SAMPLE_SPEC);
  const manifestPath = path.join(tmpDir, 'run-manifest.json');

  const manifest = generateRunManifest({
    outputPath: manifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'pub-run-1',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: COMMIT,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-pub-1', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: COMMIT,
      runner_id: 'runner-pub',
      verdict: 'release',
    },
    signingKey: keys.privatePem,
  });

  const payload = buildVerdictPayload(manifest, manifestPath, SAMPLE_SPEC.milestone_id);
  assert.equal(payload.verdict, 'release');
  assert.equal(payload.manifest_sha256.length, 64);
  assert.equal(payload.milestone_id, 'milestone-42');

  // 1. stdout-json adapter
  let capturedStdout = '';
  const stdoutRes = await publishVerdict(payload, {
    adapter: 'stdout-json',
    stdoutWriter: (chunk) => {
      capturedStdout += chunk;
    },
  });
  assert.equal(stdoutRes.published, true);
  assert.equal(JSON.parse(capturedStdout).manifest_sha256, payload.manifest_sha256);

  // 2. webhook adapter with real HTTP server verifying timestamp-bound HMAC header
  const secret = 'test-webhook-secret';
  let receivedSignature = '';
  let receivedTimestamp = '';
  let receivedBody = '';
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      receivedBody = Buffer.concat(chunks).toString('utf8');
      receivedSignature = String(req.headers['x-autocast-signature'] || '');
      receivedTimestamp = String(req.headers['x-autocast-timestamp'] || '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;

  try {
    const webhookRes = await publishVerdict(payload, {
      adapter: 'webhook',
      webhookUrl: `http://127.0.0.1:${addr.port}/verdict`,
      webhookSecret: secret,
    });
    assert.equal(webhookRes.published, true);
    assert.ok(receivedTimestamp.length > 0);
    const expectedHmac = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(`${receivedTimestamp}.${receivedBody}`, 'utf8')
      .digest('hex')}`;
    assert.equal(receivedSignature, expectedHmac);
    assert.equal(JSON.parse(receivedBody).spec_sha256, specSha256);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // 3. evm stub throws NotImplementedError
  const evm = new EvmVerdictPublisher();
  await assert.rejects(() => evm.publish(payload), NotImplementedError);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('reverifyOracle offline & --reshoot divergence reports inconclusive rather than hold', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-reverify-'));
  const keys = makePair();
  const specPath = path.join(tmpDir, 'spec.json');
  const trustedPath = path.join(tmpDir, 'trusted.json');
  const manifestPath = path.join(tmpDir, 'run-manifest.json');

  fs.writeFileSync(specPath, JSON.stringify(SAMPLE_SPEC, null, 2), 'utf-8');
  fs.writeFileSync(trustedPath, JSON.stringify({ [keys.keyId]: keys.publicPem }, null, 2), 'utf-8');
  const { specSha256 } = computeSpecSha256(SAMPLE_SPEC);

  generateRunManifest({
    outputPath: manifestPath,
    mode: 'oracle',
    status: 'verified',
    runId: 'reverify-orig-1',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: COMMIT,
    stateVerified: true,
    kaneVerification: { run_id: 'kane-orig-1', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: COMMIT,
      runner_id: 'runner-1',
      verdict: 'release',
    },
    signingKey: keys.privatePem,
  });

  // Offline verification passes
  const offline = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath,
    trustedKeysPath: trustedPath,
    reshoot: false,
  });
  assert.equal(offline.status, 'verified');
  assert.equal(offline.exitCode, 0);

  // Online reshoot matching verdict -> reproduced
  const matched = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath,
    trustedKeysPath: trustedPath,
    reshoot: true,
    outDir: path.join(tmpDir, 'reverify-matched'),
    runOracleFn: async () => ({
      exitCode: 0,
      verdict: 'release',
      specSha256,
    }),
  });
  assert.equal(matched.status, 'reproduced');
  assert.equal(matched.exitCode, 0);

  // Online reshoot diverging verdict -> inconclusive (NOT hold)
  const diverged = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath,
    trustedKeysPath: trustedPath,
    reshoot: true,
    outDir: path.join(tmpDir, 'reverify-diverged'),
    runOracleFn: async () => ({
      exitCode: 1,
      verdict: 'hold',
      holdReason: 'kane_failed',
      specSha256,
    }),
  });
  assert.equal(diverged.status, 'inconclusive');
  assert.equal(diverged.exitCode, 4);
  assert.equal(diverged.originalVerdict, 'release');
  assert.equal(diverged.reshootVerdict, 'hold');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('reverifyOracle --reshoot accepts authentic signed hold manifests without kane_verification and rejects tampered holds', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-hold-reverify-'));
  const keys = makePair();
  const specPath = path.join(tmpDir, 'spec.json');
  const trustedPath = path.join(tmpDir, 'trusted.json');
  const commitMismatchManifest = path.join(tmpDir, 'commit-mismatch.json');
  const specMismatchManifest = path.join(tmpDir, 'spec-mismatch.json');

  fs.writeFileSync(specPath, JSON.stringify(SAMPLE_SPEC, null, 2), 'utf-8');
  fs.writeFileSync(trustedPath, JSON.stringify({ [keys.keyId]: keys.publicPem }, null, 2), 'utf-8');
  const { specSha256 } = computeSpecSha256(SAMPLE_SPEC);

  // 1. Valid signed hold with hold_reason: 'commit_mismatch' (no kane_verification, tested_commit differs)
  generateRunManifest({
    outputPath: commitMismatchManifest,
    mode: 'oracle',
    status: 'failed',
    runId: 'hold-commit-1',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: '0000000000000000000000000000000000000000',
    stateVerified: false,
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: COMMIT,
      runner_id: 'runner-1',
      verdict: 'hold',
      hold_reason: 'commit_mismatch',
    },
    signingKey: keys.privatePem,
  });

  const reproducedCommitMismatch = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath: commitMismatchManifest,
    trustedKeysPath: trustedPath,
    reshoot: true,
    outDir: path.join(tmpDir, 'reverify-cm'),
    runOracleFn: async () => ({
      exitCode: 1,
      verdict: 'hold',
      holdReason: 'commit_mismatch',
      specSha256,
    }),
  });
  assert.equal(reproducedCommitMismatch.status, 'reproduced');
  assert.equal(reproducedCommitMismatch.exitCode, 1);

  // 2. Valid signed hold with hold_reason: 'spec_mismatch' (no kane_verification, tested_commit: 'not_started')
  generateRunManifest({
    outputPath: specMismatchManifest,
    mode: 'oracle',
    status: 'failed',
    runId: 'hold-spec-1',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: 'not_started',
    stateVerified: false,
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: COMMIT,
      runner_id: 'runner-1',
      verdict: 'hold',
      hold_reason: 'spec_mismatch',
    },
    signingKey: keys.privatePem,
  });

  const divergedSpecMismatch = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath: specMismatchManifest,
    trustedKeysPath: trustedPath,
    reshoot: true,
    outDir: path.join(tmpDir, 'reverify-sm'),
    runOracleFn: async () => ({
      exitCode: 0,
      verdict: 'release',
      specSha256,
    }),
  });
  assert.equal(divergedSpecMismatch.status, 'inconclusive');
  assert.equal(divergedSpecMismatch.exitCode, 4);

  // 3. Tampering with signed hold manifest still fails verification before reshooting
  const tampered = JSON.parse(fs.readFileSync(commitMismatchManifest, 'utf-8'));
  tampered.oracle.runner_id = 'tampered-runner';
  fs.writeFileSync(commitMismatchManifest, JSON.stringify(tampered, null, 2), 'utf-8');

  let reshootInvoked = false;
  const tamperedRes = await reverifyOracle({
    specPath,
    commit: COMMIT,
    manifestPath: commitMismatchManifest,
    trustedKeysPath: trustedPath,
    reshoot: true,
    outDir: path.join(tmpDir, 'reverify-tampered'),
    runOracleFn: async () => {
      reshootInvoked = true;
      return { exitCode: 1, verdict: 'hold', specSha256 };
    },
  });
  assert.equal(tamperedRes.status, 'failed');
  assert.equal(tamperedRes.exitCode, 1);
  assert.equal(reshootInvoked, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('finalizeOracleDrop verifies both HOLD and RELEASE manifests and requires two distinct commits', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-finalize-'));
  const keys = makePair();
  const cBug = '1111111111111111111111111111111111111111';
  const cFix = '2222222222222222222222222222222222222222';
  const specPath = path.join(tmpDir, 'spec.json');
  const holdPath = path.join(tmpDir, 'hold.json');
  const releasePath = path.join(tmpDir, 'release.json');
  const outPath = path.join(tmpDir, 'props.json');

  fs.writeFileSync(specPath, JSON.stringify(SAMPLE_SPEC, null, 2), 'utf-8');
  const { specSha256 } = computeSpecSha256(SAMPLE_SPEC);

  generateRunManifest({
    outputPath: releasePath,
    mode: 'oracle',
    status: 'verified',
    runId: 'fin-rel',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: cFix,
    stateVerified: true,
    kaneVerification: { run_id: 'k-rel', result_code: 100 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: cFix,
      runner_id: 'runner-1',
      verdict: 'release',
    },
    signingKey: keys.privatePem,
  });

  // Same commit -> hard failure
  generateRunManifest({
    outputPath: holdPath,
    mode: 'oracle',
    status: 'failed',
    runId: 'fin-hold-same',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: cFix,
    stateVerified: false,
    kaneVerification: { run_id: 'k-hold', result_code: 740 },
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: cFix,
      runner_id: 'runner-1',
      verdict: 'hold',
      hold_reason: 'kane_failed',
    },
    signingKey: keys.privatePem,
  });

  assert.throws(
    () =>
      finalizeOracleDrop({
        specPath,
        holdManifest: holdPath,
        releaseManifest: releasePath,
        trustedKeyMap: { [keys.keyId]: keys.publicPem },
        outPath,
        audioDir: path.join(tmpDir, 'no-audio'),
      }),
    /two distinct commits/i
  );

  // Distinct commit, valid signatures -> succeeds with 9 gates and updated copy (resultCode stays null when omitted, never 0 or fake 740)
  generateRunManifest({
    outputPath: holdPath,
    mode: 'oracle',
    status: 'failed',
    runId: 'fin-hold-distinct',
    applicationUrl: SAMPLE_SPEC.target.url,
    applicationEnvironment: 'runner_pinned',
    testedCommit: cBug,
    stateVerified: false,
    closedLoopRepair: { occurred: false },
    oracle: {
      spec_sha256: specSha256,
      seed_id: SAMPLE_SPEC.target.seed_id,
      expected_commit: cBug,
      runner_id: 'runner-1',
      verdict: 'hold',
      hold_reason: 'state_mismatch',
    },
    signingKey: keys.privatePem,
  });

  const finalized = finalizeOracleDrop({
    specPath,
    holdManifest: holdPath,
    releaseManifest: releasePath,
    trustedKeyMap: { [keys.keyId]: keys.publicPem },
    outPath,
    audioDir: path.join(tmpDir, 'no-audio'),
  });
  assert.equal(finalized.props.gates.length, 10);
  assert.equal(finalized.props.gates[9].passed, false);
  assert.equal(finalized.props.hold.resultCode, null);
  assert.match(finalized.props.closingTitle, /Milestone payouts, gated by signed and verifiable proof/i);

  // Tampered HOLD manifest -> rejected
  const tamperedHold = JSON.parse(fs.readFileSync(holdPath, 'utf-8'));
  tamperedHold.oracle.runner_id = 'tampered';
  fs.writeFileSync(holdPath, JSON.stringify(tamperedHold, null, 2), 'utf-8');
  assert.throws(
    () =>
      finalizeOracleDrop({
        specPath,
        holdManifest: holdPath,
        releaseManifest: releasePath,
        trustedKeyMap: { [keys.keyId]: keys.publicPem },
        outPath,
        audioDir: path.join(tmpDir, 'no-audio'),
      }),
    /Hold manifest failed/i
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('verifyWebhookSignature enforces 300s replay window, constant-time HMAC, and manifest_sha256 deduplication', () => {
  const secret = 'whsec_test_replay_window';
  const payload = {
    spec_sha256: 'a'.repeat(64),
    tested_commit: COMMIT,
    manifest_sha256: 'b'.repeat(64),
    verdict: 'release',
    signature: { alg: 'ed25519', key_id: 'k1', sig: 'sig' },
  };
  const body = JSON.stringify(payload);
  const nowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
  const freshTs = new Date(nowMs - 60_000).toISOString();
  const expiredTs = new Date(nowMs - 600_000).toISOString();

  const makeSig = (ts: string, rawBody: string) =>
    `sha256=${crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex')}`;

  const seen = new Set<string>();
  const freshCheck = verifyWebhookSignature({
    payloadBody: body,
    signatureHeader: makeSig(freshTs, body),
    timestampHeader: freshTs,
    secret,
    seenManifestSha256s: seen,
    nowMs,
  });
  assert.equal(freshCheck.valid, true, freshCheck.error);

  // Replay of identical manifest_sha256 fails
  const replayCheck = verifyWebhookSignature({
    payloadBody: body,
    signatureHeader: makeSig(freshTs, body),
    timestampHeader: freshTs,
    secret,
    seenManifestSha256s: seen,
    nowMs,
  });
  assert.equal(replayCheck.valid, false);
  assert.match(replayCheck.error || '', /duplicate manifest_sha256/i);

  // Stale timestamp outside 300s window fails
  const expiredCheck = verifyWebhookSignature({
    payloadBody: body,
    signatureHeader: makeSig(expiredTs, body),
    timestampHeader: expiredTs,
    secret,
    nowMs,
  });
  assert.equal(expiredCheck.valid, false);
  assert.match(expiredCheck.error || '', /replay window/i);

  // Tampered body fails constant-time HMAC check
  const tamperedBody = JSON.stringify({ ...payload, verdict: 'hold' });
  const tamperedCheck = verifyWebhookSignature({
    payloadBody: tamperedBody,
    signatureHeader: makeSig(freshTs, body),
    timestampHeader: freshTs,
    secret,
    nowMs,
  });
  assert.equal(tamperedCheck.valid, false);
  assert.match(tamperedCheck.error || '', /hmac signature mismatch/i);
});

test('archived real oracle fixtures verify cryptographically and obey Gate 10 beta lock', async () => {
  const specPath = path.resolve(process.cwd(), 'examples/oracle/ledgerly-approval.json');
  const fixDir = path.resolve(process.cwd(), 'examples/oracle/fixtures');
  const holdManifestPath = path.join(fixDir, 'hold-manifest.json');
  const releaseManifestPath = path.join(fixDir, 'release-manifest.json');
  const trustedKeysPath = path.join(fixDir, 'trusted-keys.json');
  const { specSha256 } = computeSpecSha256(JSON.parse(fs.readFileSync(specPath, 'utf-8')));

  const holdManifest = JSON.parse(fs.readFileSync(holdManifestPath, 'utf-8'));
  const releaseManifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf-8'));
  const holdCommit = holdManifest.application.tested_commit;
  const releaseCommit = releaseManifest.application.tested_commit;
  assert.notEqual(holdCommit, releaseCommit);

  const { verifyOracleHoldManifest, verifyOracleManifest } = await import('../src/manifest.js');
  const holdCheck = verifyOracleHoldManifest(holdManifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: holdCommit,
    trustedKeysPath,
  });
  assert.equal(holdCheck.valid, true, holdCheck.errors.join('; '));

  const strictReleaseCheck = verifyOracleManifest(releaseManifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: releaseCommit,
    trustedKeysPath,
  });
  assert.equal(strictReleaseCheck.valid, false);
  assert.ok(strictReleaseCheck.errors.some((e) => /isolation must be 'container'/i.test(e)));

  const betaReleaseCheck = verifyOracleManifest(releaseManifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: releaseCommit,
    trustedKeysPath,
    allowUnisolatedBeta: true,
  });
  assert.equal(betaReleaseCheck.valid, true, betaReleaseCheck.errors.join('; '));
});
