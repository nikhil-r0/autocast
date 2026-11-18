import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface KaneCardProps {
  status: 'failed' | 'passed';
  resultCode: number;
  taskTitle: string;
  durationText?: string;
  stepsCount?: number;
  creditsUsed?: string;
  summaryText: string;
  details?: Array<{ label: string; value: string }>;
  width?: number;
}

export const KaneCard: React.FC<KaneCardProps> = ({
  status,
  resultCode,
  taskTitle,
  durationText = '1m 24s',
  stepsCount = 6,
  creditsUsed = '1.25',
  summaryText,
  details,
  width = 960,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const scale = interpolate(entrance, [0, 1], [0.94, 1.0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const isPass = status === 'passed';
  const accentColor = isPass ? '#22c55e' : '#ef4444';
  const badgeBg = isPass ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const badgeBorder = isPass ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';

  return (
    <div
      style={{
        width,
        backgroundColor: '#0c1322',
        borderRadius: 16,
        border: `1px solid ${badgeBorder}`,
        boxShadow: `0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 40px ${badgeBg}`,
        padding: '24px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        transform: `scale(${scale})`,
        opacity,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Bar with Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: accentColor,
              boxShadow: `0 0 12px ${accentColor}`,
            }}
          />
          <span style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Kane CLI Verification Result
          </span>
        </div>
        <div
          style={{
            backgroundColor: badgeBg,
            border: `1px solid ${badgeBorder}`,
            color: accentColor,
            padding: '5px 14px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{isPass ? 'PASS' : 'FAIL'}</span>
          <span>·</span>
          <span>Result Code {resultCode}</span>
        </div>
      </div>

      {/* Task & Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          padding: '14px 18px',
          borderRadius: 10,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div>
          <div style={{ color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Task</div>
          <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500, marginTop: 4 }}>{taskTitle}</div>
        </div>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Duration / Steps</div>
          <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500, marginTop: 4 }}>{durationText} · {stepsCount} steps</div>
        </div>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>Credits Consumed</div>
          <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 500, marginTop: 4 }}>{creditsUsed} credits</div>
        </div>
      </div>

      {/* Summary / RCA */}
      <div
        style={{
          backgroundColor: isPass ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          borderLeft: `4px solid ${accentColor}`,
          padding: '12px 16px',
          borderRadius: 6,
        }}
      >
        <div style={{ color: accentColor, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
          {isPass ? '✓ Independent Proof of Correctness' : '⚠ Root Cause Analysis'}
        </div>
        <div style={{ color: '#f3f4f6', fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>
          {summaryText}
        </div>
      </div>

      {/* Details checklist */}
      {details && details.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {details.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#9ca3af' }}>{d.label}</span>
              <span style={{ color: isPass ? '#86efac' : '#fca5a5', fontWeight: 600 }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

