import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface ManifestBadgeProps {
  version?: string;
  status?: string;
  commitHash?: string;
  videoSha256?: string;
  stateVerified?: boolean;
  width?: number;
  mode?: 'demo' | 'oracle';
  verdict?: 'release' | 'hold';
  holdReason?: string;
  specSha256?: string;
  repairOccurred?: boolean;
  signatureKeyId?: string;
}

export const ManifestBadge: React.FC<ManifestBadgeProps> = ({
  version = '0.2.0',
  status = 'UNVERIFIED DRAFT',
  commitHash = '[UNVERIFIED COMMIT]',
  videoSha256 = '[UNVERIFIED SHA-256]',
  stateVerified = false,
  width = 960,
  mode = 'demo',
  verdict,
  holdReason,
  specSha256,
  repairOccurred,
  signatureKeyId,
}) => {
  const frame = useCurrentFrame();

  const isVerified = mode === 'oracle'
    ? verdict === 'release'
    : status === 'VERIFIED' || status === 'VERIFIED & RELEASED';
  const oracleReady = mode === 'oracle' && Boolean(verdict && specSha256 && commitHash && signatureKeyId);

  const glowOpacity = interpolate(
    Math.sin(frame / 15),
    [-1, 1],
    [0.15, 0.35]
  );

  const badgeColor = isVerified ? '#4ade80' : '#f87171';
  const badgeBg = isVerified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const badgeBorder = isVerified ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';

  return (
    <div
      style={{
        width,
        backgroundColor: '#0a0f1d',
        borderRadius: 16,
        border: `1px solid ${isVerified ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
        boxShadow: `0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 40px ${isVerified ? 'rgba(56, 189, 248, ' + glowOpacity + ')' : 'rgba(239, 68, 68, 0.2)'}`,
        padding: '26px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🛡️</span>
          <div>
            <div style={{ color: '#f3f4f6', fontSize: 18, fontWeight: 700 }}>
              {mode === 'oracle' ? 'Signed Acceptance Manifest' : 'Hash-Verified Provenance Manifest'}
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12 }}>
              Tamper-evident verification seal · run-manifest.json
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: badgeBg,
            border: `1px solid ${badgeBorder}`,
            color: badgeColor,
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.06em',
          }}
        >
          {isVerified ? '✓ ' : '⚠ '}{mode === 'oracle' ? (verdict ? verdict.toUpperCase() : 'PROPS REQUIRED') : status}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          padding: '16px 20px',
          borderRadius: 10,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        {mode === 'oracle' && !oracleReady ? (
          <div style={{ gridColumn: 'span 2', color: '#fbbf24' }}>
            Oracle manifest props missing. Pass verdict, spec hash, commit, and key id from a sealed run.
          </div>
        ) : mode === 'oracle' ? (
          <>
            <div>
              <span style={{ color: '#6b7280' }}>state_verified: </span>
              <span style={{ color: stateVerified ? '#4ade80' : '#f87171' }}>{stateVerified ? 'true' : 'false'}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>repair: </span>
              <span style={{ color: '#f59e0b' }}>{repairOccurred ? 'true' : 'false'}</span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>spec_sha256: </span>
              <span style={{ color: '#38bdf8' }}>{specSha256}</span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>tested_commit: </span>
              <span style={{ color: '#c084fc' }}>{commitHash}</span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>key_id: </span>
              <span style={{ color: '#38bdf8' }}>{signatureKeyId}</span>
            </div>
            {holdReason ? (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#6b7280' }}>hold_reason: </span>
                <span style={{ color: '#f87171' }}>{holdReason}</span>
              </div>
            ) : null}
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>optional_video_sha256: </span>
              <span style={{ color: '#9ca3af', wordBreak: 'break-all' }}>
                {videoSha256 && videoSha256 !== '[UNVERIFIED SHA-256]' ? videoSha256 : 'not attached (payment-decoupled)'}
              </span>
            </div>
          </>
        ) : (
          <>
            <div>
              <span style={{ color: '#6b7280' }}>autocast_version: </span>
              <span style={{ color: '#38bdf8' }}>v{version}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>underlying_state_verified: </span>
              <span style={{ color: stateVerified ? '#4ade80' : '#f87171' }}>
                {stateVerified ? 'true (DB record checked)' : 'false'}
              </span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>tested_commit: </span>
              <span style={{ color: '#c084fc' }}>{commitHash}</span>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#6b7280' }}>video_sha256: </span>
              <span style={{ color: isVerified ? '#38bdf8' : '#9ca3af', wordBreak: 'break-all' }}>{videoSha256}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

