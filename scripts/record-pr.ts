import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function recordPrEvidence() {
  console.log('[Playwright PR Recorder] Launching Chromium 1920x1080...');
  
  const publicDir = path.join(process.cwd(), 'public');
  const tempDir = path.join(publicDir, 'raw-pr-captures');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const prHtmlPath = path.join(publicDir, 'pr-evidence.html');
  const fileUrl = `file://${prHtmlPath}`;

  console.log(`[Playwright PR Recorder] Opening ${fileUrl}...`);
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(2000); // 2s initial overview

  // Smooth scroll down to PR diff
  console.log('[Playwright PR Recorder] Scrolling to patch diff...');
  await page.mouse.move(960, 500, { steps: 25 });
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  // Smooth scroll down to Kane verification table
  console.log('[Playwright PR Recorder] Scrolling to Kane verification table...');
  await page.evaluate(() => window.scrollBy({ top: 480, behavior: 'smooth' }));
  await page.waitForTimeout(2800);

  // Move cursor over attached evidence pills
  await page.mouse.move(620, 680, { steps: 30 });
  await page.waitForTimeout(1500);

  // Smooth scroll down to Before/After visual comparison
  console.log('[Playwright PR Recorder] Inspecting Before/After Kane visual screenshots...');
  await page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' }));
  await page.waitForTimeout(3500); // 3.5s hold on screenshots

  await page.close();
  await context.close();
  await browser.close();

  // Find generated video
  const videoFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    throw new Error('Playwright recording did not produce a video file.');
  }

  videoFiles.sort((a, b) => {
    return fs.statSync(path.join(tempDir, b)).mtimeMs - fs.statSync(path.join(tempDir, a)).mtimeMs;
  });

  const latestRawVideo = path.join(tempDir, videoFiles[0]);
  const finalVideoPath = path.join(publicDir, 'pr-recording.mp4');

  // Convert/copy with ffmpeg for h264 compatibility
  const { execSync } = await import('child_process');
  execSync(`ffmpeg -y -i "${latestRawVideo}" -c:v libx264 -pix_fmt yuv420p "${finalVideoPath}"`, {
    stdio: 'ignore',
  });

  console.log(`[Playwright PR Recorder] ✓ PR Evidence video captured: ${finalVideoPath}`);
}

recordPrEvidence().catch((err) => {
  console.error('[Playwright PR Recorder] Error:', err);
  process.exit(1);
});

