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
    const progress = interpolate(frame, [0, leadFrames], [0, 1], {
      extrapolateRight: 'clamp',
    });

    const flareOpacity = interpolate(frame, [0, 2, leadFrames], [0.85, 0.6, 0]);
    const flareWidth = interpolate(frame, [0, leadFrames], [1920 * 0.4, 1920 * 1.2]);
    const sweepX = interpolate(frame, [0, leadFrames], [-200, 2120]);

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

        {/* Anamorphic horizontal light flare streak */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: sweepX - flareWidth / 2,
            width: flareWidth,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${flareColor}, #ffffff, #c084fc, transparent)`,
            boxShadow: `0 0 16px 4px ${flareColor}, 0 0 32px 8px rgba(192, 132, 252, 0.5)`,
            opacity: flareOpacity,
            transform: 'translateY(-50%)',
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

