import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface BorderBeamProps {
  width: number;
  height: number;
  borderRadius?: number;
  size?: number; // length of beam in px
  duration?: number; // loop duration in frames
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  glow?: boolean;
  opacity?: number;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  width,
  height,
  borderRadius = 14,
  size = 320,
  duration = 90,
  borderWidth = 2,
  colorFrom = '#38bdf8',
  colorTo = '#a855f7',
  glow = true,
  opacity = 0.85,
}) => {
  const frame = useCurrentFrame();

  // Perimeter of rounded rectangle: 2*(w + h) + r*(2*pi - 4)
  const perimeter = Math.max(
    100,
    2 * (width + height) + borderRadius * (2 * Math.PI - 4)
  );

  const beamLength = Math.min(size, perimeter * 0.4);

  // Animated offset circulating continuously
  const cycleFrame = frame % duration;
  const strokeDashoffset = interpolate(
    cycleFrame,
    [0, duration],
    [0, -perimeter]
  );

  const gradientId = `border-beam-grad-${width}-${height}`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 20,
        opacity,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          overflow: 'visible',
          filter: glow
            ? `drop-shadow(0 0 8px ${colorFrom}) drop-shadow(0 0 16px ${colorTo})`
            : undefined,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} stopOpacity={1} />
            <stop offset="60%" stopColor={colorTo} stopOpacity={0.8} />
            <stop offset="100%" stopColor={colorFrom} stopOpacity={0} />
          </linearGradient>
        </defs>

        <rect
          x={borderWidth / 2}
          y={borderWidth / 2}
          width={Math.max(0, width - borderWidth)}
          height={Math.max(0, height - borderWidth)}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={borderWidth}
          strokeDasharray={`${beamLength} ${perimeter - beamLength}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

