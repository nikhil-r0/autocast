import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { executeKaneRun } from '../shoot/kane.js';
import { Storyboard } from '../types.js';

export interface VisualReviewResult {
  passed: boolean;
  frameNumber: number;
  objective: string;
  summary: string;
  kaneTestUrl?: string;
  creditsConsumed?: number;
  flawDetected?: boolean;
}

/**
 * Render a still frame from the Remotion composition.
 */
export async function renderStillFrame(frameNumber: number): Promise<string> {
  const reviewDir = path.join(process.cwd(), 'out', 'review');
  if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
  }

  const outputPath = path.join(reviewDir, `frame-${frameNumber}.png`);

  console.log(`[Loop 3 Review] Rendering frame ${frameNumber} for visual QA -> ${outputPath}...`);

  return new Promise((resolve, reject) => {
    const child = spawn('npx', [
      'remotion',
      'still',
      'Demo',
      outputPath,
      `--frame=${frameNumber}`,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[Loop 3 Review] Frame ${frameNumber} rendered successfully.`);
        resolve(outputPath);
      } else {
        reject(new Error(`Failed to render still frame ${frameNumber}: ${stderr}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Run Kane CLI visual review against the rendered frame review endpoint.
 */
export async function reviewFrameWithKane(
  frameNumber: number,
  reviewUrl: string = 'http://localhost:8080/review',
  isTransitionBoundary: boolean = false
): Promise<VisualReviewResult> {
  // Render the still frame first
  await renderStillFrame(frameNumber);

  const targetUrl = `${reviewUrl}?frame=${frameNumber}`;
  const objective = isTransitionBoundary
    ? `Open ${targetUrl} and inspect the scene transition boundary frame: verify that the viewport layout is properly contained without element clipping or visual tearing, and verify the workflow sidebar on the right renders clearly without overlapping text.`
    : `Open ${targetUrl} and verify that the application layout is properly contained inside the browser window without being cropped off at the edges, and verify the workflow sidebar on the right shows the step title without text overlap.`;

  console.log(`\n[Loop 3 Review] Executing Kane Vision QA on frame ${frameNumber} (transitionBoundary=${isTransitionBoundary})...`);
  console.log(`  Objective: "${objective}"`);

  const kaneResult = await executeKaneRun({
    objective,
    url: targetUrl,
    name: `kane-review-frame-${frameNumber}`,
    timeoutSec: 90,
  });

  const passed = kaneResult.passed;

  return {
    passed,
    frameNumber,
    objective,
    summary: kaneResult.summary || (passed ? 'Frame passed visual QA' : 'Visual flaw detected in rendered frame'),
    kaneTestUrl: kaneResult.testUrl,
    creditsConsumed: kaneResult.creditsConsumed,
    flawDetected: !passed,
  };
}

/**
 * Execute Loop 3 Review across key sampled frames (overview, mid-transition, detail).
 */
export async function executeReviewLoop(
  storyboard: Storyboard,
  appUrl: string = 'http://localhost:8080'
): Promise<{ passed: boolean; reviews: VisualReviewResult[] }> {
  console.log('\n================================================================');
  console.log('🔍 PHASE 5: LOOP 3 REVIEW LOOP (Kane Visual Video QA)');
  console.log('   "Kane checks our own video edit to catch visual clipping, transition tearing & overlap"');
  console.log('================================================================');

  const fps = storyboard.meta.fps || 30;
  const titleFrames = 75; // 2.5s
  const firstSceneFrames = Math.round((storyboard.scenes[0]?.audio_sec || 4.0) * fps);
  const transitionBoundaryFrame = titleFrames + firstSceneFrames + 3; // 3 frames into scene 2 transition

  // Sample frames:
  // 1. Frame 115: Scene 1 Dashboard Overview (Settled Wide Shot)
  // 2. Mid-transition Boundary Frame (Transition cut point)
  // 3. Frame 260: Scene 3 Invoice Line Items Review (Detail View)
  const sampleFrames = [
    { frame: 115, isBoundary: false, desc: 'Scene 1 Dashboard Overview' },
    { frame: transitionBoundaryFrame, isBoundary: true, desc: `Scene Transition Boundary (Frame ${transitionBoundaryFrame})` },
    { frame: 260, isBoundary: false, desc: 'Scene 3 Modal Line Items Detail' },
  ];

  const reviews: VisualReviewResult[] = [];

  for (const item of sampleFrames) {
    console.log(`\n[Loop 3 QA Sample] Inspecting: ${item.desc}...`);
    const result = await reviewFrameWithKane(item.frame, `${appUrl}/review`, item.isBoundary);
    reviews.push(result);

    if (result.passed) {
      console.log(`✓ Frame ${item.frame} PASSED Visual QA: ${result.summary}`);
    } else {
      console.warn(`✗ Frame ${item.frame} FLAGGED VISUAL FLAW: ${result.summary}`);
      if (result.kaneTestUrl) {
        console.warn(`  Kane Evidence: ${result.kaneTestUrl}`);
      }
    }
  }

  const allPassed = reviews.every((r) => r.passed);
  return { passed: allPassed, reviews };
}

