import { AuthoritativeTimeline, CompiledScene, Storyboard } from '../types.js';

export const TITLE_FRAMES = 75; // 2.5 seconds at 30fps
export const OUTRO_FRAMES = 75; // 2.5 seconds at 30fps

/**
 * Compiles a Storyboard into an Authoritative Shared Timeline.
 * This authoritative timeline drives Remotion rendering and frame-to-scene mapping.
 */
export function compileAuthoritativeTimeline(storyboard: Storyboard): AuthoritativeTimeline {
  const fps = storyboard.meta?.fps || 30;
  const scenes = storyboard.scenes || [];

  let currentFrame = TITLE_FRAMES;
  const compiledScenes: CompiledScene[] = [];

  for (const scene of scenes) {
    const durationFrames = Math.round((scene.audio_sec || 3.5) * fps);
    const startFrame = currentFrame;
    const endFrame = startFrame + durationFrames;

    const zoom = scene.camera?.zoom ?? 1.0;
    const target = scene.target || { x: 0, y: 0, w: 1920, h: 1080 };

    // Clamped pan calculation consistent with CameraRig
    const isWide = target.w > 900;
    const effectiveZoom = isWide ? 1.0 : Math.min(2.0, zoom);
    const targetCenterX = target.x + target.w / 2;
    const targetCenterY = target.y + target.h / 2;

    const minTx = 1920 * (1 - effectiveZoom);
    const minTy = 1080 * (1 - effectiveZoom);
    const txIdeal = 960 - effectiveZoom * targetCenterX;
    const tyIdeal = 540 - effectiveZoom * targetCenterY;

    const panX = Math.max(minTx, Math.min(0, txIdeal));
    const panY = Math.max(minTy, Math.min(0, tyIdeal));

    compiledScenes.push({
      sceneId: scene.id,
      startFrame,
      endFrame,
      durationFrames,
      camera: {
        zoom: effectiveZoom,
        panX: Math.round(panX),
        panY: Math.round(panY),
      },
      targetRect: { ...target },
    });

    currentFrame += durationFrames;
  }

  const totalDurationFrames = currentFrame + OUTRO_FRAMES;

  return {
    fps,
    totalDurationFrames,
    scenes: compiledScenes,
  };
}

/**
 * Map a specific frame number to its authoritative compiled scene.
 * Returns undefined if the frame belongs to the title card or outro.
 */
export function lookupSceneForFrame(
  timeline: AuthoritativeTimeline,
  frameNumber: number
): CompiledScene | undefined {
  for (const compiled of timeline.scenes) {
    if (frameNumber >= compiled.startFrame && frameNumber < compiled.endFrame) {
      return compiled;
    }
  }

  // If outside exact range, find closest scene (e.g. at transition boundaries)
  if (timeline.scenes.length > 0) {
    if (frameNumber < timeline.scenes[0].startFrame) {
      return timeline.scenes[0];
    }
    const last = timeline.scenes[timeline.scenes.length - 1];
    if (frameNumber >= last.endFrame) {
      return last;
    }
  }

  return undefined;
}

