import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { scrubChildEnv } from '../src/oracle/env.js';

const PROBE_PATH = path.resolve(process.cwd(), 'tests/fixtures/redteam-app/probe.mjs');

function runRedTeamProbe(extraEnv: Record<string, string>) {
  const dirtyHostEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: process.env.PATH || '/usr/bin',
    HOME: process.env.HOME || os.homedir(),
    ORACLE_SIGNING_KEY: '-----BEGIN PRIVATE KEY-----\nSECRET_KEY\n-----END PRIVATE KEY-----',
    ORACLE_WEBHOOK_SECRET: 'whsec_redteam_secret',
    ORACLE_TRUSTED_KEYS: '{"k1":"pem"}',
    GEMINI_API_KEY: 'AIzaSyFakeRedteamGeminiKey',
    GITHUB_TOKEN: 'ghp_fake_redteam_token',
  };

  const scrubbed = scrubChildEnv(dirtyHostEnv, extraEnv);
  const child = spawnSync(process.execPath, [PROBE_PATH], {
    env: scrubbed as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, `Probe exited cleanly (${child.stderr})`);
  return JSON.parse(child.stdout.trim()) as {
    pid: number;
    envKeysPresent: string[];
    leakedEnvKeys: string[];
    fileReadSucceeded: boolean;
    fileReadBytes: number;
    egressSucceeded: boolean;
  };
}

test('REDTEAM (Tier A active control): spawned child under scrubChildEnv sees zero ORACLE_* or API secret env vars', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-redteam-env-'));
  try {
    const result = runRedTeamProbe({
      TARGET_APP_URL: 'http://localhost:8080',
    });
    assert.deepEqual(result.leakedEnvKeys, []);
    assert.equal(result.envKeysPresent.includes('ORACLE_SIGNING_KEY'), false);
    assert.equal(result.envKeysPresent.includes('ORACLE_WEBHOOK_SECRET'), false);
    assert.equal(result.envKeysPresent.includes('GEMINI_API_KEY'), false);
    assert.equal(result.envKeysPresent.includes('GITHUB_TOKEN'), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test(
  'REDTEAM (Tier B boundary): child process reading local .oracle-keys/runner-private.pem succeeds under shared OS user until container + separate signer ship',
  { todo: 'Expected Tier A limitation: contractor process shares host OS user until Tier B container sandbox + separate signer service ship' },
  () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-redteam-fs-'));
    const keyFile = path.join(tmpDir, 'runner-private.pem');
    fs.writeFileSync(keyFile, '-----BEGIN PRIVATE KEY-----\nREDTEAM_TEST\n-----END PRIVATE KEY-----\n');
    try {
      const child = spawnSync(process.execPath, [PROBE_PATH], {
        env: {
          ...scrubChildEnv(process.env),
          REDTEAM_KEY_PATH: keyFile,
        } as NodeJS.ProcessEnv,
        encoding: 'utf8',
      });
      const result = JSON.parse(child.stdout.trim());
      // When Tier B container isolation + separate signer ship, assert fileReadSucceeded === false
      assert.equal(result.fileReadSucceeded, false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
);

test(
  'REDTEAM (Tier B boundary): child process outbound HTTP egress succeeds until egress-restricted Tier B container ships',
  { todo: 'Expected Tier A limitation: outbound network egress is unblocked until Tier B container network namespace ships' },
  async () => {
    let receivedEgress = false;
    const sink = http.createServer((req, res) => {
      receivedEgress = true;
      req.resume();
      res.writeHead(200);
      res.end('ok');
    });
    await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', () => resolve()));
    const addr = sink.address() as any;
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        let out = '';
        const child = spawn(process.execPath, [PROBE_PATH], {
          env: {
            ...scrubChildEnv(process.env),
            REDTEAM_EGRESS_URL: `http://127.0.0.1:${addr.port}/exfil`,
          } as NodeJS.ProcessEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', (chunk) => {
          out += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', () => resolve(out));
      });
      const parsed = JSON.parse(stdout.trim());
      assert.deepEqual(parsed.leakedEnvKeys, []);
      // When Tier B egress-restricted container ships, assert egressSucceeded === false && receivedEgress === false
      assert.equal(parsed.egressSucceeded, false);
      assert.equal(receivedEgress, false);
    } finally {
      await new Promise<void>((resolve) => sink.close(() => resolve()));
    }
  }
);
