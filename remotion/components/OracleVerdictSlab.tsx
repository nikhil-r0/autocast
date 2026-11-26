import React from 'react';
import { Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { shortHash } from '../oracle/format';

export interface OracleVerdictFace {
  resultCode?: number | null;
  taskTitle: string;
  summaryText: string;
  verdict: 'release' | 'hold';
  holdReason?: string;
  repairOccurred: boolean;
  stateVerified: boolean;
  specSha256: string;
  testedCommit: string;
  signatureKeyId: string;
}

interface OracleVerdictSlabProps extends OracleVerdictFace {
  /** Fraction of this sequence where the Kane face gives way to the verdict. */
  swapAt?: number;
  /** Length of the parent sequence. useVideoConfig() reports the whole composition. */
  durationInFrames: number;
  width?: number;
}

export const OracleVerdictSlab: React.FC<OracleVerdictSlabProps> = ({
  swapAt = 0.56,
  durationInFrames,
  width = 820,
  ...face
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swapFrame = Math.round(durationInFrames * swapAt);
  const reveal = interpolate(frame, [swapFrame, swapFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isRelease = face.verdict === 'release';
  const accent = isRelease ? '#22c55e' : '#ef4444';
  const kaneAccent = isRelease && face.resultCode === 100 ? '#22c55e' : '#ef4444';
  const hasNumericCode = typeof face.resultCode === 'number' && Number.isFinite(face.resultCode);
  const preSwapHeading = hasNumericCode ? 'ACTUAL KANE RESULT' : 'ORACLE GATE';
  const preSwapValue = hasNumericCode ? String(face.resultCode) : (face.holdReason || 'HOLD').toUpperCase();
  const stamp = spring({
    frame: Math.max(0, frame - swapFrame),
    fps,
    config: { damping: 11, stiffness: 135, mass: 0.75 },
  });
  const stampDropY = frame >= swapFrame ? interpolate(stamp, [0, 1], [-22, 0]) : 0;
  const glowAlpha = !isRelease && frame >= swapFrame ? 0.18 : 0.08;

  return (
    <div
      style={{
        width,
        height: 560,
        position: 'relative',
        backgroundColor: '#0c1322',
        borderRadius: 16,
        border: `1.5px solid ${accent}88`,
        boxShadow: `0 0 42px ${isRelease ? 'rgba(34, 197, 94,' : 'rgba(239, 68, 68,'} ${glowAlpha})`,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Phase 1: Pre-swap Kane failure evidence */}
      <div style={{ position: 'absolute', inset: 0, padding: '30px 34px', opacity: 1 - reveal }}>
        <div style={{ color: kaneAccent, fontSize: 13, fontWeight: 800, letterSpacing: 1.4 }}>{preSwapHeading}</div>
        <div style={{ color: kaneAccent, fontSize: hasNumericCode ? 88 : 52, fontWeight: 900, lineHeight: 1.05, marginTop: 10 }}>
          {preSwapValue}
        </div>
        <div style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, marginTop: 18 }}>{face.taskTitle}</div>
        <div style={{ color: '#cbd5e1', fontSize: 17, lineHeight: 1.5, marginTop: 12 }}>{face.summaryText}</div>
      </div>

      {/* Phase 2: Sealed Manifest Verdict (downward impact + facts) */}
      <div style={{ position: 'absolute', inset: 0, padding: '28px 34px', opacity: reveal }}>
        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em' }}>
          ORACLE VERDICT
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 6, transform: `translateY(${stampDropY}px)` }}>
          <div
            style={{
              scale: interpolate(stamp, [0, 1], [1.28, 1]),
              color: accent,
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1,
            }}
          >
            {face.verdict.toUpperCase()}
          </div>
          {hasNumericCode ? (
            <div style={{ color: '#fca5a5', fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 800 }}>
              {face.resultCode}
            </div>
          ) : null}
        </div>
        {face.holdReason ? (
          <div style={{ color: '#fca5a5', fontSize: 15, fontWeight: 700, marginTop: 6 }}>
            {face.holdReason} · sourced from run manifest
          </div>
        ) : null}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 11, fontSize: 17 }}>
          <Fact label="Repair performed" value={face.repairOccurred ? 'TRUE' : 'FALSE'} color="#f59e0b" />
          <Fact label="Delivery modified" value={face.repairOccurred ? 'YES' : 'NO'} color="#f59e0b" />
          <Fact label="State verification" value={face.stateVerified ? 'Verified' : 'Unverified'} color={face.stateVerified ? '#22c55e' : '#ef4444'} />
          <Fact label="Acceptance spec" value={face.specSha256 ? shortHash(face.specSha256) : '—'} color="#38bdf8" />
          <Fact label="Delivery commit" value={face.testedCommit ? shortHash(face.testedCommit) : '—'} color="#38bdf8" />
          <Fact label="Signing key ID" value={face.signatureKeyId ? shortHash(face.signatureKeyId) : '—'} color="#38bdf8" />
        </div>
      </div>
      {durationInFrames > swapFrame ? (
        <Sequence from={swapFrame}>
          <Audio src={staticFile('sfx-stamp.wav')} volume={0.7} />
        </Sequence>
      ) : null}
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
    <span style={{ color, fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{value}</span>
  </div>
);
