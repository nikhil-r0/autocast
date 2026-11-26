import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface TerminalLine {
  text: string;
  type?: 'command' | 'info' | 'error' | 'success' | 'warn' | 'dim';
  delayFrames?: number;
}

interface TerminalCardProps {
  title?: string;
  lines: TerminalLine[];
  width?: number;
  height?: number;
  fontSize?: number;
  typingSpeed?: number; // frames per line reveal
}

export const TerminalCard: React.FC<TerminalCardProps> = ({
  title = 'autocast-cli ~ bash',
  lines,
  width = 1100,
  height = 620,
  fontSize = 15,
  typingSpeed = 8,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#0a0f1d',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 42,
          backgroundColor: '#111827',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} />
        </div>
        <div style={{ color: '#9ca3af', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>TTY 1</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        style={{
          flex: 1,
          padding: '20px 24px',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          fontSize,
          lineHeight: 1.45,
        }}
      >
        {lines.map((line, idx) => {
          const threshold = line.delayFrames ?? idx * typingSpeed;
          const lineProgress = interpolate(frame, [threshold, threshold + 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          let color = '#e5e7eb';
          let prefix = '';

          if (line.type === 'command') {
            color = '#38bdf8';
            prefix = '$ ';
          } else if (line.type === 'error') {
            color = '#f87171';
          } else if (line.type === 'success') {
            color = '#4ade80';
          } else if (line.type === 'warn') {
            color = '#fbbf24';
          } else if (line.type === 'dim') {
            color = '#6b7280';
          }

          return (
            <div
              key={idx}
              style={{
                opacity: lineProgress,
                transform: `translateX(${(1 - lineProgress) * -8}px)`,
                color,
                whiteSpace: 'pre-wrap',
                wordBreak: 'normal',
                overflowWrap: 'anywhere',
              }}
            >
              {prefix ? (
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{prefix}</span>
              ) : null}
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

