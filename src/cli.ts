import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { generateKaneObjective } from './shoot/objective.js';
import { executeKaneRun } from './shoot/kane.js';
import { classifyKaneRun } from './shoot/classify.js';
import { replayAndRecord } from './capture/replay.js';
import { generateNarration } from './edit/narration.js';
import { buildStoryboard } from './edit/storyboard.js';
import { lintStoryboard } from './edit/lint.js';
import { writeShareCopy } from './edit/shareCopy.js';
import { executeReviewLoop } from './review/kaneReview.js';
import { repairVisualDefects } from './review/fix.js';
import { findHeroTimestamp, extractPosterFrame, bakePosterToFrame0 } from './edit/poster.js';
import { scanVideoPixelsForSecrets } from './edit/ocrScan.js';
import {
  createRepairWorktree,
  cleanupWorktree,
  mergeRepairBranch,
  invokeAntigravityRepair,
} from './agent/antigravity.js';
import { LedgerlyLifecycleAdapter } from './app/lifecycle.js';
import { generateRunManifest } from './manifest.js';
import { RunManifest } from './types.js';

import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

async function getServerHealth(url: string): Promise<{ ok: boolean; bug?: string | null; commit?: string } | null> {
  try {
    const res = await fetch(`${url}/api/health`);
    if (!res.ok) return null;
    const body: any = await res.json();
    return { ok: true, bug: body.bug || null, commit: body.commit };
  } catch {
    return null;
  }
}

async function ensureSampleAppRunning(port: number = 8080, expectedBug: string | null = process.env.APP_BUG || null): Promise<void> {
  const url = `http://localhost:${port}`;
  const health = await getServerHealth(url);

  if (health?.ok) {
    if (expectedBug !== undefined && expectedBug !== null && health.bug !== expectedBug) {
      console.log(`[Setup] Detected running server on port ${port} with bug='${health.bug}', but expected='${expectedBug}'. Restarting application...`);
      const adapter = new LedgerlyLifecycleAdapter({ port });
      await adapter.stop();
    } else {
      console.log(`[Setup] Application server confirmed running on ${url} (bug: ${health.bug || 'none'}, commit: ${health.commit || 'development'})`);
      return;
    }
  }

  console.log(`[Setup] Starting bundled sample app at ${url} with APP_BUG=${expectedBug || 'none'}...`);
  const serverScript = path.join(process.cwd(), 'examples', 'ledgerly', 'server', 'index.js');
  const serverProc = spawn(process.execPath, [serverScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(port), APP_BUG: expectedBug || '' },
  });
  serverProc.unref();

  // Wait for health endpoint and verify expected bug injection
  let confirmedHealth: { ok: boolean; bug?: string | null; commit?: string } | null = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    confirmedHealth = await getServerHealth(url);
    if (confirmedHealth?.ok) {
      if (!expectedBug || confirmedHealth.bug === expectedBug) {
        console.log(`[Setup] Sample app is live at ${url} (confirmed bug: ${confirmedHealth.bug || 'none'})`);
        return;
      }
    }
  }

  throw new Error(`[Setup] Fatal: Sample app failed to become healthy with expected bug='${expectedBug}' on ${url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const promptArg = args.find((a) => !a.startsWith('--'));
  const userPrompt = promptArg || 'Create a demo of the invoice approval flow';
  const skipReview = args.includes('--skip-review');
  const layoutArg = args.find((a) => a.startsWith('--layout='));
  const layoutChoice = layoutArg ? (layoutArg.split('=')[1] as 'split' | 'hud' | 'auto') : 'auto';

  console.log('================================================================');
  console.log('⚡ AUTOCAST AI: THE AUTONOMOUS DEMO DIRECTOR');
  console.log('   Tagline: Demos that can\'t lie.');
  console.log('================================================================');
  console.log(`User Prompt: "${userPrompt}"\n`);

  const appUrl = process.env.TARGET_APP_URL || 'http://localhost:8080/?logged_in=true';
  const appLifecycle = new LedgerlyLifecycleAdapter({ port: 8080 });
  const expectedBug = process.env.APP_BUG || null;
  await ensureSampleAppRunning(8080, expectedBug);

  const enableAgentRepair = args.includes('--agent-repair') || !args.includes('--no-agent-repair');
  let repairAttempts = 0;
  const MAX_REPAIRS = 2;
  let closedLoopMetadata: any = undefined;

  // Restore fresh deterministic seed data
  const apiBase = appUrl.split('?')[0].replace(/\/+$/, '');
  try {
    const resetRes = await fetch(`${apiBase}/api/reset`, { method: 'POST' });
    if (resetRes.ok) {
      console.log(`[Setup] ✓ Reset application state to fresh seed data at ${apiBase}`);
    } else {
      console.warn(`[Setup] Warning: /api/reset returned HTTP ${resetRes.status}`);
    }
  } catch (err) {
    console.warn(`[Setup] Note: could not reset seed data: ${err}`);
  }

  // 1. SHOOT LOOP (Loop 1: Kane CLI Verification)
  console.log('\n--- PHASE 1: SHOOT & VERIFY (Loop 1) ---');
  let objectivePlan = await generateKaneObjective(userPrompt, appUrl);
  console.log(`Generated Objective: "${objectivePlan.objective}"`);

  let shootAttempts = 0;
  const maxShootAttempts = 3;
  let kaneResult: any;
  let isStateVerified = false;

  while (shootAttempts < maxShootAttempts) {
    shootAttempts++;
    console.log(`\n[Shoot Loop] Attempt ${shootAttempts}/${maxShootAttempts}...`);

    try {
      await fetch(`${apiBase}/api/reset`, { method: 'POST' });
    } catch {}

    kaneResult = await executeKaneRun({
      objective: objectivePlan.objective,
      url: appUrl,
    });

    const classification = classifyKaneRun(kaneResult);

    if (classification.type === 'confirmed_product_bug') {
      // STOP-ON-BUG: The centerpiece of Autocast AI
      console.error(classification.report);

      const outDir = path.join(process.cwd(), 'out');
      fs.mkdirSync(outDir, { recursive: true });

      const failingStep = kaneResult.steps.slice(-1)[0]?.summary || 'Final verification: Approved seal is visible';
      const initialFailureSummary = {
        step: failingStep,
        status: 'failed',
        error: kaneResult.error || `Final verification failed: "${failingStep}"`,
        verdict: kaneResult.verdict,
        result_code: kaneResult.resultCode || 740,
      };
      fs.writeFileSync(
        path.join(outDir, 'initial-failure-summary.json'),
        JSON.stringify(initialFailureSummary, null, 2),
        'utf-8'
      );
      console.log(`[Closed Loop Repair] Saved genuine defect evidence -> ${path.join(outDir, 'initial-failure-summary.json')}`);

      if (enableAgentRepair && repairAttempts < MAX_REPAIRS) {
        repairAttempts++;
        console.log(`\n================================================================`);
        console.log(`🔧 AUTONOMOUS REPAIR LOOP (Attempt ${repairAttempts}/${MAX_REPAIRS})`);
        console.log(`   "Antigravity AI repairs application source code in an isolated git worktree"`);
        console.log(`================================================================`);

        const repairId = Date.now().toString();
        const { worktreeDir, repairBranch } = createRepairWorktree(repairId);

        try {
          const repairResult = await invokeAntigravityRepair(
            {
              worktreeDir,
              appRelativePath: 'examples/ledgerly',
              objective: objectivePlan.objective,
              verdict: kaneResult.verdict,
              failingStep: kaneResult.steps.slice(-1)[0]?.summary,
              evidence: {
                sessionDir: kaneResult.sessionDir || '',
                consoleLogs: kaneResult.rawEvents?.map((e: any) => e.message).filter(Boolean),
                failureScreenshot: kaneResult.steps.slice(-1)[0]?.url,
              },
              constraints: {
                allowedDirectories: ['examples/ledgerly/**'],
                protectedPaths: ['tests/**', 'examples/ledgerly/tests/**'],
                maxRepairAttempts: 2,
              },
            },
            {
              testCommand: 'npm test',
            }
          );

          if (!repairResult.success) {
            console.error(`\n[Closed Loop Repair] Agent repair failed: ${repairResult.error}`);
            cleanupWorktree(worktreeDir, repairBranch, true);
            process.exit(1);
          }

          console.log(`\n[Closed Loop Repair] Candidate commit: ${repairResult.candidateCommit}`);
          console.log(repairResult.diffSummary);

          // Restart application server from worktree with candidate commit
          const worktreeAdapter = new LedgerlyLifecycleAdapter({
            appDir: path.join(worktreeDir, 'examples/ledgerly'),
            port: 8080,
          });
          await worktreeAdapter.start({
            commit: repairResult.candidateCommit,
            env: { APP_BUG: process.env.APP_BUG || 'approve-noop' },
          });
          await worktreeAdapter.resetSeedData();

          // Kane re-verification
          console.log('\n[Closed Loop Repair] Re-shooting with Kane to independently verify repair...');
          const reKaneResult = await executeKaneRun({
            objective: objectivePlan.objective,
            url: appUrl,
            name: `autocast-reverify-${repairId}`,
          });

          const reClassification = classifyKaneRun(reKaneResult);

          if (reClassification.type === 'confirmed_product_bug') {
            console.error(`\n[Closed Loop Repair] Re-verification failed: defect still present.`);
            cleanupWorktree(worktreeDir, repairBranch, true);
            process.exit(1);
          }

          if (reClassification.type === 'pass') {
            const stateVerified = await worktreeAdapter.verifyUnderlyingState();
            if (!stateVerified) {
              console.error('\n[Closed Loop Repair] HARD ABORT: Underlying application state verification failed (invoice status was not mutated to Approved in backend storage).');
              cleanupWorktree(worktreeDir, repairBranch, true);
              process.exit(1);
            }
            isStateVerified = true;
            console.log(`\n✓ Closed-Loop Verification SUCCESS! Underlying state verified: ${isStateVerified}`);

            // Save catch evidence pack in docs/catches/catch-ledgerly-approval/
            const catchDir = path.join(process.cwd(), 'docs', 'catches', 'catch-ledgerly-approval');
            fs.mkdirSync(catchDir, { recursive: true });

            try {
              const patchDiff = execSync(`git diff HEAD~1 HEAD`, { cwd: worktreeDir, encoding: 'utf-8' });
              fs.writeFileSync(path.join(catchDir, 'patch.diff'), patchDiff, 'utf-8');
            } catch {}

            const successSummary = {
              result_code: reKaneResult.resultCode || 100,
              status: 'passed',
              steps_verified: reKaneResult.steps?.length || objectivePlan.frozenClaims.length,
              claims: objectivePlan.frozenClaims.map((c, idx) => ({
                id: c.id || `c${idx + 1}`,
                claim: c.claim,
                passed: true,
              })),
              underlying_state_verified: isStateVerified,
            };
            fs.writeFileSync(
              path.join(outDir, 'success-summary.json'),
              JSON.stringify(successSummary, null, 2),
              'utf-8'
            );
            fs.writeFileSync(
              path.join(catchDir, 'success-summary.json'),
              JSON.stringify(successSummary, null, 2),
              'utf-8'
            );
            fs.writeFileSync(
              path.join(catchDir, 'failure-summary.json'),
              JSON.stringify(initialFailureSummary, null, 2),
              'utf-8'
            );

            // Merge repair branch into main
            mergeRepairBranch(repairBranch);
            cleanupWorktree(worktreeDir, repairBranch, false);

            kaneResult = reKaneResult;
            closedLoopMetadata = {
              occurred: true,
              initial_failure: `result_code: 740 (confirmed_product_bug)`,
              agent: 'Antigravity CLI (agy 2.0 accept-edits)',
              candidate_commit: repairResult.candidateCommit,
              repair_branch: repairBranch,
              patch_file: 'docs/catches/catch-ledgerly-approval/patch.diff',
              re_verification_run_id: reKaneResult.sessionDir,
            };
            break;
          }
        } catch (repairErr: any) {
          console.error(`[Closed Loop Repair] Exception during repair loop: ${repairErr.message}`);
          cleanupWorktree(worktreeDir, repairBranch, true);
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }

    if (classification.type === 'pass') {
      console.log(`\n✓ Kane CLI verified feature: "${objectivePlan.expectedVerification}"`);
      if (kaneResult.creditsConsumed) {
        console.log(`  Credits consumed: ${kaneResult.creditsConsumed.toFixed(2)}`);
      }
      isStateVerified = await appLifecycle.verifyUnderlyingState();
      if (!isStateVerified) {
        console.error('\n[Shoot Loop] HARD ABORT: Underlying application state verification failed.');
        process.exit(1);
      }
      break;
    }

    if (classification.type === 'cli_configuration_error' || classification.type === 'cancelled') {
      console.error(`\n[Shoot Loop] Kane execution halted: ${classification.message}`);
      process.exit(1);
    }

    console.warn(`[Shoot Loop] Kane run did not pass (${classification.message}). Refining objective...`);
    objectivePlan = await generateKaneObjective(
      `${userPrompt} (Prior attempt failed: ${classification.message}. Ensure clear selectors and sequential steps.)`,
      appUrl,
      objectivePlan.frozenClaims
    );
  }

  if (!kaneResult || !kaneResult.passed) {
    console.error('Shoot loop failed after max attempts. Aborting.');
    process.exit(1);
  }

  // 2. PATH B CAPTURE: Playwright Replay at 1080p
  console.log('\n--- PHASE 2: PATH B HIGH-RES CAPTURE ---');
  const replayResult = await replayAndRecord(kaneResult.steps, appUrl, {
    sessionDir: kaneResult.sessionDir,
  });

  // 3. EDIT PHASE: Narration & Storyboard
  console.log('\n--- PHASE 3: EDITING & STORYBOARD ---');
  console.log('[Edit] Generating scene captions and voiceover narration with Gemini...');
  const narrations = await generateNarration(kaneResult.steps, objectivePlan.title, replayResult.segments.length);

  let storyboard = buildStoryboard(
    objectivePlan.title,
    replayResult,
    kaneResult.steps,
    narrations
  );
  if (layoutChoice && layoutChoice !== 'auto') {
    storyboard.meta.layout = layoutChoice;
    console.log(`[Edit] Applied explicit layout preset: ${layoutChoice.toUpperCase()}`);
  }

  // 4. LINT LOOP (Loop 2)
  console.log('\n--- PHASE 4: LINT STORYBOARD (Loop 2) ---');
  const lint = lintStoryboard(storyboard);
  if (!lint.valid) {
    console.error('Storyboard linting failed. Aborting render.');
    process.exit(1);
  }

  // 5. REVIEW LOOP (Loop 2 Visual QA: Kane reviews our own video edit)
  let visualQaMetadata: RunManifest['visual_qa'] = {
    status: skipReview ? 'flagged' : 'passed',
    attempts: 0,
  };

  if (!skipReview) {
    visualQaMetadata.attempts = 1;
    const initialReview = await executeReviewLoop(storyboard, appUrl);

    if (initialReview.passed) {
      console.log('\n✓ Loop 2 Visual QA: Kane confirmed video layout, typography, and framing are defect-free.');
      visualQaMetadata.status = 'passed';
    } else {
      const failedReviews = initialReview.reviews.filter((r) => !r.passed);
      const failedFrameNums = failedReviews.map((r) => r.frameNumber);
      const passedFrameNums = initialReview.reviews.filter((r) => r.passed).map((r) => r.frameNumber);

      console.warn(`\n[Visual QA Pass 1] Flaws detected on frame(s): ${failedFrameNums.join(', ')}.`);
      if (passedFrameNums.length > 0) {
        console.log(`[Visual QA Pass 1] Passed frame(s): ${passedFrameNums.join(', ')}.`);
      }

      // Single retry budget: propose targeted patch on the failing scene only
      const repair = repairVisualDefects(storyboard, initialReview.reviews);
      visualQaMetadata.patch = repair.patch;

      if (repair.fieldChanged) {
        console.log(`[Visual QA Patch] Field changed: ${repair.fieldChanged}`);
      }

      if (repair.reverted || !repair.lintPassed) {
        console.warn(`[Visual QA] Patch failed storyboard lint and was reverted. Skipping second Kane run.`);
        visualQaMetadata.status = 'flagged';
        visualQaMetadata.flagged_frames = failedFrameNums;
      } else if (repair.repaired) {
        // Save patched storyboard
        storyboard = repair.storyboard;
        fs.writeFileSync(
          path.join(process.cwd(), 'storyboard.json'),
          JSON.stringify(storyboard, null, 2)
        );
        fs.writeFileSync(
          path.join(process.cwd(), 'public', 'storyboard.json'),
          JSON.stringify(storyboard, null, 2)
        );

        // Re-check ONLY the frames that failed
        console.log(`\n[Visual QA Retry] Re-checking failed frame(s) only: ${failedFrameNums.join(', ')}...`);
        visualQaMetadata.attempts = 2;
        visualQaMetadata.rechecked_frames = failedFrameNums;

        const retryReview = await executeReviewLoop(storyboard, appUrl, failedFrameNums);
        const retryFailed = retryReview.reviews.filter((r) => !r.passed);

        if (retryReview.passed) {
          console.log(`\n✓ Visual QA retry PASSED for frame(s): ${failedFrameNums.join(', ')}.`);
          visualQaMetadata.status = 'passed';
        } else {
          const stillFailing = retryFailed.map((r) => r.frameNumber);
          console.warn(`\n⚠ Visual QA retry still flagged flaw on frame(s): ${stillFailing.join(', ')}.`);
          visualQaMetadata.status = 'flagged';
          visualQaMetadata.flagged_frames = stillFailing;
        }
      } else {
        visualQaMetadata.status = 'flagged';
        visualQaMetadata.flagged_frames = failedFrameNums;
      }

      if (visualQaMetadata.status !== 'passed') {
        const allowUnverified = args.includes('--allow-unverified') || args.includes('--force');
        if (!allowUnverified) {
          console.error(`\n🚨 AUTOCAST RELEASE GATE HALT: Visual QA flagged unresolved defect(s) on frame(s): ${visualQaMetadata.flagged_frames?.join(', ')}.`);
          console.error('As per Autocast policy: Demos cannot lie or ship visual defects. Rendering halted.');
          console.error('(To render an unverified draft for inspection, supply --allow-unverified or --skip-review.)');
          process.exit(1);
        } else {
          console.warn(`[Visual QA] --allow-unverified specified. Proceeding to render unverified draft MP4.`);
        }
      } else {
        console.log(`[Visual QA] Visual QA passed. Proceeding to render verified demo MP4.`);
      }
    }
  } else {
    console.log('\n[Visual QA] Skipped via --skip-review flag (STAMPED AS UNVERIFIED DRAFT).');
    visualQaMetadata = {
      status: 'flagged',
      attempts: 0,
    };
  }

  // 6. RENDER PHASE: Remotion Render
  console.log('\n--- PHASE 6: DETERMINISTIC REMOTION RENDER ---');
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputMp4 = path.join(outDir, 'demo.mp4');
  const sharePath = writeShareCopy(outDir, storyboard.meta.title);
  console.log(`Share copy: ${sharePath}`);
  console.log(`Rendering final video to: ${outputMp4}`);

  const renderArgs = [
    'remotion',
    'render',
    'Demo',
    outputMp4,
    '--codec=h264',
    '--concurrency=2',
  ];

  await new Promise<void>((resolve, reject) => {
    const renderProc = spawn('npx', renderArgs, {
      stdio: 'inherit',
      env: { ...process.env },
    });

    renderProc.on('close', async (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Remotion render exited with code ${code}`));
      }
    });

    renderProc.on('error', reject);
  });

  // 7. POSTER EXTRACTION & FRAME-0 BAKING
  console.log('\n--- PHASE 7: POSTER FRAME & FRAME-0 BAKING ---');
  const posterPath = path.join(outDir, 'poster.jpg');
  try {
    const heroSec = findHeroTimestamp(storyboard);
    await extractPosterFrame(outputMp4, posterPath, heroSec);
    await bakePosterToFrame0(outputMp4, posterPath);
  } catch (err: any) {
    console.warn(`[Poster] Poster processing warning: ${err.message}`);
  }

  // 8. PIXEL SAFETY OCR AUDIT
  console.log('\n--- PHASE 8: PIXEL-LEVEL SAFETY OCR AUDIT ---');
  const ocrResult = await scanVideoPixelsForSecrets(outputMp4);
  if (!ocrResult.passed) {
    console.error('\n🚨 AUTOCAST SECURITY GATE HALT: Potential secrets/credentials detected in video pixels or text assets!');
    const quarantineDir = path.join(process.cwd(), '.quarantine');
    fs.mkdirSync(quarantineDir, { recursive: true });
    const quarantinedVideo = path.join(quarantineDir, `quarantined-demo-${Date.now()}.mp4`);
    if (fs.existsSync(outputMp4)) {
      fs.renameSync(outputMp4, quarantinedVideo);
    }
    if (fs.existsSync(posterPath)) {
      fs.unlinkSync(posterPath);
    }
    console.error(`Artifact quarantined to: ${quarantinedVideo}`);
    console.error('As per Autocast policy: Demos cannot leak customer secrets. Release halted.');
    process.exit(1);
  }

  console.log('✓ Pixel Safety OCR: No potential secrets were detected in the scanned frames and accompanying text assets.');

  // Provenance Manifest Generation
  let baselineCommit = 'development';
  let testedCommit = 'development';
  try {
    baselineCommit = execSync('git rev-parse HEAD~1 2>/dev/null || git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    testedCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {}

  const manifest = generateRunManifest({
    status: (skipReview || visualQaMetadata.status !== 'passed' || !isStateVerified) ? 'unverified_draft' : 'verified',
    applicationUrl: appUrl,
    baselineCommit,
    testedCommit,
    stateVerified: isStateVerified,
    kaneVerification: {
      run_id: kaneResult.sessionDir || 'kane-run',
      result_code: kaneResult.resultCode || 100,
      credits_consumed: kaneResult.creditsConsumed,
      claims: kaneResult.claims,
    },
    closedLoopRepair: closedLoopMetadata,
    visualQa: visualQaMetadata,
    securityScan: {
      status: 'clean',
      ocr_frames_scanned: ocrResult.framesScanned,
    },
    videoPath: outputMp4,
    posterPath: posterPath,
  });

  // Stage 1: Generate base showcase props from live execution
  const baseShowcaseProps = {
    autocastVersion: '0.2.0',
    candidateCommit: closedLoopMetadata?.candidate_commit || testedCommit,
    testedCommit: testedCommit,
    baselineCommit: baselineCommit,
    branch: closedLoopMetadata?.occurred ? (closedLoopMetadata as any).repair_branch || 'fix/ledgerly-approve-noop' : 'main',
    kaneResult: kaneResult.resultCode || 100,
    verified: isStateVerified && visualQaMetadata.status === 'passed' && !skipReview,
    stateVerified: isStateVerified,
    visualQaPassed: visualQaMetadata.status === 'passed',
    ocrPassed: ocrResult.passed,
    sourceVideo: 'source.mp4',
    manifestPath: 'out/run-manifest.json',
  };
  fs.writeFileSync(path.join(outDir, 'showcase-props.base.json'), JSON.stringify(baseShowcaseProps, null, 2), 'utf-8');
  console.log(`[Showcase] Staged base showcase props -> ${path.join(outDir, 'showcase-props.base.json')}`);

  // Default props file until Stage 2 finalization
  fs.writeFileSync(path.join(outDir, 'showcase-props.json'), JSON.stringify(baseShowcaseProps, null, 2), 'utf-8');

  // Copy demo video to public/source.mp4 for Remotion showcase presentation
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.copyFileSync(outputMp4, path.join(publicDir, 'source.mp4'));
  console.log(`[Showcase] Copied demo video to public/source.mp4 for Remotion presentation.`);

  // Sync to examples/output for docs & sample delivery
  const examplesOutDir = path.join(process.cwd(), 'examples', 'output');
  if (fs.existsSync(examplesOutDir)) {
    fs.copyFileSync(outputMp4, path.join(examplesOutDir, 'sample-demo.mp4'));
    if (fs.existsSync(posterPath)) {
      fs.copyFileSync(posterPath, path.join(examplesOutDir, 'poster.jpg'));
    }
    fs.copyFileSync(sharePath, path.join(examplesOutDir, 'share-copy.txt'));
    fs.copyFileSync(path.join(outDir, 'run-manifest.json'), path.join(examplesOutDir, 'run-manifest.json'));
    const sbPath = path.join(process.cwd(), 'storyboard.json');
    if (fs.existsSync(sbPath)) {
      fs.copyFileSync(sbPath, path.join(examplesOutDir, 'sample-storyboard.json'));
    }
    console.log(`[Sync] Updated examples/output artifacts.`);
  }

  console.log('\n================================================================');
  console.log('🎉 AUTOCAST DEMO RENDER COMPLETE!');
  console.log(`Output Video: file://${outputMp4}`);
  console.log(`Hero Poster:  file://${posterPath}`);
  console.log(`Share Copy:   file://${sharePath}`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
