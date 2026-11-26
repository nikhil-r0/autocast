import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  findActionsLog,
  normalizeActionSelector,
  parseActionsLogToActionIR,
  verifyOutcomeSpecs,
} from '../src/capture/actionIR.js';
import { OutcomeSpec } from '../types.js';

test('parseActionsLogToActionIR successfully parses supported action types and skips assertions to outcomeSpecs', () => {
  const ndjson = [
    JSON.stringify({ action_id: '1', action_type: 'navigate', action_params: { url: 'http://localhost:8080' }, step: 1 }),
    JSON.stringify({ action_id: '1b', action_type: 'wait', action_params: { ms: 100 }, step: 2 }),
    JSON.stringify({
      action_id: '2',
      action_type: 'click',
      selectors: [{ selector: '#btn-view-INV-1001' }],
      visual_data: { bbox: { x: 100, y: 200, width: 50, height: 20 }, viewport_width: 1920, viewport_height: 1080 },
      step: 3,
    }),
    JSON.stringify({
      action_id: '3',
      action_type: 'assert',
      intent: 'the Approved seal is visible',
      step: 4,
    }),
  ].join('\n');

  const ir = parseActionsLogToActionIR(ndjson);
  assert.equal(ir.actions.length, 3);
  assert.equal(ir.actions[0].type, 'navigate');
  assert.equal(ir.actions[1].type, 'wait');
  assert.equal(ir.actions[1].waitAfterMs, 100);
  assert.equal(ir.actions[2].type, 'click');
  assert.equal(ir.actions[2].selector, '#btn-view-INV-1001');
  assert.equal(ir.outcomeSpecs.length, 1);
  assert.equal(ir.outcomeSpecs[0].verification.type, 'visible');
});

test('TEST-10: Action IR encounters unsupported action type -> Throws error', () => {
  const ndjson = [
    JSON.stringify({ action_id: '1', action_type: 'navigate', action_params: { url: 'http://localhost:8080' } }),
    JSON.stringify({ action_id: '2', action_type: 'unsupported_gesture_swipe', step: 2 }),
  ].join('\n');

  assert.throws(
    () => {
      parseActionsLogToActionIR(ndjson);
    },
    (err: any) => {
      return /unsupported action type in action ir: 'unsupported_gesture_swipe'/i.test(err.message);
    }
  );
});

test('TEST-09: Replay final state diverges from OutcomeSpec -> Returns failure', async () => {
  // Mock page object
  const mockPage: any = {
    locator: (sel: string) => ({
      isVisible: async () => false, // seal not visible!
      innerText: async () => 'Pending',
    }),
    url: () => 'http://localhost:8080/?logged_in=true',
  };

  const specs: OutcomeSpec[] = [
    {
      id: 'seal-check',
      verification: {
        type: 'visible',
        selector: '[data-testid="approved-seal"]',
      },
    },
  ];

  const result = await verifyOutcomeSpecs(mockPage, specs);
  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /not visible/i);
});

test('OutcomeSpec passes when conditions are satisfied', async () => {
  const mockPage: any = {
    locator: (sel: string) => ({
      isVisible: async () => true,
      innerText: async () => 'Approved',
    }),
    url: () => 'http://localhost:8080/?logged_in=true',
  };

  const specs: OutcomeSpec[] = [
    {
      id: 'seal-check',
      verification: {
        type: 'visible',
        selector: '[data-testid="approved-seal"]',
      },
    },
  ];

  const result = await verifyOutcomeSpecs(mockPage, specs);
  assert.equal(result.passed, true);
  assert.equal(result.failures.length, 0);
});

test('normalizeActionSelector converts Kane internal Playwright selectors and findActionsLog extracts .evidence ZIP entries', () => {
  assert.equal(
    normalizeActionSelector('internal:testid=[data-testid="btn-review-INV-1042"s]'),
    '[data-testid="btn-review-INV-1042"]'
  );
  assert.equal(
    normalizeActionSelector('internal:role=button[name="Confirm Approval"i]'),
    'role=button[name="Confirm Approval"i]'
  );
  assert.equal(
    normalizeActionSelector('internal:text="Approve Invoice"i'),
    'text="Approve Invoice"'
  );
  assert.equal(
    normalizeActionSelector('internal:attr=[aria-label="Close drawer"]'),
    '[aria-label="Close drawer"]'
  );
  assert.equal(normalizeActionSelector('xpath=//button[@type="submit"]'), 'xpath=//button[@type="submit"]');
  assert.equal(normalizeActionSelector('#plain-css'), '#plain-css');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocast-evidence-zip-'));
  try {
    const innerDir = path.join(tmpDir, 'pack-src', 'tests', 'run-1', 'logs');
    fs.mkdirSync(innerDir, { recursive: true });
    const ndjson0 = JSON.stringify({
      action_id: 'step-1',
      action_type: 'click',
      selectors: [{ selector: 'internal:testid=[data-testid="btn-login"s]' }],
      step: 1,
    });
    const ndjson1 = JSON.stringify({
      action_id: 'step-2',
      action_type: 'click',
      selectors: [{ selector: 'internal:testid=[data-testid="btn-review-INV-1042"s]' }],
      step: 2,
    });
    fs.writeFileSync(path.join(innerDir, '0-actions.ndjson'), ndjson0 + '\n', 'utf8');
    fs.writeFileSync(path.join(innerDir, '1-actions.ndjson'), ndjson1 + '\n', 'utf8');

    const sessionDir = path.join(tmpDir, 'kane-session');
    const evidenceDir = path.join(sessionDir, 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    const archivePath = path.join(evidenceDir, 'run.evidence');
    execFileSync('zip', ['-rq', archivePath, 'tests'], { cwd: path.join(tmpDir, 'pack-src') });

    const found = findActionsLog(sessionDir, archivePath);
    assert.ok(found && fs.existsSync(found), 'findActionsLog must extract & merge numbered *-actions.ndjson from .evidence archive');
    const ir = parseActionsLogToActionIR(fs.readFileSync(found, 'utf8'));
    assert.equal(ir.actions.length, 2);
    assert.equal(ir.actions[0].selector, '[data-testid="btn-login"]');
    assert.equal(ir.actions[1].selector, '[data-testid="btn-review-INV-1042"]');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Committed real Kane v0.10.4 bifurcated logs merge & parse cleanly without stale partial masking', () => {
  const realLogsDir = path.resolve(process.cwd(), 'tests/fixtures/kane-logs');
  const mergedPath = findActionsLog(realLogsDir);
  assert.ok(mergedPath && fs.existsSync(mergedPath));
  try {
    const ir = parseActionsLogToActionIR(fs.readFileSync(mergedPath, 'utf8'));
    assert.equal(ir.actions.length, 9);
    assert.equal(ir.actions[0].type, 'navigate');
    assert.equal(ir.actions[1].type, 'wait');
    assert.equal(ir.actions[2].selector, '[data-testid="input-email"]');
    assert.equal(ir.actions[4].selector, '[data-testid="btn-login"]');
    assert.equal(ir.actions[5].selector, '[data-testid="btn-review-INV-1042"]');
    assert.equal(ir.actions[8].selector, '[data-testid="btn-confirm-approve"]');
  } finally {
    const generatedMerged = path.join(realLogsDir, 'merged-actions.ndjson');
    if (fs.existsSync(generatedMerged)) {
      fs.unlinkSync(generatedMerged);
    }
  }
});

