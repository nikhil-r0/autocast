import { spawn } from 'child_process';
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
  const serverScript = path.join(process.cwd(), 'examples', 'invoice-app', 'server.js');
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

  const appUrl = process.env.TARGET_APP_URL || 'http://localhost:8080';
  await ensureSampleAppRunning(8080);

  // 1. SHOOT LOOP (Loop 1: Kane CLI Verification)
  console.log('\n--- PHASE 1: SHOOT & VERIFY (Loop 1) ---');
  let objectivePlan = await generateKaneObjective(userPrompt, appUrl);
  console.log(`Generated Objective: "${objectivePlan.objective}"`);

  let shootAttempts = 0;
  const maxShootAttempts = 3;
  let kaneResult;

  while (shootAttempts < maxShootAttempts) {
    shootAttempts++;
    console.log(`\n[Shoot Loop] Attempt ${shootAttempts}/${maxShootAttempts}...`);

    kaneResult = await executeKaneRun({
      objective: objectivePlan.objective,
      url: appUrl,
    });

    const classification = classifyKaneRun(kaneResult);

    if (classification.type === 'product_defect') {
      // STOP-ON-BUG: The centerpiece of Autocast AI
      console.error(classification.report);
      process.exit(1);
    }

    if (classification.type === 'pass') {
      console.log(`\n✓ Kane CLI verified feature: "${objectivePlan.expectedVerification}"`);
      if (kaneResult.creditsConsumed) {
        console.log(`  Credits consumed: ${kaneResult.creditsConsumed.toFixed(2)}`);
      }
      break;
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
  const replayResult = await replayAndRecord(kaneResult.steps, appUrl);

  // 3. EDIT PHASE: Narration & Storyboard
  console.log('\n--- PHASE 3: EDITING & STORYBOARD ---');
  console.log('[Edit] Generating scene captions and voiceover narration with Gemini...');
  const narrations = await generateNarration(kaneResult.steps, objectivePlan.title, replayResult.segments.length);

  const storyboard = buildStoryboard(
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
    const reviewResult = await executeReviewLoop(storyboard, appUrl);
    if (!reviewResult.passed) {
      console.warn('\n[Loop 3 Review] Kane flagged visual QA warnings on rendered frames.');
      const repair = repairVisualDefects(storyboard, reviewResult.reviews);
      if (repair.repaired) {
        console.log(`[Loop 3 Autonomous Repair] Applied ${repair.actionsTaken.length} layout fix(es):`);
        repair.actionsTaken.forEach((act) => console.log(`  - ${act}`));
        // Re-write updated storyboard
        fs.writeFileSync(
          path.join(process.cwd(), 'storyboard.json'),
          JSON.stringify(repair.storyboard, null, 2)
        );
        fs.writeFileSync(
          path.join(process.cwd(), 'public', 'storyboard.json'),
          JSON.stringify(repair.storyboard, null, 2)
        );
      }
    } else {
      console.log('\n✓ Loop 3 Visual QA: Kane confirmed video layout, typography, and framing are defect-free.');
    }
  } else {
    console.log('\n[Loop 3 Review] Skipped via --skip-review flag.');
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
  try {
    const ocrResult = await scanVideoPixelsForSecrets(outputMp4);
    if (!ocrResult.passed) {
      console.error('[Pixel Safety OCR] ❌ Warning: Potential secret patterns detected in video pixels!');
    }
  } catch (ocrErr: any) {
    console.warn(`[Pixel Safety OCR] OCR audit warning: ${ocrErr.message}`);
  }

  // Sync to examples/output for docs & sample delivery
  const examplesOutDir = path.join(process.cwd(), 'examples', 'output');
  if (fs.existsSync(examplesOutDir)) {
    fs.copyFileSync(outputMp4, path.join(examplesOutDir, 'sample-demo.mp4'));
    if (fs.existsSync(posterPath)) {
      fs.copyFileSync(posterPath, path.join(examplesOutDir, 'poster.jpg'));
    }
    fs.copyFileSync(sharePath, path.join(examplesOutDir, 'share-copy.txt'));
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
