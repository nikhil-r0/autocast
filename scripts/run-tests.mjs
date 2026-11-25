#!/usr/bin/env node
/**
 * Cross-platform test runner. Node's --test does not expand quoted globs on Linux
 * when npm passes them literally, so we resolve test files ourselves.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tests');
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => path.join(testsDir, name))
  .sort();

if (files.length === 0) {
  console.error(`No *.test.ts files found in ${testsDir}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
