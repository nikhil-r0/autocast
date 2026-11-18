import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { verifyRunManifest } from '../src/manifest.js';

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function verifyShowcase() {
  const videoPath = process.argv[2] || path.join(process.cwd(), 'out', 'autocast-hackathon-showcase.mp4');
  const propsPath = path.join(process.cwd(), 'out', 'showcase-props.json');
  const runManifestPath = path.join(process.cwd(), 'out', 'run-manifest.json');
  const manifestPath = path.join(process.cwd(), 'out', 'showcase-manifest.json');

  console.log('================================================================');
  console.log('🎬 AUTOCAST SHOWCASE POST-RENDER VALIDATOR & MANIFEST SEALER');
  console.log('   "Strict gate validation for 3:45 competition presentation"');
  console.log('================================================================');
  console.log(`Auditing Showcase Video: ${videoPath}\n`);

  const errors: string[] = [];

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ ERROR: Showcase video not found at ${videoPath}`);
    console.error('Run "npm run render:showcase" first.');
    process.exit(1);
  }

  // 1. Technical Inspection via FFprobe
  let probeData: any;
  try {
    const rawProbe = execSync(
      `ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,codec_name,codec_type -of json "${videoPath}"`,
      { encoding: 'utf-8' }
    );
    probeData = JSON.parse(rawProbe);
  } catch (err: any) {
    console.error(`❌ FFprobe inspection failed: ${err.message}`);
    process.exit(1);
  }

  const durationSec = parseFloat(probeData.format?.duration || '0');
  const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');
  const audioStream = probeData.streams?.find((s: any) => s.codec_type === 'audio');

  let actualFps = 0;
  if (!videoStream) {
    errors.push('No video stream found in showcase artifact.');
  } else {
    // Width & Height
    console.log(`✓ Check 1: Dimensions -> ${videoStream.width}x${videoStream.height} (Expected 1920x1080)`);
    if (videoStream.width !== 1920 || videoStream.height !== 1080) {
      errors.push(`Invalid dimensions: expected 1920x1080, got ${videoStream.width}x${videoStream.height}`);
    }

    // Codec
    console.log(`✓ Check 2: Video Codec -> ${videoStream.codec_name} (Expected h264)`);
    if (videoStream.codec_name !== 'h264') {
      errors.push(`Invalid video codec: expected h264, got ${videoStream.codec_name}`);
    }

    // Frame rate
    const [num, den] = (videoStream.r_frame_rate || '0/1').split('/').map((n: string) => parseInt(n, 10));
    actualFps = den ? Math.round(num / den) : 0;
    console.log(`✓ Check 3: Frame Rate -> ${actualFps} FPS (${videoStream.r_frame_rate}) (Expected 30 FPS)`);
    if (actualFps !== 30) {
      errors.push(`Invalid frame rate: expected 30 fps, got ${actualFps} (${videoStream.r_frame_rate})`);
    }
  }

  // Audio Stream Presence
  console.log(`✓ Check 4: Audio Stream -> ${audioStream ? `present (${audioStream.codec_name})` : 'MISSING'}`);
  if (!audioStream) {
    errors.push('No decodable audio stream found in showcase artifact.');
  }

  // Duration
  console.log(`✓ Check 5: Duration -> ${durationSec.toFixed(1)}s (Target: 225s ± 5s / 3:45)`);
  if (durationSec < 220 || durationSec > 230) {
    // If running in development short test mode, note it, otherwise fail
    if (process.env.ALLOW_SHORT_SHOWCASE !== 'true') {
      errors.push(`Showcase duration (${durationSec.toFixed(1)}s) is outside competition bounds [220s - 230s]`);
    } else {
      console.warn(`[Showcase Validator] WARNING: Short showcase allowed via ALLOW_SHORT_SHOWCASE (${durationSec}s)`);
    }
  }

  // 2. Compute SHA-256 Checksum
  const videoSha = computeSha256(videoPath);
  console.log(`✓ Check 6: Computed Showcase SHA-256 -> ${videoSha}`);

  // 3. Collect & Verify Provenance Links
  let props: any = {};
  if (fs.existsSync(propsPath)) {
    try {
      props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
    } catch {
      errors.push(`Showcase props at ${propsPath} is invalid JSON.`);
    }
  } else {
    errors.push(`Showcase props file not found at ${propsPath}. Run 'npm run finalize:showcase' first.`);
  }

  // Strict Showcase Props Assertions: No unverified presentation may pass
  if (props.verified !== true) {
    errors.push('Showcase props are not verified (props.verified !== true)');
  }
  if (!props.prUrl || !props.prNumber || !props.branch) {
    errors.push('Live GitHub PR metadata missing in showcase-props.json (prUrl, prNumber, or branch is null/missing)');
  }
  if (!props.runId) {
    errors.push('Run ID missing in showcase-props.json');
  }
  if (!props.testedCommit) {
    errors.push('Tested commit missing in showcase-props.json');
  }

  // Verify PR Recording artifact
  const publicPrRecording = path.join(process.cwd(), 'public', 'pr-recording.mp4');
  let prRecordingSha: string | undefined;
  if (!fs.existsSync(publicPrRecording)) {
    errors.push(`PR recording video missing at ${publicPrRecording}`);
  } else {
    prRecordingSha = computeSha256(publicPrRecording);
    console.log(`✓ Check 7: PR Recording Artifact -> Verified (${prRecordingSha.slice(0, 16)}...)`);
    if (props.prRecordingSha256 && prRecordingSha !== props.prRecordingSha256) {
      errors.push(`PR recording hash mismatch! Disk: ${prRecordingSha}, Props: ${props.prRecordingSha256}`);
    } else if (!props.prRecordingSha256) {
      errors.push('PR recording SHA-256 missing in showcase-props.json');
    }
  }

  // Verify Source Video artifact
  const publicSourceVideo = path.join(process.cwd(), 'public', 'source.mp4');
  let sourceVideoSha: string | undefined;
  if (!fs.existsSync(publicSourceVideo)) {
    errors.push(`Source demo video missing at ${publicSourceVideo}`);
  } else {
    sourceVideoSha = computeSha256(publicSourceVideo);
    console.log(`✓ Check 8: Source Demo Video Artifact -> Verified (${sourceVideoSha.slice(0, 16)}...)`);
    if (props.sourceVideoSha256 && sourceVideoSha !== props.sourceVideoSha256) {
      errors.push(`Source video hash mismatch! Disk: ${sourceVideoSha}, Props: ${props.sourceVideoSha256}`);
    } else if (!props.sourceVideoSha256) {
      errors.push('Source video SHA-256 missing in showcase-props.json');
    }
  }

  // Verify Product Run Manifest
  if (fs.existsSync(runManifestPath)) {
    const runManifestCheck = verifyRunManifest(runManifestPath, {
      requireVerifiedStatus: true,
      requireArtifacts: true,
    });
    if (!runManifestCheck.valid) {
      errors.push(`Source product manifest failed verification: ${runManifestCheck.errors.join('; ')}`);
    } else {
      console.log('✓ Check 9: Source Product Run Manifest -> Passed all 6 release gates');
      const runManifestContent = JSON.parse(fs.readFileSync(runManifestPath, 'utf-8'));
      if (!props.runId || props.runId !== runManifestContent.run_id) {
        errors.push(
          `Showcase props runId ('${props.runId}') does not match product run manifest run_id ('${runManifestContent.run_id}')`
        );
      }
      if (!props.testedCommit || props.testedCommit !== runManifestContent.application?.tested_commit) {
        errors.push(
          `Showcase props testedCommit ('${props.testedCommit}') does not match product run manifest tested_commit ('${runManifestContent.application?.tested_commit}')`
        );
      }
    }
  } else {
    errors.push(`Source product run manifest missing at ${runManifestPath}`);
  }

  // 4. Decision Gate
  const passed = errors.length === 0;

  const showcaseManifest = {
    status: passed ? 'verified' : 'failed',
    composition: 'AutoCastShowcase',
    generated_at: new Date().toISOString(),
    showcase_video: {
      path: path.relative(process.cwd(), videoPath),
      sha256: videoSha,
      duration_sec: durationSec,
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: actualFps,
    },
    provenance: {
      run_id: props.runId || null,
      pr_url: props.prUrl || null,
      pr_number: props.prNumber || null,
      branch: props.branch || null,
      tested_commit: props.testedCommit || null,
      source_video_sha256: sourceVideoSha || null,
      pr_recording_sha256: prRecordingSha || null,
    },
    post_render_validation: passed ? 'passed' : 'failed',
    validation_errors: errors.length > 0 ? errors : undefined,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(showcaseManifest, null, 2), 'utf-8');

  if (!passed) {
    console.error('\n❌ SHOWCASE POST-RENDER VALIDATION FAILED:');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error(`\nShowcase manifest marked as 'failed' -> ${manifestPath}`);
    process.exit(1);
  }

  console.log(`\n✓ Check 10: Sealed showcase manifest -> ${manifestPath}`);
  console.log('\n================================================================');
  console.log('🎉 SHOWCASE VALIDATION PASSED: READY FOR COMPETITION SUBMISSION');
  console.log('================================================================');
}

verifyShowcase().catch((err) => {
  console.error('Showcase validation fatal error:', err);
  process.exit(1);
});
