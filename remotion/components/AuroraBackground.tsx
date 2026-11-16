import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface AuroraBackgroundProps {
  style?: React.CSSProperties;
  showGrid?: boolean;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  style,
  showGrid = true,
}) => {
  const frame = useCurrentFrame();

  // Smooth sinusoidal drifting for 4 chromatic orbs
  const orb1X = 350 + Math.sin(frame * 0.02) * 120;
  const orb1Y = 220 + Math.cos(frame * 0.018) * 80;

  const orb2X = 1580 + Math.cos(frame * 0.015) * 140;
  const orb2Y = 820 + Math.sin(frame * 0.022) * 90;

  const orb3X = 960 + Math.sin(frame * 0.025 + 1.2) * 160;
  const orb3Y = 560 + Math.cos(frame * 0.02 + 0.8) * 100;

  const orb4X = 1420 + Math.sin(frame * 0.018 + 2.5) * 110;
  const orb4Y = 240 + Math.cos(frame * 0.024 + 1.5) * 70;

  // Breathing opacities
  const orb1Opacity = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.28, 0.42]);
  const orb2Opacity = interpolate(Math.cos(frame * 0.025), [-1, 1], [0.25, 0.40]);
  const orb3Opacity = interpolate(Math.sin(frame * 0.028), [-1, 1], [0.20, 0.34]);
  const orb4Opacity = interpolate(Math.cos(frame * 0.022), [-1, 1], [0.18, 0.32]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#070b14',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      {/* Deep gradient foundation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 20%, #0d172e 0%, #070b14 75%)',
        }}
      />

      {/* Living Aurora Orbs with hardware-accelerated blur */}
      <div
        style={{
          position: 'absolute',
          inset: -100,
          filter: 'blur(95px) saturate(150%)',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        {/* Orb 1: Electric Cyan */}
        <div
          style={{
            position: 'absolute',
            left: orb1X,
            top: orb1Y,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #06b6d4 0%, rgba(6, 182, 212, 0) 70%)',
            opacity: orb1Opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Orb 2: Deep Violet */}
        <div
          style={{
            position: 'absolute',
            left: orb2X,
            top: orb2Y,
            width: 620,
            height: 620,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #8b5cf6 0%, rgba(139, 92, 246, 0) 70%)',
            opacity: orb2Opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Orb 3: Emerald Glow */}
        <div
          style={{
            position: 'absolute',
            left: orb3X,
            top: orb3Y,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #10b981 0%, rgba(16, 185, 129, 0) 70%)',
            opacity: orb3Opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Orb 4: Fuchsia Accent */}
        <div
          style={{
            position: 'absolute',
            left: orb4X,
            top: orb4Y,
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #d946ef 0%, rgba(217, 70, 239, 0) 70%)',
            opacity: orb4Opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Subtle architectural tech dot grid */}
      {showGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            opacity: 0.5,
          }}
        />
      )}

      {/* Subtle vignette border darkening */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 160px rgba(0, 0, 0, 0.8)',
        }}
      />
    </div>
  );
};

