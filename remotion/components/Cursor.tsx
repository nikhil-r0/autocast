import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface CursorProps {
  from: [number, number];
  to: [number, number];
  click?: boolean;
  startFrame?: number;
  durationInFrames?: number;
}

export const Cursor: React.FC<CursorProps> = ({
  from,
  to,
  click = true,
  startFrame = 0,
  durationInFrames = 45,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = Math.max(0, frame - startFrame);

  // Smooth movement spring
  const moveProgress = spring({
    frame: relFrame,
    fps,
    config: {
      damping: 18,
      mass: 0.8,
      stiffness: 90,
    },
  });

  const currentX = interpolate(moveProgress, [0, 1], [from[0], to[0]]);
  const currentY = interpolate(moveProgress, [0, 1], [from[1], to[1]]);

  // Click timing: happens right when spring settles (~frame 24)
  const clickStartFrame = Math.floor(durationInFrames * 0.55);
  const clickProgress = interpolate(
    relFrame,
    [clickStartFrame, clickStartFrame + 18],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const rippleScale = interpolate(clickProgress, [0, 1], [0.5, 2.2]);
  const rippleOpacity = interpolate(clickProgress, [0, 0.2, 1], [0, 0.8, 0]);
  const bounce = click
    ? interpolate(
        relFrame,
        [clickStartFrame, clickStartFrame + 3, clickStartFrame + 10],
        [1, 0.82, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: currentX,
        top: currentY,
        pointerEvents: 'none',
        zIndex: 9999,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Ripple Animation */}
      {click && relFrame >= clickStartFrame && (
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            transform: `translate(-50%, -50%) scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* Modern Cursor SVG */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.5))',
          scale: bounce,
        }}
      >
        <path
          d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z"
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

