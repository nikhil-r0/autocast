import test from 'node:test';
import assert from 'node:assert/strict';
import { repairVisualDefects } from '../src/review/fix.js';
import { Storyboard } from '../types.js';

test('repairVisualDefects clamps zoom when clipping detected', () => {
  const dummyStoryboard: Storyboard = {
    meta: {
      title: 'Test',
      fps: 30,
      width: 1920,
      height: 1080,
      source: { video: 'source.mp4', width: 1920, height: 1080 },
    },
    scenes: [
      {
        id: 'scene-1',
        caption: 'Cap',
        narration: 'Narr',
        audio_sec: 3,
        segments: [],
        target: { x: 0, y: 0, w: 1920, h: 1080 },
        camera: { zoom: 1.8 },
        cursor: { from: [0, 0], to: [100, 100], click: true },
        hold_sec: 0.4,
      },
    ],
  };

  const flaws = [
    {
      passed: false,
      flawDetected: true,
      frameNumber: 204,
      objective: 'Check clipping',
      summary: 'Left edge is cut off and clipped outside safe area',
    },
  ];

  const repair = repairVisualDefects(dummyStoryboard, flaws);
  assert.equal(repair.repaired, true);
  assert.equal(repair.storyboard.scenes[0].camera.zoom, 1.0);
  assert.match(repair.actionsTaken[0], /clamped scene scene-1 camera zoom from 1.8 to 1.0/i);
});

test('TEST-11: Visual flaws persist when unrepairable -> repair returns repaired=false', () => {
  const dummyStoryboard: Storyboard = {
    meta: {
      title: 'Test',
      fps: 30,
      width: 1920,
      height: 1080,
      source: { video: 'source.mp4', width: 1920, height: 1080 },
    },
    scenes: [
      {
        id: 'scene-1',
        caption: 'Cap',
        narration: 'Narr',
        audio_sec: 3,
        segments: [],
        target: { x: 0, y: 0, w: 1920, h: 1080 },
        camera: { zoom: 1.0 }, // Already at minimum zoom 1.0
        cursor: { from: [0, 0], to: [100, 100], click: true },
        hold_sec: 0.4,
      },
    ],
  };

  const persistentFlaws = [
    {
      passed: false,
      flawDetected: true,
      frameNumber: 204,
      objective: 'Check clipping',
      summary: 'Left edge is cut off',
    },
  ];

  // Attempt repair on already-minimized zoom
  const repair = repairVisualDefects(dummyStoryboard, persistentFlaws);
  assert.equal(repair.repaired, false, 'Should report repaired=false when zoom cannot be clamped further');
});

