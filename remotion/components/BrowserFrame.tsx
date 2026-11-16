import React from 'react';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  width?: number;
  height?: number;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'http://localhost:8080/invoices',
  width = 1320,
  height = 783,
}) => {
  const navHeight = 40;
  const viewportWidth = width;
  const viewportHeight = height - navHeight; // 743px for 783px height
  const scale = width / 1920; // 0.6875 for width 1320

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        position: 'relative',
        flexShrink: 0,
      }}
    >
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
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} />
        </div>

        {/* Address Pill */}
        <div
          style={{
            flex: 1,
            maxWidth: 520,
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
        {/* Inner 1920x1080 canvas scaled to fit the 1320x743 viewport */}
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
