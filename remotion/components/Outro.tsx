import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface OutroProps {
  title?: string;
  runId?: string;
  passedCount?: number;
  totalClaims?: number;
}

export const Outro: React.FC<OutroProps> = ({
  title = 'Invoice Approval Workflow',
  runId = '837393b8-8840-4286-bf76',
  passedCount = 4,
  totalClaims = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(entrance, [0, 1], [0.94, 1.0]);

  const verifiedClaims = [
    { text: 'Invoice approved in 3 verified browser clicks', status: 'PASS' },
    { text: 'Ledger line items reconciled ($4,850.00 total)', status: 'PASS' },
    { text: 'Cryptographic compliance badge confirmed visible', status: 'PASS' },
    { text: 'Loop 3 Vision QA: zero element clipping or defects', status: 'PASS' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#070b14',
        backgroundImage: 'radial-gradient(circle at 50% 30%, #0f1d3a 0%, #070b14 75%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        zIndex: 50,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 960,
          width: '100%',
          padding: '0 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Verification Status Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 30,
            padding: '8px 22px',
            marginBottom: 20,
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          }}
        >
          <span style={{ color: '#34d399', fontSize: 18 }}>🛡️</span>
          <span
            style={{
              color: '#6ee7b7',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {passedCount}/{totalClaims} Claims Formally Verified by Kane CLI
          </span>
        </div>

        <h1
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: -1,
            color: '#ffffff',
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: '#94a3b8',
            margin: '0 0 32px 0',
            textAlign: 'center',
          }}
        >
          Autocast AI &bull; <span style={{ color: '#38bdf8' }}>Demos that can't lie.</span>
        </p>

        {/* Verified Claims Card */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: '24px 28px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: 14,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Execution Trace Verification
            </span>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#38bdf8' }}>
              kane-session: {runId}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {verifiedClaims.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#34d399', fontSize: 16, fontWeight: 800 }}>✓</span>
                  <span style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 500 }}>
                    {item.text}
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Meta */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 14,
            color: '#64748b',
          }}
        >
          <span>Engine: <strong style={{ color: '#cbd5e1' }}>Remotion 30fps</strong></span>
          <span>&bull;</span>
          <span>Driver: <strong style={{ color: '#cbd5e1' }}>Kane CLI Vision</strong></span>
          <span>&bull;</span>
          <span>Repo: <strong style={{ color: '#38bdf8' }}>github.com/nikhil-r0/autocast</strong></span>
        </div>
      </div>
    </div>
  );
};
