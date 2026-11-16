import * as fs from 'fs';
import * as path from 'path';
import { Storyboard, Scene, KaneStep } from '../types.js';
import { SceneNarration } from './narration.js';
import { ReplayResult } from '../capture/replay.js';
import { redactStoryboard } from './redact.js';

export function buildStoryboard(
  title: string,
  replayResult: ReplayResult,
  steps: KaneStep[],
  narrations: SceneNarration[]
): Storyboard {
  const scenes: Scene[] = [];
  const segments = replayResult.segments;

  // Zoom choreography per scene index:
  // Scene 1: 1.0 (Full dashboard wide shot)
  // Scene 2: 1.25 (Pending invoice selection)
  // Scene 3: 1.15 (Modal details inspection)
  // Scene 4: 1.35 (Payment authorization button)
  // Scene 5: 1.25 (Approved compliance seal)
  // Scene 6: 1.0 (Full reconciled ledger wide shot)
  const zoomLevels = [1.0, 1.25, 1.15, 1.35, 1.25, 1.0];

  let lastCursorPos: [number, number] = [960, 540];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const narrationItem = narrations[i] || {
      caption: `Step ${i + 1}`,
      narration: `Complete workflow step ${i + 1} with real-time auditability.`,
    };

    const targetRect = seg.target
      ? {
          x: Math.max(0, Math.min(1920, seg.target.x)),
          y: Math.max(0, Math.min(1080, seg.target.y)),
          w: Math.max(20, Math.min(1920, seg.target.w)),
          h: Math.max(20, Math.min(1080, seg.target.h)),
        }
      : { x: 0, y: 0, w: 1920, h: 1080 };

    const targetCursor: [number, number] = seg.cursorTo || [
      Math.round(targetRect.x + targetRect.w / 2),
      Math.round(targetRect.y + targetRect.h / 2),
    ];

    const words = narrationItem.narration.trim().split(/\s+/).filter(Boolean).length;
    const readableSec = Math.round((words * 0.3 + 0.8) * 10) / 10;
    const sceneDuration = Math.max(4.2, seg.srcEnd - seg.srcStart, readableSec);

    // Safe zoom calculation: If target element is wide (e.g. table row > 900px),
    // cap zoom at 1.0 to prevent horizontal viewport clipping and keep left table columns visible.
    const isWideTarget = targetRect.w > 900;
    const requestedZoom = zoomLevels[i] ?? 1.15;
    const zoom = isWideTarget ? 1.0 : requestedZoom;

    scenes.push({
      id: `s0${i + 1}`,
      step_ref: `step-${i + 1}`,
      caption: narrationItem.caption,
      narration: narrationItem.narration,
      audio: null, // Silent mode typography
      audio_sec: sceneDuration,
      segments: [
        {
          kind: seg.kind,
          src_start: seg.srcStart,
          src_end: seg.srcEnd,
          speed: 1,
        },
      ],
      target: targetRect,
      camera: {
        zoom,
      },
      cursor: {
        from: lastCursorPos,
        to: targetCursor,
        click: seg.kind === 'action',
      },
      hold_sec: 0.5,
    });

    lastCursorPos = targetCursor;
  }

  const rawStoryboard: Storyboard = {
    meta: {
      title,
      fps: 30,
      width: 1920,
      height: 1080,
      source: {
        video: replayResult.videoPath,
        width: 1920,
        height: 1080,
      },
      music: null,
    },
    scenes,
  };

  // Run Secret Redaction Pass (Scrub API keys, tokens, emails, IPs)
  const { storyboard } = redactStoryboard(rawStoryboard);

  // Write to storyboard.json, public/storyboard.json, and remotion/defaultStoryboard.json
  const rootStoryboardPath = path.join(process.cwd(), 'storyboard.json');
  const publicStoryboardPath = path.join(process.cwd(), 'public', 'storyboard.json');
  const remotionStoryboardPath = path.join(process.cwd(), 'remotion', 'defaultStoryboard.json');

  const jsonStr = JSON.stringify(storyboard, null, 2);
  fs.writeFileSync(rootStoryboardPath, jsonStr, 'utf-8');
  fs.writeFileSync(publicStoryboardPath, jsonStr, 'utf-8');
  fs.writeFileSync(remotionStoryboardPath, jsonStr, 'utf-8');

  console.log(`[Edit Loop] Storyboard compiled -> ${rootStoryboardPath} (${scenes.length} scenes, ~${scenes.reduce((a, s) => a + s.audio_sec, 0).toFixed(1)}s duration)`);
  return storyboard;
}
