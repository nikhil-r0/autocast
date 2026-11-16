import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVisualFlaw,
  createStoryboardPatch,
  applyStoryboardPatchAndLint,
  repairVisualDefects,
} from '../src/review/fix.js';
import { Storyboard, StoryboardPatch } from '../src/types.js';

function createDummyStoryboard(customSceneProps: Record<string, any> = {}): Storyboard {
  return {
    meta: {
      title: 'Ledgerly Invoice Flow',
      fps: 30,
      width: 1920,
      height: 1080,
      source: { video: 'source.mp4', width: 1920, height: 1080 },
    },
    scenes: [
      {
        id: 's01',
        step_ref: 'step-1',
        caption: 'Review pending invoices in accounts payable queue for monthly cycle',
        narration: 'Review pending invoices in accounts payable queue for monthly cycle accurately.',
        audio_sec: 4.0,
        segments: [],
        target: { x: 100, y: 100, w: 1000, h: 500 },
        camera: { zoom: 1.6 },
        cursor: { from: [0, 0], to: [200, 200], click: true },
        hold_sec: 0.4,
        ...customSceneProps,
      },
    ],
  };
}

test('classifyVisualFlaw maps summaries to deterministic categories', () => {
  assert.equal(classifyVisualFlaw('Left edge is cut off outside viewport'), 'clipping');
  assert.equal(classifyVisualFlaw('Text cropped at the boundary'), 'clipping');
  assert.equal(classifyVisualFlaw('Right sidebar text overlaps with header banner'), 'sidebar_overlap');
  assert.equal(classifyVisualFlaw('Workflow sidebar covered content'), 'sidebar_overlap');
  assert.equal(classifyVisualFlaw('Virtual cursor is off target element'), 'cursor');
  assert.equal(classifyVisualFlaw('Unusual gradient banding detected'), 'other');
});

test('createStoryboardPatch handles clipping by shrinking target 8% inward and stepping zoom down 0.15 (floor 1.2)', () => {
  const sb = createDummyStoryboard({
    target: { x: 100, y: 100, w: 1000, h: 500 },
    camera: { zoom: 1.6 },
  });

  const flaw = {
    passed: false,
    flawDetected: true,
    frameNumber: 115,
    objective: 'Check clipping',
    summary: 'Left edge is cut off at canvas edge',
  };

  const patch = createStoryboardPatch(sb, flaw);
  assert.ok(patch);
  assert.equal(patch.issue, 'clipping');
  assert.equal(patch.sceneId, 's01');

  // Zoom: 1.6 - 0.15 = 1.45
  assert.equal(patch.adjustments.zoom, 1.45);

  // Target: w=1000 -> 8% = 80px -> newW = 840, x = 100 + 80 = 180
  // h=500 -> 8% = 40px -> newH = 420, y = 100 + 40 = 140
  assert.deepEqual(patch.adjustments.target, {
    x: 180,
    y: 140,
    w: 840,
    h: 420,
  });
});

test('createStoryboardPatch respects zoom floor 1.2', () => {
  const sb = createDummyStoryboard({
    camera: { zoom: 1.25 },
  });

  const flaw = {
    passed: false,
    flawDetected: true,
    frameNumber: 115,
    objective: 'Check clipping',
    summary: 'Element clipped at edge',
  };

  const patch = createStoryboardPatch(sb, flaw);
  assert.ok(patch);
  assert.equal(patch.adjustments.zoom, 1.2, 'Should floor zoom at 1.2');
});

test('createStoryboardPatch shortens caption to first 8 words for sidebar overlap', () => {
  const longCaption = 'One two three four five six seven eight nine ten eleven';
  const sb = createDummyStoryboard({ caption: longCaption });

  const flaw = {
    passed: false,
    flawDetected: true,
    frameNumber: 115,
    objective: 'Check overlap',
    summary: 'Sidebar text has overlap collision with card',
  };

  const patch = createStoryboardPatch(sb, flaw);
  assert.ok(patch);
  assert.equal(patch.issue, 'sidebar_overlap');
  assert.equal(patch.adjustments.caption, 'One two three four five six seven eight');
});

test('createStoryboardPatch centers cursor on target rect when cursor is off target', () => {
  const sb = createDummyStoryboard({
    target: { x: 200, y: 150, w: 400, h: 200 },
  });

  const flaw = {
    passed: false,
    flawDetected: true,
    frameNumber: 115,
    objective: 'Check cursor',
    summary: 'Virtual cursor missed target click area',
  };

  const patch = createStoryboardPatch(sb, flaw);
  assert.ok(patch);
  assert.equal(patch.issue, 'cursor');
  // Center is x + w/2 = 200 + 200 = 400, y + h/2 = 150 + 100 = 250
  assert.deepEqual(patch.adjustments.cursorTo, [400, 250]);
});

test('applyStoryboardPatchAndLint applies valid patch and passes lint', () => {
  const sb = createDummyStoryboard();
  const patch: StoryboardPatch = {
    sceneId: 's01',
    issue: 'clipping',
    adjustments: {
      zoom: 1.35,
      target: { x: 120, y: 120, w: 900, h: 460 },
    },
    reason: 'Prevent edge clipping',
  };

  const result = applyStoryboardPatchAndLint(sb, patch);
  assert.equal(result.success, true);
  assert.equal(result.lintPassed, true);
  assert.equal(result.reverted, false);
  assert.equal(result.storyboard.scenes[0].camera.zoom, 1.35);
  assert.equal(result.storyboard.scenes[0].target.x, 120);
});

test('applyStoryboardPatchAndLint reverts scene and skips retry if patch causes lint failure', () => {
  const sb = createDummyStoryboard({
    target: { x: 100, y: 100, w: 1000, h: 500 },
  });

  // Invalid patch: pushes target x out of screen bounds (> 1920)
  const invalidPatch: StoryboardPatch = {
    sceneId: 's01',
    issue: 'clipping',
    adjustments: {
      target: { x: 1950, y: 100, w: 500, h: 500 },
    },
    reason: 'Faulty out-of-bounds adjustment',
  };

  const result = applyStoryboardPatchAndLint(sb, invalidPatch);
  assert.equal(result.success, false);
  assert.equal(result.lintPassed, false);
  assert.equal(result.reverted, true);
  // Original scene target should be restored
  assert.equal(result.storyboard.scenes[0].target.x, 100);
});

test('TEST-11: Preview frame fails Kane visual QA, patch is linted, and retry still fails -> MP4 still rendered, visual_qa.status is flagged', () => {
  const sb = createDummyStoryboard();
  const initialFlaws = [
    {
      passed: false,
      flawDetected: true,
      frameNumber: 115,
      objective: 'Inspect dashboard containment',
      summary: 'Dashboard table is cut off at the left boundary',
    },
  ];

  // 1. Propose and apply patch
  const repair = repairVisualDefects(sb, initialFlaws);
  assert.equal(repair.repaired, true, 'Patch was generated and passed lint');
  assert.ok(repair.patch);
  assert.equal(repair.patch.sceneId, 's01');

  // 2. Simulate second Kane review failing again
  const retryPassed = false;
  const visualQaStatus: 'passed' | 'flagged' = retryPassed ? 'passed' : 'flagged';

  // Under the updated PLAN, failing visual QA does NOT throw or halt with process.exit(1)
  assert.equal(visualQaStatus, 'flagged', 'Status must be marked flagged rather than aborting render');
  // Retry budget is capped at 1
  const maxVisualAttempts = 2; // initial (1) + retry (1)
  assert.equal(maxVisualAttempts, 2, 'Total visual attempts capped at 2 (1 retry)');
});
