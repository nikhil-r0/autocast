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
  reviewUrl: string = 'http://localhost:8080/review'
): Promise<VisualReviewResult> {
  // Render the still frame first
  await renderStillFrame(frameNumber);

  const targetUrl = `${reviewUrl}?frame=${frameNumber}`;
  const objective = `Open ${targetUrl} and verify that the application layout is properly contained inside the browser window without being cropped off at the edges, and verify the workflow sidebar on the right shows the step title without text overlap.`;

  console.log(`\n[Loop 3 Review] Executing Kane Vision QA on frame ${frameNumber}...`);
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
 * Execute Loop 3 Review across key sampled frames.
 */
export async function executeReviewLoop(
  storyboard: Storyboard,
  appUrl: string = 'http://localhost:8080'
): Promise<{ passed: boolean; reviews: VisualReviewResult[] }> {
  console.log('\n================================================================');
  console.log('🔍 PHASE 6: LOOP 3 REVIEW LOOP (Kane Visual Video QA)');
  console.log('   "Kane checks our own video edit to catch visual clipping & overlap"');
  console.log('================================================================');

  // Sample frames:
  // Frame 115: Scene 1 Dashboard Overview (Wide Shot)
  // Frame 260: Scene 3 Invoice Line Items Review
  const sampleFrames = [115, 260];
  const reviews: VisualReviewResult[] = [];

  for (const frameNum of sampleFrames) {
    const result = await reviewFrameWithKane(frameNum, `${appUrl}/review`);
    reviews.push(result);

    if (result.passed) {
      console.log(`✓ Frame ${frameNum} PASSED Visual QA: ${result.summary}`);
    } else {
      console.warn(`✗ Frame ${frameNum} FLAGGED VISUAL FLAW: ${result.summary}`);
      if (result.kaneTestUrl) {
        console.warn(`  Kane Evidence: ${result.kaneTestUrl}`);
      }
    }
  }

  const allPassed = reviews.every((r) => r.passed);
  return { passed: allPassed, reviews };
}

