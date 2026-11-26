import React from 'react';
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AuroraBackground } from './components/AuroraBackground';
import { FloatingHud } from './components/FloatingHud';
import { KineticTransition } from './components/KineticTransition';
import { LowerThird } from './components/LowerThird';
import { OracleEndCard } from './components/OracleEndCard';
import { OracleGate, OracleGateList } from './components/OracleGateList';
import { OracleVerdictFace, OracleVerdictSlab } from './components/OracleVerdictSlab';
import { TerminalCard, TerminalLine } from './components/TerminalCard';
import { TitleCard } from './components/TitleCard';
import { ORACLE_BEAT_FRAMES, ORACLE_GATE_LABELS, shortHash } from './oracle/format';

/**
 * Copy, hashes, and terminal lines are props from sealed oracle runs
 * (scripts/finalize-oracle-drop.ts). They are not hand-authored in this file.
 */
export interface OracleDropProps {
  beatFrames: number[];
  specSha256: string;
  contractId: string;
  hold: OracleVerdictFace;
  release: OracleVerdictFace;
  holdTerminalLines: TerminalLine[];
  verifyTerminalLines: TerminalLine[];
  sourceVideo: string;
  sourcePlaybackRate?: number;
  sourceTrimBefore?: number;
  apiStateLine: string;
  gates: OracleGate[];
  closingTitle: string;
  closingSubtitle: string;
  repoUrl: string;
  swapAt?: number;
  audio?: Partial<Record<'beat1' | 'beat2' | 'beat3a' | 'beat3b' | 'beat4a' | 'beat4b', string>>;
  [key: string]: unknown;
}

const emptyFace = (verdict: 'release' | 'hold'): OracleVerdictFace => ({
  resultCode: verdict === 'release' ? 100 : 740,
  taskTitle: 'Props required',
  summaryText: 'Render with --props from scripts/finalize-oracle-drop.ts.',
  verdict,
  repairOccurred: false,
  stateVerified: verdict === 'release',
  specSha256: '',
  testedCommit: '',
  signatureKeyId: '',
});

export const defaultOracleDropProps: OracleDropProps = {
  beatFrames: [...ORACLE_BEAT_FRAMES],
  specSha256: '',
  contractId: '',
  hold: emptyFace('hold'),
  release: emptyFace('release'),
  holdTerminalLines: [{ text: 'Hold terminal log not loaded.', type: 'dim' }],
  verifyTerminalLines: [{ text: 'verify:oracle log not loaded.', type: 'dim' }],
  sourceVideo: '',
  sourcePlaybackRate: 1,
  sourceTrimBefore: 0,
  apiStateLine: '',
  gates: ORACLE_GATE_LABELS.map((label: string) => ({ label, passed: false })),
  closingTitle: "Autocast v0.2 — Demos that can't lie. Code that can't fake a payout.",
  closingSubtitle: 'Pass --props from a sealed hold commit and a sealed release commit.',
  repoUrl: 'github.com/nikhil-r0/autocast',
  swapAt: 0.52,
};

export const calculateOracleDropMetadata: CalculateMetadataFunction<OracleDropProps> = async ({ props }) => {
  const frames = props.beatFrames?.length === 6 ? props.beatFrames : [...ORACLE_BEAT_FRAMES];
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: frames.reduce((sum, framesInBeat) => sum + framesInBeat, 0),
    props: { ...props, beatFrames: frames },
  };
};

const mediaSrc = (src: string) => (src.startsWith('http') ? src : staticFile(src));

const BeatAudio: React.FC<{ src?: string }> = ({ src }) => {
  if (!src) return null;
  return <Audio src={mediaSrc(src)} />;
};

const lineSpeed = (beatFrames: number, count: number) =>
  Math.max(8, Math.round((beatFrames * 0.62) / Math.max(1, count)));

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: '#060911' }}>
    <AuroraBackground />
    {children}
  </AbsoluteFill>
);

const BeatTitle: React.FC<{ kicker: string; title: string; subtitle: string }> = ({ kicker, title, subtitle }) => (
  <div style={{ textAlign: 'center', marginBottom: 22 }}>
    <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 800, letterSpacing: '0.14em' }}>{kicker}</div>
    <h2 style={{ color: '#f8fafc', fontSize: 36, fontWeight: 800, margin: '8px 0 0', letterSpacing: '-0.02em' }}>{title}</h2>
    <p style={{ color: '#94a3b8', fontSize: 18, margin: '8px auto 0', maxWidth: 820 }}>{subtitle}</p>
  </div>
);

const PolicyBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fork = spring({ frame: frame - Math.round(fps * 0.8), fps, config: { damping: 16, stiffness: 90 } });
  const spec = props.specSha256 ? shortHash(props.specSha256, 12, 6) : 'not loaded';
  return (
    <Stage>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <BeatTitle
          kicker="ORACLE MODE"
          title="Same Kane engine. Opposite policy."
          subtitle="Part 1 repairs a failed demo. Oracle mode seals a hold and does not touch the deliverable."
        />
        <div style={{ display: 'flex', gap: 40, opacity: interpolate(fork, [0, 1], [0, 1]) }}>
          <PolicyPanel label="PART 1" body="740 → auto-fix" color="#38bdf8" />
          <PolicyPanel label="ORACLE" body="740 → HOLD" color="#ef4444" />
        </div>
        <div style={{ marginTop: 28, color: '#38bdf8', fontFamily: 'ui-monospace, monospace', fontSize: 16 }}>
          {props.contractId || 'contract not loaded'} · spec {spec}
        </div>
      </div>
      <LowerThird caption="Part 1: 740 → auto-fix · Oracle: 740 → HOLD" tone="policy" />
      <KineticTransition durationInFrames={durationInFrames} />
      <Sequence from={Math.round(fps * 0.8)}>
        <Audio src={staticFile('sfx-click.wav')} volume={0.45} />
      </Sequence>
      <BeatAudio src={props.audio?.beat1} />
    </Stage>
  );
};

const PolicyPanel: React.FC<{ label: string; body: string; color: string }> = ({ label, body, color }) => (
  <div
    style={{
      width: 640,
      padding: '36px 32px',
      borderRadius: 18,
      border: `1px solid ${color}88`,
      backgroundColor: 'rgba(12, 19, 34, 0.92)',
    }}
  >
    <div style={{ color, fontSize: 14, fontWeight: 800, letterSpacing: 1.4 }}>{label}</div>
    <div style={{ color: '#f8fafc', fontSize: 48, fontWeight: 800, marginTop: 12 }}>{body}</div>
  </div>
);

const HoldBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const speed = lineSpeed(durationInFrames, props.holdTerminalLines.length);
  return (
    <Stage>
      <div style={{ position: 'absolute', top: 36, left: 0, right: 0 }}>
        <BeatTitle
          kicker="FAIL CLOSED"
          title="Buggy commit seals a hold"
          subtitle="Kane 740. No worktree. No repair. Signed hold, exit 1."
        />
      </div>
      <div style={{ position: 'absolute', top: 210, left: 80, display: 'flex', gap: 40 }}>
        <TerminalCard title="oracle hold" lines={props.holdTerminalLines} width={860} height={560} typingSpeed={speed} />
        <OracleVerdictSlab {...props.hold} swapAt={props.swapAt ?? 0.52} durationInFrames={durationInFrames} />
      </div>
      <LowerThird caption="Kane 740 caught → zero repair → signed HOLD" tone="hold" />
      <KineticTransition durationInFrames={durationInFrames} />
      <BeatAudio src={props.audio?.beat2} />
    </Stage>
  );
};

const ReleaseBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flatten = spring({
    frame: Math.max(0, frame - fps),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const tiltX = interpolate(flatten, [0, 1], [2.8, 0]);
  const tiltY = interpolate(flatten, [0, 1], [-2.4, 0]);
  const width = 1500;
  const height = 844;
  return (
    <Stage>
      <div style={{ position: 'absolute', left: (1920 - width) / 2, top: 70, width, height, perspective: 1400 }}>
        <div style={{ width: '100%', height: '100%', transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }}>
          {props.sourceVideo ? (
            <OffthreadVideo
              src={mediaSrc(props.sourceVideo)}
              playbackRate={props.sourcePlaybackRate ?? 1}
              trimBefore={props.sourceTrimBefore ?? 0}
              style={{ width, height, objectFit: 'cover', borderRadius: 12 }}
            />
          ) : (
            <div style={{ width, height, borderRadius: 12, backgroundColor: '#0f172a', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              Source replay not loaded
            </div>
          )}
        </div>
      </div>
      {props.apiStateLine ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            bottom: 120,
            color: '#22c55e',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 18,
            fontWeight: 700,
            backgroundColor: 'rgba(6, 9, 17, 0.82)',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          {props.apiStateLine}
        </div>
      ) : null}
      <FloatingHud
        oracle={{
          verdict: 'release',
          resultCode: props.release.resultCode,
          stateVerified: props.release.stateVerified,
          repairOccurred: props.release.repairOccurred,
        }}
        title={props.release.testedCommit ? `commit ${shortHash(props.release.testedCommit)}` : 'release commit'}
      />
      <LowerThird caption="Kane 100 + API state verified → signed RELEASE" tone="release" />
      <KineticTransition durationInFrames={durationInFrames} />
      <BeatAudio src={props.audio?.beat3a} />
    </Stage>
  );
};

const EndBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => (
  <Stage>
    <OracleEndCard
      verdict={props.release.verdict}
      holdReason={props.release.holdReason}
      specSha256={props.release.specSha256}
      testedCommit={props.release.testedCommit}
      resultCode={props.release.resultCode}
      stateVerified={props.release.stateVerified}
      repairOccurred={props.release.repairOccurred}
      signatureKeyId={props.release.signatureKeyId}
      durationInFrames={durationInFrames}
    />
    <BeatAudio src={props.audio?.beat3b} />
  </Stage>
);

const VerifyBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const speed = lineSpeed(durationInFrames, props.verifyTerminalLines.length);
  return (
    <Stage>
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0 }}>
        <BeatTitle
          kicker="OFFLINE"
          title="Eight gates. No browser required."
          subtitle="A client checks the signed manifest. The video is not a payment gate."
        />
      </div>
      <div style={{ position: 'absolute', top: 200, left: 80, display: 'flex', gap: 40 }}>
        <TerminalCard title="verify:oracle" lines={props.verifyTerminalLines} width={860} height={560} typingSpeed={speed} />
        <OracleGateList gates={props.gates} durationInFrames={durationInFrames} />
      </div>
      <LowerThird caption="8 payment gates verified offline · zero video required" tone="neutral" />
      <KineticTransition durationInFrames={durationInFrames} />
      <BeatAudio src={props.audio?.beat4a} />
    </Stage>
  );
};

const CloseBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => (
  <Stage>
    <TitleCard
      title={props.closingTitle}
      eyebrow="Autocast v0.2"
      subtitle={props.closingSubtitle}
      pills={['SIGNED RELEASE', 'OFFLINE VERIFY', props.repoUrl]}
      holdThroughSequence
      sequenceDuration={durationInFrames}
    />
    <BeatAudio src={props.audio?.beat4b} />
  </Stage>
);

export const OracleDrop: React.FC<OracleDropProps> = (props) => {
  const frames = props.beatFrames?.length === 6 ? props.beatFrames : [...ORACLE_BEAT_FRAMES];
  return (
    <AbsoluteFill style={{ backgroundColor: '#060911', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Series>
        <Series.Sequence durationInFrames={frames[0]} name="Policy">
          <PolicyBeat props={props} durationInFrames={frames[0]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames[1]} name="Hold">
          <HoldBeat props={props} durationInFrames={frames[1]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames[2]} name="Release replay">
          <ReleaseBeat props={props} durationInFrames={frames[2]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames[3]} name="Release stamp">
          <EndBeat props={props} durationInFrames={frames[3]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames[4]} name="Offline gates">
          <VerifyBeat props={props} durationInFrames={frames[4]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames[5]} name="Close">
          <CloseBeat props={props} durationInFrames={frames[5]} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
