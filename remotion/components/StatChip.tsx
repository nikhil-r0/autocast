import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface StatChipProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
  durationInFrames: number;
}

export const StatChip: React.FC<StatChipProps> = ({
  currentStep,
  totalSteps,
  label = 'Kane Verified',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 6, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 30,
        opacity,
        transform: `translateY(${interpolate(entrance, [0, 1], [-10, 0])}px)`,
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Step Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: 20,
          padding: '6px 14px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          STEP {currentStep}/{totalSteps}
        </span>
      </div>

      {/* Verification Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(5, 150, 105, 0.2)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 20,
          padding: '6px 14px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ color: '#34d399', fontSize: 14 }}>✓</span>
        <span style={{ color: '#ecfdf5', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

