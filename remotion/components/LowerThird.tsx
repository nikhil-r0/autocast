import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene } from '../../src/types';

interface LowerThirdProps {
  scene: Scene;
  stepNumber: number;
  totalSteps: number;
  style?: React.CSSProperties;
}

export const LowerThird: React.FC<LowerThirdProps> = ({
  scene,
  stepNumber,
  totalSteps,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Snappy spring entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 90, mass: 0.8 },
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 18px',
        borderRadius: 12,
        backgroundColor: 'rgba(10, 15, 29, 0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow:
          '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 20px rgba(56, 189, 248, 0.15)',
        transform: `translateY(${translateY}px)`,
        opacity,
        pointerEvents: 'none',
        zIndex: 30,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 720,
        ...style,
      }}
    >
      {/* Step Indicator Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 6,
          padding: '4px 10px',
          color: '#38bdf8',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        <span>STEP {stepNumber}/{totalSteps}</span>
      </div>

      {/* Caption Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            color: '#f8fafc',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: -0.2,
          }}
        >
          {scene.caption}
        </div>
        {scene.narration && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 500,
            }}
          >
            {scene.narration}
          </div>
        )}
      </div>

      {/* Kane Verified Shield */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: '#34d399',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          padding: '3px 8px',
          borderRadius: 6,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          flexShrink: 0,
        }}
      >
        <span>✓</span> VERIFIED
      </div>
    </div>
  );
};

