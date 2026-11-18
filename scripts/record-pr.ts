import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

interface ProbeResult {
  streams?: Array<{
    width?: number;
    height?: number;
    r_frame_rate?: string;
  }>;
  format?: {
    duration?: string;
  };
}

function verifyRecordedVideo(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Recorded PR video missing at: ${filePath}`);
  }

  const raw = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of json "${filePath}"`,
    { encoding: 'utf-8' }
  );

  const probe: ProbeResult = JSON.parse(raw);
  const stream = probe.streams?.[0];
  const duration = parseFloat(probe.format?.duration || '0');

  if (!stream) {
    throw new Error('Recorded PR video has no valid video stream.');
  }

  if (stream.width !== 1920 || stream.height !== 1080) {
    throw new Error(`Recorded PR video must be 1920x1080. Got ${stream.width}x${stream.height}`);
  }

  const [num, den] = (stream.r_frame_rate || '0/1').split('/').map((n) => parseInt(n, 10));
  const fps = den ? num / den : 0;
  if (Math.round(fps) !== 30) {
    throw new Error(`Recorded PR video must be 30 FPS. Got ${fps.toFixed(2)} (${stream.r_frame_rate})`);
  }

  if (duration < 5) {
    throw new Error(`Recorded PR video is too short (${duration.toFixed(1)}s < 5s minimum).`);
  }

  console.log(`[Playwright PR Recorder] ✓ FFprobe verified: 1920x1080 @ ${fps} FPS (${duration.toFixed(1)}s)`);
}

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
    if (process.env.ALLOW_MOCK_PR !== 'true') {
      throw new Error(
        'PR_URL environment variable is required to record live GitHub PR evidence.\n' +
        'Set PR_URL=https://github.com/nikhil-r0/autocast/pull/<id> or explicitly set ALLOW_MOCK_PR=true for development offline testing.'
      );
    }
    console.warn('[Playwright PR Recorder] WARNING: PR_URL not provided. Falling back to local hermetic mockup (ALLOW_MOCK_PR=true).');
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

    // 1. Mandatory Discussion Header Check
    const headerSelector = 'h1.gh-header-title, #partial-discussion-header';
    try {
      await page.waitForSelector(headerSelector, { timeout: 15000 });
    } catch {
      throw new Error(`Failed to locate PR discussion header (${headerSelector}) on live PR: ${prUrl}`);
    }

    const title = await page.title();
    console.log(`[Playwright PR Recorder] Confirmed PR Title: "${title}"`);

    // 2. Strict Head Branch Verification - Must match expected branch
    const expectedBranch = process.env.PR_BRANCH || 'fix/ledgerly-approve-noop';
    const branchLocator = page.locator('.commit-ref.head-ref, span.commit-ref, a.commit-ref');
    const branchCount = await branchLocator.count();
    let foundBranch = false;
    for (let i = 0; i < branchCount; i++) {
      const txt = await branchLocator.nth(i).textContent();
      if (txt && txt.trim() === expectedBranch) {
        foundBranch = true;
        console.log(`[Playwright PR Recorder] ✓ Confirmed Head Branch in UI: "${txt.trim()}"`);
        break;
      }
    }
    if (!foundBranch) {
      throw new Error(`PR head branch mismatch: expected branch "${expectedBranch}" not found on live PR page: ${prUrl}`);
    }

    // 3. Mandatory Genuine Kane Assurance Content Verification
    const bodyLocator = page.locator('#issue-body, .comment-body, .markdown-body').first();
    const bodyText = (await bodyLocator.textContent({ timeout: 10000 })) || '';
    
    const hasKaneResult740 = bodyText.includes('740') || bodyText.includes('Confirmed product bug') || bodyText.includes('approve-noop');
    const hasKaneResult100 = bodyText.includes('100') || bodyText.includes('Passed');
    const hasTargetFile = bodyText.includes('examples/ledgerly/server/index.js') || bodyText.includes('server/index.js');
    const hasAutonomousRepair = bodyText.includes('Antigravity') || bodyText.includes('Kane');

    if (!hasKaneResult740 || !hasKaneResult100 || !hasTargetFile || !hasAutonomousRepair) {
      throw new Error(
        `Live PR description does not contain genuine Kane assurance evidence (expected 740, 100, server/index.js, Antigravity/Kane): ${prUrl}`
      );
    }
    console.log('[Playwright PR Recorder] ✓ Verified genuine Kane assurance report content present in PR body.');

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

    // 4. Mandatory "Files changed" Tab Click & Diff Validation
    const filesTab = page.locator('a[data-tab-item="files-tab"], a[href$="/files"], #files-tab').first();
    const tabVisible = await filesTab.isVisible({ timeout: 10000 }).catch(() => false);
    if (!tabVisible) {
      throw new Error(`"Files changed" tab not visible on GitHub PR: ${prUrl}`);
    }

    console.log('[Playwright PR Recorder] Clicking "Files changed" diff tab...');
    await filesTab.click();

    // Wait for diff content to load
    await page.waitForSelector('.file-header, [data-tagsearch-path], .diff-table, div[data-details-container-group="file"]', {
      timeout: 15000,
    });

    const diffPageText = (await page.textContent('body')) || '';
    const hasFileDiff =
      diffPageText.includes('examples/ledgerly/server/index.js') ||
      diffPageText.includes('server/index.js');

    if (!hasFileDiff) {
      throw new Error(`Verified patch on examples/ledgerly/server/index.js not found in PR diff view: ${prUrl}`);
    }
    console.log('[Playwright PR Recorder] ✓ Confirmed patch diff for examples/ledgerly/server/index.js in PR files view.');

    // Scroll through the verified diff
    console.log('[Playwright PR Recorder] Scrolling through verified code diff...');
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(3000);
  } else {
    const prHtmlPath = path.join(publicDir, 'pr-evidence.html');
    const fileUrl = `file://${prHtmlPath}`;
    console.log(`[Playwright PR Recorder] Opening ${fileUrl}...`);
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    // Validate mock PR page elements
    const mockTitle = await page.title();
    console.log(`[Playwright PR Recorder] Confirmed Mockup PR Title: "${mockTitle}"`);

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
    throw new Error('Playwright recording did not produce a video file in ' + tempDir);
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

  // Verify resulting video stream properties with FFprobe
  verifyRecordedVideo(finalVideoPath);

  console.log(`[Playwright PR Recorder] ✓ PR Evidence video captured & verified: ${finalVideoPath}`);
}

recordPrEvidence().catch((err) => {
  console.error('[Playwright PR Recorder] Error:', err.message || err);
  process.exit(1);
});
