import { Storyboard, StoryboardPatch, Scene, AuthoritativeTimeline } from '../types.js';
import { VisualReviewResult } from './kaneReview.js';
import { compileAuthoritativeTimeline, lookupSceneForFrame } from './timeline.js';
import { lintStoryboard } from '../edit/lint.js';

export interface PatchApplyResult {
  success: boolean;
  storyboard: Storyboard;
  patch?: StoryboardPatch;
  fieldChanged?: string;
  lintPassed: boolean;
  lintErrors?: string[];
  reverted: boolean;
  actionsTaken: string[];
}

/**
 * Classifies Kane review summary into a deterministic issue category
 * before spending another model call.
 */
export function classifyVisualFlaw(
  summary: string
): 'clipping' | 'sidebar_overlap' | 'cursor' | 'other' {
  const s = (summary || '').toLowerCase();

  // Cropped or cut off (crop, cut off, outside, edge)
  if (s.includes('crop') || s.includes('cut off') || s.includes('outside') || s.includes('edge') || s.includes('clip')) {
    return 'clipping';
  }

  // Overlap or covered text (overlap, covered, sidebar)
  if (s.includes('overlap') || s.includes('covered') || s.includes('sidebar')) {
    return 'sidebar_overlap';
  }

  // Cursor off the target (cursor)
  if (s.includes('cursor')) {
    return 'cursor';
  }

  return 'other';
}

/**
 * Proposes a targeted StoryboardPatch for the failing scene only.
 */
export function createStoryboardPatch(
  storyboard: Storyboard,
  flaw: VisualReviewResult,
  timeline?: AuthoritativeTimeline
): StoryboardPatch | null {
  const currentTimeline = timeline || compileAuthoritativeTimeline(storyboard);
  const compiled = lookupSceneForFrame(currentTimeline, flaw.frameNumber);

  if (!compiled) {
    return null;
  }

  const scene = storyboard.scenes.find((s) => s.id === compiled.sceneId);
  if (!scene) {
    return null;
  }

  const issue = classifyVisualFlaw(flaw.summary);

  if (issue === 'clipping') {
    // Pull target rect inward by 8% of width and height, clamped to 1920x1080
    const target = scene.target;
    const dx = Math.round(target.w * 0.08);
    const dy = Math.round(target.h * 0.08);
    const newW = Math.max(20, target.w - dx * 2);
    const newH = Math.max(20, target.h - dy * 2);
    const newX = Math.max(0, Math.min(1920 - newW, target.x + dx));
    const newY = Math.max(0, Math.min(1080 - newH, target.y + dy));

    // Step camera.zoom down by 0.15, floor 1.2
    const currentZoom = scene.camera?.zoom ?? 1.6;
    const newZoom = Math.max(1.2, Math.round((currentZoom - 0.15) * 100) / 100);

    return {
      sceneId: scene.id,
      issue: 'clipping',
      adjustments: {
        zoom: newZoom,
        target: { x: newX, y: newY, w: newW, h: newH },
      },
      reason: `Frame ${flaw.frameNumber} clipping: stepped zoom from ${currentZoom} to ${newZoom} and shrunk target rect by 8% inward.`,
    };
  }

  if (issue === 'sidebar_overlap') {
    // Shorten caption to its first 8 words. Do not move sidebar in React.
    const words = (scene.caption || '').trim().split(/\s+/).filter(Boolean);
    const shortened = words.slice(0, 8).join(' ');

    return {
      sceneId: scene.id,
      issue: 'sidebar_overlap',
      adjustments: {
        caption: shortened,
      },
      reason: `Frame ${flaw.frameNumber} text collision: shortened caption to first 8 words ("${shortened}").`,
    };
  }

  if (issue === 'cursor') {
    // Set cursor.to to the center of the target rect
    const target = scene.target;
    const centerX = Math.round(target.x + target.w / 2);
    const centerY = Math.round(target.y + target.h / 2);

    return {
      sceneId: scene.id,
      issue: 'cursor',
      adjustments: {
        cursorTo: [centerX, centerY],
      },
      reason: `Frame ${flaw.frameNumber} cursor off target: centered cursor.to at (${centerX}, ${centerY}).`,
    };
  }

  // Fallback for 'other'
  return null;
}

/**
 * Applies a StoryboardPatch to the storyboard, validates with lintStoryboard,
 * and automatically reverts the failing scene if lint fails.
 *
 * Allowed fields: target, camera.zoom, cursor.to, caption.
 * Forbidden: narration, audio, segments, meta.
 */
export function applyStoryboardPatchAndLint(
  storyboard: Storyboard,
  patch: StoryboardPatch
): PatchApplyResult {
  const updatedStoryboard: Storyboard = JSON.parse(JSON.stringify(storyboard));
  const sceneIndex = updatedStoryboard.scenes.findIndex((s) => s.id === patch.sceneId);

  if (sceneIndex === -1) {
    return {
      success: false,
      storyboard,
      lintPassed: false,
      reverted: false,
      actionsTaken: [`Scene ${patch.sceneId} not found in storyboard`],
    };
  }

  // Keep an immutable snapshot of the original scene for instant rollback
  const originalSceneSnapshot: Scene = JSON.parse(
    JSON.stringify(updatedStoryboard.scenes[sceneIndex])
  );
  const targetScene = updatedStoryboard.scenes[sceneIndex];
  const fieldsChanged: string[] = [];

  // Apply allowed adjustments ONLY
  if (patch.adjustments.zoom !== undefined) {
    targetScene.camera = { ...targetScene.camera, zoom: patch.adjustments.zoom };
    fieldsChanged.push(`camera.zoom -> ${patch.adjustments.zoom}`);
  }

  if (patch.adjustments.target !== undefined) {
    targetScene.target = { ...patch.adjustments.target };
    fieldsChanged.push(
      `target -> [${targetScene.target.x}, ${targetScene.target.y}, ${targetScene.target.w}, ${targetScene.target.h}]`
    );
  }

  if (patch.adjustments.cursorTo !== undefined) {
    targetScene.cursor = {
      ...targetScene.cursor,
      to: [patch.adjustments.cursorTo[0], patch.adjustments.cursorTo[1]],
    };
    fieldsChanged.push(`cursor.to -> (${patch.adjustments.cursorTo.join(', ')})`);
  }

  if (patch.adjustments.caption !== undefined) {
    targetScene.caption = patch.adjustments.caption;
    fieldsChanged.push(`caption -> "${patch.adjustments.caption}"`);
  }

  const fieldDesc = fieldsChanged.join(', ');

  // Lint the modified storyboard
  const lint = lintStoryboard(updatedStoryboard);

  if (!lint.valid) {
    // Revert scene and do not call Kane again
    console.warn(`[Visual QA Patch] ❌ Lint failed after applying patch to ${patch.sceneId}:`);
    lint.errors.forEach((e) => console.warn(`   - ${e}`));
    console.warn(`[Visual QA Patch] ↩ Reverting scene ${patch.sceneId} to original snapshot.`);

    updatedStoryboard.scenes[sceneIndex] = originalSceneSnapshot;

    return {
      success: false,
      storyboard: updatedStoryboard,
      patch,
      fieldChanged: fieldDesc,
      lintPassed: false,
      lintErrors: lint.errors,
      reverted: true,
      actionsTaken: [
        `Patch attempted on ${patch.sceneId} (${fieldDesc}) but failed storyboard lint. Reverted scene.`,
      ],
    };
  }

  return {
    success: true,
    storyboard: updatedStoryboard,
    patch,
    fieldChanged: fieldDesc,
    lintPassed: true,
    reverted: false,
    actionsTaken: [`Patched scene ${patch.sceneId}: ${fieldDesc}. Passed lint.`],
  };
}

/**
 * Top-level entrypoint for single-retry visual defect repair.
 */
export function repairVisualDefects(
  storyboard: Storyboard,
  flaws: VisualReviewResult[]
): {
  repaired: boolean;
  storyboard: Storyboard;
  actionsTaken: string[];
  patch?: StoryboardPatch;
  fieldChanged?: string;
  lintPassed: boolean;
  reverted: boolean;
} {
  const activeFlaw = flaws.find((f) => f.flawDetected);
  if (!activeFlaw) {
    return {
      repaired: true,
      storyboard,
      actionsTaken: ['No visual flaws detected.'],
      lintPassed: true,
      reverted: false,
    };
  }

  const timeline = compileAuthoritativeTimeline(storyboard);
  const patch = createStoryboardPatch(storyboard, activeFlaw, timeline);

  if (!patch) {
    return {
      repaired: false,
      storyboard,
      actionsTaken: [`No applicable patch heuristic for flaw on frame ${activeFlaw.frameNumber}`],
      lintPassed: true,
      reverted: false,
    };
  }

  const result = applyStoryboardPatchAndLint(storyboard, patch);

  return {
    repaired: result.success && result.lintPassed,
    storyboard: result.storyboard,
    actionsTaken: result.actionsTaken,
    patch: result.patch,
    fieldChanged: result.fieldChanged,
    lintPassed: result.lintPassed,
    reverted: result.reverted,
  };
}
