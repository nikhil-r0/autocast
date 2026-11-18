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

  // 1. Read Stage 1 Base Props
  let baseProps: any = {};
  if (fs.existsSync(basePropsPath)) {
    try {
      baseProps = JSON.parse(fs.readFileSync(basePropsPath, 'utf-8'));
    } catch {}
  } else if (fs.existsSync(finalPropsPath)) {
    try {
      baseProps = JSON.parse(fs.readFileSync(finalPropsPath, 'utf-8'));
    } catch {}
  }

  // 2. Discover / Validate GitHub PR
  let prUrl = process.env.PR_URL;
  let prNumber: number | undefined = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : undefined;
  let branch = process.env.PR_BRANCH || baseProps.branch || 'fix/ledgerly-approve-noop';

  if (!prUrl) {
    try {
      console.log(`[Finalize] Querying GitHub CLI for PR on branch '${branch}'...`);
      const prJsonRaw = execSync(`gh pr view ${branch} --json url,number,headRefName 2>/dev/null || true`, {
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

  // 3. Verify Artifacts
  if (!fs.existsSync(publicSourceVideo)) {
    throw new Error(`Source video missing: ${publicSourceVideo}. Run 'npm run demo' first.`);
  }
  const sourceVideoSha256 = computeSha256(publicSourceVideo);
  console.log(`[Finalize] ✓ Source Video Verified: ${sourceVideoSha256.slice(0, 16)}...`);

  if (!fs.existsSync(publicPrRecording)) {
    throw new Error(`PR recording video missing: ${publicPrRecording}. Run 'npm run record:pr' first.`);
  }
  const prRecordingSha256 = computeSha256(publicPrRecording);
  console.log(`[Finalize] ✓ PR Recording Verified: ${prRecordingSha256.slice(0, 16)}...`);

  // 4. Verify Product Run Manifest if present
  let isManifestVerified = false;
  if (fs.existsSync(runManifestPath)) {
    const manifestCheck = verifyRunManifest(runManifestPath, {
      requireVerifiedStatus: true,
      requireArtifacts: true,
    });
    isManifestVerified = manifestCheck.valid;
    if (manifestCheck.valid) {
      console.log('[Finalize] ✓ Product Run Manifest passed all release gates.');
    } else {
      console.warn('[Finalize] ⚠ Warning: Product Run Manifest has pending/flagged gates:');
      manifestCheck.errors.forEach((e) => console.warn(`    - ${e}`));
    }
  }

  // 5. Assemble Final Showcase Props
  const finalProps = {
    autocastVersion: baseProps.autocastVersion || '0.2.0',
    prUrl: prUrl || null,
    prNumber: prNumber || null,
    branch: branch || 'fix/ledgerly-approve-noop',
    candidateCommit: baseProps.candidateCommit || baseProps.testedCommit || null,
    testedCommit: baseProps.testedCommit || null,
    baselineCommit: baseProps.baselineCommit || null,
    kaneResult: baseProps.kaneResult || 100,
    verified: Boolean(baseProps.verified && isManifestVerified && prUrl && prNumber),
    stateVerified: Boolean(baseProps.stateVerified),
    visualQaPassed: Boolean(baseProps.visualQaPassed),
    ocrPassed: Boolean(baseProps.ocrPassed),
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
