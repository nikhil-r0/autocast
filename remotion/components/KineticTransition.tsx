import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface KineticTransitionProps {
  durationInFrames: number;
  leadFrames?: number;
  flareColor?: string;
}

export const KineticTransition: React.FC<KineticTransitionProps> = ({
  durationInFrames,
  leadFrames = 8,
  flareColor = '#38bdf8',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance flare / wipe (first leadFrames)
  const isCutIn = frame < leadFrames;
  // Exit fade anticipation (last 5 frames)
  const isCutOut = frame >= durationInFrames - 5;

  if (!isCutIn && !isCutOut) return null;

  if (isCutIn) {
    const flareOpacity = interpolate(frame, [0, 2, leadFrames], [0.85, 0.6, 0]);

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 40,
        }}
      >
        {/* Soft radial cut flash */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 50% 50%, rgba(56, 189, 248, ${flareOpacity * 0.25}) 0%, transparent 70%)`,
          }}
        />
      </div>
    );
  }

  // Cut-out anticipation
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 5, durationInFrames],
    [0, 0.15],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#070b14',
        opacity: exitOpacity,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  );
};

