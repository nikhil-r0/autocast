import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { shortHash } from '../oracle/format';
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

const PackageIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

const ShieldCheckIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/**
 * Scene 01 (426f / ~14s): Escrow milestone dispute synced to a1.mp3 cues:
 *  - 0..95f: Contractor, Client, Central Locked Vault
 *  - 105..170f: Delivery package moves from Contractor toward Client
 *  - 180..240f: Dashboard says Approved
 *  - 245..310f: Actual check still fails (Pending)
 *  - 315..end: "Should the money be released?"
 */
export const ExplainEscrowBeat: React.FC<{ audioSrc?: string }> = ({ audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introIn = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const vaultIn = spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 15, stiffness: 88 } });
  const clientIn = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 16, stiffness: 90 } });
  const packageTravel = interpolate(frame, [105, 168], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const packageOpacity = interpolate(frame, [96, 112, 162, 180], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const approvedClaim = spring({ frame: Math.max(0, frame - 178), fps, config: { damping: 14, stiffness: 110 } });
  const pendingCheck = spring({ frame: Math.max(0, frame - 246), fps, config: { damping: 14, stiffness: 110 } });
  const questionIn = spring({ frame: Math.max(0, frame - 315), fps, config: { damping: 14, stiffness: 92 } });

  const dashOffset = -(frame * 1.3) % 24;
  const vaultPulse = 0.24 + 0.14 * Math.sin(frame * 0.1);
  const pkgX = interpolate(packageTravel, [0, 1], [485, 1105]);

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
          Milestone funds stay deposited and locked until trustworthy proof exists.
        </p>

        <div
          style={{
            position: 'relative',
            marginTop: 46,
            width: 1620,
            height: 430,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <svg width={1620} height={430} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <line x1={470} y1={215} x2={610} y2={215} stroke="#38bdf8" strokeWidth={3} strokeDasharray="8 8" strokeDashoffset={dashOffset} opacity={0.7} />
            <line x1={1010} y1={215} x2={1150} y2={215} stroke="#ef4444" strokeWidth={3} strokeDasharray="8 8" strokeDashoffset={-dashOffset} opacity={0.7} />
            <path d="M 455 110 Q 810 42 1165 110" fill="none" stroke="rgba(56, 189, 248, 0.25)" strokeWidth={2} strokeDasharray="6 6" />
          </svg>

          {/* Moving delivery package from Contractor toward Client */}
          <div
            style={{
              position: 'absolute',
              left: pkgX,
              top: 56,
              opacity: packageOpacity,
              backgroundColor: '#0c1322',
              border: '1px solid #38bdf8',
              borderRadius: 12,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 12,
              boxShadow: '0 0 24px rgba(56, 189, 248, 0.35)',
            }}
          >
            <PackageIcon color="#38bdf8" size={20} />
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
              delivery.tar
            </span>
          </div>

          {/* Left: Contractor */}
          <div
            style={{
              ...cardBase,
              width: 470,
              height: 360,
              border: '1px solid rgba(56, 189, 248, 0.45)',
              opacity: interpolate(introIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(introIn, [0, 1], [16, 0])}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PackageIcon color="#38bdf8" />
                <span style={{ color: '#38bdf8', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>CONTRACTOR</span>
              </div>
              <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, marginTop: 18, lineHeight: 1.3 }}>
                Submits milestone &amp; claims delivery is complete.
              </div>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(34, 197, 94, 0.14)',
                border: '1px solid rgba(34, 197, 94, 0.55)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: interpolate(approvedClaim, [0, 1], [0.18, 1]),
              }}
            >
              <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>Dashboard</span>
              <span style={{ color: '#4ade80', fontSize: 16, fontWeight: 800 }}>Invoice Approved</span>
            </div>
          </div>

          {/* Center: Escrow Vault */}
          <div
            style={{
              ...cardBase,
              width: 400,
              height: 390,
              border: '1.5px solid rgba(245, 158, 11, 0.7)',
              boxShadow: `0 0 54px rgba(245, 158, 11, ${vaultPulse})`,
              opacity: interpolate(vaultIn, [0, 1], [0, 1]),
              transform: `scale(${interpolate(vaultIn, [0, 1], [0.92, 1])})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                border: '1.5px solid rgba(245, 158, 11, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockVaultIcon color="#fbbf24" />
            </div>
            <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em' }}>
              MILESTONE FUNDS
            </div>
            <div
              style={{
                padding: '4px 14px',
                borderRadius: 999,
                backgroundColor: 'rgba(245, 158, 11, 0.16)',
                border: '1px solid rgba(245, 158, 11, 0.65)',
                color: '#fbbf24',
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: '0.1em',
              }}
            >
              LOCKED
            </div>
            <div style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.45, maxWidth: 310 }}>
              Deposited upfront in escrow. Funds remain held pending verification.
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
              transform: `translateY(${interpolate(clientIn, [0, 1], [16, 0])}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ShieldAlertIcon color="#f87171" />
                <span style={{ color: '#f87171', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>CLIENT</span>
              </div>
              <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 700, marginTop: 18, lineHeight: 1.3 }}>
                Funded milestone; cannot verify whether it works.
              </div>
            </div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: interpolate(pendingCheck, [0, 1], [0.18, 1]),
              }}
            >
              <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 600 }}>Acceptance Check</span>
              <span style={{ color: '#f87171', fontSize: 16, fontWeight: 800 }}>Invoice Pending</span>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 26,
            padding: '14px 32px',
            borderRadius: 999,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            border: '1.5px solid rgba(56, 189, 248, 0.55)',
            color: '#f8fafc',
            fontSize: 24,
            fontWeight: 800,
            opacity: interpolate(questionIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(questionIn, [0, 1], [12, 0])}px)`,
          }}
        >
          Should the money be released?
        </div>

        <div
          style={{
            position: 'absolute',
            right: 48,
            bottom: 42,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            backgroundColor: 'rgba(12, 19, 34, 0.85)',
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          ILLUSTRATIVE SCENARIO — NOT CAPTURED TEST EVIDENCE
        </div>
      </div>

      <LowerThird caption="Milestone funds locked in escrow · Conflicting claims need proof" tone="policy" />
      <Sequence from={246}>
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
 * Scene 02 (468f / ~15.2s): Introducing Oracle pipeline + 1 contract branching to 2 pending evaluations.
 * Saves HOLD/RELEASE reveals for Scenes 04 & 05.
 */
export const ExplainWorkflowBeat: React.FC<{ audioSrc?: string; specSha256?: string }> = ({ audioSrc, specSha256 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const steps = [
    { num: '01', title: 'Frozen acceptance contract', sub: 'Both parties agree on done', color: '#38bdf8' },
    { num: '02', title: 'Pinned delivery commit', sub: 'Identify exact code tested', color: '#38bdf8' },
    { num: '03', title: 'Kane verification', sub: 'Run agreed browser objective', color: '#60a5fa' },
    { num: '04', title: 'Deterministic assertions', sub: 'Check UI & API outcomes', color: '#22c55e' },
    { num: '05', title: 'Signed verdict', sub: 'Record HOLD or RELEASE proof', color: '#f59e0b' },
  ];

  const lineProgress = interpolate(frame, [10, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const branchIn = spring({ frame: Math.max(0, frame - 235), fps, config: { damping: 14, stiffness: 88 } });
  const shortSpec = specSha256 ? shortHash(specSha256, 10, 6) : 'spec_sha256';

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
          INTRODUCING AUTOCAST ORACLE
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 40, fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em' }}>
          Evidence-based milestone decisions.
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 18, margin: '8px 0 0' }}>
          Freeze what success means upfront, then judge submitted commits independently.
        </p>

        {/* 5-step pipeline */}
        <div style={{ position: 'relative', marginTop: 46, width: 1680, height: 196 }}>
          <svg width={1680} height={196} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <line x1={160} y1={98} x2={1520} y2={98} stroke="rgba(56, 189, 248, 0.18)" strokeWidth={4} />
            <line x1={160} y1={98} x2={1520} y2={98} stroke="#38bdf8" strokeWidth={4} strokeDasharray={1360} strokeDashoffset={1360 * (1 - lineProgress)} />
          </svg>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', paddingTop: 18 }}>
            {steps.map((step, index) => {
              const s = spring({
                frame: Math.max(0, frame - index * 38),
                fps,
                config: { damping: 14, stiffness: 100 },
              });
              return (
                <div
                  key={step.num}
                  style={{
                    ...cardBase,
                    width: 314,
                    height: 158,
                    padding: '18px 20px',
                    border: `1px solid ${step.color}66`,
                    opacity: interpolate(s, [0, 1], [0.12, 1]),
                    transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px)`,
                  }}
                >
                  <div style={{ color: step.color, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em' }}>
                    STEP {step.num}
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800, marginTop: 8, lineHeight: 1.2 }}>{step.title}</div>
                  <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>{step.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* One frozen contract splitting into two evaluations (results unrevealed) */}
        <div
          style={{
            marginTop: 42,
            width: 1320,
            opacity: interpolate(branchIn, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(branchIn, [0, 1], [16, 0])}px)`,
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
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.55)',
              color: '#fbbf24',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ONE FROZEN CONTRACT · spec {shortSpec}
          </div>

          <div style={{ display: 'flex', gap: 36, width: '100%', justifyContent: 'center' }}>
            <div
              style={{
                ...cardBase,
                width: 580,
                padding: '22px 26px',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>
                  EVALUATION 1 · C_bug
                </div>
                <div style={{ color: '#f8fafc', fontSize: 23, fontWeight: 800, marginTop: 6 }}>
                  First submitted delivery
                </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Evaluated without modifying source</div>
              </div>
              <div style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', fontSize: 13, fontWeight: 800 }}>
                NEXT →
              </div>
            </div>

            <div
              style={{
                ...cardBase,
                width: 580,
                padding: '22px 26px',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800, letterSpacing: '0.12em' }}>
                  EVALUATION 2 · C_fix
                </div>
                <div style={{ color: '#f8fafc', fontSize: 23, fontWeight: 800, marginTop: 6 }}>
                  Second submitted delivery
                </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Same frozen spec · new commit SHA</div>
              </div>
              <div style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: 'rgba(148, 163, 184, 0.12)', color: '#cbd5e1', fontSize: 13, fontWeight: 800 }}>
                THEN →
              </div>
            </div>
          </div>
        </div>
      </div>

      <LowerThird caption="Two separate evaluations · One unchanged acceptance contract" tone="neutral" />
      {audioSrc ? (
        <Sequence from={6}>
          <Audio src={audioSrc.startsWith('http') ? audioSrc : staticFile(audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Scene 06 (192f / ~6s): Cryptographic trust seal animation synced to a6.mp3.
 */
export const ExplainSealBeat: React.FC<{
  audioSrc?: string;
  specSha256: string;
  testedCommit: string;
  keyId: string;
}> = ({ audioSrc, specSha256, testedCommit, keyId }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 14, stiffness: 95 } });
  const sealAt = 48;
  const sealStamp = spring({ frame: Math.max(0, frame - sealAt), fps, config: { damping: 10, stiffness: 120, mass: 0.8 } });
  const ringProgress = interpolate(frame, [10, 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const fields = [
    { label: 'Verdict', value: 'RELEASE', color: '#22c55e' },
    { label: 'Tested commit', value: testedCommit ? shortHash(testedCommit, 10, 6) : '—', color: '#38bdf8' },
    { label: 'Acceptance spec hash', value: specSha256 ? shortHash(specSha256, 10, 6) : '—', color: '#38bdf8' },
    { label: 'Key ID', value: keyId ? shortHash(keyId, 10, 6) : '—', color: '#38bdf8' },
    { label: 'Signature status', value: frame >= sealAt ? 'VERIFIED (Ed25519)' : 'SEALING...', color: '#22c55e' },
  ];

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
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          gap: 26,
        }}
      >
        <div
          style={{
            ...cardBase,
            width: 820,
            padding: '34px 40px',
            border: '1.5px solid rgba(34, 197, 94, 0.5)',
            boxShadow: frame >= sealAt ? '0 0 60px rgba(34, 197, 94, 0.18)' : cardBase.boxShadow,
            transform: `translateY(${interpolate(cardIn, [0, 1], [18, 0])}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={68} height={68} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                  <circle cx={34} cy={34} r={30} fill="none" stroke="rgba(34, 197, 94, 0.2)" strokeWidth={3} />
                  <circle
                    cx={34}
                    cy={34}
                    r={30}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={3}
                    strokeDasharray={188.5}
                    strokeDashoffset={188.5 * (1 - ringProgress)}
                  />
                </svg>
                <ShieldCheckIcon color="#22c55e" size={30} />
              </div>
              <div>
                <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em' }}>
                  CRYPTOGRAPHIC SEAL
                </div>
                <div style={{ color: '#f8fafc', fontSize: 28, fontWeight: 900 }}>
                  run-manifest.json
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                border: '2px solid #22c55e',
                color: '#22c55e',
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: 2,
                opacity: frame >= sealAt ? 1 : 0.25,
                transform: `scale(${frame >= sealAt ? interpolate(sealStamp, [0, 1], [1.35, 1]) : 1})`,
              }}
            >
              SIGNED
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((f) => (
              <div
                key={f.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}
              >
                <span style={{ color: '#94a3b8', fontSize: 16, fontWeight: 700 }}>{f.label}</span>
                <span style={{ color: f.color, fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700 }}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            color: '#22c55e',
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.16em',
            opacity: frame >= sealAt ? 1 : 0.4,
          }}
        >
          ED25519-SIGNED ACCEPTANCE PROOF
        </div>
      </div>

      <Sequence from={sealAt}>
        <Audio src={staticFile('sfx-stamp.wav')} volume={0.65} />
      </Sequence>
      {audioSrc ? (
        <Sequence from={6}>
          <Audio src={audioSrc.startsWith('http') ? audioSrc : staticFile(audioSrc)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
