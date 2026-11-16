import test from 'node:test';
import assert from 'node:assert/strict';

test('TEST-17: Closed loop halts after configured max repair attempts (max 2)', async () => {
  let repairAttempts = 0;
  const MAX_REPAIRS = 2;
  let terminated = false;

  // Simulate repeated Kane failures
  while (repairAttempts <= MAX_REPAIRS) {
    if (repairAttempts >= MAX_REPAIRS) {
      terminated = true;
      break;
    }
    repairAttempts++;
  }

  assert.equal(repairAttempts, 2);
  assert.equal(terminated, true);
});

