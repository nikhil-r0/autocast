import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REDACTION_RULES, redactSecrets } from '../src/edit/redact.js';

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
  ];

  for (const s of secrets) {
    const text = `Frame OCR payload: config = { apiKey: "${s.val}" }`;
    const res = redactSecrets(text, DEFAULT_REDACTION_RULES);
    assert.equal(res.detectedTypes.includes(s.rule), true, `Expected rule ${s.rule} to match`);
    assert.equal(res.text.includes(s.val), false);
  }
});

