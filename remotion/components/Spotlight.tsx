import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface SpotlightProps {
  target: { x: number; y: number; w: number; h: number };
  active: boolean;
  durationInFrames: number;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  target,
  active,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Don't spotlight full page or wide table views
  if (!active || target.w >= 1200 || target.h >= 800 || target.w <= 0 || target.h <= 0) {
    return null;
  }

  // Smooth entrance: start 10 frames in, settle smoothly
  const progress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 15, stiffness: 90 },
  });

  const opacity = interpolate(
    frame,
    [8, 16, durationInFrames - 10, durationInFrames - 2],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const padding = 10;
  const left = Math.max(0, target.x - padding);
  const top = Math.max(0, target.y - padding);
  const width = target.w + padding * 2;
  const height = target.h + padding * 2;

  const pulse = Math.sin(frame * 0.12) * 4;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
        opacity,
      }}
    >
      {/* Target Focus Ring - Non-intrusive elegant luminous aura */}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          borderRadius: 10,
          border: '1.5px solid rgba(59, 130, 246, 0.75)',
          boxShadow: `0 0 ${12 + pulse}px rgba(59, 130, 246, 0.4), inset 0 0 8px rgba(59, 130, 246, 0.15)`,
          transform: `scale(${interpolate(progress, [0, 1], [0.96, 1.0])})`,
        }}
      />
    </div>
  );
};

