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
  const window = Math.max(fps, Math.round((durationInFrames - tail) * 0.65));
  const step = gates.length > 0 ? window / gates.length : window;
  const gate10Blocked = gates.length > 0 && !gates[gates.length - 1].passed;
  const gate10Reveal = frame >= Math.round(window * 0.85);

  return (
    <div
      style={{
        width,
        height: 560,
        backgroundColor: '#0c1322',
        borderRadius: 16,
        border: '1px solid rgba(56, 189, 248, 0.35)',
        padding: '18px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 800, letterSpacing: 1.2 }}>
          RELEASE VERIFICATION ({gates.length} GATES)
        </span>
        {gate10Blocked ? (
          <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 800, letterSpacing: 0.8 }}>
            GATES 1–9 VERIFIED · GATE 10 NOT CLEARED
          </span>
        ) : null}
      </div>
      {gates.map((gate, index) => {
        const start = Math.round(index * step);
        const entrance = spring({
          frame: Math.max(0, frame - start),
          fps,
          config: { damping: 16, stiffness: 120 },
        });
        const opacity = interpolate(entrance, [0, 1], [0.4, 1]);
        const isFailedLast = !gate.passed;
        const color = gate.passed ? '#22c55e' : '#ef4444';
        return (
          <div
            key={gate.label}
            style={{
              opacity,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              borderRadius: 8,
              border: isFailedLast ? '1px solid rgba(239, 68, 68, 0.55)' : '1px solid transparent',
              backgroundColor: isFailedLast ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <span style={{ color: '#e5e7eb', fontSize: 17, fontWeight: 600 }}>
              {index + 1}. {gate.label}
            </span>
            <span style={{ color, fontSize: 13, fontWeight: 900, letterSpacing: 0.6 }}>
              {frame >= start ? (gate.passed ? 'VERIFIED' : 'NOT CLEARED') : ''}
            </span>
          </div>
        );
      })}
      {gate10Blocked ? (
        <div
          style={{
            marginTop: 4,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.7)',
            backgroundColor: 'rgba(239, 68, 68, 0.16)',
            color: '#fca5a5',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.8,
            textAlign: 'center',
            opacity: gate10Reveal ? 1 : 0.25,
          }}
        >
          NOT AUTHORIZED FOR REAL FUNDS — BETA LACKS CONTAINER ISOLATION
        </div>
      ) : null}
    </div>
  );
};
