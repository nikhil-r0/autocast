import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene } from '../../src/types';

const chipStyle = (color: string): React.CSSProperties => ({
  padding: '3px 8px',
  borderRadius: 6,
  backgroundColor: `${color}22`,
  border: `1px solid ${color}66`,
  color,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
});

const OracleChipRow: React.FC<{ oracle: OracleHudChips }> = ({ oracle }) => {
  const verdictColor = oracle.verdict === 'release' ? '#22c55e' : '#ef4444';
  const stateColor = oracle.stateVerified ? '#22c55e' : '#ef4444';
  return (
    <>
      <span style={chipStyle(verdictColor)}>ORACLE {oracle.verdict.toUpperCase()}</span>
      <span style={chipStyle('#38bdf8')}>KANE {oracle.resultCode}</span>
      <span style={chipStyle(stateColor)}>STATE {oracle.stateVerified ? 'TRUE' : 'FALSE'}</span>
      <span style={chipStyle('#f59e0b')}>REPAIR {oracle.repairOccurred ? 'TRUE' : 'FALSE'}</span>
    </>
  );
};

interface OracleHudChips {
  verdict: 'release' | 'hold';
  resultCode: number;
  stateVerified: boolean;
  repairOccurred: boolean;
}

interface FloatingHudProps {
  scene?: Scene;
  stepNumber?: number;
  totalSteps?: number;
  title?: string;
  oracle?: OracleHudChips;
}

export const FloatingHud: React.FC<FloatingHudProps> = ({
  scene,
  stepNumber,
  totalSteps,
  title,
  oracle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 85, mass: 0.9 },
  });

  const translateY = interpolate(entrance, [0, 1], [30, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 36,
        right: 48,
        width: oracle ? 760 : 440,
        backgroundColor: 'rgba(13, 19, 31, 0.88)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 25px rgba(59, 130, 246, 0.15)',
        padding: '16px 20px',
        boxSizing: 'border-box',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transform: `translateY(${translateY}px)`,
        opacity,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Header: Verified Pill + Step Counter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {oracle ? (
            <OracleChipRow oracle={oracle} />
          ) : (
            <div
              style={{
                padding: '2px 8px',
                borderRadius: 6,
                backgroundColor: 'rgba(16, 185, 129, 0.18)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>✓</span> Kane Verified
            </div>
          )}
          <span style={{ fontSize: 11, color: '#64748b' }}>Autocast AI</span>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#38bdf8',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: 0.5,
          }}
        >
          {oracle ? oracle.verdict.toUpperCase() : `STEP ${stepNumber}/${totalSteps}`}
        </div>
      </div>

      {/* Caption Headline */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#ffffff',
          lineHeight: 1.3,
          marginBottom: 4,
        }}
      >
        {scene?.caption ?? title}
      </div>

      {/* Narration Description */}
      {!oracle && scene?.narration && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: '#94a3b8',
          }}
        >
          {scene.narration}
        </div>
      )}
    </div>
  );
};

