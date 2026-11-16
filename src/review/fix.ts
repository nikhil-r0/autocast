import { Storyboard } from '../types.js';
import { VisualReviewResult } from './kaneReview.js';

export interface RepairResult {
  repaired: boolean;
  storyboard: Storyboard;
  actionsTaken: string[];
}

/**
 * Autonomous repair module for Loop 3 visual QA defects.
 * Adjusts camera parameters, zoom clamps, or margins when Kane detects visual issues.
 */
export function repairVisualDefects(
  storyboard: Storyboard,
  flaws: VisualReviewResult[]
): RepairResult {
  let repaired = false;
  const actionsTaken: string[] = [];
  const updatedStoryboard: Storyboard = JSON.parse(JSON.stringify(storyboard));

  for (const flaw of flaws) {
    if (!flaw.flawDetected) continue;

    const summary = (flaw.summary || '').toLowerCase();

    // Case 1: Viewport clipping or edge cropping detected
    if (summary.includes('cut off') || summary.includes('clip') || summary.includes('wider than')) {
      for (const scene of updatedStoryboard.scenes) {
        if (scene.camera.zoom > 1.0) {
          const oldZoom = scene.camera.zoom;
          // Clamp zoom to avoid out-of-bounds translation
          scene.camera.zoom = 1.0;
          actionsTaken.push(`Clamped scene ${scene.id} camera zoom from ${oldZoom} to 1.0 to prevent edge clipping.`);
          repaired = true;
        }
      }
    }

    // Case 2: Typography overlap or sidebar collision
    if (summary.includes('overlap') || summary.includes('sidebar')) {
      for (const scene of updatedStoryboard.scenes) {
        if (scene.target.w > 1200) {
          scene.target.w = 1100;
          actionsTaken.push(`Reduced scene ${scene.id} target width to 1100px to maintain sidebar clearance.`);
          repaired = true;
        }
      }
    }
  }

  return {
    repaired,
    storyboard: updatedStoryboard,
    actionsTaken,
  };
}

