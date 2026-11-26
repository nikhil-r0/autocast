import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface TitleCardProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  pills?: string[];
  /** Fade against this sequence's length instead of a fixed 75-frame title. */
  holdThroughSequence?: boolean;
  sequenceDuration?: number;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  eyebrow = 'Autocast AI Cinematic Production',
  subtitle = 'Formally verified end-to-end with Kane CLI autonomous computer vision.',
  pills = ['ZERO SIMULATION', '100% REAL SCREEN TRACE', 'CRYPTO SEALED'],
  holdThroughSequence = false,
  sequenceDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sequenceLength = sequenceDuration ?? durationInFrames;

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const fadeOutStart = holdThroughSequence ? Math.max(15, sequenceLength - 15) : 60;
  const fadeOutEnd = holdThroughSequence ? sequenceLength : 75;
  const opacity = interpolate(frame, [0, 15, fadeOutStart, fadeOutEnd], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(entrance, [0, 1], [0.92, 1.0]);

  const shimmerProgress = interpolate(frame, [0, fadeOutEnd], [100, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const words = title.split(' ');

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
        overflow: 'hidden',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(139, 92, 246, 0.1) 40%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `scale(${scale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
          padding: '0 40px',
        }}
      >
        {/* Animated Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 30,
            background:
              'linear-gradient(90deg, rgba(59, 130, 246, 0.22), rgba(139, 92, 246, 0.22))',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            boxShadow: '0 0 24px rgba(139, 92, 246, 0.25)',
            color: '#c084fc',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          <span style={{ color: '#38bdf8' }}>⚡</span>
          <span>{eyebrow}</span>
        </div>

        {/* Word-staggered Shimmer Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: -1.8,
            marginBottom: 20,
            maxWidth: 1000,
            lineHeight: 1.15,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0 16px',
          }}
        >
          {words.map((word, idx) => {
            const wordSpring = spring({
              frame: Math.max(0, frame - idx * 3),
              fps,
              config: { damping: 14, stiffness: 90 },
            });
            const wordY = interpolate(wordSpring, [0, 1], [30, 0]);
            const wordOpacity = interpolate(wordSpring, [0, 1], [0, 1]);

            return (
              <span
                key={idx}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${wordY}px)`,
                  opacity: wordOpacity,
                  background:
                    'linear-gradient(135deg, #ffffff 0%, #93c5fd 40%, #c084fc 70%, #ffffff 100%)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: `${shimmerProgress}% 0`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {word}
              </span>
            );
          })}
        </h1>

        <p
          style={{
            fontSize: 22,
            color: '#94a3b8',
            maxWidth: 680,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>

        {/* Verification Guarantee Pill */}
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
            color: '#64748b',
            letterSpacing: 0.5,
          }}
        >
          {pills.map((pill, index) => (
            <span key={pill} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              {index > 0 ? <span>&bull;</span> : null}
              <span style={{ color: index === 0 ? '#34d399' : index === 1 ? '#38bdf8' : '#a78bfa', fontWeight: 700 }}>
                {index === 0 ? '✓ ' : ''}{pill}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
