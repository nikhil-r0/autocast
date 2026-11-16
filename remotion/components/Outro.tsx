import React from 'react';
import {
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { NumberTicker } from './NumberTicker';

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

  // Stamp bounce animation on frame 12
  const stampSpring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const stampScale = interpolate(stampSpring, [0, 1], [1.6, 1.0]);
  const stampGlow = interpolate(
    Math.max(0, frame - 12),
    [0, 6, 25],
    [0, 1, 0.4],
    { extrapolateRight: 'clamp' }
  );

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
        backgroundImage:
          'radial-gradient(ellipse at 50% 30%, #0d1e3d 0%, #070b14 80%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        zIndex: 50,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient color bursts */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 600,
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(56, 189, 248, 0.1) 40%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 1020,
          width: '100%',
          padding: '0 32px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Verification Status Header with Stamp Physics */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            borderRadius: 30,
            padding: '8px 24px',
            marginBottom: 20,
            boxShadow: `0 0 30px rgba(16, 185, 129, ${stampGlow * 0.5})`,
            transform: `scale(${frame >= 12 ? stampScale : 1})`,
          }}
        >
          <span style={{ color: '#34d399', fontSize: 18 }}>🛡️</span>
          <span
            style={{
              color: '#6ee7b7',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {passedCount}/{totalClaims} Claims Formally Verified by Kane CLI
          </span>
        </div>

        {/* Shimmering Title */}
        <h1
          style={{
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: -1,
            margin: '0 0 8px 0',
            textAlign: 'center',
            background:
              'linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #6ee7b7 80%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 19,
            fontWeight: 500,
            color: '#94a3b8',
            margin: '0 0 24px 0',
            textAlign: 'center',
          }}
        >
          Autocast AI &bull;{' '}
          <span
            style={{
              color: '#38bdf8',
              fontWeight: 700,
              textShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
            }}
          >
            Demos that can't lie.
          </span>
        </p>

        {/* Hero Rolling Stat Ticker Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '12px 24px',
            boxSizing: 'border-box',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#6ee7b7',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Audited Ledger Amount Reconciled
            </span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              Cryptographic integrity confirmed against banking snapshot
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              color: '#34d399',
              fontSize: 32,
              fontWeight: 900,
              textShadow: '0 0 18px rgba(52, 211, 153, 0.45)',
            }}
          >
            <NumberTicker
              value={4850}
              startValue={0}
              prefix="$"
              decimals={2}
              startFrame={10}
              durationFrames={45}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7' }}>
              USD
            </span>
          </div>
        </div>

        {/* Verified Claims Card */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: '20px 24px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: 12,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#64748b',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Autonomous Execution Trace Verification
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'ui-monospace, monospace',
                color: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              kane-session: {runId}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {verifiedClaims.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      color: '#34d399',
                      fontSize: 15,
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      color: '#e2e8f0',
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontFamily: 'ui-monospace, monospace',
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
            gap: 20,
            fontSize: 13,
            color: '#64748b',
          }}
        >
          <span>
            Engine: <strong style={{ color: '#cbd5e1' }}>Remotion 30fps</strong>
          </span>
          <span>&bull;</span>
          <span>
            Driver:{' '}
            <strong style={{ color: '#cbd5e1' }}>Kane CLI Vision</strong>
          </span>
          <span>&bull;</span>
          <span>
            Repo:{' '}
            <strong style={{ color: '#38bdf8' }}>
              github.com/nikhil-r0/autocast
            </strong>
          </span>
        </div>
      </div>

      {/* Tactile stamp audio trigger */}
      <Sequence from={12}>
        <Audio src={staticFile('sfx-stamp.wav')} volume={0.7} />
      </Sequence>
    </div>
  );
};
