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
      {/* Target Focus Ring */}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          borderRadius: 10,
          border: '2px solid rgba(59, 130, 246, 0.95)',
          boxShadow: `0 0 ${16 + pulse}px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(59, 130, 246, 0.2)`,
          transform: `scale(${interpolate(progress, [0, 1], [0.95, 1.0])})`,
          transition: 'all 0.1s ease-out',
        }}
      >
        {/* Verification Checkmark Pill */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            right: 8,
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            padding: '2px 8px',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>🎯</span> FOCUS
        </div>
      </div>
    </div>
  );
};

