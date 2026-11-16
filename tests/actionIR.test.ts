import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActionsLogToActionIR, verifyOutcomeSpecs } from '../src/capture/actionIR.js';
import { OutcomeSpec } from '../types.js';

test('parseActionsLogToActionIR successfully parses supported action types and skips assertions to outcomeSpecs', () => {
  const ndjson = [
    JSON.stringify({ action_id: '1', action_type: 'navigate', action_params: { url: 'http://localhost:8080' }, step: 1 }),
    JSON.stringify({
      action_id: '2',
      action_type: 'click',
      selectors: [{ selector: '#btn-view-INV-1001' }],
      visual_data: { bbox: { x: 100, y: 200, width: 50, height: 20 }, viewport_width: 1920, viewport_height: 1080 },
      step: 2,
    }),
    JSON.stringify({
      action_id: '3',
      action_type: 'assert',
      intent: 'the Approved seal is visible',
      step: 3,
    }),
  ].join('\n');

  const ir = parseActionsLogToActionIR(ndjson);
  assert.equal(ir.actions.length, 2);
  assert.equal(ir.actions[0].type, 'navigate');
  assert.equal(ir.actions[1].type, 'click');
  assert.equal(ir.actions[1].selector, '#btn-view-INV-1001');
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

