import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TargetRect } from '../../src/types';

interface CameraRigProps {
  children: React.ReactNode;
  target: TargetRect;
  zoom?: number;
  startFrame?: number;
  durationInFrames?: number;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  target,
  zoom = 1.0,
  startFrame = 0,
  durationInFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = Math.max(0, frame - startFrame);

  // Eased spring for smooth camera movement
  const zoomProgress = spring({
    frame: relFrame,
    fps,
    config: {
      damping: 18,
      mass: 0.9,
      stiffness: 70,
    },
  });

  // Calculate current zoom level
  const currentZoom = interpolate(zoomProgress, [0, 1], [1.0, zoom]);

  // Center of target element
  const targetCenterX = target.x + target.w / 2;
  const targetCenterY = target.y + target.h / 2;

  // Clamped panning so the 1920x1080 frame edges never pull away from boundaries
  const minTx = 1920 * (1 - currentZoom);
  const minTy = 1080 * (1 - currentZoom);
  const txIdeal = 960 - currentZoom * targetCenterX;
  const tyIdeal = 540 - currentZoom * targetCenterY;

  const tx = currentZoom <= 1.001 ? 0 : Math.max(minTx, Math.min(0, txIdeal));
  const ty = currentZoom <= 1.001 ? 0 : Math.max(minTy, Math.min(0, tyIdeal));

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        transform: `translate(${tx}px, ${ty}px) scale(${currentZoom})`,
        transformOrigin: '0 0',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
