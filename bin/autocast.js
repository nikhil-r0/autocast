#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distCli = path.resolve(__dirname, '../dist/cli.js');
const srcCli = path.resolve(__dirname, '../src/cli.ts');

function run(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

if (fs.existsSync(distCli)) {
  run(process.execPath, [distCli, ...process.argv.slice(2)]);
} else if (fs.existsSync(srcCli)) {
  let tsxLoader;
  try {
    tsxLoader = createRequire(import.meta.url).resolve('tsx/esm');
  } catch {
    console.error(
      '[autocast] CLI source is present but tsx is not installed, and dist/cli.js is missing.\n' +
        'Run "npm install && npm run build", then retry.'
    );
    process.exit(1);
  }
  run(process.execPath, ['--import', tsxLoader, srcCli, ...process.argv.slice(2)]);
} else {
  console.error(
    '[autocast] Neither dist/cli.js nor src/cli.ts was found. Reinstall the package or rebuild.'
  );
  process.exit(1);
}
