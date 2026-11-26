import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface OracleGate {
  label: string;
  passed: boolean;
}

export const OracleGateList: React.FC<{ gates: OracleGate[]; durationInFrames: number; width?: number }> = ({
  gates,
  durationInFrames,
  width = 860,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tail = Math.round(fps * 0.5);
  const window = Math.max(fps, durationInFrames - tail);
  const step = gates.length > 0 ? window / gates.length : window;

  return (
    <div
      style={{
        width,
        height: 560,
        backgroundColor: '#0c1322',
        borderRadius: 16,
        border: '1px solid rgba(56, 189, 248, 0.35)',
        padding: '22px 26px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 800, letterSpacing: 1.2, marginBottom: 6 }}>
        {gates.length} PAYMENT GATES
      </div>
      {gates.map((gate, index) => {
        const start = Math.round(index * step);
        const entrance = spring({
          frame: Math.max(0, frame - start),
          fps,
          config: { damping: 16, stiffness: 120 },
        });
        const opacity = interpolate(entrance, [0, 1], [0.15, 1]);
        const color = gate.passed ? '#22c55e' : '#ef4444';
        return (
          <div
            key={gate.label}
            style={{
              opacity,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            <span style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600 }}>{gate.label}</span>
            <span style={{ color, fontSize: 14, fontWeight: 800, letterSpacing: 0.6 }}>
              {frame >= start ? (gate.passed ? 'PASS' : 'FAIL') : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};
