import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { verifyRunManifest } from '../src/manifest.js';

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function finalizeShowcase() {
  console.log('================================================================');
  console.log('🎬 AUTOCAST SHOWCASE PROPS FINALIZER (STAGE 2)');
  console.log('   "Binding live GitHub PR metadata to Remotion presentation"');
  console.log('================================================================\n');

  const outDir = path.join(process.cwd(), 'out');
  const basePropsPath = path.join(outDir, 'showcase-props.base.json');
  const finalPropsPath = path.join(outDir, 'showcase-props.json');
  const runManifestPath = path.join(outDir, 'run-manifest.json');
  const publicSourceVideo = path.join(process.cwd(), 'public', 'source.mp4');
  const publicPrRecording = path.join(process.cwd(), 'public', 'pr-recording.mp4');

  // 1. Verify Product Run Manifest - Fail closed on missing or invalid release gates
  if (!fs.existsSync(runManifestPath)) {
    throw new Error(`Product run manifest missing: ${runManifestPath}. Run 'npm run demo' first.`);
  }

  const manifestCheck = verifyRunManifest(runManifestPath, {
    requireVerifiedStatus: true,
    requireArtifacts: true,
  });
  if (!manifestCheck.valid) {
    throw new Error(
      `Product Run Manifest failed release gates:\n${manifestCheck.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
  const runManifest = JSON.parse(fs.readFileSync(runManifestPath, 'utf-8'));
  console.log('[Finalize] ✓ Product Run Manifest passed all release gates.');

  // 2. Read Stage 1 Base Props (No fallback to older final props; fail closed)
  if (!fs.existsSync(basePropsPath)) {
    throw new Error(`Stage 1 base props missing: ${basePropsPath}. Run 'npm run demo' first.`);
  }

  let baseProps: any = {};
  try {
    baseProps = JSON.parse(fs.readFileSync(basePropsPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse Stage 1 base props at ${basePropsPath}: ${err.message}`);
  }

  // Strict run-id and commit consistency assertions
  if (!baseProps.runId || baseProps.runId !== runManifest.run_id) {
    throw new Error(
      `Run ID mismatch! baseProps.runId ('${baseProps.runId}') !== runManifest.run_id ('${runManifest.run_id}'). Contaminated execution rejected.`
    );
  }

  if (!baseProps.testedCommit || baseProps.testedCommit !== runManifest.application?.tested_commit) {
    throw new Error(
      `Tested commit mismatch! baseProps.testedCommit ('${baseProps.testedCommit}') !== runManifest.application.tested_commit ('${runManifest.application?.tested_commit}'). Mismatched candidate rejected.`
    );
  }
  console.log(`[Finalize] ✓ Confirmed matching run_id ('${baseProps.runId}') and tested_commit ('${baseProps.testedCommit}')`);

  // 3. Discover / Validate GitHub PR
  let prUrl = process.env.PR_URL;
  let prNumber: number | undefined = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : undefined;
  let branch = process.env.PR_BRANCH || baseProps.branch || null;

  if (!prUrl) {
    try {
      console.log(`[Finalize] Querying GitHub CLI for PR on branch '${branch || 'HEAD'}'...`);
      const prJsonRaw = execSync(`gh pr view ${branch || ''} --json url,number,headRefName 2>/dev/null || true`, {
        encoding: 'utf-8',
      }).trim();
      if (prJsonRaw) {
        const prData = JSON.parse(prJsonRaw);
        prUrl = prData.url;
        prNumber = prData.number;
        branch = prData.headRefName;
      }
    } catch {}
  }

  if (prUrl) {
    const parsed = new URL(prUrl);
    if (parsed.hostname !== 'github.com' || !parsed.pathname.match(/^\/nikhil-r0\/autocast\/pull\/\d+$/)) {
      throw new Error(`Unexpected PR URL format: ${prUrl}. Expected https://github.com/nikhil-r0/autocast/pull/<id>`);
    }
    const match = parsed.pathname.match(/\/pull\/(\d+)$/);
    if (match && !prNumber) {
      prNumber = parseInt(match[1], 10);
    }
    console.log(`[Finalize] ✓ Validated Live GitHub PR: #${prNumber} -> ${prUrl}`);
  } else {
    console.warn('[Finalize] WARNING: No live PR_URL provided. Operating in unverified / staged PR mode.');
  }

  // 3. Verify Artifacts (sync from out/demo.mp4 to public/source.mp4 if needed)
  if (!fs.existsSync(publicSourceVideo)) {
    const outDemoMp4 = path.join(process.cwd(), 'out', 'demo.mp4');
    if (fs.existsSync(outDemoMp4)) {
      console.log(`[Finalize] Syncing out/demo.mp4 -> ${publicSourceVideo}...`);
      fs.copyFileSync(outDemoMp4, publicSourceVideo);
    } else {
      throw new Error(`Source video missing: ${publicSourceVideo}. Run 'npm run demo' first.`);
    }
  }
  const sourceVideoSha256 = computeSha256(publicSourceVideo);
  console.log(`[Finalize] ✓ Source Video Verified: ${sourceVideoSha256.slice(0, 16)}...`);

  if (!fs.existsSync(publicPrRecording)) {
    throw new Error(`PR recording video missing: ${publicPrRecording}. Run 'npm run record:pr' first.`);
  }
  const prRecordingSha256 = computeSha256(publicPrRecording);
  console.log(`[Finalize] ✓ PR Recording Verified: ${prRecordingSha256.slice(0, 16)}...`);

  // 4. Assemble Final Showcase Props (No fabricated fallbacks)
  const isKanePass = baseProps.kaneResult === 100;
  const isStateVerified = baseProps.stateVerified === true;
  const isVisualQaPass = baseProps.visualQaPassed === true;
  const isOcrPass = baseProps.ocrPassed === true;
  const isVerified = Boolean(
    baseProps.verified &&
    manifestCheck.valid &&
    isKanePass &&
    isStateVerified &&
    isVisualQaPass &&
    isOcrPass &&
    prUrl &&
    prNumber
  );

  const finalProps = {
    autocastVersion: baseProps.autocastVersion || '0.2.0',
    runId: baseProps.runId || null,
    prUrl: prUrl || null,
    prNumber: prNumber || null,
    branch: branch || null,
    candidateCommit: baseProps.candidateCommit || null,
    testedCommit: baseProps.testedCommit || null,
    integrationCommit: baseProps.integrationCommit || null,
    baselineCommit: baseProps.baselineCommit || null,
    kaneResult: typeof baseProps.kaneResult === 'number' ? baseProps.kaneResult : null,
    verified: isVerified,
    stateVerified: isStateVerified,
    visualQaPassed: isVisualQaPass,
    ocrPassed: isOcrPass,
    sourceVideo: 'source.mp4',
    prRecording: 'pr-recording.mp4',
    sourceVideoSha256,
    prRecordingSha256,
    manifestPath: 'out/run-manifest.json',
  };

  fs.writeFileSync(finalPropsPath, JSON.stringify(finalProps, null, 2), 'utf-8');
  console.log(`\n[Finalize] ✓ Wrote final Remotion props -> ${finalPropsPath}`);

  // Sync to examples/output
  const examplePropsPath = path.join(process.cwd(), 'examples', 'output', 'showcase-props.json');
  try {
    fs.writeFileSync(examplePropsPath, JSON.stringify(finalProps, null, 2), 'utf-8');
  } catch {}

  console.log('================================================================');
  console.log('🎉 SHOWCASE PROPS READY FOR REMOTION RENDER');
  console.log('================================================================');
}

finalizeShowcase().catch((err) => {
  console.error('[Finalize] Fatal error:', err.message);
  process.exit(1);
});
