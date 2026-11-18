import React from 'react';
import {
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ============================================================================
// ARCHITECTURE FLOWCHART COMPONENT
// "How AutoCast Turns Code into Proof-Backed Demos"
// Two connected horizontal lanes: Closed-Loop Repair -> Cinematic Synthesis
// ============================================================================

interface FlowNodeProps {
  stepNumber: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  accentColor: string;
  opacity: number;
  scale: number;
  highlight?: boolean;
  statusText?: string;
  statusColor?: string;
  width?: number;
}

const FlowNode: React.FC<FlowNodeProps> = ({
  stepNumber,
  badge,
  badgeColor,
  title,
  subtitle,
  accentColor,
  opacity,
  scale,
  highlight = false,
  statusText,
  statusColor = '#10b981',
  width = 250,
}) => {
  return (
    <div
      style={{
        width,
        minHeight: 110,
        backgroundColor: 'rgba(12, 19, 34, 0.92)',
        borderRadius: 14,
        border: `1px solid ${highlight ? accentColor : 'rgba(255, 255, 255, 0.12)'}`,
        boxShadow: highlight
          ? `0 16px 36px -8px rgba(0, 0, 0, 0.8), 0 0 28px ${accentColor}33`
          : '0 12px 28px -6px rgba(0, 0, 0, 0.6)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity,
        transform: `scale(${scale})`,
        backdropFilter: 'blur(10px)',
        position: 'relative',
        transition: 'border 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#64748b',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 6px',
              borderRadius: 4,
              letterSpacing: '0.08em',
            }}
          >
            {stepNumber}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: badgeColor,
              backgroundColor: `${badgeColor}18`,
              border: `1px solid ${badgeColor}40`,
              padding: '2px 8px',
              borderRadius: 5,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {badge}
          </span>
        </div>
        {statusText && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: statusColor,
              backgroundColor: `${statusColor}18`,
              border: `1px solid ${statusColor}44`,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {statusText}
          </span>
        )}
      </div>

      {/* Main Title & Subtitle */}
      <div>
        <div
          style={{
            color: '#f8fafc',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: 12,
            lineHeight: 1.35,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
};

// Animated Horizontal Flow Beam
const FlowConnector: React.FC<{
  progress: number;
  color?: string;
  width?: number;
  label?: string;
}> = ({ progress, color = '#38bdf8', width = 60, label }) => {
  const frame = useCurrentFrame();
  const dashOffset = (frame * 2) % 24;

  return (
    <div
      style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        opacity: progress,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: color,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
      <svg width={width} height="12" style={{ overflow: 'visible' }}>
        {/* Track Line */}
        <line
          x1="0"
          y1="6"
          x2={width}
          y2="6"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="2"
        />
        {/* Animated Flow Pulse */}
        <line
          x1="0"
          y1="6"
          x2={width * progress}
          y2="6"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeDashoffset={-dashOffset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* Arrow Head */}
        {progress > 0.8 && (
          <polygon
            points={`${width - 2},3 ${width + 5},6 ${width - 2},9`}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
      </svg>
    </div>
  );
};

export const ArchitectureFlowchart: React.FC<{ durationInFrames?: number }> = ({
  durationInFrames = 330,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for overall container
  const containerEntrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 90 },
  });
  const overallOpacity = interpolate(frame, [0, 20, durationInFrames - 20, durationInFrames], [0, 1, 1, 0]);

  // --------------------------------------------------------------------------
  // TIMELINE STAGES (330 frames = 11.0s @ 30fps)
  // Stage 1 (0-30f): Header & Lane 1 Repo
  // Stage 2 (30-65f): Kane Detects failure (740)
  // Stage 3 (65-100f): Antigravity Repairs Worktree
  // Stage 4 (100-145f): Kane Verifies Repair (100 PASS)
  // Stage 5 (145-185f): Vertical Conduit & Lane 2 Playwright
  // Stage 6 (185-245f): Remotion + QA Provenance
  // Stage 7 (245-330f): Deliverables Reveal (Demo Video + GitHub PR)
  // --------------------------------------------------------------------------

  // Lane 1 Nodes Animation
  const node1Spring = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 14, stiffness: 100 } });
  const beam1Progress = interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const node2Spring = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 14, stiffness: 100 } });
  // Kane Detect switches to 740 at frame 50
  const isKaneFailActive = frame >= 50;

  const beam2Progress = interpolate(frame, [65, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const node3Spring = spring({ frame: Math.max(0, frame - 80), fps, config: { damping: 14, stiffness: 100 } });

  const beam3Progress = interpolate(frame, [100, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const node4Spring = spring({ frame: Math.max(0, frame - 115), fps, config: { damping: 14, stiffness: 100 } });

  // Kane re-verification: transitions from checking to 100 PASS at frame 135
  const isKanePassActive = frame >= 135;
  const passBounce = spring({
    frame: Math.max(0, frame - 135),
    fps,
    config: { damping: 10, stiffness: 120 },
  });

  // Vertical Conduit from Lane 1 to Lane 2
  const conduitProgress = interpolate(frame, [145, 175], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lane2Opacity = interpolate(frame, [160, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Lane 2 Nodes Animation
  const lane2Node1Spring = spring({ frame: Math.max(0, frame - 175), fps, config: { damping: 14, stiffness: 100 } });
  const lane2Beam1Progress = interpolate(frame, [195, 215], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const lane2Node2Spring = spring({ frame: Math.max(0, frame - 210), fps, config: { damping: 14, stiffness: 100 } });
  const lane2Beam2Progress = interpolate(frame, [225, 245], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const lane2Node3Spring = spring({ frame: Math.max(0, frame - 240), fps, config: { damping: 14, stiffness: 100 } });

  // Deliverables Split (Frames 255+)
  const deliverablesSpring = spring({
    frame: Math.max(0, frame - 255),
    fps,
    config: { damping: 12, stiffness: 95 },
  });
  const deliverablesProgress = interpolate(frame, [250, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
        opacity: overallOpacity,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* SFX Triggers */}
      {frame >= 135 && frame < 145 && (
        <Audio src={staticFile('sfx-click.wav')} startFrom={0} volume={0.4} />
      )}
      {frame >= 255 && frame < 265 && (
        <Audio src={staticFile('sfx-stamp.wav')} startFrom={0} volume={0.35} />
      )}

      {/* Chapter Title & Architectural Transition Narrative */}
      <div style={{ textAlign: 'center', marginBottom: 24, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            SYSTEM ARCHITECTURE // CLOSED-LOOP ENGINE
          </span>
          <span
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            TWO CONNECTED HORIZONTAL LANES
          </span>
        </div>
        <h2 style={{ color: '#f8fafc', fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          How AutoCast Turns Code into Proof-Backed Demos
        </h2>
        <p
          style={{
            color: '#38bdf8',
            fontSize: 17,
            fontWeight: 600,
            margin: '8px 0 0',
            maxWidth: 920,
            lineHeight: 1.4,
            textShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
          }}
        >
          &ldquo;AutoCast doesn&rsquo;t stop at fixing the product. It turns verified execution into a demo you can trust.&rdquo;
        </p>
      </div>

      {/* Main Flowchart Frame */}
      <div
        style={{
          width: 1560,
          backgroundColor: 'rgba(8, 13, 25, 0.75)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), inset 0 0 60px rgba(0, 0, 0, 0.4)',
          padding: '28px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          position: 'relative',
        }}
      >
        {/* ================================================================= */}
        {/* LANE 1: CLOSED-LOOP PRODUCT VERIFICATION                          */}
        {/* ================================================================= */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 16,
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '18px 24px',
            position: 'relative',
          }}
        >
          {/* Lane 1 Header Label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  backgroundColor: '#38bdf8',
                  color: '#090d16',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: '0.08em',
                }}
              >
                LANE 1
              </span>
              <span style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>
                CLOSED-LOOP PRODUCT VERIFICATION
              </span>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                · Isolated Worktree &amp; Defect Repair
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isKanePassActive ? '#10b981' : '#f59e0b', boxShadow: isKanePassActive ? '0 0 10px #10b981' : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isKanePassActive ? '#10b981' : '#f59e0b' }}>
                {isKanePassActive ? 'MUTATION VERIFIED (100 PASS)' : 'SPEC EXECUTION IN PROGRESS'}
              </span>
            </div>
          </div>

          {/* Lane 1 Horizontal Nodes Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Node 1: Product Repository */}
            <FlowNode
              stepNumber="01"
              badge="PRODUCT REPO"
              badgeColor="#94a3b8"
              title="Ledgerly Source"
              subtitle="Invoice approval workflow in production repo"
              accentColor="#38bdf8"
              opacity={node1Spring}
              scale={interpolate(node1Spring, [0, 1], [0.92, 1.0])}
              width={260}
            />

            {/* Beam 1: Repo -> Kane Detect */}
            <FlowConnector progress={beam1Progress} color="#38bdf8" width={80} label="Journey Spec" />

            {/* Node 2: Kane CLI Detect */}
            <FlowNode
              stepNumber="02"
              badge="KANE CLI"
              badgeColor={isKaneFailActive ? '#ef4444' : '#f59e0b'}
              title="Detects Failure"
              subtitle={isKaneFailActive ? 'INV-1042 unmutated · State mismatch' : 'Executing user journey'}
              accentColor={isKaneFailActive ? '#ef4444' : '#38bdf8'}
              opacity={node2Spring}
              scale={interpolate(node2Spring, [0, 1], [0.92, 1.0])}
              highlight={isKaneFailActive}
              statusText={isKaneFailActive ? '740 · FAIL' : 'TESTING'}
              statusColor={isKaneFailActive ? '#ef4444' : '#f59e0b'}
              width={270}
            />

            {/* Beam 2: Kane Detect -> Antigravity Repair */}
            <FlowConnector
              progress={beam2Progress}
              color={isKaneFailActive ? '#ef4444' : '#64748b'}
              width={80}
              label="Defect Trace"
            />

            {/* Node 3: Antigravity AI Repair */}
            <FlowNode
              stepNumber="03"
              badge="ANTIGRAVITY"
              badgeColor="#a855f7"
              title="Repairs Source"
              subtitle="Creates isolated worktree & fixes server/index.js"
              accentColor="#a855f7"
              opacity={node3Spring}
              scale={interpolate(node3Spring, [0, 1], [0.92, 1.0])}
              highlight={frame >= 85}
              statusText="WORKTREE PATCH"
              statusColor="#a855f7"
              width={280}
            />

            {/* Beam 3: Antigravity -> Kane Re-verify */}
            <FlowConnector progress={beam3Progress} color="#10b981" width={80} label="Candidate" />

            {/* Node 4: Kane CLI Re-verify */}
            <FlowNode
              stepNumber="04"
              badge="KANE CLI"
              badgeColor={isKanePassActive ? '#10b981' : '#f59e0b'}
              title="Verifies Repair"
              subtitle={isKanePassActive ? 'DB status mutated to Approved · Seal valid' : 'Re-running journey spec...'}
              accentColor="#10b981"
              opacity={node4Spring}
              scale={isKanePassActive ? interpolate(passBounce, [0, 1], [1.0, 1.03]) : interpolate(node4Spring, [0, 1], [0.92, 1.0])}
              highlight={isKanePassActive}
              statusText={isKanePassActive ? '100 · PASS ✓' : 'VERIFYING'}
              statusColor="#10b981"
              width={270}
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* INTER-LANE CONDUIT / BRIDGE                                       */}
        {/* ================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 110,
            marginTop: -14,
            marginBottom: -14,
            zIndex: 15,
            opacity: conduitProgress,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'rgba(12, 20, 36, 0.95)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 4px 18px rgba(16, 185, 129, 0.25)',
              borderRadius: 30,
              padding: '6px 18px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', letterSpacing: '0.04em' }}>
              ✓ VERIFIED EXECUTION PROVENANCE
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>
        </div>

        {/* ================================================================= */}
        {/* LANE 2: VERIFIED PROOF BECOMES A CINEMATIC DEMO                   */}
        {/* ================================================================= */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            borderRadius: 16,
            border: '1px solid rgba(168, 85, 247, 0.25)',
            padding: '18px 24px',
            opacity: lane2Opacity,
            position: 'relative',
          }}
        >
          {/* Lane 2 Header Label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  backgroundColor: '#a855f7',
                  color: '#090d16',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: '0.08em',
                }}
              >
                LANE 2
              </span>
              <span style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>
                VERIFIED PROOF BECOMES A CINEMATIC DEMO
              </span>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                · Machine Directed Presentation &amp; Public Evidence
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: deliverablesProgress > 0.5 ? '#a855f7' : '#64748b', boxShadow: deliverablesProgress > 0.5 ? '0 0 10px #a855f7' : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: deliverablesProgress > 0.5 ? '#a855f7' : '#94a3b8' }}>
                DEMO CANNOT LIE · TAMPER-EVIDENT
              </span>
            </div>
          </div>

          {/* Lane 2 Horizontal Pipeline & Dual Deliverables */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Step 1: Playwright */}
            <FlowNode
              stepNumber="05"
              badge="PLAYWRIGHT"
              badgeColor="#06b6d4"
              title="1080p Capture"
              subtitle="Records verified browser flow with native actions"
              accentColor="#06b6d4"
              opacity={lane2Node1Spring}
              scale={interpolate(lane2Node1Spring, [0, 1], [0.92, 1.0])}
              width={230}
            />

            {/* Beam: Playwright -> Remotion */}
            <FlowConnector progress={lane2Beam1Progress} color="#06b6d4" width={40} />

            {/* Step 2: Remotion */}
            <FlowNode
              stepNumber="06"
              badge="REMOTION"
              badgeColor="#8b5cf6"
              title="Video Director"
              subtitle="Camera zooms, easing, typography &amp; split HUD"
              accentColor="#8b5cf6"
              opacity={lane2Node2Spring}
              scale={interpolate(lane2Node2Spring, [0, 1], [0.92, 1.0])}
              width={240}
            />

            {/* Beam: Remotion -> QA */}
            <FlowConnector progress={lane2Beam2Progress} color="#8b5cf6" width={40} />

            {/* Step 3: QA & Provenance */}
            <FlowNode
              stepNumber="07"
              badge="QA &amp; OCR"
              badgeColor="#10b981"
              title="Artifact Audit"
              subtitle="Kane visual QA, Pixel Safety OCR &amp; SHA-256 seal"
              accentColor="#10b981"
              opacity={lane2Node3Spring}
              scale={interpolate(lane2Node3Spring, [0, 1], [0.92, 1.0])}
              statusText="6 GATES ✓"
              statusColor="#10b981"
              width={240}
            />

            {/* Fork Connector */}
            <FlowConnector progress={deliverablesProgress} color="#38bdf8" width={50} label="Outputs" />

            {/* DUAL FINAL DELIVERABLES */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                opacity: deliverablesProgress,
                transform: `scale(${interpolate(deliverablesSpring, [0, 1], [0.92, 1.0])})`,
              }}
            >
              {/* Deliverable A: Verified Demo Video */}
              <div
                style={{
                  width: 250,
                  backgroundColor: 'rgba(12, 22, 38, 0.95)',
                  borderRadius: 14,
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.8), 0 0 24px rgba(56, 189, 248, 0.25)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 110,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#38bdf8',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    FINAL VIDEO
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>✓ 1080p 30fps</span>
                </div>
                <div>
                  <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
                    Verified Demo Video
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>
                    out/demo.mp4 · SHA-256 sealed
                  </div>
                </div>
              </div>

              {/* Deliverable B: GitHub PR + Evidence */}
              <div
                style={{
                  width: 250,
                  backgroundColor: 'rgba(20, 14, 34, 0.95)',
                  borderRadius: 14,
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                  boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.8), 0 0 24px rgba(168, 85, 247, 0.25)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 110,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#a855f7',
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    PUBLIC REPO
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>PR #2 LIVE</span>
                </div>
                <div>
                  <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
                    GitHub PR + Evidence
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>
                    docs/catches/ · Machine proof
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

