import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header';
  text: string;
}

interface DiffCardProps {
  filePath?: string;
  diffLines?: DiffLine[];
  commitHash?: string;
  width?: number;
  height?: number;
}

const DEFAULT_DIFF_LINES: DiffLine[] = [
  { type: 'header', text: '--- a/examples/ledgerly/server/index.js' },
  { type: 'header', text: '+++ b/examples/ledgerly/server/index.js' },
  { type: 'header', text: '@@ -137,10 +137,11 @@ app.post(\'/api/invoices/:id/approve\', async (req, res) => {' },
  { type: 'context', text: '   // Bug Injection: approve-noop (returns success toast payload, but leaves status Pending)' },
  { type: 'context', text: '   if (process.env.APP_BUG === \'approve-noop\') {' },
  { type: 'add', text: '+    invoice.status = \'Approved\';' },
  { type: 'add', text: '+    invoice.approvedAt = new Date().toISOString();' },
  { type: 'context', text: '     return res.json({' },
  { type: 'context', text: '       success: true,' },
  { type: 'context', text: '       id,' },
  { type: 'del', text: '-      status: invoice.status, // stays Pending!' },
  { type: 'add', text: '+      status: invoice.status, // updated to Approved' },
  { type: 'context', text: '       message: `Invoice ${id} approved`,' },
  { type: 'context', text: '     });' },
  { type: 'context', text: '   }' },
];

export const DiffCard: React.FC<DiffCardProps> = ({
  filePath = 'examples/ledgerly/server/index.js',
  diffLines = DEFAULT_DIFF_LINES,
  commitHash = '9ef4bade88e7 (autocast/repair-worktree)',
  width = 1100,
  height = 560,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#090d16',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {/* File Header */}
      <div
        style={{
          height: 46,
          backgroundColor: '#121827',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ color: '#f3f4f6', fontSize: 14, fontWeight: 600 }}>{filePath}</span>
        </div>
        <div
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            color: '#c084fc',
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {commitHash}
        </div>
      </div>

      {/* Diff Content */}
      <div
        style={{
          flex: 1,
          padding: '16px 20px',
          overflowY: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        {diffLines.map((line, idx) => {
          const delay = idx * 3;
          const opacity = interpolate(frame, [delay, delay + 8], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          let bg = 'transparent';
          let color = '#d1d5db';

          if (line.type === 'add') {
            bg = 'rgba(34, 197, 94, 0.15)';
            color = '#4ade80';
          } else if (line.type === 'del') {
            bg = 'rgba(239, 68, 68, 0.15)';
            color = '#f87171';
          } else if (line.type === 'header') {
            color = '#818cf8';
          }

          return (
            <div
              key={idx}
              style={{
                opacity,
                backgroundColor: bg,
                color,
                padding: '2px 8px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'pre',
              }}
            >
              <span style={{ width: 28, userSelect: 'none', opacity: 0.5 }}>{idx + 1}</span>
              <span>{line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

