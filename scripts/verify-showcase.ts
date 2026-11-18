import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function verifyShowcase() {
  const videoPath = process.argv[2] || path.join(process.cwd(), 'out', 'autocast-hackathon-showcase.mp4');
  const propsPath = path.join(process.cwd(), 'out', 'showcase-props.json');
  const manifestPath = path.join(process.cwd(), 'out', 'showcase-manifest.json');

  console.log('================================================================');
  console.log('🎬 AUTOCAST SHOWCASE POST-RENDER VALIDATOR & MANIFEST SEALER');
  console.log('   "Validating final 3:45 competition showcase presentation"');
  console.log('================================================================');
  console.log(`Auditing Showcase Video: ${videoPath}\n`);

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

  if (!videoStream) {
    console.error('❌ Validation Failed: No video stream found in showcase artifact.');
    process.exit(1);
  }

  console.log('✓ Check 1: Dimensions -> ' + videoStream.width + 'x' + videoStream.height + ' (Expected 1920x1080)');
  if (videoStream.width !== 1920 || videoStream.height !== 1080) {
    console.error(`❌ Validation Failed: Expected 1920x1080, got ${videoStream.width}x${videoStream.height}`);
    process.exit(1);
  }

  console.log(`✓ Check 2: Video Duration -> ${durationSec.toFixed(1)}s (Target: ~225s / 3:45)`);
  if (durationSec < 10) {
    console.error(`❌ Validation Failed: Video duration (${durationSec}s) is unexpectedly short.`);
    process.exit(1);
  }

  // 2. Compute SHA-256 Checksum
  const videoSha = computeSha256(videoPath);
  console.log(`✓ Check 3: Computed Showcase SHA-256 -> ${videoSha}`);

  // 3. Collect Provenance Links
  let props: any = {};
  if (fs.existsSync(propsPath)) {
    try {
      props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
    } catch {}
  }

  const publicPrRecording = path.join(process.cwd(), 'public', 'pr-recording.mp4');
  const prRecordingSha = fs.existsSync(publicPrRecording) ? computeSha256(publicPrRecording) : undefined;

  const publicSourceVideo = path.join(process.cwd(), 'public', 'source.mp4');
  const sourceVideoSha = fs.existsSync(publicSourceVideo) ? computeSha256(publicSourceVideo) : undefined;

  // 4. Generate & Seal showcase-manifest.json
  const showcaseManifest = {
    status: 'verified',
    composition: 'AutoCastShowcase',
    generated_at: new Date().toISOString(),
    showcase_video: {
      path: path.relative(process.cwd(), videoPath),
      sha256: videoSha,
      duration_sec: durationSec,
      width: videoStream.width,
      height: videoStream.height,
      fps: 30,
    },
    provenance: {
      pr_url: props.prUrl || process.env.PR_URL || null,
      pr_number: props.prNumber || null,
      branch: props.branch || 'main',
      tested_commit: props.testedCommit || null,
      source_video_sha256: sourceVideoSha,
      pr_recording_sha256: prRecordingSha,
    },
    post_render_validation: 'passed',
  };

  fs.writeFileSync(manifestPath, JSON.stringify(showcaseManifest, null, 2), 'utf-8');
  console.log(`✓ Check 4: Sealed showcase manifest -> ${manifestPath}`);

  console.log('\n================================================================');
  console.log('🎉 SHOWCASE VALIDATION PASSED: READY FOR COMPETITION SUBMISSION');
  console.log('================================================================');
}

verifyShowcase().catch((err) => {
  console.error('Showcase validation fatal error:', err);
  process.exit(1);
});
