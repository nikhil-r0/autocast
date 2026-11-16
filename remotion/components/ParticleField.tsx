import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface ParticleFieldProps {
  count?: number;
  style?: React.CSSProperties;
}

interface ParticleConfig {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
  baseOpacity: number;
  color: string;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 24,
  style,
}) => {
  const frame = useCurrentFrame();

  // Generate deterministic particles using pseudo-random math
  const particles = useMemo<ParticleConfig[]>(() => {
    const list: ParticleConfig[] = [];
    const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#34d399', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const seed1 = (i * 137.5 + 47) % 1920;
      const seed2 = (i * 269.3 + 83) % 1080;
      const radius = 1.2 + (i % 3) * 0.8;
      const speedX = 0.015 + ((i * 7) % 10) * 0.003;
      const speedY = 0.018 + ((i * 11) % 10) * 0.003;
      const phase = (i * 0.8) % (Math.PI * 2);
      const baseOpacity = 0.2 + ((i * 13) % 10) * 0.03;
      const color = colors[i % colors.length];

      list.push({
        x: seed1,
        y: seed2,
        radius,
        speedX,
        speedY,
        phase,
        baseOpacity,
        color,
      });
    }
    return list;
  }, [count]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
        ...style,
      }}
    >
      {particles.map((p, idx) => {
        const posX = (p.x + Math.sin(frame * p.speedX + p.phase) * 60 + 1920) % 1920;
        const posY = (p.y + Math.cos(frame * p.speedY + p.phase) * 50 + 1080) % 1080;
        const pulse = interpolate(
          Math.sin(frame * 0.05 + p.phase),
          [-1, 1],
          [p.baseOpacity * 0.6, p.baseOpacity * 1.3]
        );

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: posX,
              top: posY,
              width: p.radius * 2,
              height: p.radius * 2,
              borderRadius: '50%',
              backgroundColor: p.color,
              opacity: pulse,
              boxShadow: `0 0 ${p.radius * 3}px ${p.color}`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </div>
  );
};

