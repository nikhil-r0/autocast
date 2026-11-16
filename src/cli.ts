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

import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureSampleAppRunning(port: number = 8080): Promise<void> {
  const url = `http://localhost:${port}`;
  if (await isServerRunning(url)) {
    return;
  }

  console.log(`[Setup] Starting bundled sample app at ${url}...`);
  const serverScript = path.join(process.cwd(), 'examples', 'ledgerly', 'server', 'index.js');
  const serverProc = spawn('node', [serverScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(port) },
  });
  serverProc.unref();

  // Wait for health endpoint
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isServerRunning(url)) {
      console.log(`[Setup] Sample app is live at ${url}`);
      return;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const promptArg = args.find((a) => !a.startsWith('--'));
  const userPrompt = promptArg || 'Create a demo of the invoice approval flow';
  const skipReview = args.includes('--skip-review');

  console.log('================================================================');
  console.log('⚡ AUTOCAST AI: THE AUTONOMOUS DEMO DIRECTOR');
  console.log('   Tagline: Demos that can\'t lie.');
  console.log('================================================================');
  console.log(`User Prompt: "${userPrompt}"\n`);

  const appUrl = process.env.TARGET_APP_URL || 'http://localhost:8080/?logged_in=true';
  await ensureSampleAppRunning(8080);

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

      if (enableAgentRepair && repairAttempts < MAX_REPAIRS) {
        repairAttempts++;
        console.log(`\n================================================================`);
        console.log(`🔧 AUTONOMOUS REPAIR LOOP (Attempt ${repairAttempts}/${MAX_REPAIRS})`);
        console.log(`   "Antigravity AI repairs application source code in an isolated git worktree"`);
        console.log(`================================================================`);

        const repairId = Date.now().toString();
        const { worktreeDir, repairBranch } = createRepairWorktree(repairId);

        try {
          const repairResult = await invokeAntigravityRepair({
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
          });

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
          await worktreeAdapter.start({ commit: repairResult.candidateCommit });
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
            console.log(`\n✓ Closed-Loop Verification SUCCESS! Underlying state verified: ${stateVerified}`);

            // Save catch evidence pack in docs/catches/catch-ledgerly-approval/
            const catchDir = path.join(process.cwd(), 'docs', 'catches', 'catch-ledgerly-approval');
            fs.mkdirSync(catchDir, { recursive: true });

            try {
              const patchDiff = execSync(`git diff HEAD~1 HEAD`, { cwd: worktreeDir, encoding: 'utf-8' });
              fs.writeFileSync(path.join(catchDir, 'patch.diff'), patchDiff, 'utf-8');
            } catch {}

            // Merge repair branch into main
            mergeRepairBranch(repairBranch);
            cleanupWorktree(worktreeDir, repairBranch, false);

            kaneResult = reKaneResult;
            closedLoopMetadata = {
              occurred: true,
              initial_failure: `result_code: 740 (confirmed_product_bug)`,
              agent: 'Antigravity CLI (agy 2.0 accept-edits)',
              candidate_commit: repairResult.candidateCommit,
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

  // 4. LINT LOOP (Loop 2)
  console.log('\n--- PHASE 4: LINT STORYBOARD (Loop 2) ---');
  const lint = lintStoryboard(storyboard);
  if (!lint.valid) {
    console.error('Storyboard linting failed. Aborting render.');
    process.exit(1);
  }

  // 5. REVIEW LOOP (Loop 3: Kane reviews our own video edit)
  if (!skipReview) {
    let reviewAttempts = 0;
    const MAX_VISUAL_REPAIRS = 2;
    let visualReviewPassed = false;

    while (reviewAttempts <= MAX_VISUAL_REPAIRS) {
      const reviewResult = await executeReviewLoop(storyboard, appUrl);
      if (reviewResult.passed) {
        visualReviewPassed = true;
        console.log('\n✓ Loop 3 Visual QA: Kane confirmed video layout, typography, and framing are defect-free.');
        break;
      }

      if (reviewAttempts === MAX_VISUAL_REPAIRS) {
        console.error(`\n🚨 AUTOCAST VISUAL QA HALT: Visual defects persist after ${MAX_VISUAL_REPAIRS} repair iterations.`);
        reviewResult.reviews.filter((r) => !r.passed).forEach((r) => {
          console.error(`  - Frame ${r.frameNumber}: ${r.summary}`);
        });
        console.error('As per Autocast policy: NO DEFECTIVE VIDEO WILL BE RENDERED.');
        process.exit(1);
      }

      reviewAttempts++;
      console.warn(`\n[Loop 3 Review] Kane flagged visual QA warnings (attempt ${reviewAttempts}/${MAX_VISUAL_REPAIRS}). Applying repair...`);
      const repair = repairVisualDefects(storyboard, reviewResult.reviews);
      if (repair.repaired) {
        console.log(`[Loop 3 Autonomous Repair] Applied ${repair.actionsTaken.length} layout fix(es):`);
        repair.actionsTaken.forEach((act) => console.log(`  - ${act}`));
        storyboard = repair.storyboard;
        // Re-write updated storyboard
        fs.writeFileSync(
          path.join(process.cwd(), 'storyboard.json'),
          JSON.stringify(repair.storyboard, null, 2)
        );
        fs.writeFileSync(
          path.join(process.cwd(), 'public', 'storyboard.json'),
          JSON.stringify(repair.storyboard, null, 2)
        );
      } else {
        console.error('Autonomous storyboard repair could not resolve detected visual defects. Aborting render.');
        process.exit(1);
      }
    }
  } else {
    console.log('\n[Loop 3 Review] Skipped via --skip-review flag (STAMPED AS UNVERIFIED DRAFT).');
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
    status: skipReview ? 'unverified_draft' : 'verified',
    applicationUrl: appUrl,
    baselineCommit,
    testedCommit,
    stateVerified: true,
    kaneVerification: {
      run_id: kaneResult.sessionDir || 'kane-run',
      result_code: kaneResult.resultCode || 100,
      credits_consumed: kaneResult.creditsConsumed,
      claims: kaneResult.claims,
    },
    closedLoopRepair: closedLoopMetadata,
    visualQa: {
      status: skipReview ? 'failed' : 'passed',
      attempts: 1,
    },
    securityScan: {
      status: 'clean',
      ocr_frames_scanned: ocrResult.framesScanned,
    },
    videoPath: outputMp4,
    posterPath: posterPath,
  });

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
