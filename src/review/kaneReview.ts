import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
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

function getCachePath(): string {
  const reviewDir = path.join(process.cwd(), 'out', 'review');
  if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
  }
  return path.join(reviewDir, 'review-cache.json');
}

function loadReviewCache(): Record<string, VisualReviewResult> {
  const cacheFile = getCachePath();
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveReviewCache(cache: Record<string, VisualReviewResult>): void {
  const cacheFile = getCachePath();
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Loop 3 Cache] Warning: Failed to save review cache:', err);
  }
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
  const imagePath = await renderStillFrame(frameNumber);

  // Compute image content hash for smart caching
  const imageHash = crypto.createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex');
  const cacheKey = `${imageHash}:${isTransitionBoundary ? 'boundary' : 'standard'}`;
  const cache = loadReviewCache();

  if (cache[cacheKey] && cache[cacheKey].passed) {
    console.log(`[Loop 3 Review] ✓ Cache hit: Frame ${frameNumber} (hash ${imageHash.slice(0, 8)}) previously verified.`);
    return {
      ...cache[cacheKey],
      frameNumber,
    };
  }

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
  const result: VisualReviewResult = {
    passed,
    frameNumber,
    objective,
    summary: kaneResult.summary || (passed ? 'Frame passed visual QA' : 'Visual flaw detected in rendered frame'),
    kaneTestUrl: kaneResult.testUrl,
    creditsConsumed: kaneResult.creditsConsumed,
    flawDetected: !passed,
  };

  if (passed) {
    cache[cacheKey] = result;
    saveReviewCache(cache);
  }

  return result;
}

/**
 * Execute Loop 3 Review across key sampled frames (overview, mid-transition, detail).
 */
export async function executeReviewLoop(
  storyboard: Storyboard,
  appUrl: string = 'http://localhost:8080',
  framesToCheck?: number[]
): Promise<{ passed: boolean; reviews: VisualReviewResult[] }> {
  console.log('\n================================================================');
  console.log('🔍 PHASE 5: LOOP 2/3 REVIEW LOOP (Kane Visual Video QA)');
  console.log('   "Kane checks our own video edit to catch visual clipping, transition tearing & overlap"');
  console.log('================================================================');

  const fps = storyboard.meta.fps || 30;
  const titleFrames = 75; // 2.5s
  const firstSceneFrames = Math.round((storyboard.scenes[0]?.audio_sec || 4.0) * fps);
  const transitionBoundaryFrame = titleFrames + firstSceneFrames + 3; // 3 frames into scene 2 transition

  let baseReviewUrl = 'http://localhost:8080/review';
  try {
    const parsed = new URL(appUrl);
    baseReviewUrl = `${parsed.origin}/review`;
  } catch {
    baseReviewUrl = 'http://localhost:8080/review';
  }

  // Baseline Sample frames:
  // 1. Frame 115: Scene 1 Dashboard Overview (Settled Wide Shot)
  // 2. Mid-transition Boundary Frame (Transition cut point)
  // 3. Frame 260: Scene 3 Invoice Line Items Review (Detail View)
  const allDefaultFrames = [
    { frame: 115, isBoundary: false, desc: 'Scene 1 Dashboard Overview' },
    { frame: transitionBoundaryFrame, isBoundary: true, desc: `Scene Transition Boundary (Frame ${transitionBoundaryFrame})` },
    { frame: 260, isBoundary: false, desc: 'Scene 3 Modal Line Items Detail' },
  ];

  const sampleFrames = framesToCheck && framesToCheck.length > 0
    ? framesToCheck.map((f) => {
        const found = allDefaultFrames.find((df) => df.frame === f);
        return found || { frame: f, isBoundary: f === transitionBoundaryFrame, desc: `Preview Frame ${f}` };
      })
    : allDefaultFrames;

  // Run visual review sequentially across the sampled frames
  const reviews: VisualReviewResult[] = [];
  for (const item of sampleFrames) {
    console.log(`\n[Loop 3 QA Sample] Inspecting: ${item.desc}...`);
    const result = await reviewFrameWithKane(item.frame, baseReviewUrl, item.isBoundary);
    if (result.passed) {
      console.log(`✓ Frame ${item.frame} PASSED Visual QA: ${result.summary}`);
    } else {
      console.warn(`✗ Frame ${item.frame} FLAGGED VISUAL FLAW: ${result.summary}`);
      if (result.kaneTestUrl) {
        console.warn(`  Kane Evidence: ${result.kaneTestUrl}`);
      }
    }
    reviews.push(result);
  }

  const allPassed = reviews.every((r) => r.passed);
  return { passed: allPassed, reviews };
}

