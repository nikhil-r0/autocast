import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { runOraclePipeline, validateOracleTargetUrl } from '../src/oracle/runner.js';
import { computePublicKeyId } from '../src/oracle/sign.js';
import { computeSpecSha256 } from '../src/oracle/spec.js';
import { verifyOracleManifest } from '../src/manifest.js';
import { AcceptanceSpec, AppLifecycleAdapter, KaneRunResult } from '../src/types.js';
import { LedgerlyLifecycleAdapter } from '../src/app/lifecycle.js';

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
      executeKaneRunFn: async () => ({
        passed: true,
        category: 'pass',
        isProductDefect: false,
        exitCode: 0,
        resultCode: 100,
        summary: 'Verified',
        sessionDir: '/tmp/kane-release-session',
        steps: [],
      }),
    },
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.verdict, 'release');

  const verify = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: commit,
    publicKeyPem: keys.publicPem,
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
    },
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.verdict, 'release');

  const verify = verifyOracleManifest(manifestPath, {
    expectedSpecSha256: specSha256,
    expectedCommit: upperCommit,
    publicKeyPem: keys.publicPem,
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
