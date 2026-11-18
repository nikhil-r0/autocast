import React, { useContext } from 'react';
import {
  Audio,
  CalculateMetadataFunction,
  interpolate,
  OffthreadVideo,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AuroraBackground } from './components/AuroraBackground';
import { BorderBeam } from './components/BorderBeam';
import { TerminalCard } from './components/TerminalCard';
import { DiffCard } from './components/DiffCard';
import { KaneCard } from './components/KaneCard';
import { ManifestBadge } from './components/ManifestBadge';
import runManifest from '../examples/output/run-manifest.json';

export const SHOWCASE_TOTAL_FRAMES = 6750; // 3 minutes 45 seconds at 30 fps

export interface ShowcaseProps {
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  candidateCommit?: string;
  testedCommit?: string;
  baselineCommit?: string;
  kaneResult?: number;
  verified?: boolean;
  sourceVideo?: string;
  prRecording?: string;
  manifestPath?: string;
}

export const ShowcaseDataContext = React.createContext<ShowcaseProps>({});

export const calculateShowcaseMetadata: CalculateMetadataFunction<ShowcaseProps> = async ({ props }) => {
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: SHOWCASE_TOTAL_FRAMES,
    props,
  };
};

// Reusable Chapter Title Component
const ChapterHeader: React.FC<{
  act: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
}> = ({ act, title, subtitle, badge, badgeColor = '#38bdf8' }) => {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {act}
        </span>
        {badge && (
          <span
            style={{
              backgroundColor: `${badgeColor}20`,
              border: `1px solid ${badgeColor}60`,
              color: badgeColor,
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <h2 style={{ color: '#f8fafc', fontSize: 38, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      <p style={{ color: '#94a3b8', fontSize: 17, margin: '8px 0 0', maxWidth: 780 }}>
        {subtitle}
      </p>
    </div>
  );
};

export const AutoCastShowcase: React.FC<ShowcaseProps> = (props) => {
  return (
    <ShowcaseDataContext.Provider value={props}>
      <div style={{ width: 1920, height: 1080, backgroundColor: '#060911', position: 'relative', overflow: 'hidden' }}>
        <AuroraBackground />

        <Series>
          {/* ACT 1: THE HOOK (0:00 - 0:15 = 450 frames) */}
          <Series.Sequence durationInFrames={450}>
            <Act1Hook />
          </Series.Sequence>

          {/* ACT 2: THE PROBLEM & PROMPT (0:15 - 0:40 = 750 frames) */}
          <Series.Sequence durationInFrames={750}>
            <Act2Problem />
          </Series.Sequence>

          {/* ACT 3: KANE CATCHES THE BUG (0:40 - 1:10 = 900 frames) */}
          <Series.Sequence durationInFrames={900}>
            <Act3BugCatch />
          </Series.Sequence>

          {/* ACT 4: AUTONOMOUS REPAIR LOOP (1:10 - 1:55 = 1350 frames) */}
          <Series.Sequence durationInFrames={1350}>
            <Act4Repair />
          </Series.Sequence>

          {/* ACT 5: INDEPENDENT VERIFICATION (1:55 - 2:15 = 600 frames) */}
          <Series.Sequence durationInFrames={600}>
            <Act5Verification />
          </Series.Sequence>

          {/* ACT 6: THE CINEMATIC PRODUCT DEMO (2:15 - 3:05 = 1500 frames) */}
          <Series.Sequence durationInFrames={1500}>
            <Act6DemoVideo />
          </Series.Sequence>

          {/* ACT 7: LOOP 2 VISUAL QA & RELEASE (3:05 - 3:30 = 750 frames) */}
          <Series.Sequence durationInFrames={750}>
            <Act7VisualQaAndRelease />
          </Series.Sequence>

          {/* ACT 8: THE CLOSE (3:30 - 3:45 = 450 frames) */}
          <Series.Sequence durationInFrames={450}>
            <Act8Close />
          </Series.Sequence>
        </Series>
      </div>
    </ShowcaseDataContext.Provider>
  );
};

// ==========================================
// ACT 1: THE HOOK
// ==========================================
const Act1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20, 420, 450], [0, 1, 1, 0]);
  const scale = interpolate(frame, [0, 450], [0.96, 1.02]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${scale})`,
        padding: '0 80px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '8px 20px',
          borderRadius: 9999,
          color: '#38bdf8',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        <span>⚡ AUTOCAST AI</span>
        <span>·</span>
        <span>THE AUTONOMOUS DEMO DIRECTOR</span>
      </div>

      <h1
        style={{
          color: '#ffffff',
          fontSize: 64,
          fontWeight: 900,
          textAlign: 'center',
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          margin: 0,
          maxWidth: 1200,
        }}
      >
        What if your AI could <span style={{ color: '#38bdf8' }}>build a feature</span>,{' '}
        <span style={{ color: '#4ade80' }}>prove it works</span>, and create its own{' '}
        <span style={{ color: '#c084fc' }}>verified product demo</span>?
      </h1>

      <p
        style={{
          color: '#94a3b8',
          fontSize: 24,
          textAlign: 'center',
          maxWidth: 850,
          marginTop: 24,
          lineHeight: 1.5,
        }}
      >
        Demos that can't lie. A self-demonstration directed, edited, and verified by its own closed-loop engine.
      </p>

      {/* Floating compliance stamp teaser */}
      <div
        style={{
          marginTop: 40,
          border: '2px solid rgba(34, 197, 94, 0.6)',
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          color: '#4ade80',
          padding: '12px 28px',
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: '0.08em',
          boxShadow: '0 0 30px rgba(34, 197, 94, 0.25)',
        }}
      >
        ✓ INDEPENDENTLY VERIFIED BY KANE CLI
      </div>
    </div>
  );
};

// ==========================================
// ACT 2: THE PROBLEM & AUTOCAST PROMPT
// ==========================================
const Act2Problem: React.FC = () => {
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
      }}
    >
      <ChapterHeader
        act="ACT 01 // THE CHALLENGE"
        title="Ordinary AI Demos Can Lie. AutoCast Can't."
        subtitle="Traditional synthetic video tools hallucinate UI or record broken software. AutoCast gates every video behind autonomous end-to-end verification."
      />

      <TerminalCard
        title="user@developer-workstation: ~/autocast"
        width={1200}
        height={460}
        lines={[
          { text: 'autocast "Create a cinematic product demo of the invoice approval workflow in Ledgerly.', type: 'command', delayFrames: 10 },
          { text: '          Show the pending approvals dashboard, open invoice INV-1042,', type: 'command', delayFrames: 25 },
          { text: '          inspect its line items, enter an approval note, approve the invoice,', type: 'command', delayFrames: 40 },
          { text: '          and verify the Approved status and digital approval seal."', type: 'command', delayFrames: 55 },
          { text: '', type: 'dim', delayFrames: 70 },
          { text: '⚡ AUTOCAST AI: THE AUTONOMOUS DEMO DIRECTOR', type: 'info', delayFrames: 80 },
          { text: '   Target Application: Ledgerly SaaS (http://localhost:8080)', type: 'dim', delayFrames: 95 },
          { text: '   Enforcing Gate: Stop-On-Bug with Autonomous Closed-Loop Repair', type: 'warn', delayFrames: 110 },
          { text: '   Phase 1 Launch: Ingesting Kane CLI verification engine...', type: 'info', delayFrames: 125 },
        ]}
      />
    </div>
  );
};

// ==========================================
// ACT 3: KANE CATCHES THE INJECTED BUG
// ==========================================
const Act3BugCatch: React.FC = () => {
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
      }}
    >
      <ChapterHeader
        act="ACT 02 // STOP-ON-BUG"
        title="Kane CLI Detects Hidden Product Failure (Result 740)"
        subtitle="Ledgerly server was running with a deceptive bug (approve-noop): HTTP 200 returned, but invoice stayed Pending. Kane caught it immediately."
        badge="RESULT CODE: 740"
        badgeColor="#ef4444"
      />

      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <KaneCard
          status="failed"
          resultCode={740}
          taskTitle="Approve Invoice INV-1042 & Confirm Approved Seal"
          durationText="1m 12s"
          stepsCount={6}
          creditsUsed="1.25"
          summaryText="Approval endpoint returned HTTP 200, but database state and document seal remained in Pending state. UI state mismatch confirmed."
          details={[
            { label: 'Step 4: Click Approve Modal Confirm', value: 'HTTP 200 OK (Deceptive)' },
            { label: 'Step 5: Verify [data-testid=approved-seal]', value: 'Element Not Found' },
            { label: 'Verdict Classification', value: 'assertion_error.confirmed_product_bug' },
          ]}
          width={760}
        />

        <TerminalCard
          title="kane-cli execution stream"
          width={640}
          height={380}
          lines={[
            { text: '[Shoot Loop] Attempt 1/3 executing with Kane CLI...', type: 'info', delayFrames: 10 },
            { text: '{"type":"progress","step":"0-4","remark":"Clicked confirm approve"}', type: 'dim', delayFrames: 25 },
            { text: '{"type":"progress","step":"0-5","status":"failed","error":"Approved seal missing"}', type: 'error', delayFrames: 45 },
            { text: '🚨 STOP-ON-BUG TRIGGERED: Result code 740', type: 'error', delayFrames: 65 },
            { text: 'AutoCast release gate HALTED. Video will NOT be rendered.', type: 'warn', delayFrames: 85 },
            { text: 'Packaging failure evidence pack to .testmuai/evidence/ ...', type: 'info', delayFrames: 105 },
            { text: 'Invoking Antigravity autonomous repair agent...', type: 'success', delayFrames: 125 },
          ]}
        />
      </div>
    </div>
  );
};

// ==========================================
// ACT 4: AUTONOMOUS REPAIR LOOP
// ==========================================
const Act4Repair: React.FC = () => {
  const data = useContext(ShowcaseDataContext);
  const commit = data.candidateCommit || data.testedCommit || runManifest.application?.tested_commit || 'candidate-commit';

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
      }}
    >
      <ChapterHeader
        act="ACT 03 // AUTONOMOUS REPAIR"
        title="Antigravity AI Fixes Source in Isolated Worktree"
        subtitle="AutoCast clones an isolated git worktree with strict guardrails: tests are read-only. Antigravity inspects Kane logs and fixes the server endpoint."
        badge="CLOSED-LOOP AI"
        badgeColor="#a855f7"
      />

      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <DiffCard
          filePath="examples/ledgerly/server/index.js"
          commitHash={`candidate-commit: ${commit.slice(0, 11)}`}
          width={760}
          height={500}
        />

        <TerminalCard
          title="antigravity repair engine (.worktrees/repair-814)"
          width={640}
          height={500}
          lines={[
            { text: 'Creating isolated repair worktree at .worktrees/repair-814...', type: 'info', delayFrames: 10 },
            { text: 'Enforcing path guardrails: tests/** PROTECTED (read-only)', type: 'warn', delayFrames: 25 },
            { text: 'Antigravity AI analyzing Kane failure triage...', type: 'info', delayFrames: 45 },
            { text: 'Found defect in /api/invoices/:id/approve:', type: 'dim', delayFrames: 65 },
            { text: '  -> Invoice status was not updated in storage.', type: 'error', delayFrames: 80 },
            { text: 'Applied patch to examples/ledgerly/server/index.js', type: 'success', delayFrames: 95 },
            { text: 'Running regression verification test suite...', type: 'info', delayFrames: 110 },
            { text: '✓ 33/33 tests passed in worktree.', type: 'success', delayFrames: 125 },
            { text: 'Starting candidate server on port 8080...', type: 'info', delayFrames: 140 },
            { text: `✓ Health check confirmed candidate commit ${commit.slice(0, 11)}`, type: 'success', delayFrames: 155 },
          ]}
        />
      </div>
    </div>
  );
};

// ==========================================
// ACT 5: INDEPENDENT VERIFICATION (KANE 100)
// ==========================================
const Act5Verification: React.FC = () => {
  const data = useContext(ShowcaseDataContext);
  const resultCode = data.kaneResult || runManifest.kane_verification?.result_code || 100;
  const isPassed = resultCode === 100;

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
      }}
    >
      <Audio src={staticFile('sfx-stamp.wav')} startFrom={0} volume={0.6} />
      <ChapterHeader
        act="ACT 04 // INDEPENDENT PROOF"
        title={`Kane CLI Re-Verifies the Repaired Application (${resultCode} · ${isPassed ? 'Passed' : 'Failed'})`}
        subtitle="Kane runs the full browser journey against the patched server. The invoice transitions to Approved, digital seal appears, and backend DB state is verified."
        badge={`RESULT CODE: ${resultCode}`}
        badgeColor={isPassed ? '#22c55e' : '#ef4444'}
      />

      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <KaneCard
          status={isPassed ? 'passed' : 'failed'}
          resultCode={resultCode}
          taskTitle="Re-verify Invoice Approval & Document Compliance Seal"
          durationText="58s"
          stepsCount={6}
          creditsUsed="1.25"
          summaryText="Invoice INV-1042 successfully updated to Approved. Digital compliance seal rendered in green ink. Underlying DB record verified."
          details={[
            { label: 'Claim 1: Invoice status mutated to Approved', value: 'VERIFIED ✓' },
            { label: 'Claim 2: Digital approval seal visible', value: 'VERIFIED ✓' },
            { label: 'Claim 3: Backend DB status matches UI', value: 'VERIFIED ✓' },
          ]}
          width={760}
        />

        <TerminalCard
          title="closed-loop verification output"
          width={640}
          height={380}
          lines={[
            { text: '[Closed Loop Repair] Re-shooting with Kane CLI...', type: 'info', delayFrames: 10 },
            { text: '✓ Step 1: Dashboard overview verified', type: 'success', delayFrames: 25 },
            { text: '✓ Step 2: Selected INV-1042 for review', type: 'success', delayFrames: 40 },
            { text: '✓ Step 3: Verified line items & terms', type: 'success', delayFrames: 55 },
            { text: '✓ Step 4: Approval note saved & submitted', type: 'success', delayFrames: 70 },
            { text: '✓ Step 5: Approved compliance seal CONFIRMED', type: 'success', delayFrames: 85 },
            { text: '✓ Independent DB state check: invoice.status === "Approved"', type: 'success', delayFrames: 100 },
            { text: 'Merging repair branch into main repository...', type: 'info', delayFrames: 120 },
            { text: 'Proceeding to 1080p Playwright cinematic recording.', type: 'info', delayFrames: 135 },
          ]}
        />
      </div>
    </div>
  );
};

// ==========================================
// ACT 6: THE CINEMATIC PRODUCT DEMO
// ==========================================
const Act6DemoVideo: React.FC = () => {
  const data = useContext(ShowcaseDataContext);
  const videoFile = data.sourceVideo || 'source.mp4';

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
      }}
    >
      <ChapterHeader
        act="ACT 05 // THE CINEMATIC DEMO"
        title="AutoCast Records, Directs, and Edits the Product Video"
        subtitle="Recorded in 1080p by Playwright. Camera zooms, cursor easing, spotlighting, narration, and typography synthesized deterministically."
        badge="REMOTION RENDERED"
        badgeColor="#38bdf8"
      />

      {/* Render actual source video in browser mockup frame */}
      <div
        style={{
          width: 1280,
          height: 720,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(56, 189, 248, 0.2)',
          position: 'relative',
          backgroundColor: '#000000',
        }}
      >
        <OffthreadVideo
          src={staticFile(videoFile)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Live HUD Pill */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backdropFilter: 'blur(8px)',
            padding: '10px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'sans-serif',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span style={{ color: '#f8fafc', fontSize: 14, fontWeight: 600 }}>
            Automated Replay: Playwright 1080p · Verified Backend State
          </span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ACT 7: LOOP 2 VISUAL QA, GITHUB PR & RELEASE MANIFEST
// ==========================================
const Act7SubPR: React.FC = () => {
  const data = useContext(ShowcaseDataContext);
  const prNum = data.prNumber || 2;
  const branch = data.branch || 'fix/ledgerly-approve-noop';
  const prRecording = data.prRecording || 'pr-recording.mp4';
  const commit = data.testedCommit || data.candidateCommit || runManifest.application?.tested_commit || 'verified';

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
      }}
    >
      <ChapterHeader
        act="ACT 06.1 // MACHINE PROOF"
        title={`Automated GitHub PR #${prNum} & Verified Evidence`}
        subtitle={`Antigravity created branch '${branch}' and submitted Pull Request #${prNum} to nikhil-r0/autocast. Kane CLI test matrix and machine evidence attached.`}
        badge={`GITHUB PR #${prNum} · VERIFIED`}
        badgeColor="#a855f7"
      />

      <div
        style={{
          width: 1240,
          height: 680,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(168, 85, 247, 0.25)',
          position: 'relative',
          backgroundColor: '#0d1117',
        }}
      >
        <OffthreadVideo
          src={staticFile(prRecording)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {/* Floating machine artifact badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            backgroundColor: 'rgba(13, 17, 23, 0.92)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            backdropFilter: 'blur(8px)',
            padding: '10px 18px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'sans-serif',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>
            Machine Evidence: PR #{prNum} · Commit {commit.slice(0, 11)}
          </span>
        </div>
      </div>
    </div>
  );
};

const Act7SubProvenance: React.FC = () => {
  const data = useContext(ShowcaseDataContext);

  const isVerified = (data.verified ?? true) && (runManifest.status === 'verified');
  const manifestStatus = isVerified ? 'VERIFIED & RELEASED' : 'UNVERIFIED DRAFT';
  const badgeColor = isVerified ? '#4ade80' : '#ef4444';
  const testedCommit = data.testedCommit || runManifest.application?.tested_commit || '[UNKNOWN COMMIT]';
  const videoSha256 = runManifest.artifacts?.video?.sha256 || (isVerified ? '[CALCULATING HASH]' : '[UNVERIFIED DRAFT - NO HASH]');
  const stateVerified = data.verified ?? runManifest.application?.state_verified ?? false;

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
      }}
    >
      <Audio src={staticFile('sfx-stamp.wav')} startFrom={0} volume={0.7} />
      <ChapterHeader
        act="ACT 06.2 // TAMPER-EVIDENT PROVENANCE"
        title="Loop 2 Visual Review & Hash-Verified Provenance Manifest"
        subtitle="Kane reviews the video edit frames for visual defects. Tesseract pixel OCR audits for credentials. A tamper-evident SHA-256 manifest is sealed."
        badge={isVerified ? 'HASH-VERIFIED' : 'UNVERIFIED DRAFT'}
        badgeColor={badgeColor}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <ManifestBadge
          version={runManifest.autocast_version || '0.2.0'}
          status={manifestStatus}
          commitHash={testedCommit}
          videoSha256={videoSha256}
          stateVerified={stateVerified}
          width={1100}
        />

        <div style={{ display: 'flex', gap: 20 }}>
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${isVerified ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: '14px 22px',
              borderRadius: 10,
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            🔍 <strong style={{ color: '#f8fafc' }}>Loop 2 Visual QA:</strong> {isVerified ? 'Zero clipping, typography flaws, or overlaps' : 'Visual QA review pending or flagged'}
          </div>
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${isVerified ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: '14px 22px',
              borderRadius: 10,
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            🔒 <strong style={{ color: '#f8fafc' }}>Pixel Safety OCR:</strong> {isVerified ? '0 secrets or credentials exposed across frames' : 'Security audit pending'}
          </div>
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: `1px solid ${isVerified ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.4)'}`,
              padding: '14px 22px',
              borderRadius: 10,
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            📦 <strong style={{ color: '#f8fafc' }}>Manifest Auditor:</strong> {isVerified ? 'scripts/verify-provenance.ts verified' : 'Auditor rejects unverified draft'}
          </div>
        </div>
      </div>
    </div>
  );
};

const Act7VisualQaAndRelease: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={390}>
        <Act7SubPR />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360}>
        <Act7SubProvenance />
      </Series.Sequence>
    </Series>
  );
};

// ==========================================
// ACT 8: THE CLOSE
// ==========================================
const Act8Close: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          boxShadow: '0 0 50px rgba(56, 189, 248, 0.5)',
          marginBottom: 24,
        }}
      >
        ⚡
      </div>

      <h1 style={{ color: '#ffffff', fontSize: 60, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
        AUTOCAST AI
      </h1>
      <p style={{ color: '#38bdf8', fontSize: 28, fontWeight: 600, margin: '8px 0 24px', letterSpacing: '0.04em' }}>
        Demos that can't lie.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 30,
          color: '#cbd5e1',
          fontSize: 16,
          fontWeight: 500,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '14px 28px',
          borderRadius: 9999,
        }}
      >
        <span>Built with AI</span>
        <span>•</span>
        <span>Verified with KaneCLI</span>
        <span>•</span>
        <span>Repaired with Antigravity</span>
        <span>•</span>
        <span>Directed with Remotion</span>
      </div>

      <div style={{ color: '#64748b', fontSize: 14, marginTop: 40 }}>
        KaneCLI Online Hackathon Submission · November 2026
      </div>
    </div>
  );
};

