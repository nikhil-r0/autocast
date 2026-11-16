import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface TitleCardProps {
  title: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(frame, [0, 15, 50, 60], [0, 1, 1, 0]);
  const scale = interpolate(entrance, [0, 1], [0.92, 1.0]);

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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 20,
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#a78bfa',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          ⚡ Autocast AI Production
        </div>

        <h1
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: -1.5,
            color: '#ffffff',
            marginBottom: 16,
            maxWidth: 900,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 20,
            color: '#94a3b8',
            maxWidth: 600,
          }}
        >
          Verified end-to-end with Kane CLI autonomous vision.
        </p>
      </div>
    </div>
  );
};

