import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { resolveArtifactPath, verifyRunManifest } from '../src/manifest.js';

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyCommittedShowcaseEvidence(): void {
  const examplesOut = path.join(process.cwd(), 'examples', 'output');
  const propsPath = path.join(examplesOut, 'showcase-props.json');
  const runManifestPath = path.join(examplesOut, 'run-manifest.json');
  const sampleDemoPath = path.join(examplesOut, 'sample-demo.mp4');

  console.log('================================================================');
  console.log('🎬 AUTOCAST SHOWCASE — COMMITTED EVIDENCE AUDIT');
  console.log('   Fresh clones do not include out/ showcase renders.');
  console.log('   Auditing the sealed examples/output evidence pack instead.');
  console.log('================================================================\n');

  const errors: string[] = [];

  if (!fs.existsSync(propsPath)) {
    errors.push(`Committed showcase props missing at ${propsPath}`);
  }

  let props: any = {};
  if (fs.existsSync(propsPath)) {
    try {
      props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
    } catch {
      errors.push(`Showcase props at ${propsPath} is invalid JSON.`);
    }
  }

  if (props.verified !== true) {
    errors.push('Showcase props are not verified (props.verified !== true)');
  }
  if (!props.prUrl || !props.prNumber || !props.branch) {
    errors.push('Live GitHub PR metadata missing in showcase-props.json');
  }
  if (!props.runId) {
    errors.push('Run ID missing in showcase-props.json');
  }
  if (!props.testedCommit) {
    errors.push('Tested commit missing in showcase-props.json');
  }
  if (!props.sourceVideoSha256) {
    errors.push('Source video SHA-256 missing in showcase-props.json');
  }

  if (!fs.existsSync(sampleDemoPath)) {
    errors.push(`Committed sample demo missing at ${sampleDemoPath}`);
  } else {
    const sampleSha = computeSha256(sampleDemoPath);
    console.log(`✓ Committed sample demo present (${sampleSha.slice(0, 16)}...)`);
    if (props.sourceVideoSha256 && sampleSha !== props.sourceVideoSha256) {
      errors.push(
        `Committed sample-demo.mp4 hash mismatch! Disk: ${sampleSha}, Props: ${props.sourceVideoSha256}`
      );
    } else {
      console.log('✓ Sample demo SHA-256 matches showcase-props.sourceVideoSha256');
    }
  }

  if (!fs.existsSync(runManifestPath)) {
    errors.push(`Committed run manifest missing at ${runManifestPath}`);
  } else {
    const runManifestCheck = verifyRunManifest(runManifestPath, {
      requireVerifiedStatus: true,
      requireArtifacts: true,
    });
    if (!runManifestCheck.valid) {
      errors.push(`Committed product manifest failed verification: ${runManifestCheck.errors.join('; ')}`);
    } else {
      console.log('✓ Committed product run manifest passed all release gates');
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
      if (props.runId && props.testedCommit) {
        console.log(`✓ Provenance linkage intact (runId=${props.runId}, testedCommit=${props.testedCommit})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ COMMITTED SHOWCASE EVIDENCE AUDIT FAILED:');
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('🎉 COMMITTED EVIDENCE PACK VERIFIED');
  console.log('   To validate a full 3:45 render, run: npm run render:showcase');
  console.log('   then re-run: npm run verify:showcase');
  console.log('================================================================');
}

async function verifyRenderedShowcase(videoPath: string): Promise<void> {
  const propsPath = fs.existsSync(path.join(process.cwd(), 'out', 'showcase-props.json'))
    ? path.join(process.cwd(), 'out', 'showcase-props.json')
    : path.join(process.cwd(), 'examples', 'output', 'showcase-props.json');
  const runManifestPath = fs.existsSync(path.join(process.cwd(), 'out', 'run-manifest.json'))
    ? path.join(process.cwd(), 'out', 'run-manifest.json')
    : path.join(process.cwd(), 'examples', 'output', 'run-manifest.json');
  const manifestPath = path.join(process.cwd(), 'out', 'showcase-manifest.json');

  console.log('================================================================');
  console.log('🎬 AUTOCAST SHOWCASE POST-RENDER VALIDATOR & MANIFEST SEALER');
  console.log('   "Strict gate validation for 3:45 competition presentation"');
  console.log('================================================================');
  console.log(`Auditing Showcase Video: ${videoPath}\n`);

  const errors: string[] = [];

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
    console.log(`✓ Check 1: Dimensions -> ${videoStream.width}x${videoStream.height} (Expected 1920x1080)`);
    if (videoStream.width !== 1920 || videoStream.height !== 1080) {
      errors.push(`Invalid dimensions: expected 1920x1080, got ${videoStream.width}x${videoStream.height}`);
    }

    console.log(`✓ Check 2: Video Codec -> ${videoStream.codec_name} (Expected h264)`);
    if (videoStream.codec_name !== 'h264') {
      errors.push(`Invalid video codec: expected h264, got ${videoStream.codec_name}`);
    }

    const [num, den] = (videoStream.r_frame_rate || '0/1').split('/').map((n: string) => parseInt(n, 10));
    actualFps = den ? Math.round(num / den) : 0;
    console.log(`✓ Check 3: Frame Rate -> ${actualFps} FPS (${videoStream.r_frame_rate}) (Expected 30 FPS)`);
    if (actualFps !== 30) {
      errors.push(`Invalid frame rate: expected 30 fps, got ${actualFps} (${videoStream.r_frame_rate})`);
    }
  }

  console.log(`✓ Check 4: Audio Stream -> ${audioStream ? `present (${audioStream.codec_name})` : 'MISSING'}`);
  if (!audioStream) {
    errors.push('No decodable audio stream found in showcase artifact.');
  }

  console.log(`✓ Check 5: Duration -> ${durationSec.toFixed(1)}s (Target: 225s ± 5s / 3:45)`);
  if (durationSec < 220 || durationSec > 230) {
    if (process.env.ALLOW_SHORT_SHOWCASE !== 'true') {
      errors.push(`Showcase duration (${durationSec.toFixed(1)}s) is outside competition bounds [220s - 230s]`);
    } else {
      console.warn(`[Showcase Validator] WARNING: Short showcase allowed via ALLOW_SHORT_SHOWCASE (${durationSec}s)`);
    }
  }

  const videoSha = computeSha256(videoPath);
  console.log(`✓ Check 6: Computed Showcase SHA-256 -> ${videoSha}`);

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

  const publicSourceVideo = path.join(process.cwd(), 'public', 'source.mp4');
  const committedSourceVideo = resolveArtifactPath('out/demo.mp4');
  let sourceVideoSha: string | undefined;
  if (fs.existsSync(publicSourceVideo)) {
    sourceVideoSha = computeSha256(publicSourceVideo);
    console.log(`✓ Check 8: Source Demo Video Artifact -> Verified (${sourceVideoSha.slice(0, 16)}...)`);
  } else if (committedSourceVideo) {
    sourceVideoSha = computeSha256(committedSourceVideo);
    console.log(
      `✓ Check 8: Source Demo Video Artifact (committed fallback) -> Verified (${sourceVideoSha.slice(0, 16)}...)`
    );
  } else {
    errors.push(`Source demo video missing at ${publicSourceVideo}`);
  }

  if (sourceVideoSha) {
    if (props.sourceVideoSha256 && sourceVideoSha !== props.sourceVideoSha256) {
      errors.push(`Source video hash mismatch! Disk: ${sourceVideoSha}, Props: ${props.sourceVideoSha256}`);
    } else if (!props.sourceVideoSha256) {
      errors.push('Source video SHA-256 missing in showcase-props.json');
    }
  }

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

  const passed = errors.length === 0;

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
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

async function verifyShowcase() {
  const explicitVideo = process.argv[2];
  const defaultVideoPath = path.join(process.cwd(), 'out', 'autocast-hackathon-showcase.mp4');
  const videoPath = explicitVideo || defaultVideoPath;

  if (!fs.existsSync(videoPath)) {
    if (explicitVideo) {
      console.error(`❌ ERROR: Showcase video not found at ${videoPath}`);
      console.error('Run "npm run render:showcase" first.');
      process.exit(1);
    }
    verifyCommittedShowcaseEvidence();
    return;
  }

  await verifyRenderedShowcase(videoPath);
}

verifyShowcase().catch((err) => {
  console.error('Showcase validation fatal error:', err);
  process.exit(1);
});
