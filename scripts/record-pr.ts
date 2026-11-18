import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

async function recordPrEvidence() {
  const prUrl = process.env.PR_URL;
  const isLiveGitHub = Boolean(prUrl);

  if (isLiveGitHub) {
    const parsed = new URL(prUrl!);
    if (parsed.hostname !== 'github.com' || !parsed.pathname.match(/^\/nikhil-r0\/autocast\/pull\/\d+$/)) {
      throw new Error(`Unexpected GitHub PR URL: ${prUrl}. Expected pattern: https://github.com/nikhil-r0/autocast/pull/<id>`);
    }
    console.log(`[Playwright PR Recorder] Target: LIVE GitHub Pull Request -> ${prUrl}`);
  } else {
    console.warn('[Playwright PR Recorder] WARNING: PR_URL not provided. Falling back to local hermetic mockup.');
    console.warn('[Playwright PR Recorder] To record the actual live GitHub PR, supply PR_URL=https://github.com/nikhil-r0/autocast/pull/<id>');
  }

  const publicDir = path.join(process.cwd(), 'public');
  const tempDir = path.join(publicDir, 'raw-pr-captures');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log('[Playwright PR Recorder] Launching Chromium 1920x1080...');
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

  if (isLiveGitHub) {
    console.log(`[Playwright PR Recorder] Navigating to ${prUrl}...`);
    await page.goto(prUrl!, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Allow fonts and styles to settle

    // Validate page header is present
    try {
      await page.waitForSelector('h1.gh-header-title, #partial-discussion-header', { timeout: 8000 });
      const title = await page.title();
      console.log(`[Playwright PR Recorder] Confirmed PR Title: "${title}"`);
    } catch {
      console.warn('[Playwright PR Recorder] Warning: Discussion header not immediately detected.');
    }

    // Smooth scroll down through Kane report and PR description
    console.log('[Playwright PR Recorder] Scrolling PR overview & Kane assurance report...');
    await page.mouse.move(960, 400, { steps: 20 });
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    // Scroll back to top to switch to Files changed tab
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);

    // Click "Files changed" tab if available
    const filesTab = page.locator('a[data-tab-item="files-tab"], a[href$="/files"], #files-tab').first();
    if (await filesTab.isVisible()) {
      console.log('[Playwright PR Recorder] Clicking "Files changed" diff tab...');
      await filesTab.click();
      await page.waitForTimeout(2000);

      // Scroll through the diff
      console.log('[Playwright PR Recorder] Scrolling through verified code diff...');
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
    }
  } else {
    const prHtmlPath = path.join(publicDir, 'pr-evidence.html');
    const fileUrl = `file://${prHtmlPath}`;
    console.log(`[Playwright PR Recorder] Opening ${fileUrl}...`);
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(2000);

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
    await page.waitForTimeout(3500);
  }

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

  // Convert with ffmpeg enforcing 30 fps (r_frame_rate: 30/1) to match Remotion composition
  console.log('[Playwright PR Recorder] Transcoding video to 1080p @ 30 FPS (H.264)...');
  execSync(`ffmpeg -y -i "${latestRawVideo}" -r 30 -c:v libx264 -pix_fmt yuv420p "${finalVideoPath}"`, {
    stdio: 'ignore',
  });

  console.log(`[Playwright PR Recorder] ✓ PR Evidence video captured at 30 FPS: ${finalVideoPath}`);
}

recordPrEvidence().catch((err) => {
  console.error('[Playwright PR Recorder] Error:', err);
  process.exit(1);
});
