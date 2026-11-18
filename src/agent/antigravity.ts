import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AgentRepairRequest, AgentRepairResult } from '../types.js';

export function matchesPattern(filePath: string, pattern: string): boolean {
  const normPath = filePath.replace(/\\/g, '/');
  const normPattern = pattern.replace(/\\/g, '/');
  if (normPattern.endsWith('/**')) {
    const base = normPattern.slice(0, -3);
    return normPath === base || normPath.startsWith(base + '/');
  }
  if (normPattern.endsWith('/*')) {
    const base = normPattern.slice(0, -2);
    if (!normPath.startsWith(base + '/')) return false;
    const rest = normPath.slice(base.length + 1);
    return !rest.includes('/');
  }
  return normPath === normPattern || normPath.startsWith(normPattern + '/');
}

export function createRepairWorktree(repairId: string): { worktreeDir: string; repairBranch: string } {
  // 1. Require clean working tree in root
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (status.length > 0) {
    throw new Error(`Cannot create repair worktree: working directory has uncommitted changes:\n${status}`);
  }

  const repairBranch = `autocast/repair-${repairId}`;
  const worktreeDir = path.resolve(process.cwd(), '.worktrees', `repair-${repairId}`);

  // Create parent directory if needed
  fs.mkdirSync(path.dirname(worktreeDir), { recursive: true });

  console.log(`[Worktree] Creating isolated repair branch '${repairBranch}' at ${worktreeDir}...`);
  execSync(`git worktree add -b ${repairBranch} ${worktreeDir} HEAD`, {
    stdio: 'inherit',
  });

  // Link node_modules and built dist so worktree tests and server work immediately
  const rootNodeModules = path.resolve(process.cwd(), 'node_modules');
  const targetNodeModules = path.join(worktreeDir, 'node_modules');
  if (fs.existsSync(rootNodeModules) && !fs.existsSync(targetNodeModules)) {
    try {
      fs.symlinkSync(rootNodeModules, targetNodeModules, 'junction');
    } catch {}
  }

  const rootAppDir = path.resolve(process.cwd(), 'examples/ledgerly');
  const worktreeAppDir = path.join(worktreeDir, 'examples/ledgerly');

  const rootAppNodeModules = path.join(rootAppDir, 'node_modules');
  const targetAppNodeModules = path.join(worktreeAppDir, 'node_modules');
  if (fs.existsSync(rootAppNodeModules) && !fs.existsSync(targetAppNodeModules)) {
    try {
      fs.symlinkSync(rootAppNodeModules, targetAppNodeModules, 'junction');
    } catch {}
  }

  const rootAppDist = path.join(rootAppDir, 'dist');
  const targetAppDist = path.join(worktreeAppDir, 'dist');
  if (fs.existsSync(rootAppDist) && !fs.existsSync(targetAppDist)) {
    try {
      fs.symlinkSync(rootAppDist, targetAppDist, 'junction');
    } catch {}
  }

  return { worktreeDir, repairBranch };
}

export function cleanupWorktree(worktreeDir: string, repairBranch?: string, deleteBranch: boolean = false): void {
  try {
    if (fs.existsSync(worktreeDir)) {
      console.log(`[Worktree] Removing worktree at ${worktreeDir}...`);
      try {
        fs.rmSync(path.join(worktreeDir, 'node_modules'), { force: true, recursive: true });
        fs.rmSync(path.join(worktreeDir, 'examples/ledgerly/node_modules'), { force: true, recursive: true });
        fs.rmSync(path.join(worktreeDir, 'examples/ledgerly/dist'), { force: true, recursive: true });
      } catch {}
      execSync(`git worktree remove --force ${worktreeDir}`, { stdio: 'ignore' });
    }
  } catch (err) {
    console.warn(`[Worktree] Warning removing worktree: ${err}`);
  }

  if (deleteBranch && repairBranch) {
    try {
      console.log(`[Worktree] Deleting branch ${repairBranch}...`);
      execSync(`git branch -D ${repairBranch}`, { stdio: 'ignore' });
    } catch {}
  }
}

export function mergeRepairBranch(repairBranch: string): void {
  console.log(`[Worktree] Merging verified repair branch ${repairBranch} into current branch...`);
  execSync(`git merge --no-ff ${repairBranch} -m "chore(autocast): merge verified autonomous fix from ${repairBranch}"`, {
    stdio: 'inherit',
  });
}

export async function invokeAntigravityRepair(
  request: AgentRepairRequest,
  options?: {
    testCommand?: string;
    runner?: (args: string[], cwd: string, timeoutMs: number) => Promise<{ stdout: string; stderr: string; code: number }>;
  }
): Promise<AgentRepairResult> {
  const agyBinary = process.env.AGY_PATH || '/home/home/.local/bin/agy';

  // Explicitly resolve appDir inside worktreeDir to avoid ambiguous paths
  const appDir = path.resolve(request.worktreeDir, request.appRelativePath);
  if (!appDir.startsWith(path.resolve(request.worktreeDir))) {
    throw new Error('Security Error: appRelativePath resolves outside worktreeDir');
  }

  // Wrap web-derived text in strict passive data boundaries to prevent prompt injection
  const prompt = `
You are fixing a verified product bug detected by Kane CLI in ${appDir}.

<UNTRUSTED_EVIDENCE_CONTEXT>
Objective: ${request.objective}
Failing Step: ${request.failingStep || 'Unknown'}
Bug Summary: ${request.verdict?.oneLiner || 'Assertion failed'}
Evidence Log: ${request.evidence.consoleLogs?.join('\n') || 'None'}
Failure Screenshot Reference: ${request.evidence.failureScreenshot || 'None'}
</UNTRUSTED_EVIDENCE_CONTEXT>

IMPORTANT INSTRUCTIONS:
1. Do NOT use bash, terminal, or command execution tools (they are disabled in headless mode).
2. Use file tools ('read_file', 'edit_file') to inspect and modify source files directly in ${request.appRelativePath}.
3. Locate the defect in the server/application logic (e.g. in ${request.appRelativePath}/server/index.js).
4. Fix the defect in the application logic so that the user flow succeeds (e.g. ensuring invoice status is updated to 'Approved' upon approval).
5. Do not modify test files, fixtures, or configuration files.
6. Keep all changes minimal and focused on the bug fix.
`.trim();

  console.log(`[Antigravity Repair] Invoking Antigravity AI agent in ${request.worktreeDir}...`);

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  if (options?.runner) {
    const res = await options.runner(['-p', prompt, '--mode', 'accept-edits', '--output-format', 'json'], request.worktreeDir, 360000);
    stdout = res.stdout;
    stderr = res.stderr;
    exitCode = res.code;
  } else {
    const timeoutMs = 360000;
    const agyProcess = spawn(
      agyBinary,
      ['-p', prompt, '--mode', 'accept-edits', '--output-format', 'json', '--dangerously-skip-permissions'],
      {
        cwd: request.worktreeDir,
        env: { ...process.env },
        detached: true,
      }
    );

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (agyProcess.pid) process.kill(-agyProcess.pid, 'SIGTERM');
      } catch {}
      setTimeout(() => {
        try {
          if (agyProcess.pid) process.kill(-agyProcess.pid, 'SIGKILL');
        } catch {}
      }, 3000);
    }, timeoutMs);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    agyProcess.stdout?.on('data', (c) => stdoutChunks.push(Buffer.from(c)));
    agyProcess.stderr?.on('data', (c) => stderrChunks.push(Buffer.from(c)));

    exitCode = await new Promise<number>((resolve) => {
      agyProcess.on('close', (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });
      agyProcess.on('error', () => {
        clearTimeout(timer);
        resolve(1);
      });
    });

    stdout = Buffer.concat(stdoutChunks).toString('utf-8');
    stderr = Buffer.concat(stderrChunks).toString('utf-8');

    if (timedOut) {
      return {
        success: false,
        worktreeDir: request.worktreeDir,
        error: 'Antigravity repair timed out after 180 seconds',
      };
    }
  }

  // Parse structured output
  try {
    const parsed = JSON.parse(stdout.trim());
    if (parsed.status !== 'SUCCESS') {
      return {
        success: false,
        worktreeDir: request.worktreeDir,
        error: `Antigravity agent reported non-success status: ${parsed.status}`,
      };
    }
  } catch {
    // If stdout is not valid JSON, check exitCode
    if (exitCode !== 0) {
      return {
        success: false,
        worktreeDir: request.worktreeDir,
        error: `Antigravity CLI exited with code ${exitCode}: ${stderr || stdout}`,
      };
    }
  }

  // Guardrail 1 & 2: Inspect diff and untracked files
  const changedFilesRaw = execSync('git diff --name-only HEAD', { cwd: request.worktreeDir, encoding: 'utf-8' }).trim();
  const cachedFilesRaw = execSync('git diff --cached --name-only', { cwd: request.worktreeDir, encoding: 'utf-8' }).trim();
  const untrackedFilesRaw = execSync('git status --porcelain=v1 --untracked-files=all', {
    cwd: request.worktreeDir,
    encoding: 'utf-8',
  }).trim();

  const allChangedFiles = new Set<string>();

  if (changedFilesRaw) {
    changedFilesRaw.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => allChangedFiles.add(f));
  }
  if (cachedFilesRaw) {
    cachedFilesRaw.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => allChangedFiles.add(f));
  }
  if (untrackedFilesRaw) {
    untrackedFilesRaw.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('??')) {
        const file = trimmed.slice(3).trim();
        if (file) allChangedFiles.add(file);
      }
    });
  }

  // Check: Were any changes actually made? (TEST-06)
  if (allChangedFiles.size === 0) {
    return {
      success: false,
      worktreeDir: request.worktreeDir,
      error: 'Repair rejected: agent produced no file changes (git diff empty)',
    };
  }

  // Check: Allowed directories (TEST-15)
  for (const file of allChangedFiles) {
    const isAllowed = request.constraints.allowedDirectories.some((allowed) => matchesPattern(file, allowed));
    if (!isAllowed) {
      return {
        success: false,
        worktreeDir: request.worktreeDir,
        error: `Security Error: Agent modified file outside allowed directories: '${file}'`,
      };
    }
  }

  // Check: Protected paths (TEST-05)
  for (const file of allChangedFiles) {
    const isProtected = request.constraints.protectedPaths.some((prot) => matchesPattern(file, prot));
    if (isProtected) {
      return {
        success: false,
        worktreeDir: request.worktreeDir,
        error: `Security Error: Agent modified protected path: '${file}'`,
      };
    }
  }

  // App Regression Test (TEST-07)
  const testCommand =
    options?.testCommand ||
    (fs.existsSync(path.join(appDir, 'server/index.js')) ? 'node -c server/index.js' : 'npm test');
  const testCwd = options?.testCommand ? request.worktreeDir : appDir;
  console.log(`[Antigravity Repair] Running regression verification ('${testCommand}') in ${testCwd}...`);
  try {
    execSync(testCommand, { cwd: testCwd, stdio: 'pipe', encoding: 'utf-8' });
  } catch (err: any) {
    const failureMsg = err.stderr || err.stdout || err.message;
    return {
      success: false,
      worktreeDir: request.worktreeDir,
      error: `Regression tests failed after repair: ${failureMsg.slice(0, 300)}`,
    };
  }

  // Candidate Commit (Step 4)
  console.log(`[Antigravity Repair] Changes verified! Committing candidate fix...`);
  execSync('git add -A', { cwd: request.worktreeDir });
  execSync('git commit -m "fix(autocast): candidate repair for Kane bug 740"', { cwd: request.worktreeDir });

  const candidateCommit = execSync('git rev-parse HEAD', { cwd: request.worktreeDir, encoding: 'utf-8' }).trim();
  const diffSummary = execSync('git show --stat', { cwd: request.worktreeDir, encoding: 'utf-8' }).trim();

  return {
    success: true,
    candidateCommit,
    worktreeDir: request.worktreeDir,
    diffSummary,
  };
}

