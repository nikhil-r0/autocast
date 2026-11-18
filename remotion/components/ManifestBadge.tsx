import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface ManifestBadgeProps {
  version?: string;
  status?: string;
  commitHash?: string;
  videoSha256?: string;
  stateVerified?: boolean;
  width?: number;
}

export const ManifestBadge: React.FC<ManifestBadgeProps> = ({
  version = '0.2.0',
  status = 'VERIFIED',
  commitHash = '9ef4bade88e764c20ff9e47d40f86c23a0988bc1',
  videoSha256 = 'e87d2193453adf71053fa4f96f068d4f8a4b94001dfaf075b9c3a62cc05c30b3',
  stateVerified = true,
  width = 960,
}) => {
  const frame = useCurrentFrame();

  const glowOpacity = interpolate(
    Math.sin(frame / 15),
    [-1, 1],
    [0.15, 0.35]
  );

  return (
    <div
      style={{
        width,
        backgroundColor: '#0a0f1d',
        borderRadius: 16,
        border: '1px solid rgba(56, 189, 248, 0.4)',
        boxShadow: `0 20px 50px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, ${glowOpacity})`,
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
              Cryptographic Provenance Manifest
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12 }}>
              Tamper-evident verification seal · run-manifest.json
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.5)',
            color: '#4ade80',
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.06em',
          }}
        >
          ✓ {status}
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
          <span style={{ color: '#fbbf24' }}>{videoSha256}</span>
        </div>
      </div>
    </div>
  );
};

