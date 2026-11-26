import React from 'react';
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AuroraBackground } from './components/AuroraBackground';
import { BrowserFrame } from './components/BrowserFrame';
import { LowerThird } from './components/LowerThird';
import { ExplainEscrowBeat, ExplainSealBeat, ExplainWorkflowBeat } from './components/OracleExplainerBeats';
import { OracleGate, OracleGateList } from './components/OracleGateList';
import { OracleVerdictFace, OracleVerdictSlab } from './components/OracleVerdictSlab';
import { TerminalCard, TerminalLine } from './components/TerminalCard';
import { TitleCard } from './components/TitleCard';
import { ORACLE_BEAT_FRAMES, ORACLE_TRANSITION_FRAMES, ORACLE_GATE_LABELS, shortHash } from './oracle/format';

/**
 * Copy, hashes, and terminal lines are props from sealed oracle runs
 * (scripts/finalize-oracle-drop.ts).
 */
export interface OracleDropProps {
  beatFrames: number[];
  specSha256: string;
  contractId: string;
  hold: OracleVerdictFace;
  release: OracleVerdictFace;
  holdTerminalLines: TerminalLine[];
  releaseTerminalLines?: TerminalLine[];
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
  audio?: Partial<Record<'beat0a' | 'beat0b' | 'beat1' | 'beat2' | 'beat3a' | 'beat3b' | 'beat4a' | 'beat4b', string>>;
  [key: string]: unknown;
}

const emptyFace = (verdict: 'release' | 'hold'): OracleVerdictFace => ({
  resultCode: verdict === 'release' ? 100 : null,
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
  releaseTerminalLines: [{ text: 'Release terminal log not loaded.', type: 'dim' }],
  verifyTerminalLines: [{ text: 'verify:oracle log not loaded.', type: 'dim' }],
  sourceVideo: '',
  sourcePlaybackRate: 1,
  sourceTrimBefore: 0,
  apiStateLine: '',
  gates: ORACLE_GATE_LABELS.map((label: string) => ({ label, passed: false })),
  closingTitle: 'Autocast Oracle',
  closingSubtitle: 'Milestone decisions, backed by signed and verifiable proof.',
  repoUrl: 'github.com/nikhil-r0/autocast',
  swapAt: 0.56,
};

export const calculateOracleDropMetadata: CalculateMetadataFunction<OracleDropProps> = async ({ props }) => {
  const frames = props.beatFrames?.length === ORACLE_BEAT_FRAMES.length ? props.beatFrames : [...ORACLE_BEAT_FRAMES];
  const transitionOverlap = (frames.length - 1) * ORACLE_TRANSITION_FRAMES;
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: frames.reduce((sum, framesInBeat) => sum + framesInBeat, 0) - transitionOverlap,
    props: { ...props, beatFrames: frames },
  };
};

const mediaSrc = (src: string) => (src.startsWith('http') ? src : staticFile(src));

const BeatAudio: React.FC<{ src?: string }> = ({ src }) => {
  if (!src) return null;
  return (
    <Sequence from={6}>
      <Audio src={mediaSrc(src)} />
    </Sequence>
  );
};

const lineSpeed = (beatFrames: number, count: number) =>
  Math.max(5, Math.round((beatFrames * 0.44) / Math.max(1, count)));

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: '#060911' }}>
    <AuroraBackground />
    {children}
  </AbsoluteFill>
);

const BeatTitle: React.FC<{ kicker: string; title: string; subtitle: string }> = ({ kicker, title, subtitle }) => (
  <div style={{ textAlign: 'center', marginBottom: 18 }}>
    <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 800, letterSpacing: '0.14em' }}>{kicker}</div>
    <h2 style={{ color: '#f8fafc', fontSize: 36, fontWeight: 800, margin: '6px 0 0', letterSpacing: '-0.02em' }}>{title}</h2>
    <p style={{ color: '#94a3b8', fontSize: 17, margin: '6px auto 0', maxWidth: 940 }}>{subtitle}</p>
  </div>
);

const WrenchIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const LockedCodeIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect width={16} height={10} x={4} y={11} rx={2} />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <path d="m10 15-1.5 1.5L10 18" />
    <path d="m14 15 1.5 1.5L14 18" />
  </svg>
);

const PolicyBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fork = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 16, stiffness: 90 } });
  const calloutIn = spring({ frame: Math.max(0, frame - 145), fps, config: { damping: 14, stiffness: 95 } });
  const wrenchRotation = interpolate(Math.sin(frame * 0.14), [-1, 1], [-12, 12]);
  const spec = props.specSha256 ? shortHash(props.specSha256, 12, 6) : 'not loaded';

  return (
    <Stage>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <BeatTitle
          kicker="DEMO MODE VS. ORACLE MODE"
          title="Different responsibilities by design."
          subtitle="Demo Mode autonomously repairs broken flows; Oracle Mode leaves submitted source code untouched."
        />
        <div style={{ display: 'flex', gap: 40, marginTop: 14, opacity: interpolate(fork, [0, 1], [0.2, 1]) }}>
          <div
            style={{
              width: 680,
              padding: '32px 32px',
              borderRadius: 18,
              border: '1px solid rgba(56, 189, 248, 0.55)',
              backgroundColor: '#0c1322',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#38bdf8', fontSize: 14, fontWeight: 800, letterSpacing: 1.4 }}>DEMO MODE · REPAIR ENABLED</div>
              <div style={{ transform: `rotate(${wrenchRotation}deg)` }}>
                <WrenchIcon color="#38bdf8" />
              </div>
            </div>
            <div style={{ color: '#f8fafc', fontSize: 38, fontWeight: 800, marginTop: 14 }}>740 → auto-fix</div>
            <div style={{ color: '#94a3b8', fontSize: 17, fontFamily: 'ui-monospace, monospace', marginTop: 12 }}>
              Failure → AI investigates → source repaired → reverified
            </div>
          </div>

          <div
            style={{
              width: 680,
              padding: '32px 32px',
              borderRadius: 18,
              border: '1.5px solid rgba(245, 158, 11, 0.65)',
              backgroundColor: '#0c1322',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#fbbf24', fontSize: 14, fontWeight: 800, letterSpacing: 1.4 }}>ORACLE MODE · REPAIR DISABLED</div>
              <LockedCodeIcon color="#fbbf24" />
            </div>
            <div style={{ color: '#f8fafc', fontSize: 38, fontWeight: 800, marginTop: 14 }}>Fail → signed HOLD</div>
            <div style={{ color: '#94a3b8', fontSize: 17, fontFamily: 'ui-monospace, monospace', marginTop: 12 }}>
              Failure → evidence recorded → signed HOLD
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            padding: '12px 26px',
            borderRadius: 999,
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#fbbf24',
            fontSize: 22,
            fontWeight: 800,
            opacity: interpolate(calloutIn, [0, 1], [0.25, 1]),
          }}
        >
          “Oracle judges the exact code you shipped.”
        </div>
        <div style={{ marginTop: 14, color: '#38bdf8', fontFamily: 'ui-monospace, monospace', fontSize: 15 }}>
          {props.contractId || 'contract'} · spec {spec}
        </div>
      </div>
      <LowerThird caption="Demo Mode repairs · Oracle Mode judges submitted commit untouched" tone="policy" />
      <Sequence from={145}>
        <Audio src={staticFile('sfx-click.wav')} volume={0.45} />
      </Sequence>
      <BeatAudio src={props.audio?.beat1} />
    </Stage>
  );
};

const HoldBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const speed = lineSpeed(durationInFrames, props.holdTerminalLines.length);
  const shortBug = props.hold.testedCommit ? shortHash(props.hold.testedCommit, 10, 6) : 'C_bug';
  const shortSpec = props.specSha256 ? shortHash(props.specSha256, 10, 6) : 'spec';
  return (
    <Stage>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0 }}>
        <BeatTitle
          kicker={`FIRST EVALUATION · C_bug (${shortBug})`}
          title="Buggy commit fails and seals a signed HOLD"
          subtitle={`Spec ${shortSpec} · Kane reports failure; closed_loop_repair.occurred: false.`}
        />
      </div>
      <div style={{ position: 'absolute', top: 196, left: 80, display: 'flex', gap: 40 }}>
        <TerminalCard title="autocast --oracle (C_bug)" lines={props.holdTerminalLines} width={900} height={560} typingSpeed={speed} />
        <OracleVerdictSlab {...props.hold} swapAt={props.swapAt ?? 0.56} durationInFrames={durationInFrames} width={820} />
      </div>
      <LowerThird caption={`Commit ${shortBug} · Kane 740 · Repair disabled → signed HOLD`} tone="hold" />
      <BeatAudio src={props.audio?.beat2} />
    </Stage>
  );
};

const ReleaseBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swapFrame = Math.round(durationInFrames * 0.56);
  const swapProgress = interpolate(frame, [swapFrame, swapFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const revealSpring = spring({ frame: Math.max(0, frame - swapFrame), fps, config: { damping: 14, stiffness: 105 } });

  const shortFix = props.release.testedCommit ? shortHash(props.release.testedCommit, 10, 6) : 'C_fix';
  const shortSpec = props.specSha256 ? shortHash(props.specSha256, 10, 6) : 'spec';
  const relLines = props.releaseTerminalLines && props.releaseTerminalLines.length > 0
    ? props.releaseTerminalLines
    : [{ text: `Spec ${shortSpec} · Commit ${shortFix} · Kane 100 · State verified`, type: 'success' as const }];
  const speed = lineSpeed(swapFrame, relLines.length);

  return (
    <Stage>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0 }}>
        <BeatTitle
          kicker={`SECOND EVALUATION · C_fix (${shortFix})`}
          title="Corrected commit passes the same frozen contract"
          subtitle={`Acceptance spec UNCHANGED (${shortSpec}) · Declared UI & API assertions pass.`}
        />
      </div>

      {/* Symmetric 2-column layout matching HoldBeat hierarchy */}
      <div style={{ position: 'absolute', top: 190, left: 80, display: 'flex', gap: 36, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BrowserFrame url={`http://localhost:8080/invoices · ${shortFix}`} width={960} height={578} showBorderBeam={false}>
            {props.sourceVideo ? (
              <OffthreadVideo
                src={mediaSrc(props.sourceVideo)}
                playbackRate={props.sourcePlaybackRate ?? 1}
                trimBefore={props.sourceTrimBefore ?? 0}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                Source replay not loaded
              </div>
            )}
          </BrowserFrame>
        </div>

        {/* Symmetric right panel: real release log -> Release evaluation summary */}
        <div
          style={{
            width: 764,
            height: 560,
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - swapProgress }}>
            <TerminalCard title="autocast --oracle (C_fix)" lines={relLines} width={764} height={560} typingSpeed={speed} fontSize={14} />
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#0c1322',
              borderRadius: 16,
              border: '1.5px solid rgba(34, 197, 94, 0.7)',
              boxShadow: '0 0 42px rgba(34, 197, 94, 0.16)',
              padding: '28px 32px',
              opacity: swapProgress,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em' }}>
              SECOND ORACLE EVALUATION
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 6, transform: `scale(${interpolate(revealSpring, [0, 1], [1.08, 1])})` }}>
              <div style={{ color: '#22c55e', fontSize: 58, fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>
                RELEASE
              </div>
              <div style={{ color: '#86efac', fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 800 }}>
                {props.release.resultCode ?? 100} · PASSED
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 11, fontSize: 16 }}>
              <ReleaseFact label="Acceptance specification" value={`UNCHANGED (${shortSpec})`} color="#38bdf8" />
              <ReleaseFact label="Delivery commit (C_fix)" value={shortFix} color="#38bdf8" />
              <ReleaseFact label="Repair performed" value={props.release.repairOccurred ? 'TRUE' : 'FALSE'} color="#f59e0b" />
              <ReleaseFact label="Application state" value={props.release.stateVerified ? 'Verified' : 'Unverified'} color="#22c55e" />
            </div>

            {props.apiStateLine ? (
              <div
                style={{
                  marginTop: 22,
                  padding: '12px 14px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.45)',
                  color: '#4ade80',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ✓ {props.apiStateLine}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <LowerThird caption={`Commit ${shortFix} · Kane 100 + UI & API assertions verified → RELEASE`} tone="release" />
      <Sequence from={swapFrame}>
        <Audio src={staticFile('sfx-click.wav')} volume={0.5} />
      </Sequence>
      <BeatAudio src={props.audio?.beat3a} />
    </Stage>
  );
};

const ReleaseFact: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
    <span style={{ color, fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{value}</span>
  </div>
);

const VerifyBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => {
  const speed = lineSpeed(durationInFrames, props.verifyTerminalLines.length);
  return (
    <Stage>
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0 }}>
        <BeatTitle
          kicker="INDEPENDENT OFFLINE VERIFICATION"
          title="Inspect proof offline. Report limits honestly."
          subtitle="Any trusted public key verifies gates 1–9 without re-running the app; Gate 10 blocks real-funds release in beta."
        />
      </div>
      <div style={{ position: 'absolute', top: 196, left: 80, display: 'flex', gap: 40 }}>
        <TerminalCard title="npm run verify:oracle" lines={props.verifyTerminalLines} width={860} height={560} typingSpeed={speed} fontSize={14} />
        <OracleGateList gates={props.gates} durationInFrames={durationInFrames} width={860} />
      </div>
      <LowerThird caption="Signature & manifest verified offline (does not re-run app) · Gate 10 NOT CLEARED" tone="neutral" />
      <BeatAudio src={props.audio?.beat4a} />
    </Stage>
  );
};

const CloseBeat: React.FC<{ props: OracleDropProps; durationInFrames: number }> = ({ props, durationInFrames }) => (
  <Stage>
    <TitleCard
      title={props.closingTitle}
      eyebrow="Autocast Oracle"
      subtitle={props.closingSubtitle}
      pills={['ED25519-SIGNED EVIDENCE', '10-GATE OFFLINE VERIFY', props.repoUrl]}
      holdThroughSequence
      sequenceDuration={durationInFrames}
    />
    <BeatAudio src={props.audio?.beat4b} />
  </Stage>
);

export const OracleDrop: React.FC<OracleDropProps> = (props) => {
  const frames = props.beatFrames?.length === ORACLE_BEAT_FRAMES.length ? props.beatFrames : [...ORACLE_BEAT_FRAMES];
  const transition = <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: ORACLE_TRANSITION_FRAMES })} />;

  return (
    <AbsoluteFill style={{ backgroundColor: '#060911', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={frames[0]} name="Scene 01 - Escrow dispute">
          <ExplainEscrowBeat audioSrc={props.audio?.beat0a} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[1]} name="Scene 02 - Introducing Oracle">
          <ExplainWorkflowBeat audioSrc={props.audio?.beat0b} specSha256={props.specSha256} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[2]} name="Scene 03 - Policy split">
          <PolicyBeat props={props} durationInFrames={frames[2]} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[3]} name="Scene 04 - First evaluation HOLD">
          <HoldBeat props={props} durationInFrames={frames[3]} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[4]} name="Scene 05 - Second evaluation RELEASE">
          <ReleaseBeat props={props} durationInFrames={frames[4]} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[5]} name="Scene 06 - Trust seal">
          <ExplainSealBeat
            audioSrc={props.audio?.beat3b}
            specSha256={props.release.specSha256}
            testedCommit={props.release.testedCommit}
            keyId={props.release.signatureKeyId}
          />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[6]} name="Scene 07 - Offline verify">
          <VerifyBeat props={props} durationInFrames={frames[6]} />
        </TransitionSeries.Sequence>
        {transition}
        <TransitionSeries.Sequence durationInFrames={frames[7]} name="Scene 08 - Closing">
          <CloseBeat props={props} durationInFrames={frames[7]} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
