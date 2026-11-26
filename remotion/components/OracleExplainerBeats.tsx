import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AuroraBackground } from './AuroraBackground';
import { LowerThird } from './LowerThird';

const cardBase: React.CSSProperties = {
  backgroundColor: '#0c1322',
  borderRadius: 18,
  padding: '28px 30px',
  boxSizing: 'border-box',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const PackageIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const LockVaultIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <circle cx={12} cy={16} r={1.2} fill={color} />
  </svg>
);

const ShieldAlertIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

/**
 * Beat 0a: Client-contractor milestone dispute with funds locked in escrow.
 */
export const ExplainEscrowBeat: React.FC<{ audioSrc?: string }> = ({ audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const contractorIn = spring({ frame, fps, config: { damping: 15, stiffness: 95 } });
  const vaultIn = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 14, stiffness: 90 } });
  const clientIn = spring({ frame: Math.max(0, frame - 26), fps, config: { damping: 15, stiffness: 95 } });
  const mismatchIn = spring({ frame: Math.max(0, frame - 54), fps, config: { damping: 13, stiffness: 105 } });
  const questionIn = spring({ frame: Math.max(0, frame - 108), fps, config: { damping: 15, stiffness: 85 } });

  const dashOffset = -(frame * 1.4) % 24;
  const vaultPulse = 0.25 + 0.14 * Math.sin(frame * 0.12);

  return (
    <AbsoluteFill style={{ backgroundColor: '#060911' }}>
      <AuroraBackground />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 58,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em' }}>
          THE MILESTONE DISPUTE
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 40, fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          Two conflicting claims. One locked escrow.
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 18, margin: '8px 0 0' }}>
          Deposited milestone funds remain held until objective acceptance evidence exists.
        </p>

        {/* 3-column dispute diagram */}
        <div
          style={{
            position: 'relative',
            marginTop: 48,
            width: 1620,
            height: 430,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Animated SVG dashed connectors behind cards */}
          <svg
            width={1620}
            height={430}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <line
              x1={470}
              y1={215}
              x2={610}
              y2={215}
              stroke="#38bdf8"
              strokeWidth={3}
              strokeDasharray="8 8"
              strokeDashoffset={dashOffset}
              opacity={0.75}
            />
            <line
              x1={1010}
              y1={215}
              x2={1150}
              y2={215}
              stroke="#ef4444"
              strokeWidth={3}
              strokeDasharray="8 8"
              strokeDashoffset={-dashOffset}
              opacity={0.75}
            />
          </svg>

          {/* Left: Contractor */}
          <div
            style={{
              ...cardBase,
              width: 470,
              height: 360,
              border: '1px solid rgba(56, 189, 248, 0.45)',
              opacity: interpolate(contractorIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(contractorIn, [0, 1], [18, 0])}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PackageIcon color="#38bdf8" />
                <span style={{ color: '#38bdf8', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>
                  CONTRACTOR
                </span>
              </div>
              <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, marginTop: 18, lineHeight: 1.3 }}>
                Submits delivery & claims feature is complete.
              </div>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: interpolate(mismatchIn, [0, 1], [0.25, 1]),
              }}
            >
              <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>Dashboard UI</span>
              <span style={{ color: '#4ade80', fontSize: 16, fontWeight: 800 }}>Invoice Approved</span>
            </div>
          </div>

          {/* Center: Locked Escrow Vault */}
          <div
            style={{
              ...cardBase,
              width: 400,
              height: 390,
              border: '1.5px solid rgba(245, 158, 11, 0.65)',
              boxShadow: `0 0 54px rgba(245, 158, 11, ${vaultPulse})`,
              opacity: interpolate(vaultIn, [0, 1], [0, 1]),
              transform: `scale(${interpolate(vaultIn, [0, 1], [0.92, 1])})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                border: '1.5px solid rgba(245, 158, 11, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockVaultIcon color="#fbbf24" />
            </div>
            <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>
              MILESTONE FUNDS
            </div>
            <div style={{ color: '#f8fafc', fontSize: 30, fontWeight: 900 }}>
              Locked in Escrow
            </div>
            <div style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.45, maxWidth: 310 }}>
              Deposited upfront &amp; still held. Evidence decides payout before transfer.
            </div>
          </div>

          {/* Right: Client */}
          <div
            style={{
              ...cardBase,
              width: 470,
              height: 360,
              border: '1px solid rgba(239, 68, 68, 0.45)',
              opacity: interpolate(clientIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(clientIn, [0, 1], [18, 0])}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldAlertIcon color="#f87171" />
                <span style={{ color: '#f87171', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>
                  CLIENT
                </span>
              </div>
              <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, marginTop: 18, lineHeight: 1.3 }}>
                Funded milestone; cannot prove it actually works.
              </div>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.55)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: interpolate(mismatchIn, [0, 1], [0.25, 1]),
              }}
            >
              <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>Actual Check</span>
              <span style={{ color: '#f87171', fontSize: 16, fontWeight: 800 }}>Invoice Pending</span>
            </div>
          </div>
        </div>

        {/* Central question callout */}
        <div
          style={{
            marginTop: 28,
            padding: '14px 28px',
            borderRadius: 999,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#f8fafc',
            fontSize: 22,
            fontWeight: 700,
            opacity: interpolate(questionIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(questionIn, [0, 1], [10, 0])}px)`,
          }}
        >
          Should escrow release the money?
        </div>

        <div style={{ marginTop: 14, color: '#64748b', fontSize: 13, fontWeight: 500 }}>
          Illustrative scenario — not a captured Oracle test result.
        </div>
      </div>

      <LowerThird caption="Milestone funds locked in escrow · Conflicting claims need proof" tone="policy" />
      <Sequence from={54}>
        <Audio src={staticFile('sfx-click.wav')} volume={0.4} />
      </Sequence>
      {audioSrc ? (
        <Sequence from={6}>
          <Audio src={audioSrc.startsWith('http') ? audioSrc : staticFile(audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Beat 0b: How AutoCast Oracle fits in + 1 frozen spec across C_bug and C_fix.
 */
export const ExplainWorkflowBeat: React.FC<{ audioSrc?: string; specSha256?: string }> = ({ audioSrc, specSha256 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const steps = [
    { num: '01', title: 'Frozen Spec', sub: 'Acceptance rules hashed', color: '#38bdf8' },
    { num: '02', title: 'Pinned Commit', sub: 'git archive SHA', color: '#38bdf8' },
    { num: '03', title: 'Kane Check', sub: 'Verbatim objective', color: '#60a5fa' },
    { num: '04', title: 'Assertions', sub: 'UI + API state checks', color: '#22c55e' },
    { num: '05', title: 'Signed Verdict', sub: 'Ed25519 HOLD / RELEASE', color: '#f59e0b' },
  ];

  const lineProgress = interpolate(frame, [6, 96], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const twinIn = spring({ frame: Math.max(0, frame - 85), fps, config: { damping: 14, stiffness: 88 } });
  const shortSpec = specSha256 ? `${specSha256.slice(0, 10)}…${specSha256.slice(-6)}` : 'spec_sha256';

  return (
    <AbsoluteFill style={{ backgroundColor: '#060911' }}>
      <AuroraBackground />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 58,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em' }}>
          AUTOCAST ORACLE
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 40, fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          Impartial verification without touching contractor code.
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 18, margin: '8px 0 0' }}>
          One pre-agreed AcceptanceSpec evaluates each submitted commit independently.
        </p>

        {/* 5-step pipeline with progressive SVG connector */}
        <div style={{ position: 'relative', marginTop: 46, width: 1640, height: 190 }}>
          <svg width={1640} height={190} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <line
              x1={160}
              y1={95}
              x2={1480}
              y2={95}
              stroke="rgba(56, 189, 248, 0.2)"
              strokeWidth={4}
            />
            <line
              x1={160}
              y1={95}
              x2={1480}
              y2={95}
              stroke="#38bdf8"
              strokeWidth={4}
              strokeDasharray={1320}
              strokeDashoffset={1320 * (1 - lineProgress)}
            />
          </svg>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', paddingTop: 22 }}>
            {steps.map((step, index) => {
              const s = spring({
                frame: Math.max(0, frame - index * 14),
                fps,
                config: { damping: 14, stiffness: 105 },
              });
              return (
                <div
                  key={step.num}
                  style={{
                    ...cardBase,
                    width: 292,
                    height: 146,
                    padding: '18px 20px',
                    border: `1px solid ${step.color}66`,
                    opacity: interpolate(s, [0, 1], [0.1, 1]),
                    transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px)`,
                  }}
                >
                  <div style={{ color: step.color, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em' }}>
                    STEP {step.num}
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: 22, fontWeight: 800, marginTop: 8 }}>{step.title}</div>
                  <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 6 }}>{step.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Twin evaluation preview: 1 frozen contract -> C_bug HOLD vs C_fix RELEASE */}
        <div
          style={{
            marginTop: 42,
            width: 1320,
            opacity: interpolate(twinIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(twinIn, [0, 1], [16, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              padding: '10px 24px',
              borderRadius: 999,
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              color: '#38bdf8',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ONE FROZEN ACCEPTANCESPEC · {shortSpec} · ZERO CODE CHANGES
          </div>

          <div style={{ display: 'flex', gap: 36, width: '100%', justifyContent: 'center' }}>
            <div
              style={{
                ...cardBase,
                width: 600,
                padding: '22px 26px',
                border: '1px solid rgba(239, 68, 68, 0.55)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#f87171', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>
                  EVALUATION 1 · C_bug
                </div>
                <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  Original buggy delivery
                </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Signed failure verdict</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#ef4444', fontSize: 34, fontWeight: 900 }}>HOLD</div>
                <div style={{ color: '#fca5a5', fontFamily: 'ui-monospace, monospace', fontSize: 16 }}>
                  Kane 740
                </div>
              </div>
            </div>

            <div
              style={{
                ...cardBase,
                width: 600,
                padding: '22px 26px',
                border: '1px solid rgba(34, 197, 94, 0.55)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>
                  EVALUATION 2 · C_fix
                </div>
                <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  Corrected delivery
                </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Signed acceptance verdict</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#22c55e', fontSize: 34, fontWeight: 900 }}>RELEASE</div>
                <div style={{ color: '#86efac', fontFamily: 'ui-monospace, monospace', fontSize: 16 }}>
                  Kane 100
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LowerThird caption="Two deliveries · One frozen contract · Zero code modification" tone="neutral" />
      {audioSrc ? (
        <Sequence from={6}>
          <Audio src={audioSrc.startsWith('http') ? audioSrc : staticFile(audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
