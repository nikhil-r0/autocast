import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { KaneStep } from '../types.js';

export interface ReplaySegment {
  stepIndex: number;
  kind: 'idle' | 'action';
  srcStart: number;
  srcEnd: number;
  target?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  cursorTo?: [number, number];
}

export interface ReplayResult {
  videoPath: string;
  durationSec: number;
  segments: ReplaySegment[];
}

export async function replayAndRecord(
  steps: KaneStep[],
  startUrl: string = 'http://localhost:8080'
): Promise<ReplayResult> {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const tempVideoDir = path.join(publicDir, 'raw-captures');
  if (!fs.existsSync(tempVideoDir)) {
    fs.mkdirSync(tempVideoDir, { recursive: true });
  }

  console.log('[Path B Replay] Launching Playwright at 1920x1080 with crisp recording...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const startTime = Date.now();
  const getElapsedSec = () => (Date.now() - startTime) / 1000;

  const segments: ReplaySegment[] = [];

  // SCENE 1: Centralized Dashboard Overview (Wide Shot)
  console.log('[Path B Replay] Scene 1: Centralized Dashboard Overview...');
  const s1Start = getElapsedSec();
  await page.goto(startUrl, { waitUntil: 'networkidle' });
  // Move cursor to initial neutral position
  await page.mouse.move(960, 540);
  await page.waitForTimeout(3500); // 3.5s wide shot hold
  const s1End = getElapsedSec();

  segments.push({
    stepIndex: 1,
    kind: 'idle',
    srcStart: s1Start,
    srcEnd: s1End,
    target: { x: 0, y: 0, w: 1920, h: 1080 },
    cursorTo: [960, 540],
  });

  // SCENE 2: Locate Invoice Row & Click Review
  console.log('[Path B Replay] Scene 2: Selecting Invoice INV-1001 for Review...');
  const s2Start = getElapsedSec();
  const btnReview = page.locator('#btn-view-INV-1001');
  await btnReview.waitFor({ state: 'visible', timeout: 5000 });
  const rowBox = await page.locator('#row-INV-1001').boundingBox();
  const btnBox = await btnReview.boundingBox();

  const btnX = btnBox ? Math.round(btnBox.x + btnBox.width / 2) : 1650;
  const btnY = btnBox ? Math.round(btnBox.y + btnBox.height / 2) : 395;

  // Smooth mouse glide to button
  await page.mouse.move(btnX, btnY, { steps: 35 });
  await page.waitForTimeout(600);
  await btnReview.click();
  await page.waitForTimeout(1800); // Wait for modal to slide in
  const s2End = getElapsedSec();

  segments.push({
    stepIndex: 2,
    kind: 'action',
    srcStart: s2Start,
    srcEnd: s2End,
    target: rowBox ? {
      x: Math.round(rowBox.x),
      y: Math.round(rowBox.y),
      w: Math.round(rowBox.width),
      h: Math.round(rowBox.height),
    } : { x: 280, y: 350, w: 1360, h: 80 },
    cursorTo: [btnX, btnY],
  });

  // SCENE 3: Inspect Line Items in Review Modal
  console.log('[Path B Replay] Scene 3: Inspecting Line Items & Terms in Modal...');
  const s3Start = getElapsedSec();
  const modalCard = page.locator('#modal-card');
  await modalCard.waitFor({ state: 'visible', timeout: 5000 });
  const modalBox = await modalCard.boundingBox();

  const lineItems = page.locator('#modal-line-items');
  const lineBox = await lineItems.boundingBox();
  const inspectX = lineBox ? Math.round(lineBox.x + lineBox.width / 2) : 960;
  const inspectY = lineBox ? Math.round(lineBox.y + lineBox.height / 2) : 480;

  // Smooth mouse movement over line items
  await page.mouse.move(inspectX, inspectY, { steps: 30 });
  await page.waitForTimeout(3500); // Inspect billing details
  const s3End = getElapsedSec();

  segments.push({
    stepIndex: 3,
    kind: 'idle',
    srcStart: s3Start,
    srcEnd: s3End,
    target: modalBox ? {
      x: Math.round(modalBox.x),
      y: Math.round(modalBox.y),
      w: Math.round(modalBox.width),
      h: Math.round(modalBox.height),
    } : { x: 600, y: 150, w: 720, h: 700 },
    cursorTo: [inspectX, inspectY],
  });

  // SCENE 4: Authorize Disbursement (Click Approve Invoice)
  console.log('[Path B Replay] Scene 4: Authorizing Payment Disbursement...');
  const s4Start = getElapsedSec();
  const btnApprove = page.locator('#approve-invoice-btn');
  await btnApprove.waitFor({ state: 'visible', timeout: 5000 });
  const approveBox = await btnApprove.boundingBox();

  const approveX = approveBox ? Math.round(approveBox.x + approveBox.width / 2) : 1080;
  const approveY = approveBox ? Math.round(approveBox.y + approveBox.height / 2) : 750;

  await page.mouse.move(approveX, approveY, { steps: 30 });
  await page.waitForTimeout(600);
  await btnApprove.click();
  await page.waitForTimeout(1800); // Wait for approval animation & stamp
  const s4End = getElapsedSec();

  segments.push({
    stepIndex: 4,
    kind: 'action',
    srcStart: s4Start,
    srcEnd: s4End,
    target: approveBox ? {
      x: Math.round(approveBox.x - 40),
      y: Math.round(approveBox.y - 20),
      w: Math.round(approveBox.width + 80),
      h: Math.round(approveBox.height + 40),
    } : { x: 1000, y: 720, w: 200, h: 60 },
    cursorTo: [approveX, approveY],
  });

  // SCENE 5: Verify Approved Compliance Seal
  console.log('[Path B Replay] Scene 5: Verifying Digital Approval Seal...');
  const s5Start = getElapsedSec();
  const seal = page.locator('#approval-seal');
  await seal.waitFor({ state: 'visible', timeout: 5000 });
  const sealBox = await seal.boundingBox();

  const sealX = sealBox ? Math.round(sealBox.x + sealBox.width / 2) : 960;
  const sealY = sealBox ? Math.round(sealBox.y + sealBox.height / 2) : 660;

  await page.mouse.move(sealX, sealY, { steps: 25 });
  await page.waitForTimeout(3500); // 3.5s hold on seal
  const s5End = getElapsedSec();

  segments.push({
    stepIndex: 5,
    kind: 'idle',
    srcStart: s5Start,
    srcEnd: s5End,
    target: sealBox ? {
      x: Math.round(sealBox.x - 30),
      y: Math.round(sealBox.y - 20),
      w: Math.round(sealBox.width + 60),
      h: Math.round(sealBox.height + 40),
    } : { x: 700, y: 620, w: 520, h: 100 },
    cursorTo: [sealX, sealY],
  });

  // SCENE 6: Close Modal & Settle Updated Ledger
  console.log('[Path B Replay] Scene 6: Dismissing Modal & Viewing Reconciled Ledger...');
  const s6Start = getElapsedSec();
  const btnClose = page.locator('#close-modal-btn');
  await btnClose.waitFor({ state: 'visible', timeout: 5000 });
  const closeBox = await btnClose.boundingBox();
  const closeX = closeBox ? Math.round(closeBox.x + closeBox.width / 2) : 1260;
  const closeY = closeBox ? Math.round(closeBox.y + closeBox.height / 2) : 180;

  await page.mouse.move(closeX, closeY, { steps: 20 });
  await page.waitForTimeout(400);
  await btnClose.click();
  await page.waitForTimeout(1000); // Modal fades out

  // Glide cursor to updated status badge in table
  const statusPill = page.locator('#status-INV-1001');
  const statusBox = await statusPill.boundingBox();
  const pillX = statusBox ? Math.round(statusBox.x + statusBox.width / 2) : 960;
  const pillY = statusBox ? Math.round(statusBox.y + statusBox.height / 2) : 400;

  await page.mouse.move(pillX, pillY, { steps: 30 });
  await page.waitForTimeout(2500); // Hold final reconciled view
  const s6End = getElapsedSec();

  segments.push({
    stepIndex: 6,
    kind: 'action',
    srcStart: s6Start,
    srcEnd: s6End,
    target: { x: 0, y: 0, w: 1920, h: 1080 }, // Full wide shot
    cursorTo: [pillX, pillY],
  });

  const totalElapsed = getElapsedSec();

  await page.close();
  await context.close();
  await browser.close();

  // Find the generated video file
  const videoFiles = fs.readdirSync(tempVideoDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    throw new Error('Playwright recording did not produce a video file.');
  }

  videoFiles.sort((a, b) => {
    return fs.statSync(path.join(tempVideoDir, b)).mtimeMs - fs.statSync(path.join(tempVideoDir, a)).mtimeMs;
  });

  const latestRawVideo = path.join(tempVideoDir, videoFiles[0]);
  const finalVideoName = 'source.mp4';
  const finalVideoPath = path.join(publicDir, finalVideoName);

  fs.copyFileSync(latestRawVideo, finalVideoPath);
  console.log(`[Path B Replay] Video captured successfully -> ${finalVideoPath} (${totalElapsed.toFixed(1)}s, 6 cinematic scenes)`);

  return {
    videoPath: finalVideoName,
    durationSec: totalElapsed,
    segments,
  };
}
