import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_REDACTION_RULES, redactSecrets } from '../src/edit/redact.js';
import { scanVideoPixelsForSecrets } from '../src/edit/ocrScan.js';

test('TEST-12: Injected fake Stripe live key (sk_live_...) -> Detected and redacted', () => {
  const fakeSecret = 'sk_live_abc12345678901234567';
  const text = `Connecting to Stripe billing with key ${fakeSecret} now.`;

  const result = redactSecrets(text, DEFAULT_REDACTION_RULES);
  assert.equal(result.redactedCount, 1);
  assert.equal(result.detectedTypes.includes('api_key_sk'), true);
  assert.equal(result.text.includes(fakeSecret), false);
  assert.match(result.text, /\[REDACTED_API_KEY\]/);
});

test('TEST-18: Secret in transition frame text / payload -> Detected across all rules', () => {
  const secrets = [
    { rule: 'google_api_key', val: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567' },
    { rule: 'github_token', val: 'ghp_123456789012345678901234567890123456' },
    { rule: 'aws_access_key', val: 'AKIAIOSFODNN7EXAMPLE' },
    { rule: 'pem_private_key_header', val: '-----BEGIN OPENSSH PRIVATE KEY-----' },
    { rule: 'pem_private_key_header', val: '-----BEGIN PRIVATE KEY-----' },
    { rule: 'oracle_keys_path', val: '.oracle-keys/runner-private.pem' },
    { rule: 'oracle_secret_assignment', val: 'ORACLE_SIGNING_KEY=.oracle-keys/runner-private.pem' },
    { rule: 'oracle_secret_assignment', val: 'ORACLE_WEBHOOK_SECRET=super-secret-token' },
  ];

  for (const s of secrets) {
    const text = `Frame OCR payload: config = { apiKey: "${s.val}" }`;
    const res = redactSecrets(text, DEFAULT_REDACTION_RULES);
    assert.equal(res.detectedTypes.includes(s.rule), true, `Expected rule ${s.rule} to match`);
    assert.equal(res.text.includes(s.val), false);
  }
});

test('TEST-20: Pixel Safety OCR fails closed when zero frames extracted', async () => {
  // Create an empty dummy file that ffmpeg cannot extract frames from
  const dummyVideo = path.join(process.cwd(), 'out', 'dummy-empty.mp4');
  fs.mkdirSync(path.dirname(dummyVideo), { recursive: true });
  fs.writeFileSync(dummyVideo, 'not a valid video');

  try {
    const result = await scanVideoPixelsForSecrets(dummyVideo, [100.0]);
    assert.equal(result.passed, false, 'Must fail closed when no frames extracted');
    assert.equal(result.framesScanned, 0);
    assert.ok(result.error);
  } finally {
    if (fs.existsSync(dummyVideo)) {
      fs.unlinkSync(dummyVideo);
    }
  }
});


