import fs from 'fs';
import path from 'path';

function createWavFile(outputPath, sampleRate, samples) {
  const byteRate = sampleRate * 2; // 16-bit mono = 2 bytes per sample
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(byteRate, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`[SFX] Created ${outputPath} (${samples.length} samples, ${(samples.length / sampleRate * 1000).toFixed(1)}ms)`);
}

const sampleRate = 44100;

// 1. Soft Tactile Mouse Click (warm 50ms transient with fast exponential decay)
const clickDurationMs = 50;
const clickSamplesCount = Math.floor((sampleRate * clickDurationMs) / 1000);
const clickSamples = new Float32Array(clickSamplesCount);

for (let i = 0; i < clickSamplesCount; i++) {
  const t = i / sampleRate;
  // Subtle dual-tone 850Hz + 1200Hz click with steep exponential decay (tau = 7ms)
  const decay = Math.exp(-t / 0.007);
  const tone = Math.sin(2 * Math.PI * 850 * t) * 0.7 + Math.sin(2 * Math.PI * 1250 * t) * 0.3;
  clickSamples[i] = tone * decay * 0.45;
}

// 2. Verified Compliance Seal Stamp (rich 240ms low-end thud)
const stampDurationMs = 240;
const stampSamplesCount = Math.floor((sampleRate * stampDurationMs) / 1000);
const stampSamples = new Float32Array(stampSamplesCount);

for (let i = 0; i < stampSamplesCount; i++) {
  const t = i / sampleRate;
  // 95Hz warm sub-bass pitch envelope sliding down to 60Hz, decaying over 65ms
  const freq = 95 - 35 * (i / stampSamplesCount);
  const decay = Math.exp(-t / 0.065);
  const tone = Math.sin(2 * Math.PI * freq * t);
  stampSamples[i] = tone * decay * 0.55;
}

const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

createWavFile(path.join(publicDir, 'sfx-click.wav'), sampleRate, clickSamples);
createWavFile(path.join(publicDir, 'sfx-stamp.wav'), sampleRate, stampSamples);

