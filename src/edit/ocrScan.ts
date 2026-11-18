import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createWorker } from 'tesseract.js';
import { DEFAULT_REDACTION_RULES } from './redact.js';

export interface OcrScanResult {
  passed: boolean;
  framesScanned: number;
  detectedSecrets: Array<{
    frameTimeSec: number;
    ruleName: string;
    matchedText: string;
  }>;
  error?: string;
}

function getVideoDurationSec(videoPath: string): number {
  try {
    const stdout = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const dur = parseFloat(stdout);
    return isNaN(dur) || dur <= 0 ? 0 : dur;
  } catch {
    return 0;
  }
}

/**
 * Perform pixel-level safety verification by OCR scanning sampled frames
 * from the rendered MP4 to ensure no secrets or API keys are exposed.
 */
export async function scanVideoPixelsForSecrets(
  videoPath: string,
  sampleTimestampsSec?: number[]
): Promise<OcrScanResult> {
  console.log(`\n[Pixel Safety OCR] Auditing rendered frames from ${path.basename(videoPath)}...`);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found for OCR audit: ${videoPath}`);
  }

  const tmpDir = path.join(process.cwd(), 'out', 'ocr-tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  let timestamps = sampleTimestampsSec;
  if (!timestamps || timestamps.length === 0) {
    const duration = getVideoDurationSec(videoPath);
    if (duration > 4) {
      const fractions = [0.15, 0.30, 0.45, 0.60, 0.75, 0.90];
      timestamps = fractions.map((f) => Math.round(duration * f * 10) / 10);
    } else {
      timestamps = [1.0, 2.0, 3.0, 4.0];
    }
  }

  const detectedSecrets: OcrScanResult['detectedSecrets'] = [];

  // Extract frames using ffmpeg
  const framePaths: Array<{ timeSec: number; filePath: string }> = [];
  for (const timeSec of timestamps) {
    const framePath = path.join(tmpDir, `ocr-frame-${timeSec}s.jpg`);
    try {
      execSync(
        `ffmpeg -y -ss ${timeSec} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}"`,
        { stdio: 'ignore' }
      );
      if (fs.existsSync(framePath)) {
        framePaths.push({ timeSec, filePath: framePath });
      }
    } catch (err) {
      console.warn(`[Pixel Safety OCR] Failed to extract frame at ${timeSec}s:`, err);
    }
  }

  if (framePaths.length === 0) {
    console.error('[Pixel Safety OCR] ✗ FAILED: No frames could be extracted for security audit. Failing closed.');
    return { passed: false, framesScanned: 0, detectedSecrets: [], error: 'No frames extracted for audit' };
  }

  let worker: any = null;
  let ocrError: string | null = null;
  try {
    worker = await createWorker('eng');

    for (const { timeSec, filePath } of framePaths) {
      console.log(`  Scanning video pixels at t=${timeSec}s...`);
      const ret = await worker.recognize(filePath);
      const recognizedText = ret.data.text || '';

      // Check extracted pixel text against all redaction rules
      for (const rule of DEFAULT_REDACTION_RULES) {
        // Reset regex state
        const regex = new RegExp(rule.regex.source, rule.regex.flags);
        const match = regex.exec(recognizedText);
        if (match) {
          console.error(
            `  ✗ LEAK DETECTED at t=${timeSec}s: Rule '${rule.name}' matched '${match[0]}'`
          );
          detectedSecrets.push({
            frameTimeSec: timeSec,
            ruleName: rule.name,
            matchedText: match[0],
          });
        }
      }

      // Clean up extracted frame
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  } catch (err: any) {
    ocrError = err?.message || 'OCR worker execution failed';
    console.error('[Pixel Safety OCR] ✗ OCR worker failure (failing closed):', ocrError);
  } finally {
    if (worker) {
      await worker.terminate();
    }
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }

  const passed = detectedSecrets.length === 0 && !ocrError;
  if (passed) {
    console.log(`[Pixel Safety OCR] ✓ All ${framePaths.length} sampled frames passed pixel redaction audit (0 secret leaks).`);
  } else {
    console.error(`[Pixel Safety OCR] ✗ FAILED: ${detectedSecrets.length} secret leaks found in video pixels!${ocrError ? ` (Error: ${ocrError})` : ''}`);
  }

  return {
    passed,
    framesScanned: framePaths.length,
    detectedSecrets,
    ...(ocrError ? { error: ocrError } : {}),
  };
}

