import React from 'react';
import { BorderBeam } from './BorderBeam';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  showBorderBeam?: boolean;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'http://localhost:8080/invoices',
  width = 1450,
  height = 854,
  style,
  showBorderBeam = true,
}) => {
  const navHeight = 38;
  const viewportWidth = width;
  const viewportHeight = height - navHeight;
  const scale = width / 1920;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow:
          '0 0 0 10px #111827, 0 0 0 11px rgba(255, 255, 255, 0.08), 0 36px 80px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Animated Glowing Border Beam around Window Bezel */}
      {showBorderBeam && (
        <BorderBeam
          width={width}
          height={height}
          borderRadius={14}
          size={360}
          duration={90}
          borderWidth={2}
          colorFrom="#38bdf8"
          colorTo="#a855f7"
          opacity={0.8}
        />
      )}

      {/* Browser Top Navigation Bar */}
      <div
        style={{
          height: navHeight,
          backgroundColor: '#1e293b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 16,
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        {/* Window controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
            }}
          />
        </div>

        {/* Address Pill */}
        <div
          style={{
            flex: 1,
            maxWidth: 540,
            margin: '0 auto',
            height: 26,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            color: '#94a3b8',
            gap: 6,
          }}
        >
          <span style={{ color: '#10b981', fontSize: 10 }}>🔒</span>
          <span>{url}</span>
        </div>
      </div>

      {/* Viewport Content with Strict 16:9 Aspect Ratio Container */}
      <div
        style={{
          width: viewportWidth,
          height: viewportHeight,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
        }}
      >
        {/* Inner 1920x1080 canvas scaled to fit the viewport */}
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
