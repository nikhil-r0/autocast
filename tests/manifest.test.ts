import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { generateRunManifest, verifyRunManifest, computeFileSha256 } from '../src/manifest.js';

test('computeFileSha256 computes valid 64-char hex string', () => {
  const tempFile = path.resolve(process.cwd(), 'out', 'test-file.txt');
  fs.mkdirSync(path.dirname(tempFile), { recursive: true });
  fs.writeFileSync(tempFile, 'Hello Autocast AI');

  const sha = computeFileSha256(tempFile);
  assert.equal(sha.length, 64);
  assert.match(sha, /^[a-f0-9]{64}$/);

  fs.rmSync(tempFile, { force: true });
});

test('TEST-19: MP4 bytes modified after manifest generation -> SHA-256 verification detects tampering', () => {
  const tempVideo = path.resolve(process.cwd(), 'out', 'test-demo.mp4');
  const tempManifest = path.resolve(process.cwd(), 'out', 'test-manifest.json');
  fs.mkdirSync(path.dirname(tempVideo), { recursive: true });

  fs.writeFileSync(tempVideo, 'Original video bytes 12345');

  // Generate manifest
  generateRunManifest({
    outputPath: tempManifest,
    applicationUrl: 'http://localhost:8080',
    stateVerified: true,
    videoPath: tempVideo,
  });

  // Verify before tamper
  const initialCheck = verifyRunManifest(tempManifest);
  assert.equal(initialCheck.valid, true);

  // Tamper video bytes!
  fs.appendFileSync(tempVideo, ' - malicious injection');

  // Verify after tamper
  const tamperedCheck = verifyRunManifest(tempManifest);
  assert.equal(tamperedCheck.valid, false);
  assert.equal(tamperedCheck.errors.length, 1);
  assert.match(tamperedCheck.errors[0], /video sha-256 mismatch/i);

  // Clean up
  fs.rmSync(tempVideo, { force: true });
  fs.rmSync(tempManifest, { force: true });
});

