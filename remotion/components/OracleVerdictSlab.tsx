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
  swapAt = 0.52,
  durationInFrames,
  width = 860,
  ...face
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swapFrame = Math.round(durationInFrames * swapAt);
  const reveal = interpolate(frame, [swapFrame, swapFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isRelease = face.verdict === 'release';
  const accent = isRelease ? '#22c55e' : '#ef4444';
  const kaneAccent = isRelease && face.resultCode === 100 ? '#22c55e' : '#ef4444';
  const hasNumericCode = typeof face.resultCode === 'number' && Number.isFinite(face.resultCode);
  const preSwapHeading = hasNumericCode ? 'KANE RESULT' : 'ORACLE GATE';
  const preSwapValue = hasNumericCode ? String(face.resultCode) : (face.holdReason || 'HOLD').toUpperCase();
  const stamp = spring({
    frame: Math.max(0, frame - swapFrame),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });

  return (
    <div
      style={{
        width,
        height: 560,
        position: 'relative',
        backgroundColor: '#0c1322',
        borderRadius: 16,
        border: `1px solid ${accent}66`,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, padding: '28px 32px', opacity: 1 - reveal }}>
        <div style={{ color: kaneAccent, fontSize: 13, fontWeight: 800, letterSpacing: 1.2 }}>{preSwapHeading}</div>
        <div style={{ color: kaneAccent, fontSize: hasNumericCode ? 84 : 52, fontWeight: 900, lineHeight: 1.05, marginTop: 8 }}>
          {preSwapValue}
        </div>
        <div style={{ color: '#f8fafc', fontSize: 22, fontWeight: 700, marginTop: 18 }}>{face.taskTitle}</div>
        <div style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.45, marginTop: 12 }}>{face.summaryText}</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, padding: '28px 32px', opacity: reveal }}>
        <div
          style={{
            scale: interpolate(stamp, [0, 1], [1.45, 1]),
            color: accent,
            fontSize: 68,
            fontWeight: 900,
            letterSpacing: 2,
          }}
        >
          {face.verdict.toUpperCase()}
        </div>
        {face.holdReason ? (
          <div style={{ color: '#fca5a5', fontSize: 16, fontWeight: 700, marginTop: 6 }}>{face.holdReason}</div>
        ) : null}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 18 }}>
          <Fact label="Repair" value={face.repairOccurred ? 'ran' : 'locked off'} color="#f59e0b" />
          <Fact label="State" value={face.stateVerified ? 'verified' : 'unverified'} color={face.stateVerified ? '#22c55e' : '#ef4444'} />
          <Fact label="Spec" value={face.specSha256 ? shortHash(face.specSha256) : '—'} color="#38bdf8" />
          <Fact label="Commit" value={face.testedCommit ? shortHash(face.testedCommit) : '—'} color="#38bdf8" />
          <Fact label="Key" value={face.signatureKeyId ? shortHash(face.signatureKeyId) : '—'} color="#38bdf8" />
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
