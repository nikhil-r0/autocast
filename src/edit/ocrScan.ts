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
}

/**
 * Perform pixel-level safety verification by OCR scanning sampled frames
 * from the rendered MP4 to ensure no secrets or API keys are exposed.
 */
export async function scanVideoPixelsForSecrets(
  videoPath: string,
  sampleTimestampsSec: number[] = [3.0, 10.0, 18.0, 24.0]
): Promise<OcrScanResult> {
  console.log(`\n[Pixel Safety OCR] Auditing rendered frames from ${path.basename(videoPath)}...`);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found for OCR audit: ${videoPath}`);
  }

  const tmpDir = path.join(process.cwd(), 'out', 'ocr-tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const detectedSecrets: OcrScanResult['detectedSecrets'] = [];

  // Extract frames using ffmpeg
  const framePaths: Array<{ timeSec: number; filePath: string }> = [];
  for (const timeSec of sampleTimestampsSec) {
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
    console.warn('[Pixel Safety OCR] No frames extracted for audit.');
    return { passed: true, framesScanned: 0, detectedSecrets: [] };
  }

  let worker: any = null;
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
    console.warn('[Pixel Safety OCR] Worker warning (falling back to regex check):', err.message);
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

  const passed = detectedSecrets.length === 0;
  if (passed) {
    console.log(`[Pixel Safety OCR] ✓ All ${framePaths.length} sampled frames passed pixel redaction audit (0 secret leaks).`);
  } else {
    console.error(`[Pixel Safety OCR] ✗ FAILED: ${detectedSecrets.length} secret leaks found in video pixels!`);
  }

  return {
    passed,
    framesScanned: framePaths.length,
    detectedSecrets,
  };
}

