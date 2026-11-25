import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { canonicalizeJson } from '../src/oracle/canonicalJson.js';
import {
  computeSpecSha256,
  loadAcceptanceSpec,
  OracleSpecError,
  parseAcceptanceSpec,
} from '../src/oracle/spec.js';
import { parseCliArgs } from '../src/cli.js';
import { resolveJsonPath, verifyApiStateOutcomes } from '../src/capture/actionIR.js';
import { AcceptanceSpec } from '../src/types.js';
import http from 'http';

const BASE_SPEC: AcceptanceSpec = {
  version: 1,
  title: 'Ledgerly INV-1042 Approval',
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
    expected_commit: '0123456789abcdef0123456789abcdef01234567',
    seed_id: 'ledgerly-default-v1',
  },
  parties: {
    client: 'alice@example.com',
    contractor: 'bob@example.com',
  },
  milestone_id: 'ms-1',
};

test('canonicalizeJson sorts keys recursively, omits undefined, and preserves array order', () => {
  const a = { z: 1, a: { d: undefined, c: [3, 2, 1], b: 'x' } };
  const b = { a: { b: 'x', c: [3, 2, 1] }, z: 1 };
  assert.equal(canonicalizeJson(a), '{"a":{"b":"x","c":[3,2,1]},"z":1}');
  assert.equal(canonicalizeJson(a), canonicalizeJson(b));
});

test('spec_sha256 is invariant to JSON key ordering and whitespace', () => {
  const formattedA = JSON.stringify(BASE_SPEC, null, 2);
  const reordered = {
    milestone_id: BASE_SPEC.milestone_id,
    target: {
      seed_id: BASE_SPEC.target.seed_id,
      expected_commit: BASE_SPEC.target.expected_commit,
      url: BASE_SPEC.target.url,
    },
    objective: BASE_SPEC.objective,
    outcome_specs: BASE_SPEC.outcome_specs,
    title: BASE_SPEC.title,
    parties: {
      contractor: BASE_SPEC.parties!.contractor,
      client: BASE_SPEC.parties!.client,
    },
    version: 1,
  };
  const formattedB = JSON.stringify(reordered);

  const loadedA = parseAcceptanceSpec(formattedA, 'a.json');
  const loadedB = parseAcceptanceSpec(formattedB, 'b.json');

  assert.equal(loadedA.specSha256, loadedB.specSha256);
  assert.equal(loadedA.specSha256.length, 64);
  assert.equal(computeSpecSha256(loadedA.spec).specSha256, loadedA.specSha256);
});

test('parseAcceptanceSpec rejects unknown fields at root, target, parties, and verification', () => {
  const withRootExtra = { ...BASE_SPEC, extra_field: true };
  assert.throws(
    () => parseAcceptanceSpec(JSON.stringify(withRootExtra)),
    (err: unknown) => err instanceof OracleSpecError && /validation failed/i.test(err.message)
  );

  const withTargetExtra = {
    ...BASE_SPEC,
    target: { ...BASE_SPEC.target, branch: 'main' },
  };
  assert.throws(
    () => parseAcceptanceSpec(JSON.stringify(withTargetExtra)),
    (err: unknown) => err instanceof OracleSpecError
  );

  const withVerificationExtra = {
    ...BASE_SPEC,
    outcome_specs: [
      {
        id: 'x',
        verification: { type: 'visible', selector: '#ok', unexpected: 1 },
      },
    ],
  };
  assert.throws(
    () => parseAcceptanceSpec(JSON.stringify(withVerificationExtra)),
    (err: unknown) => err instanceof OracleSpecError
  );
});

test('parseAcceptanceSpec rejects mutable HEAD commit refs and invalid URLs', () => {
  const withHead = {
    ...BASE_SPEC,
    target: { ...BASE_SPEC.target, expected_commit: 'HEAD' },
  };
  assert.throws(() => parseAcceptanceSpec(JSON.stringify(withHead)), OracleSpecError);

  const withBadUrl = {
    ...BASE_SPEC,
    target: { ...BASE_SPEC.target, url: 'ftp://example.com/app' },
  };
  assert.throws(() => parseAcceptanceSpec(JSON.stringify(withBadUrl)), OracleSpecError);
});

test('loadAcceptanceSpec loads valid JSON file from disk', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-spec-'));
  const specFile = path.join(tmpDir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify(BASE_SPEC, null, 2), 'utf-8');

  const loaded = loadAcceptanceSpec(specFile);
  const expectedSha = crypto.createHash('sha256').update(canonicalizeJson(BASE_SPEC)).digest('hex');

  assert.equal(loaded.specSha256, expectedSha);
  assert.equal(loaded.spec.objective, BASE_SPEC.objective);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('parseCliArgs supports --oracle, subcommand oracle, --agent-repair, --expect-spec-sha256, --with-video, and --publish', () => {
  const flagStyle = parseCliArgs([
    '--oracle',
    'examples/oracle/ledgerly-approval.json',
    '--expect-spec-sha256',
    'a'.repeat(64),
    '--agent-repair',
    '--with-video',
    '--publish',
    'webhook',
  ]);
  assert.equal(flagStyle.oracleMode, true);
  assert.equal(flagStyle.oracleSpecPath, 'examples/oracle/ledgerly-approval.json');
  assert.equal(flagStyle.expectSpecSha256, 'a'.repeat(64));
  assert.equal(flagStyle.agentRepairFlag, true);
  assert.equal(flagStyle.withVideo, true);
  assert.equal(flagStyle.publishAdapter, 'webhook');

  const subcommandStyle = parseCliArgs(['oracle', 'spec.json', '--publish=stdout-json']);
  assert.equal(subcommandStyle.oracleMode, true);
  assert.equal(subcommandStyle.oracleSpecPath, 'spec.json');
  assert.equal(subcommandStyle.publishAdapter, 'stdout-json');
});

test('resolveJsonPath and verifyApiStateOutcomes support nested paths and reject mismatched backend state', async () => {
  const payload = {
    status: 'Approved',
    nested: { metrics: { items: [{ id: 'INV-1042', approved: true }] } },
  };
  assert.equal(resolveJsonPath(payload, 'status'), 'Approved');
  assert.equal(resolveJsonPath(payload, '$.nested.metrics.items[0].approved'), true);

  const server = http.createServer((req, res) => {
    if (req.url === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;

  try {
    const passRes = await verifyApiStateOutcomes(`http://127.0.0.1:${addr.port}`, [
      {
        id: 'nested-check',
        verification: {
          type: 'api_state',
          endpoint: '/api/state',
          jsonPath: 'nested.metrics.items[0].approved',
          expected: true,
        },
      },
    ]);
    assert.equal(passRes.passed, true);
    assert.equal(passRes.checkedCount, 1);

    const failRes = await verifyApiStateOutcomes(`http://127.0.0.1:${addr.port}`, [
      {
        id: 'bad-check',
        verification: {
          type: 'api_state',
          endpoint: '/api/state',
          jsonPath: 'status',
          expected: 'Pending',
        },
      },
    ]);
    assert.equal(failRes.passed, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
