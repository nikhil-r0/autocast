import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Storyboard } from '../types.js';

/**
 * Determine the optimal hero timestamp (in seconds) for the poster thumbnail.
 * Prioritizes compliance seal / approved state scenes, or defaults to the settled view.
 */
export function findHeroTimestamp(storyboard: Storyboard): number {
  let currentTime = 2.5; // Title card offset in seconds
  let heroTime = 4.0; // Default fallback to settled dashboard

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    const duration = scene.audio_sec || 3.5;
    const text = `${scene.caption} ${scene.narration}`.toLowerCase();

    // Check for hero keywords (approved, compliance, seal, verified, result)
    if (
      text.includes('approved') ||
      text.includes('seal') ||
      text.includes('compliance') ||
      text.includes('verified')
    ) {
      // Pick 40% into this hero scene so animations have settled
      heroTime = currentTime + Math.min(duration * 0.4, 2.0);
      return Math.round(heroTime * 10) / 10;
    }

    currentTime += duration;
  }

  return Math.round(heroTime * 10) / 10;
}

/**
 * Extract a single still frame from the video using ffmpeg as a high-quality poster.
 */
export async function extractPosterFrame(
  videoPath: string,
  posterPath: string,
  timestampSec: number
): Promise<void> {
  console.log(`[Poster] Extracting hero frame at ${timestampSec}s -> ${posterPath}...`);

  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y',
      '-ss',
      String(timestampSec),
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      posterPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(posterPath)) {
        console.log(`[Poster] ✓ Hero poster generated: ${posterPath}`);
        resolve();
      } else {
        reject(new Error(`ffmpeg poster extraction failed (code ${code}): ${stderr}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Bake poster into frame 0 of the MP4 using ffmpeg overlay filter (enable='eq(n,0)').
 * Leaves all subsequent frames, audio, and duration untouched.
 * Ensures preview cards (Slack, Twitter, Discord, YouTube) show the hero frame.
 */
export async function bakePosterToFrame0(
  videoPath: string,
  posterPath: string
): Promise<void> {
  const tempOutput = videoPath.replace(/\.mp4$/, '.poster.mp4');
  console.log(`[Poster] Baking poster frame into frame 0 (${tempOutput})...`);

  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-i',
      posterPath,
      '-filter_complex',
      "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",
      '-map',
      '[v]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-crf',
      '16',
      '-preset',
      'fast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      tempOutput,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(tempOutput)) {
        // Replace original with the poster-baked video
        fs.renameSync(tempOutput, videoPath);
        console.log(`[Poster] ✓ Successfully baked hero poster into frame 0 of ${videoPath}`);
        resolve();
      } else {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
        reject(new Error(`ffmpeg frame-0 baking failed (code ${code}): ${stderr}`));
      }
    });

    child.on('error', reject);
  });
}

