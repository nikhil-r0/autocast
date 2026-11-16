import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene } from '../../src/types';

interface SidebarProps {
  scenes: Scene[];
  activeSceneIndex: number;
  title: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  scenes,
  activeSceneIndex,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeScene = scenes[activeSceneIndex] || scenes[0];

  // Subtle breathing pulse for active step indicator
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.98, 1.02]
  );

  return (
    <div
      style={{
        width: 472,
        height: 783,
        backgroundColor: '#0d131f',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 24px',
        boxSizing: 'border-box',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Top Header & Verified Badge */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 5,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>✓</span> Kane Verified
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Autocast AI</span>
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: -0.4,
            lineHeight: 1.25,
            color: '#ffffff',
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>

      {/* Steps Progress List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 2,
          }}
        >
          Workflow Steps ({activeSceneIndex + 1}/{scenes.length})
        </div>

        {scenes.map((scene, idx) => {
          const isDone = idx < activeSceneIndex;
          const isActive = idx === activeSceneIndex;

          return (
            <div
              key={scene.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(59, 130, 246, 0.4)'
                  : '1px solid transparent',
                transform: isActive ? `scale(${pulse})` : 'none',
                opacity: isDone ? 0.75 : isActive ? 1 : 0.45,
              }}
            >
              {/* Step indicator circle */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: isDone
                    ? '#10b981'
                    : isActive
                    ? '#3b82f6'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: isDone || isActive ? '#ffffff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {isDone ? '✓' : idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    marginBottom: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {scene.caption}
                </div>
                {isActive && (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: '#93c5fd',
                      marginTop: 3,
                    }}
                  >
                    {scene.narration}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Branding */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <span>Demos that can't lie.</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: '#94a3b8' }}>30 FPS · 1080p</span>
      </div>
    </div>
  );
};
