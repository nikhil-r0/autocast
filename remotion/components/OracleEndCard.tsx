import React from 'react';
import { Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { shortHash } from '../oracle/format';

export interface OracleEndCardProps {
  verdict: 'release' | 'hold';
  holdReason?: string;
  specSha256: string;
  testedCommit: string;
  resultCode: number;
  stateVerified: boolean;
  repairOccurred: boolean;
  signatureKeyId: string;
  durationInFrames?: number;
}

export const OracleEndCard: React.FC<OracleEndCardProps> = ({
  verdict,
  holdReason,
  specSha256,
  testedCommit,
  resultCode,
  stateVerified,
  repairOccurred,
  signatureKeyId,
  durationInFrames: durationOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: compositionDuration } = useVideoConfig();
  const durationInFrames = durationOverride ?? compositionDuration;
  const stampAt = Math.round(durationInFrames * 0.12);
  const isRelease = verdict === 'release';
  const accent = isRelease ? '#22c55e' : '#ef4444';

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stampSpring = spring({
    frame: Math.max(0, frame - stampAt),
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const stampScale = interpolate(stampSpring, [0, 1], [1.6, 1]);

  const rows = [
    { label: 'Kane', value: String(resultCode), color: resultCode === 100 ? '#22c55e' : '#ef4444' },
    { label: 'State', value: stateVerified ? 'verified' : 'unverified', color: stateVerified ? '#22c55e' : '#ef4444' },
    { label: 'Repair', value: repairOccurred ? 'ran' : 'locked off', color: '#f59e0b' },
    { label: 'Spec', value: specSha256 ? shortHash(specSha256, 8, 4) : '—', color: '#38bdf8' },
    { label: 'Commit', value: testedCommit ? shortHash(testedCommit, 8, 4) : '—', color: '#38bdf8' },
    { label: 'Key', value: signatureKeyId ? shortHash(signatureKeyId, 8, 4) : '—', color: '#38bdf8' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#070b14',
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
          scale: interpolate(entrance, [0, 1], [0.94, 1]),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <div
          style={{
            scale: frame >= stampAt ? stampScale : 1,
            padding: '14px 36px',
            borderRadius: 16,
            border: `2px solid ${accent}`,
            color: accent,
            fontSize: 72,
            fontWeight: 900,
            letterSpacing: 4,
            boxShadow: `0 0 40px ${accent}55`,
          }}
        >
          {verdict.toUpperCase()}
        </div>
        {holdReason ? (
          <div style={{ color: '#fca5a5', fontSize: 18, fontWeight: 700 }}>{holdReason}</div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 18 }}>Ed25519-signed for payout</div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1100 }}>
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                minWidth: 150,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{row.label.toUpperCase()}</div>
              <div style={{ color: row.color, fontSize: 18, fontWeight: 700, fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Sequence from={stampAt}>
        <Audio src={staticFile('sfx-stamp.wav')} volume={0.7} />
      </Sequence>
    </div>
  );
};
