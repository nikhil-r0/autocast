import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeKaneExecution } from '../src/shoot/kaneAdapter.js';
import { classifyKaneRun } from '../src/shoot/classify.js';

test('TEST-01: Kane returns exit 1 with verdict.confirmed === true (740 confirmed product bug)', () => {
  const stdout = JSON.stringify({
    type: 'run_end',
    status: 'failed',
    result_code: 740,
    reason_code: 'bug.confirmed',
    summary: 'Invoice INV-1042 status stayed Pending after clicking Confirm Approval',
    verdict: {
      confirmed: true,
      family: 'product_defect',
      category: 'state_mutation_failed',
      severity: 'high',
      one_liner: 'Approval button is no-op, invoice remains Pending',
      confidence: 1.0,
    },
  });

  const normalized = normalizeKaneExecution({
    exitCode: 1,
    stdout,
    stderr: '',
    durationSec: 15,
  });

  assert.strictEqual(normalized.category, 'confirmed_product_bug');
  assert.strictEqual(normalized.isProductDefect, true);
  assert.strictEqual(normalized.resultCode, 740);

  const classification = classifyKaneRun(normalized);
  assert.strictEqual(classification.type, 'confirmed_product_bug');
  assert.ok(classification.report?.includes('CONFIRMED PRODUCT BUG'));
});

test('TEST-02: Kane returns exit 1 without confirmed verdict (unconfirmed failure)', () => {
  const stdout = JSON.stringify({
    type: 'run_end',
    status: 'failed',
    result_code: 720,
    reason_code: 'checkpoint_failed',
    summary: 'Element not found within 10s',
  });

  const normalized = normalizeKaneExecution({
    exitCode: 1,
    stdout,
    stderr: '',
    durationSec: 20,
  });

  assert.strictEqual(normalized.category, 'unconfirmed_failure');
  assert.strictEqual(normalized.isProductDefect, false);

  const classification = classifyKaneRun(normalized);
  assert.strictEqual(classification.type, 'unconfirmed_failure');
});

test('TEST-03: Kane exits code 2 without run_end (CLI configuration / auth error)', () => {
  const normalized = normalizeKaneExecution({
    exitCode: 2,
    stdout: '',
    stderr: 'Error: invalid flag --unknown-flag',
    durationSec: 1,
  });

  assert.strictEqual(normalized.category, 'cli_configuration_error');
  const classification = classifyKaneRun(normalized);
  assert.strictEqual(classification.type, 'cli_configuration_error');
});

test('TEST-04: Kane exits code 3 after duration limit (Timeout)', () => {
  const normalized = normalizeKaneExecution({
    exitCode: 3,
    stdout: '',
    stderr: 'Timeout 300s exceeded',
    durationSec: 300,
    timeoutSec: 300,
  });

  assert.strictEqual(normalized.category, 'timeout');
  const classification = classifyKaneRun(normalized);
  assert.strictEqual(classification.type, 'timeout');
});

test('Kane returns exit 0 with status passed (Complete)', () => {
  const stdout = JSON.stringify({
    type: 'run_end',
    status: 'passed',
    result_code: 100,
    summary: 'Objective completed successfully',
  });

  const normalized = normalizeKaneExecution({
    exitCode: 0,
    stdout,
    stderr: '',
    durationSec: 10,
  });

  assert.strictEqual(normalized.category, 'pass');
  assert.strictEqual(normalized.passed, true);
  const classification = classifyKaneRun(normalized);
  assert.strictEqual(classification.type, 'pass');
});

