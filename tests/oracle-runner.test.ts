import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import {
  runOraclePipeline,
  runOracleWithInconclusivePolicy,
  validateOracleTargetUrl,
} from '../src/oracle/runner.js';
import { scrubChildEnv, stripOracleSecrets } from '../src/oracle/env.js';
import { computePublicKeyId } from '../src/oracle/sign.js';
import { computeSpecSha256 } from '../src/oracle/spec.js';
import { verifyOracleManifest } from '../src/manifest.js';
import { AcceptanceSpec, AppLifecycleAdapter, KaneRunResult } from '../src/types.js';
import {
  DeliverableBuildError,
  LedgerlyLifecycleAdapter,
  RunnerInfraError,
} from '../src/app/lifecycle.js';

function createTestKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    keyId: computePublicKeyId(publicKey),
  };
}

const DEFAULT_COMMIT = 'abc1234567890abcdef1234567890abcdef12345';

function makeSpec(overrides?: Partial<AcceptanceSpec['target']>): AcceptanceSpec {
  return {
    version: 1,
    title: 'Ledgerly INV-1042 Oracle Acceptance',
    objective:
      'Click the Review button for row INV-1042, click Approve Invoice in the drawer, enter approval note, click Confirm Approval, then verify drawer status badge shows Approved',
    outcome_specs: [
      {
        id: 'drawer-approved',
        verification: {
          type: 'dom_text',
          selector: '[data-testid="drawer-status-badge"]',
          expected: 'Approved',
        },
      },
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
      ...overrides,
    },
    contract_id: 'contract-test-001',
    milestone_id: 'milestone-test-001',
  };
}

function writeSpecFile(dir: string, spec: AcceptanceSpec): { specPath: string; specSha256: string } {
  const specPath = path.join(dir, 'spec.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');
  const { specSha256 } = computeSpecSha256(spec);
  return { specPath, specSha256 };
}

test('Kane 740 in oracle mode: never invokes agy, seals hold manifest with kane_failed, exits 1', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-740-'));
  const keys = createTestKeys();
  const spec = makeSpec();
  const { specPath, specSha256 } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  // Place a fake executable `agy` first on PATH that writes a marker file if ever invoked
  const fakeBinDir = path.join(tmpDir, 'bin');
  fs.mkdirSync(fakeBinDir, { recursive: true });
  const agyMarker = path.join(tmpDir, 'agy-was-invoked');
  const fakeAgy = path.join(fakeBinDir, 'agy');
  fs.writeFileSync(fakeAgy, `#!/bin/sh\ntouch "${agyMarker}"\nexit 1\n`, { mode: 0o755 });

  const prevPath = process.env.PATH;
  const prevAgy = process.env.AGY_PATH;
  process.env.PATH = `${fakeBinDir}:${prevPath}`;
  process.env.AGY_PATH = fakeAgy;

  let kaneCalls = 0;
  let capturedObjective = '';
  let stateVerifyCalled = false;

  const mockAdapter: AppLifecycleAdapter = {
    name: 'mock-ledgerly',
    appDir: tmpDir,
    start: async () => ({ pid: 123, port: 8080, commit: DEFAULT_COMMIT }),
    stop: async () => {},
    getHealthInfo: async () => ({ ok: true, commit: DEFAULT_COMMIT }),
    healthCheck: async (c) => c === DEFAULT_COMMIT,
    resetSeedData: async () => {},
    verifyUnderlyingState: async () => {
      stateVerifyCalled = true;
      return true;
    },
  };

  try {
    const outcome = await runOraclePipeline({
      specPath,
      commit: DEFAULT_COMMIT,
      outDir: path.join(tmpDir, 'out'),
      manifestOutPath: manifestPath,
      signingKey: keys.privatePem,
      agentRepairRequested: true,
      requireCleanTree: false,
      deps: {
        preflightFn: () => ({ headCommit: DEFAULT_COMMIT, clean: true }),
        prepareCheckoutFn: () => ({ appDir: tmpDir }),
        createAdapterFn: () => mockAdapter,
        executeKaneRunFn: async (opts): Promise<KaneRunResult> => {
          kaneCalls++;
          capturedObjective = opts.objective;
          return {
            passed: false,
            category: 'confirmed_product_bug',
            isProductDefect: true,
            exitCode: 1,
            resultCode: 740,
            reasonCode: 'bug.confirmed',
            summary: 'Approval button is no-op',
            verdict: {
              confirmed: true,
              family: 'product_defect',
              category: 'state_mutation_failed',
              severity: 'high',
              oneLiner: 'Invoice stayed Pending',
              confidence: 1.0,
            },
            sessionDir: '/tmp/kane-740-session',
            evidencePack: '/tmp/kane-740-session/run.evidence',
            testUrl: 'https://test-manager.example/share/740',
            steps: [],
          };
        },
      },
    });

    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.verdict, 'hold');
    assert.equal(outcome.holdReason, 'kane_failed');
    assert.equal(kaneCalls, 1, 'Oracle must never re-shoot after Kane failure');
    assert.equal(capturedObjective, spec.objective, 'Spec objective must pass verbatim');
    assert.equal(stateVerifyCalled, false);
    assert.equal(fs.existsSync(agyMarker), false, 'agy must never be invoked in oracle mode');

    const sealed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.equal(sealed.mode, 'oracle');
    assert.equal(sealed.status, 'failed');
    assert.equal(sealed.oracle.verdict, 'hold');
    assert.equal(sealed.oracle.hold_reason, 'kane_failed');
    assert.equal(sealed.oracle.spec_sha256, specSha256);
    assert.equal(sealed.closed_loop_repair.occurred, false);
    assert.equal(sealed.kane_verification.session_id, '/tmp/kane-740-session');
    assert.equal(sealed.kane_verification.evidence_pack, '/tmp/kane-740-session/run.evidence');
    assert.ok(sealed.signature?.sig);
  } finally {
    process.env.PATH = prevPath;
    if (prevAgy === undefined) delete process.env.AGY_PATH;
    else process.env.AGY_PATH = prevAgy;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Spec hash mismatch exits 2 before the app starts', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-specmismatch-'));
  const keys = createTestKeys();
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  let startCalled = false;
  let kaneCalled = false;

  const outcome = await runOraclePipeline({
    specPath,
    commit: DEFAULT_COMMIT,
    expectSpecSha256: 'f'.repeat(64),
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    deps: {
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => {
          startCalled = true;
          return { pid: 1, port: 8080 };
        },
        stop: async () => {},
        healthCheck: async () => true,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => {
        kaneCalled = true;
        return { passed: true, category: 'pass', isProductDefect: false, exitCode: 0, steps: [] };
      },
    },
  });

  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.holdReason, 'spec_mismatch');
  assert.equal(startCalled, false, 'App must not start on spec hash mismatch');
  assert.equal(kaneCalled, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Party-supplied localhost or disallowed URL is rejected with exit 2 before app starts', async () => {
  assert.throws(
    () => validateOracleTargetUrl('http://localhost:9999/', 'http://localhost:8080', ''),
    /not on the runner allowlist/i
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-url-'));
  const keys = createTestKeys();
  const spec = makeSpec({ url: 'http://localhost:9999/?logged_in=true' });
  const { specPath } = writeSpecFile(tmpDir, spec);
  let startCalled = false;

  const outcome = await runOraclePipeline({
    specPath,
    commit: DEFAULT_COMMIT,
    outDir: path.join(tmpDir, 'out'),
    signingKey: keys.privatePem,
    runnerOrigin: 'http://localhost:8080',
    allowedHosts: '',
    deps: {
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => {
          startCalled = true;
          return { pid: 1, port: 9999 };
        },
        stop: async () => {},
        healthCheck: async () => true,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
    },
  });

  assert.equal(outcome.exitCode, 2);
  assert.equal(startCalled, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('expected_commit != served commit seals hold with commit_mismatch and exits 1', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-commit-'));
  const keys = createTestKeys();
  const expectedCommit = 'aaaa1111bbbb2222cccc3333dddd4444eeee5555';
  const servedCommit = '9999888877776666555544443333222211110000';
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  let kaneCalled = false;

  const outcome = await runOraclePipeline({
    specPath,
    commit: expectedCommit,
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: expectedCommit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit: servedCommit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit: servedCommit }),
        healthCheck: async (c) => c === servedCommit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => {
        kaneCalled = true;
        return { passed: true, category: 'pass', isProductDefect: false, exitCode: 0, steps: [] };
      },
    },
  });

  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.verdict, 'hold');
  assert.equal(outcome.holdReason, 'commit_mismatch');
  assert.equal(kaneCalled, false);

  const sealed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(sealed.oracle.verdict, 'hold');
  assert.equal(sealed.oracle.hold_reason, 'commit_mismatch');
  assert.equal(sealed.application.tested_commit, servedCommit);
  assert.equal(sealed.oracle.expected_commit, expectedCommit);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Kane 100 but api_state mismatch seals hold with state_mismatch and exits 1', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-state-'));
  const keys = createTestKeys();
  const commit = 'cccc1111dddd2222eeee3333ffff4444aaaa5555';

  // Spin up real HTTP server returning status: 'Pending' (approve-noop backend truth mismatch)
  let serverPort = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', commit }));
    } else if (req.url === '/api/reset') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } else if (req.url === '/api/invoices/INV-1042') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'INV-1042', status: 'Pending' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      resolve();
    });
  });

  try {
    const baseUrl = `http://127.0.0.1:${serverPort}`;
    const spec = makeSpec({ url: `${baseUrl}/?logged_in=true` });
    const { specPath } = writeSpecFile(tmpDir, spec);
    const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

    const adapter = new LedgerlyLifecycleAdapter({ port: serverPort, baseUrl });

    const outcome = await runOraclePipeline({
      specPath,
      commit,
      outDir: path.join(tmpDir, 'out'),
      manifestOutPath: manifestPath,
      signingKey: keys.privatePem,
      runnerOrigin: 'http://localhost:8080',
      allowedHosts: `127.0.0.1:${serverPort}`,
      deps: {
        createAdapterFn: () => adapter,
        executeKaneRunFn: async () => ({
          passed: true,
          category: 'pass',
          isProductDefect: false,
          exitCode: 0,
          resultCode: 100,
          summary: 'UI claimed Approved',
          sessionDir: '/tmp/kane-100-session',
          steps: [],
        }),
      },
    });

    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.verdict, 'hold');
    assert.equal(outcome.holdReason, 'state_mismatch');

    const sealed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.equal(sealed.status, 'failed');
    assert.equal(sealed.application.state_verified, false);
    assert.equal(sealed.kane_verification.result_code, 100);
    assert.equal(sealed.oracle.verdict, 'hold');
    assert.equal(sealed.oracle.hold_reason, 'state_mismatch');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Kane 100 + matching api_state seals signed release manifest and exits 0', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-release-'));
  const keys = createTestKeys();
  const commit = 'dddd1111eeee2222ffff33330000444411112222';
  const spec = makeSpec();
  const { specPath, specSha256 } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  const outcome = await runOraclePipeline({
    specPath,
    commit,
    expectSpecSha256: specSha256,
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit }),
        healthCheck: async (c) => c === commit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async (opts) => {
        assert.equal(opts.bugDetection, 'off', 'Oracle mode must pass bugDetection=off to Kane');
        assert.equal(opts.scrubOracleSecrets, true);
        return {
          passed: true,
          category: 'pass',
          isProductDefect: false,
          exitCode: 0,
          resultCode: 100,
          summary: 'Verified',
          sessionDir: '/tmp/kane-release-session',
          steps: [],
        };
      },
      verifyUiOutcomesFn: async () => ({ passed: true, failures: [] }),
    },
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.verdict, 'release');
  assert.equal(outcome.manifest?.application.environment, 'runner_pinned');
  assert.equal(outcome.manifest?.application.isolation, 'none');
  assert.equal(outcome.manifest?.kane_verification?.kane_cli_version, '0.10.4');

  const strictDefault = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: commit,
    publicKeyPem: keys.publicPem,
  });
  assert.equal(strictDefault.valid, false);
  assert.ok(strictDefault.errors.some((e) => /isolation must be 'container'/i.test(e)));

  const verify = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: commit,
    publicKeyPem: keys.publicPem,
    allowUnisolatedBeta: true,
  });
  assert.equal(verify.valid, true, verify.errors.join('; '));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('CLI env ORACLE_SIGNING_KEY signs manifest in a single write (never writes unsigned manifest to disk)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-singlewrite-'));
  const keys = createTestKeys();
  const commit = 'eeee1111ffff2222000033334444555566667777';
  const spec = makeSpec();
  const { specPath, specSha256 } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  const prevSigningKey = process.env.ORACLE_SIGNING_KEY;
  process.env.ORACLE_SIGNING_KEY = keys.privatePem;

  const writesToManifest: string[] = [];
  const origWriteFileSync = fs.writeFileSync;
  (fs as any).writeFileSync = (file: fs.PathOrFileDescriptor, data: any, ...rest: any[]) => {
    if (typeof file === 'string' && path.resolve(file) === path.resolve(manifestPath)) {
      writesToManifest.push(String(data));
    }
    return (origWriteFileSync as any).call(fs, file, data, ...rest);
  };

  try {
    const outcome = await runOraclePipeline({
      specPath,
      commit,
      outDir: path.join(tmpDir, 'out'),
      manifestOutPath: manifestPath,
      requireCleanTree: false,
      deps: {
        preflightFn: () => ({ headCommit: commit, clean: true }),
        prepareCheckoutFn: () => ({ appDir: tmpDir }),
        createAdapterFn: () => ({
          name: 'mock',
          appDir: tmpDir,
          start: async () => ({ pid: 1, port: 8080, commit }),
          stop: async () => {},
          getHealthInfo: async () => ({ ok: true, commit }),
          healthCheck: async (c) => c === commit,
          resetSeedData: async () => {},
          verifyUnderlyingState: async () => true,
        }),
        executeKaneRunFn: async () => ({
          passed: true,
          category: 'pass',
          isProductDefect: false,
          exitCode: 0,
          resultCode: 100,
          summary: 'Verified',
          sessionDir: '/tmp/kane-singlewrite',
          steps: [],
        }),
        verifyUiOutcomesFn: async () => ({ passed: true, failures: [] }),
      },
    });

    assert.equal(outcome.exitCode, 0);
    assert.equal(writesToManifest.length, 1, 'Manifest must be written once, already signed');
    const firstWritten = JSON.parse(writesToManifest[0]);
    assert.equal(firstWritten.signature?.alg, 'ed25519');
    assert.ok(firstWritten.signature?.sig);

    const verify = verifyOracleManifest(manifestPath, {
      expectedSpecSha256: specSha256,
      expectedCommit: commit,
      publicKeyPem: keys.publicPem,
      allowUnisolatedBeta: true,
    });
    assert.equal(verify.valid, true, verify.errors.join('; '));
  } finally {
    (fs as any).writeFileSync = origWriteFileSync;
    if (prevSigningKey === undefined) delete process.env.ORACLE_SIGNING_KEY;
    else process.env.ORACLE_SIGNING_KEY = prevSigningKey;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Uppercase 40-char --commit matches lowercase served commit from /api/health', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-case-'));
  const keys = createTestKeys();
  const lowerCommit = 'abcdef0123456789abcdef0123456789abcdef01';
  const upperCommit = lowerCommit.toUpperCase();
  const spec = makeSpec();
  const { specPath, specSha256 } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  const outcome = await runOraclePipeline({
    specPath,
    commit: upperCommit,
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: lowerCommit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit: lowerCommit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit: lowerCommit }),
        healthCheck: async (c) => (c || '').toLowerCase() === lowerCommit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => ({
        passed: true,
        category: 'pass',
        isProductDefect: false,
        exitCode: 0,
        resultCode: 100,
        summary: 'Verified',
        sessionDir: '/tmp/kane-case',
        steps: [],
      }),
      verifyUiOutcomesFn: async () => ({ passed: true, failures: [] }),
    },
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.verdict, 'release');

  const verify = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: upperCommit,
    publicKeyPem: keys.publicPem,
    allowUnisolatedBeta: true,
  });
  assert.equal(verify.valid, true, verify.errors.join('; '));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Invalid or short --commit exits 2 before loading spec or starting app', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-badcommit-'));
  const keys = createTestKeys();
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);
  let startCalled = false;

  const outcome = await runOraclePipeline({
    specPath,
    commit: 'abc1234',
    outDir: path.join(tmpDir, 'out'),
    signingKey: keys.privatePem,
    deps: {
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => {
          startCalled = true;
          return { pid: 1, port: 8080 };
        },
        stop: async () => {},
        healthCheck: async () => true,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
    },
  });

  assert.equal(outcome.exitCode, 2);
  assert.match(outcome.error || '', /40-character hexadecimal/i);
  assert.equal(startCalled, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('scrubChildEnv and stripOracleSecrets remove signing keys, webhook secrets, and AI keys', () => {
  const dirtyEnv: NodeJS.ProcessEnv = {
    PATH: '/usr/bin',
    HOME: '/home/runner',
    PORT: '8080',
    ORACLE_SIGNING_KEY: '-----BEGIN PRIVATE KEY-----secret',
    ORACLE_WEBHOOK_SECRET: 'whsec_12345',
    ORACLE_TRUSTED_KEYS: '{"abc":"pem"}',
    GEMINI_API_KEY: 'AIzaSyFakeKey',
    GITHUB_TOKEN: 'ghp_secret',
    CUSTOM_API_KEY: 'my_api_key',
    TESTMU_API_TOKEN: 'kane_session_token',
  };

  const scrubbed = scrubChildEnv(dirtyEnv, { APP_COMMIT: 'abcd'.repeat(10) });
  assert.equal(scrubbed.PATH, '/usr/bin');
  assert.equal(scrubbed.APP_COMMIT, 'abcd'.repeat(10));
  assert.equal(scrubbed.ORACLE_SIGNING_KEY, undefined);
  assert.equal(scrubbed.ORACLE_WEBHOOK_SECRET, undefined);
  assert.equal(scrubbed.ORACLE_TRUSTED_KEYS, undefined);
  assert.equal(scrubbed.GEMINI_API_KEY, undefined);
  assert.equal(scrubbed.GITHUB_TOKEN, undefined);
  assert.equal(scrubbed.CUSTOM_API_KEY, undefined);

  const kaneEnv = stripOracleSecrets(dirtyEnv);
  assert.equal(kaneEnv.ORACLE_SIGNING_KEY, undefined);
  assert.equal(kaneEnv.ORACLE_WEBHOOK_SECRET, undefined);
  assert.equal(kaneEnv.GEMINI_API_KEY, undefined);
  assert.equal(kaneEnv.TESTMU_API_TOKEN, 'kane_session_token');
});

test('Kane timeout seals inconclusive manifest (exit 4) instead of contractual hold', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-timeout-'));
  const keys = createTestKeys();
  const commit = '7777111122223333444455556666777788889999';
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  const outcome = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit }),
        healthCheck: async (c) => c === commit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => ({
        passed: false,
        category: 'timeout',
        isProductDefect: false,
        exitCode: 3,
        summary: 'Kane execution timed out after 300s',
        steps: [],
      }),
    },
  });

  assert.equal(outcome.exitCode, 4);
  assert.equal(outcome.verdict, 'inconclusive');
  assert.equal(outcome.holdReason, 'timeout');
  const sealed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.equal(sealed.oracle.verdict, 'inconclusive');
  assert.equal(sealed.oracle.hold_reason, 'timeout');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Declared UI outcome_specs failure seals hold (state_mismatch) and strict --expect-spec-sha256 rejects missing hash', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-uicheck-'));
  const keys = createTestKeys();
  const commit = '8888111122223333444455556666777788889999';
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);
  const manifestPath = path.join(tmpDir, 'out', 'run-manifest.json');

  const missingHash = await runOraclePipeline({
    specPath,
    commit,
    requireExpectSpecSha256: true,
    signingKey: keys.privatePem,
  });
  assert.equal(missingHash.exitCode, 2);

  const uiMismatch = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out'),
    manifestOutPath: manifestPath,
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit }),
        healthCheck: async (c) => c === commit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => ({
        passed: true,
        category: 'pass',
        isProductDefect: false,
        exitCode: 0,
        resultCode: 100,
        summary: 'Verified',
        steps: [],
      }),
      verifyUiOutcomesFn: async () => ({
        passed: false,
        failures: ["OutcomeSpec 'drawer-approved' failed: selector not found"],
      }),
    },
  });

  assert.equal(uiMismatch.exitCode, 1);
  assert.equal(uiMismatch.verdict, 'hold');
  assert.equal(uiMismatch.holdReason, 'state_mismatch');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Oracle splits runner faults (missing actions.ndjson, RunnerInfraError -> inconclusive exit 4) from deliverable build failure (hold exit 1)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-split-'));
  const keys = createTestKeys();
  const commit = '9999111122223333444455556666777788889999';
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);

  // 1. Missing actions.ndjson trace when deterministic UI check is enabled -> inconclusive / missing_trace (exit 4)
  const missingTraceOutcome = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out-missing'),
    manifestOutPath: path.join(tmpDir, 'out-missing', 'run-manifest.json'),
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => ({ pid: 1, port: 8080, commit }),
        stop: async () => {},
        getHealthInfo: async () => ({ ok: true, commit }),
        healthCheck: async (c) => c === commit,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => true,
      }),
      executeKaneRunFn: async () => ({
        passed: true,
        category: 'pass',
        isProductDefect: false,
        exitCode: 0,
        resultCode: 100,
        summary: 'Verified',
        sessionDir: path.join(tmpDir, 'empty-session-dir'),
        steps: [],
      }),
    },
  });
  assert.equal(missingTraceOutcome.exitCode, 4);
  assert.equal(missingTraceOutcome.verdict, 'inconclusive');
  assert.equal(missingTraceOutcome.holdReason, 'missing_trace');

  // 2. DeliverableBuildError -> contractual hold / build_failed (exit 1)
  const buildFailOutcome = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out-build'),
    manifestOutPath: path.join(tmpDir, 'out-build', 'run-manifest.json'),
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => {
          throw new DeliverableBuildError('npm run build exited 1');
        },
        stop: async () => {},
        healthCheck: async () => false,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => false,
      }),
    },
  });
  assert.equal(buildFailOutcome.exitCode, 1);
  assert.equal(buildFailOutcome.verdict, 'hold');
  assert.equal(buildFailOutcome.holdReason, 'build_failed');

  // 3. RunnerInfraError -> inconclusive / runner_error (exit 4)
  const infraFailOutcome = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out-infra'),
    manifestOutPath: path.join(tmpDir, 'out-infra', 'run-manifest.json'),
    signingKey: keys.privatePem,
    requireCleanTree: false,
    deps: {
      preflightFn: () => ({ headCommit: commit, clean: true }),
      prepareCheckoutFn: () => ({ appDir: tmpDir }),
      createAdapterFn: () => ({
        name: 'mock',
        appDir: tmpDir,
        start: async () => {
          throw new RunnerInfraError('EAI_AGAIN npm registry outage');
        },
        stop: async () => {},
        healthCheck: async () => false,
        resetSeedData: async () => {},
        verifyUnderlyingState: async () => false,
      }),
    },
  });
  assert.equal(infraFailOutcome.exitCode, 4);
  assert.equal(infraFailOutcome.verdict, 'inconclusive');
  assert.equal(infraFailOutcome.holdReason, 'runner_error');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Oracle fails closed (exit 2) on untested Kane CLI version and enforces 3-attempt inconclusive retry policy', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-kane-pin-'));
  const keys = createTestKeys();
  const commit = 'abab111122223333444455556666777788889999';
  const spec = makeSpec();
  const { specPath } = writeSpecFile(tmpDir, spec);

  // Untested kane-cli version fails closed with exitCode 2 before starting app
  const badVerOutcome = await runOraclePipeline({
    specPath,
    commit,
    outDir: path.join(tmpDir, 'out-badver'),
    signingKey: keys.privatePem,
    deps: {
      getKaneVersionFn: () => '0.11.0',
    },
  });
  assert.equal(badVerOutcome.exitCode, 2);
  assert.match(badVerOutcome.error || '', /Unsupported kane-cli version '0.11.0'/i);

  // Retry policy caps at max 2 retries (3 total runs) then escalates to arbitration
  let calls = 0;
  const escalated = await runOracleWithInconclusivePolicy(
    { specPath, commit, maxInconclusiveRetries: 2 },
    async () => {
      calls++;
      return { exitCode: 4, verdict: 'inconclusive', holdReason: 'timeout' };
    }
  );
  assert.equal(calls, 3);
  assert.equal(escalated.attempts, 3);
  assert.equal(escalated.escalatedToArbitration, true);

  // Hold / Release stops immediately without retrying
  let holdCalls = 0;
  const nonRetryHold = await runOracleWithInconclusivePolicy(
    { specPath, commit, maxInconclusiveRetries: 2 },
    async () => {
      holdCalls++;
      return { exitCode: 1, verdict: 'hold', holdReason: 'build_failed' };
    }
  );
  assert.equal(holdCalls, 1);
  assert.equal(nonRetryHold.escalatedToArbitration, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('LedgerlyLifecycleAdapter registry ping separates runner outage (RunnerInfraError) from lockfile 404 (DeliverableBuildError)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-oracle-regcheck-'));
  const appDir = path.join(tmpDir, 'ledgerly');
  fs.mkdirSync(path.join(appDir, 'server'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'bad-pkg', version: '1.0.0' }));
  fs.writeFileSync(
    path.join(appDir, 'package-lock.json'),
    JSON.stringify({
      name: 'bad-pkg',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': { name: 'bad-pkg', version: '1.0.0', dependencies: { 'nonexistent-tarball-xyz': '1.0.0' } },
        'node_modules/nonexistent-tarball-xyz': {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/nonexistent-tarball-xyz/-/nonexistent-tarball-xyz-1.0.0.tgz',
        },
      },
    })
  );
  fs.writeFileSync(path.join(appDir, 'server', 'index.js'), '');

  const adapter = new LedgerlyLifecycleAdapter({ appDir, port: 18999 });

  // 1. Registry ping fails -> RunnerInfraError (runner outage -> inconclusive)
  await assert.rejects(
    () =>
      adapter.start({
        scrubEnv: true,
        allowNodeModulesSymlink: false,
        checkRegistryFn: async () => false,
      }),
    (err: any) => err instanceof RunnerInfraError
  );

  // 2. Registry ping succeeds, but lockfile tarball returns E404 / fails -> DeliverableBuildError (hold)
  await assert.rejects(
    () =>
      adapter.start({
        scrubEnv: true,
        allowNodeModulesSymlink: false,
        checkRegistryFn: async () => true,
      }),
    (err: any) => err instanceof DeliverableBuildError
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
