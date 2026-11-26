import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { KaneStep } from '../types.js';
import { ActionIR, parseActionsLogToActionIR, findActionsLog, verifyOutcomeSpecs } from './actionIR.js';

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

/**
 * Replays and records the verified browser workflow in 1080p using Playwright.
 * 
 * Note on Scope:
 * While Action IR parsing and Machine OutcomeSpec verification are generalized,
 * the cinematic camera choreography, cursor easing, and 6-scene sequence below
 * are tailored specifically to the Ledgerly invoice approval flow for this demo.
 * Arbitrary-app dynamic replay is on the post-hackathon roadmap.
 */
export async function replayAndRecord(
  steps: KaneStep[],
  startUrl: string = 'http://localhost:8080',
  options?: {
    actionIR?: ActionIR;
    sessionDir?: string;
  }
): Promise<ReplayResult> {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const tempVideoDir = path.join(publicDir, 'raw-captures');
  if (!fs.existsSync(tempVideoDir)) {
    fs.mkdirSync(tempVideoDir, { recursive: true });
  }

  // Resolve Action IR
  let actionIR = options?.actionIR;
  if (!actionIR && options?.sessionDir) {
    const actionsLog = findActionsLog(options.sessionDir);
    if (actionsLog && fs.existsSync(actionsLog)) {
      try {
        const content = fs.readFileSync(actionsLog, 'utf-8');
        actionIR = parseActionsLogToActionIR(content, { fallbackUrl: startUrl });
        console.log(`[Path B Replay] Ingested Action IR from ${actionsLog} (${actionIR.actions.length} action(s), ${actionIR.outcomeSpecs.length} outcome spec(s))`);
      } catch (err) {
        console.warn(`[Path B Replay] Could not parse action IR: ${err}`);
      }
    }
  }

  console.log('[Path B Replay] Launching Playwright at 1920x1080 with crisp recording...');

  // Reset database state for clean, repeatable replay
  const baseUrl = startUrl.split('?')[0].replace(/\/+$/, '');
  try {
    const res = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    if (res.ok) {
      console.log(`[Path B Replay] ✓ Reset application state to fresh seed data at ${baseUrl}`);
    } else {
      console.warn(`[Path B Replay] Warning: Reset failed with status ${res.status}`);
    }
  } catch (e) {
    console.warn(`[Path B Replay] Warning: Reset request error: ${e}`);
  }

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
  const targetPageUrl = startUrl.includes('?') ? startUrl : `${startUrl}/?logged_in=true`;

  // SCENE 1: Centralized Dashboard Overview (Wide Shot)
  console.log('[Path B Replay] Scene 1: Centralized Dashboard Overview...');
  const s1Start = getElapsedSec();
  await page.goto(targetPageUrl, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="kpi-cards-grid"]').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('[data-testid="invoices-table"]').waitFor({ state: 'visible', timeout: 8000 });

  // Move cursor to initial position over Pending approvals KPI
  const kpiBox = await page.locator('[data-testid="kpi-pending-value"]').boundingBox();
  const kpiX = kpiBox ? Math.round(kpiBox.x + kpiBox.width / 2) : 500;
  const kpiY = kpiBox ? Math.round(kpiBox.y + kpiBox.height / 2) : 180;
  await page.mouse.move(kpiX, kpiY, { steps: 25 });
  await page.waitForTimeout(3500); // 3.5s wide shot hold
  const s1End = getElapsedSec();

  segments.push({
    stepIndex: 1,
    kind: 'idle',
    srcStart: s1Start,
    srcEnd: s1End,
    target: { x: 0, y: 0, w: 1920, h: 1080 },
    cursorTo: [kpiX, kpiY],
  });

  // SCENE 2: Locate Invoice Row & Click Review
  console.log('[Path B Replay] Scene 2: Selecting Invoice INV-1042 for Review...');
  const s2Start = getElapsedSec();
  const btnReview = page.locator('[data-testid="btn-review-INV-1042"]');
  await btnReview.waitFor({ state: 'visible', timeout: 5000 });
  const rowBox = await page.locator('[data-testid="invoice-row-INV-1042"]').boundingBox();
  const btnBox = await btnReview.boundingBox();

  const btnX = btnBox ? Math.round(btnBox.x + btnBox.width / 2) : 1650;
  const btnY = btnBox ? Math.round(btnBox.y + btnBox.height / 2) : 395;

  // Smooth mouse glide to button
  await page.mouse.move(btnX, btnY, { steps: 35 });
  await page.waitForTimeout(600);
  await btnReview.click();
  await page.locator('[data-testid="invoice-drawer"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1800); // Wait for drawer to slide in
  const s2End = getElapsedSec();

  segments.push({
    stepIndex: 2,
    kind: 'action',
    srcStart: s2Start,
    srcEnd: s2End,
    target: rowBox
      ? {
          x: Math.round(rowBox.x),
          y: Math.round(rowBox.y),
          w: Math.round(rowBox.width),
          h: Math.round(rowBox.height),
        }
      : { x: 280, y: 350, w: 1360, h: 80 },
    cursorTo: [btnX, btnY],
  });

  // SCENE 3: Inspect Line Items in Review Drawer
  console.log('[Path B Replay] Scene 3: Inspecting Line Items & Terms in Drawer...');
  const s3Start = getElapsedSec();
  const drawer = page.locator('[data-testid="invoice-drawer"]');
  await drawer.waitFor({ state: 'visible', timeout: 5000 });
  const drawerBox = await drawer.boundingBox();

  const lineItems = page.locator('[data-testid="line-items-table"]');
  const lineBox = await lineItems.boundingBox();
  const inspectX = lineBox ? Math.round(lineBox.x + lineBox.width / 2) : 1550;
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
    target: drawerBox
      ? {
          x: Math.round(drawerBox.x),
          y: Math.round(drawerBox.y),
          w: Math.round(drawerBox.width),
          h: Math.round(drawerBox.height),
        }
      : { x: 1300, y: 0, w: 620, h: 1080 },
    cursorTo: [inspectX, inspectY],
  });

  // SCENE 4: Click Approve Invoice and Confirm
  console.log('[Path B Replay] Scene 4: Authorizing Payment Disbursement...');
  const s4Start = getElapsedSec();
  const btnOpenModal = page.locator('[data-testid="btn-open-approve-modal"]');
  await btnOpenModal.waitFor({ state: 'visible', timeout: 5000 });
  const openBox = await btnOpenModal.boundingBox();

  const openX = openBox ? Math.round(openBox.x + openBox.width / 2) : 1750;
  const openY = openBox ? Math.round(openBox.y + openBox.height / 2) : 1020;

  await page.mouse.move(openX, openY, { steps: 25 });
  await page.waitForTimeout(400);
  await btnOpenModal.click();

  // Wait for approve modal
  const modal = page.locator('[data-testid="approve-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 5000 });
  const modalBox = await modal.boundingBox();

  const noteInput = page.locator('[data-testid="input-approval-note"]');
  await noteInput.waitFor({ state: 'visible', timeout: 5000 });
  const noteBox = await noteInput.boundingBox();
  const noteX = noteBox ? Math.round(noteBox.x + noteBox.width / 2) : 960;
  const noteY = noteBox ? Math.round(noteBox.y + noteBox.height / 2) : 540;

  await page.mouse.move(noteX, noteY, { steps: 20 });
  await noteInput.fill('Approved under Q4 infra budget.');
  await page.waitForTimeout(500);

  const btnConfirm = page.locator('[data-testid="btn-confirm-approve"]');
  await btnConfirm.waitFor({ state: 'visible', timeout: 5000 });
  const confirmBox = await btnConfirm.boundingBox();
  const confirmX = confirmBox ? Math.round(confirmBox.x + confirmBox.width / 2) : 1100;
  const confirmY = confirmBox ? Math.round(confirmBox.y + confirmBox.height / 2) : 620;

  await page.mouse.move(confirmX, confirmY, { steps: 20 });
  await page.waitForTimeout(400);
  await btnConfirm.click();
  await page.waitForTimeout(1800); // Wait for modal to close and stamp to animate
  const s4End = getElapsedSec();

  segments.push({
    stepIndex: 4,
    kind: 'action',
    srcStart: s4Start,
    srcEnd: s4End,
    target: modalBox
      ? {
          x: Math.round(modalBox.x),
          y: Math.round(modalBox.y),
          w: Math.round(modalBox.width),
          h: Math.round(modalBox.height),
        }
      : { x: 700, y: 350, w: 520, h: 380 },
    cursorTo: [confirmX, confirmY],
  });

  // SCENE 5: Verify Approved Compliance Seal
  console.log('[Path B Replay] Scene 5: Verifying Digital Approval Seal...');
  const s5Start = getElapsedSec();
  const seal = page.locator('[data-testid="approved-seal"]');
  await seal.waitFor({ state: 'visible', timeout: 5000 });
  const sealBox = await seal.boundingBox();

  const sealX = sealBox ? Math.round(sealBox.x + sealBox.width / 2) : 1720;
  const sealY = sealBox ? Math.round(sealBox.y + sealBox.height / 2) : 220;

  await page.mouse.move(sealX, sealY, { steps: 25 });
  await page.waitForTimeout(3500); // 3.5s hold on seal
  const s5End = getElapsedSec();

  // Semantic Equivalence Verification (TEST-09) while drawer & approved seal are visible
  const specsToVerify = actionIR?.outcomeSpecs || [
    {
      id: 'seal-visibility',
      verification: {
        type: 'visible',
        selector: '[data-testid="status-badge-INV-1042"]',
      },
    },
    {
      id: 'api-state-approved',
      verification: {
        type: 'api_state',
        endpoint: '/api/invoices/INV-1042',
        jsonPath: 'status',
        expected: 'Approved',
      },
    },
  ];

  console.log(`[Path B Replay] Verifying ${specsToVerify.length} Machine OutcomeSpec(s)...`);
  const outcomeResult = await verifyOutcomeSpecs(page, specsToVerify, baseUrl);
  if (!outcomeResult.passed) {
    await page.close();
    await context.close();
    await browser.close();
    throw new Error(`Replay rejected for semantic non-equivalence: ${outcomeResult.failures.join('; ')}`);
  }
  console.log('[Path B Replay] ✓ All Machine OutcomeSpecs verified successfully.');

  segments.push({
    stepIndex: 5,
    kind: 'idle',
    srcStart: s5Start,
    srcEnd: s5End,
    target: sealBox
      ? {
          x: Math.round(sealBox.x - 30),
          y: Math.round(sealBox.y - 20),
          w: Math.round(sealBox.width + 60),
          h: Math.round(sealBox.height + 40),
        }
      : { x: 1600, y: 180, w: 220, h: 100 },
    cursorTo: [sealX, sealY],
  });

  // SCENE 6: Close Drawer & Settle Reconciled Ledger
  console.log('[Path B Replay] Scene 6: Dismissing Drawer & Viewing Reconciled Ledger...');
  const s6Start = getElapsedSec();
  const btnClose = page.locator('[data-testid="btn-close-drawer"]');
  await btnClose.waitFor({ state: 'visible', timeout: 5000 });
  const closeBox = await btnClose.boundingBox();
  const closeX = closeBox ? Math.round(closeBox.x + closeBox.width / 2) : 1880;
  const closeY = closeBox ? Math.round(closeBox.y + closeBox.height / 2) : 40;

  await page.mouse.move(closeX, closeY, { steps: 20 });
  await page.waitForTimeout(400);
  await btnClose.click();
  await page.waitForTimeout(1000); // Drawer slides out

  // Glide cursor to updated status badge in table
  const statusPill = page.locator('[data-testid="status-badge-INV-1042"]');
  await statusPill.waitFor({ state: 'visible', timeout: 5000 });
  const statusBox = await statusPill.boundingBox();
  const pillX = statusBox ? Math.round(statusBox.x + statusBox.width / 2) : 1500;
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
