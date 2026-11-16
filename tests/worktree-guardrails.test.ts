import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPattern, invokeAntigravityRepair } from '../src/agent/antigravity.js';
import { AgentRepairRequest } from '../src/types.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

test('matchesPattern utility tests', () => {
  assert.equal(matchesPattern('tests/smoke.spec.ts', 'tests/**'), true);
  assert.equal(matchesPattern('examples/ledgerly/tests/smoke.spec.ts', 'examples/ledgerly/tests/**'), true);
  assert.equal(matchesPattern('examples/ledgerly/server/index.js', 'examples/ledgerly/**'), true);
  assert.equal(matchesPattern('src/cli.ts', 'examples/ledgerly/**'), false);
  assert.equal(matchesPattern('package.json', 'package.json'), true);
});

test('TEST-06: Agent returns success but leaves git diff empty -> Rejected', async () => {
  // Create a temporary git repo to simulate worktree
  const tempDir = path.resolve(process.cwd(), '.worktrees', 'test-wt-empty');
  fs.mkdirSync(tempDir, { recursive: true });
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@autocast.test"', { cwd: tempDir });
  execSync('git config user.name "Autocast Test"', { cwd: tempDir });
  fs.mkdirSync(path.join(tempDir, 'examples/ledgerly'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/app.js'), 'console.log("hello");');
  execSync('git add -A && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  const request: AgentRepairRequest = {
    worktreeDir: tempDir,
    appRelativePath: 'examples/ledgerly',
    objective: 'Fix approval',
    evidence: { sessionDir: tempDir },
    constraints: {
      allowedDirectories: ['examples/ledgerly/**'],
      protectedPaths: ['tests/**', 'examples/ledgerly/tests/**'],
      maxRepairAttempts: 2,
    },
  };

  const result = await invokeAntigravityRepair(request, {
    runner: async () => ({
      stdout: JSON.stringify({ status: 'SUCCESS' }),
      stderr: '',
      code: 0,
    }),
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /agent produced no file changes/i);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('TEST-05: Agent attempts modifying protected file (tests/**) -> Path guardrail aborts', async () => {
  const tempDir = path.resolve(process.cwd(), '.worktrees', 'test-wt-prot');
  fs.mkdirSync(tempDir, { recursive: true });
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@autocast.test"', { cwd: tempDir });
  execSync('git config user.name "Autocast Test"', { cwd: tempDir });
  fs.mkdirSync(path.join(tempDir, 'examples/ledgerly/tests'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/tests/smoke.spec.ts'), '// initial test');
  execSync('git add -A && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  const request: AgentRepairRequest = {
    worktreeDir: tempDir,
    appRelativePath: 'examples/ledgerly',
    objective: 'Fix approval',
    evidence: { sessionDir: tempDir },
    constraints: {
      allowedDirectories: ['examples/ledgerly/**'],
      protectedPaths: ['examples/ledgerly/tests/**'],
      maxRepairAttempts: 2,
    },
  };

  const result = await invokeAntigravityRepair(request, {
    runner: async () => {
      // Malicious or rogue edit in protected path
      fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/tests/smoke.spec.ts'), '// hacked test');
      return {
        stdout: JSON.stringify({ status: 'SUCCESS' }),
        stderr: '',
        code: 0,
      };
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /modified protected path/i);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('TEST-15: Agent creates untracked file outside allowed scope -> Rejected by status check', async () => {
  const tempDir = path.resolve(process.cwd(), '.worktrees', 'test-wt-untracked');
  fs.mkdirSync(tempDir, { recursive: true });
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@autocast.test"', { cwd: tempDir });
  execSync('git config user.name "Autocast Test"', { cwd: tempDir });
  fs.mkdirSync(path.join(tempDir, 'examples/ledgerly'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/app.js'), '// initial');
  execSync('git add -A && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  const request: AgentRepairRequest = {
    worktreeDir: tempDir,
    appRelativePath: 'examples/ledgerly',
    objective: 'Fix approval',
    evidence: { sessionDir: tempDir },
    constraints: {
      allowedDirectories: ['examples/ledgerly/**'],
      protectedPaths: ['tests/**'],
      maxRepairAttempts: 2,
    },
  };

  const result = await invokeAntigravityRepair(request, {
    runner: async () => {
      // Create untracked file outside allowed directory
      fs.writeFileSync(path.join(tempDir, 'malicious.js'), 'bad');
      return {
        stdout: JSON.stringify({ status: 'SUCCESS' }),
        stderr: '',
        code: 0,
      };
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /outside allowed directories/i);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('TEST-07: Agent modifies source but testCommand fails -> Rejected', async () => {
  const tempDir = path.resolve(process.cwd(), '.worktrees', 'test-wt-testfail');
  fs.mkdirSync(tempDir, { recursive: true });
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@autocast.test"', { cwd: tempDir });
  execSync('git config user.name "Autocast Test"', { cwd: tempDir });
  fs.mkdirSync(path.join(tempDir, 'examples/ledgerly'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/app.js'), '// initial');
  execSync('git add -A && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  const request: AgentRepairRequest = {
    worktreeDir: tempDir,
    appRelativePath: 'examples/ledgerly',
    objective: 'Fix approval',
    evidence: { sessionDir: tempDir },
    constraints: {
      allowedDirectories: ['examples/ledgerly/**'],
      protectedPaths: ['tests/**'],
      maxRepairAttempts: 2,
    },
  };

  const result = await invokeAntigravityRepair(request, {
    testCommand: 'node -e "process.exit(1)"', // simulated failing regression test
    runner: async () => {
      // Modify allowed source file
      fs.writeFileSync(path.join(tempDir, 'examples/ledgerly/app.js'), '// valid edit');
      return {
        stdout: JSON.stringify({ status: 'SUCCESS' }),
        stderr: '',
        code: 0,
      };
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /regression tests failed after repair/i);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

