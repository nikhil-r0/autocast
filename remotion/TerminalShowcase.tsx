import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { AuroraBackground } from './components/AuroraBackground';
import { BorderBeam } from './components/BorderBeam';
import { TerminalCard } from './components/TerminalCard';
import { KaneCard } from './components/KaneCard';

export const RemotionTerminalOnly: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#060911',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />
      <div style={{ position: 'relative' }}>
        <TerminalCard
          title="autocast-cli ~ bash (Option 3: Remotion Vector)"
          width={1300}
          height={680}
          fontSize={18}
          lines={[
            { text: '$ autocast "Create a cinematic demo of invoice approval in Ledgerly"', type: 'command', delayFrames: 5 },
            { text: '================================================================', type: 'dim', delayFrames: 12 },
            { text: '⚡ AUTOCAST AI: THE AUTONOMOUS DEMO DIRECTOR', type: 'info', delayFrames: 18 },
            { text: '   Tagline: Demos that can\'t lie.', type: 'dim', delayFrames: 24 },
            { text: '   Target Application: Ledgerly SaaS (http://localhost:8080)', type: 'dim', delayFrames: 30 },
            { text: '================================================================', type: 'dim', delayFrames: 36 },
            { text: '', type: 'dim', delayFrames: 40 },
            { text: '--- PHASE 1: SHOOT & VERIFY (Loop 1: Kane CLI) ---', type: 'warn', delayFrames: 44 },
            { text: 'Generated Objective: "Approve invoice INV-1042 and verify Approved seal"', type: 'info', delayFrames: 50 },
            { text: '[Shoot Loop] Attempt 1/3 executing with Kane CLI...', type: 'dim', delayFrames: 56 },
            { text: '🚨 STOP-ON-BUG: Kane result code 740 (confirmed_product_bug)', type: 'error', delayFrames: 64 },
            { text: '   Reason: Approval toast shown, but document seal remained Pending.', type: 'error', delayFrames: 70 },
            { text: '', type: 'dim', delayFrames: 74 },
            { text: '--- PHASE 2: AUTONOMOUS REPAIR LOOP (Antigravity AI) ---', type: 'warn', delayFrames: 78 },
            { text: 'Created isolated git worktree: .worktrees/repair-814', type: 'info', delayFrames: 84 },
            { text: 'Enforcing path guardrails: tests/** PROTECTED (read-only)', type: 'dim', delayFrames: 88 },
            { text: 'Antigravity AI patched: examples/ledgerly/server/index.js', type: 'success', delayFrames: 92 },
            { text: 'Candidate commit: 9ef4bade88e (fix: mutate invoice status)', type: 'success', delayFrames: 96 },
            { text: '✓ 33/33 tests passed in worktree.', type: 'success', delayFrames: 100 },
            { text: '', type: 'dim', delayFrames: 104 },
            { text: '--- PHASE 3: RE-VERIFICATION & PROVENANCE ---', type: 'warn', delayFrames: 108 },
            { text: '✓ Kane CLI re-verification: Result 100 Passed!', type: 'success', delayFrames: 112 },
            { text: '✓ Independent backend DB check: status === "Approved"', type: 'success', delayFrames: 115 },
            { text: '✓ Tamper-evident manifest sealed: out/run-manifest.json', type: 'info', delayFrames: 118 },
          ]}
        />
        <BorderBeam width={1300} height={680} colorFrom="#38bdf8" colorTo="#a855f7" />
      </div>
    </div>
  );
};

export const RemotionTerminalSplitHud: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#060911',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        padding: '0 60px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />

      {/* Left: Terminal */}
      <div style={{ position: 'relative' }}>
        <TerminalCard
          title="autocast-cli ~ bash (Option 4: Split HUD)"
          width={920}
          height={680}
          fontSize={16}
          lines={[
            { text: '$ autocast "Invoice approval workflow in Ledgerly"', type: 'command', delayFrames: 5 },
            { text: '⚡ AUTOCAST AI: Demos that can\'t lie', type: 'info', delayFrames: 15 },
            { text: '[Phase 1] Launching Kane CLI verification...', type: 'dim', delayFrames: 25 },
            { text: '🚨 Kane detected bug: Result code 740', type: 'error', delayFrames: 40 },
            { text: '   Element [data-testid=approved-seal] missing', type: 'error', delayFrames: 50 },
            { text: '[Phase 2] Antigravity repair worktree spawned...', type: 'warn', delayFrames: 65 },
            { text: '   Path guardrail enforced on tests/**', type: 'dim', delayFrames: 75 },
            { text: '   Server patched: examples/ledgerly/server/index.js', type: 'success', delayFrames: 85 },
            { text: '   Candidate commit: 9ef4bade88e', type: 'success', delayFrames: 95 },
            { text: '[Phase 3] Kane re-verification running...', type: 'info', delayFrames: 105 },
            { text: '✓ Kane Result Code 100 Passed!', type: 'success', delayFrames: 112 },
            { text: '✓ DB record verified: status === "Approved"', type: 'success', delayFrames: 115 },
            { text: '✓ Manifest sealed: SHA-256 e87d21934...', type: 'info', delayFrames: 118 },
          ]}
        />
        <BorderBeam width={920} height={680} colorFrom="#38bdf8" colorTo="#3b82f6" />
      </div>

      {/* Right: Live Reactive Kane Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 800 }}>
        {frame < 60 ? (
          <KaneCard
            status="failed"
            resultCode={740}
            taskTitle="Approve Invoice & Verify Seal"
            durationText="1m 12s"
            stepsCount={6}
            creditsUsed="1.25"
            summaryText="Approval endpoint returned HTTP 200, but invoice remained in Pending state without digital compliance seal."
            details={[
              { label: 'Step 4: Confirm Approval', value: 'HTTP 200 OK (Buggy)' },
              { label: 'Step 5: Verify Seal', value: 'Not Found' },
              { label: 'Classification', value: 'confirmed_product_bug' },
            ]}
            width={780}
          />
        ) : (
          <KaneCard
            status="passed"
            resultCode={100}
            taskTitle="Approve Invoice & Verify Seal"
            durationText="58s"
            stepsCount={6}
            creditsUsed="1.25"
            summaryText="Invoice status updated to Approved. Digital seal confirmed in green ink. DB record matches UI state."
            details={[
              { label: 'Claim 1: Invoice Approved', value: 'VERIFIED ✓' },
              { label: 'Claim 2: Seal Stamped', value: 'VERIFIED ✓' },
              { label: 'Claim 3: DB Record', value: 'VERIFIED ✓' },
            ]}
            width={780}
          />
        )}
      </div>
    </div>
  );
};
