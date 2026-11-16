import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

interface NumberTickerProps {
  value: number;
  startValue?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  startFrame?: number;
  durationFrames?: number;
  style?: React.CSSProperties;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  startValue = 0,
  prefix = '',
  suffix = '',
  decimals = 2,
  startFrame = 0,
  durationFrames = 45,
  style,
}) => {
  const frame = useCurrentFrame();

  const currentVal = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [startValue, value],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(currentVal);

  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        display: 'inline-block',
        ...style,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

