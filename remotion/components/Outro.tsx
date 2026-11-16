import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1]);
  const scale = interpolate(entrance, [0, 1], [0.94, 1.0]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#0a0f1d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        zIndex: 50,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            marginBottom: 24,
            boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4)',
          }}
        >
          ⚡
        </div>

        <h2
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: -1,
            color: '#ffffff',
            marginBottom: 12,
          }}
        >
          Autocast AI
        </h2>

        <p
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#34d399',
            marginBottom: 20,
          }}
        >
          Demos that can't lie.
        </p>

        <div
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: 14,
            fontFamily: 'ui-monospace, monospace',
            color: '#94a3b8',
          }}
        >
          github.com/nikhil-r0/autocast
        </div>
      </div>
    </div>
  );
};

