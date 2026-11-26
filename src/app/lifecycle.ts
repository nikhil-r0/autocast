import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AppLifecycleAdapter, OutcomeSpec } from '../types.js';
import { verifyApiStateOutcomes } from '../capture/actionIR.js';
import { scrubChildEnv } from '../oracle/env.js';

export const SUPPORTED_LEDGERLY_SEED_IDS = new Set(['ledgerly-default-v1', 'default']);

export class DeliverableBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeliverableBuildError';
  }
}

export class RunnerInfraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunnerInfraError';
  }
}

const INFRA_NETWORK_ERROR_RE = /EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ERR_SOCKET|getaddrinfo/i;
const LOCKFILE_OR_CONTRACTOR_INSTALL_RE = /E404|ETARGET|EINTEGRITY|ENOLOCK|EUSAGE|sha512-|integrity checksum|notarget|404 Not Found|invalid package|ERESOLVE/i;

export async function checkNpmRegistryHealth(
  registryUrl: string = process.env.npm_config_registry || 'https://registry.npmjs.org/'
): Promise<boolean> {
  try {
    const base = registryUrl.replace(/\/+$/, '');
    const pingUrl = `${base}/-/ping`;
    const res = await fetch(pingUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok || res.status < 500) return true;
    const rootRes = await fetch(base, { signal: AbortSignal.timeout(5000) });
    return rootRes.status < 500;
  } catch {
    return false;
  }
}

export interface LifecycleStartOptions {
  env?: Record<string, string>;
  commit?: string;
  strictPort?: boolean;
  requireHealthyCommitMatch?: boolean;
  buildDistIfMissing?: boolean;
  scrubEnv?: boolean;
  allowNodeModulesSymlink?: boolean;
  checkRegistryFn?: () => Promise<boolean>;
}

export class LedgerlyLifecycleAdapter implements AppLifecycleAdapter {
  name = 'ledgerly';
  appDir: string;
  port: number;
  baseUrl: string;
  serverProcess: ChildProcess | null = null;

  constructor(options?: { appDir?: string; port?: number; baseUrl?: string }) {
    this.appDir = options?.appDir || path.resolve(process.cwd(), 'examples/ledgerly');
    this.port = options?.port || 8080;
    this.baseUrl = (options?.baseUrl || `http://localhost:${this.port}`).replace(/\/+$/, '');
  }

  private resolveCheckoutCommit(): string | undefined {
    try {
      const sha = execSync('git rev-parse HEAD', {
        cwd: this.appDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return sha || undefined;
    } catch {
      return undefined;
    }
  }

  private isPortOccupied(): boolean {
    try {
      const check = execSync(`lsof -ti :${this.port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      return Boolean(check);
    } catch {
      return false;
    }
  }

  async start(opts?: LifecycleStartOptions): Promise<{ pid: number; port: number; commit?: string }> {
    // Stop any existing Ledgerly instance on the port
    await this.stop();

    if (opts?.strictPort && this.isPortOccupied()) {
      throw new RunnerInfraError(
        `Oracle Port Conflict: Port ${this.port} is occupied by an unrelated external process.`
      );
    }

    const resolvedCommit = opts?.commit ?? process.env.APP_COMMIT ?? this.resolveCheckoutCommit() ?? '';
    const overrides: Record<string, string | undefined> = {
      PORT: String(this.port),
      ...(resolvedCommit ? { APP_COMMIT: resolvedCommit } : {}),
      ...(opts?.env || {}),
    };
    const env: Record<string, string | undefined> = opts?.scrubEnv
      ? scrubChildEnv(process.env, overrides)
      : {
          ...process.env,
          ...overrides,
        };

    console.log(`[Lifecycle] Starting Ledgerly from ${this.appDir} on port ${this.port}...`);
    const serverPath = path.join(this.appDir, 'server/index.js');

    // Ensure node_modules exists; in demo worktrees symlink from root, in oracle install from pinned lockfile
    const appNodeModules = path.join(this.appDir, 'node_modules');
    const rootAppNodeModules = path.resolve(process.cwd(), 'examples/ledgerly/node_modules');
    const allowSymlink = opts?.allowNodeModulesSymlink !== false;
    if (!fs.existsSync(appNodeModules)) {
      if (allowSymlink && fs.existsSync(rootAppNodeModules)) {
        try {
          fs.symlinkSync(rootAppNodeModules, appNodeModules, 'junction');
        } catch {}
      } else if (!allowSymlink) {
        const hasLockfile = fs.existsSync(path.join(this.appDir, 'package-lock.json'));
        const installCmd = hasLockfile
          ? 'npm ci --ignore-scripts --no-audit --no-fund'
          : 'npm install --ignore-scripts --no-audit --no-fund';
        const registryHealthy = await (opts?.checkRegistryFn
          ? opts.checkRegistryFn()
          : checkNpmRegistryHealth(env?.npm_config_registry));
        if (!registryHealthy) {
          throw new RunnerInfraError(
            'Runner npm registry health check failed prior to deliverable dependency install.'
          );
        }
        console.log(`[Lifecycle] Installing pinned dependencies in ${this.appDir} via "${installCmd}"...`);
        try {
          execSync(installCmd, { cwd: this.appDir, env, stdio: 'pipe' });
        } catch (err: any) {
          const stderr = err?.stderr ? String(err.stderr) : '';
          const stdout = err?.stdout ? String(err.stdout) : '';
          const message = `${err?.message || ''}\n${stderr}\n${stdout}`.trim();
          // On a verified healthy runner registry, 404/integrity/lockfile failures belong to contractor lockfile
          if (LOCKFILE_OR_CONTRACTOR_INSTALL_RE.test(message)) {
            throw new DeliverableBuildError(`Deliverable lockfile/dependency install failed (${installCmd}): ${message}`);
          }
          if (INFRA_NETWORK_ERROR_RE.test(message)) {
            throw new RunnerInfraError(`Runner dependency install failed due to transient network error: ${message}`);
          }
          throw new DeliverableBuildError(`Deliverable dependency install failed (${installCmd}): ${message}`);
        }
      }
    }

    // Ensure built frontend dist assets exist
    const distDir = path.join(this.appDir, 'dist');
    const rootDist = path.resolve(process.cwd(), 'examples/ledgerly/dist');
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      if (opts?.buildDistIfMissing) {
        console.log(`[Lifecycle] Building Ledgerly frontend assets in ${this.appDir}...`);
        try {
          execSync('npm run build', { cwd: this.appDir, env, stdio: 'pipe' });
        } catch (err: any) {
          const stderr = err?.stderr ? String(err.stderr) : '';
          const stdout = err?.stdout ? String(err.stdout) : '';
          throw new DeliverableBuildError(
            `Deliverable frontend build failed (npm run build): ${stderr || stdout || err?.message}`
          );
        }
      } else if (allowSymlink && !fs.existsSync(distDir) && fs.existsSync(rootDist)) {
        try {
          fs.symlinkSync(rootDist, distDir, 'junction');
        } catch {}
      }
    }

    this.serverProcess = spawn(process.execPath, [serverPath], {
      cwd: this.appDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let serverStderr = '';
    let childExited = false;
    let childExitCode: number | null = null;
    this.serverProcess.stderr?.on('data', (chunk) => {
      serverStderr += chunk.toString();
    });
    this.serverProcess.on('exit', (code) => {
      childExited = true;
      childExitCode = code;
    });

    const pid = this.serverProcess.pid!;
    this.serverProcess.unref();

    const requireCommitMatch = opts?.requireHealthyCommitMatch ?? true;

    // Poll healthcheck until ready (max 15s)
    const startTime = Date.now();
    let isHealthy = false;
    let lastCommit: string | undefined;

    while (Date.now() - startTime < 15000) {
      if (childExited) {
        throw new DeliverableBuildError(
          `Lifecycle Error: Server process exited early (code=${childExitCode}).${serverStderr ? `\nServer stderr:\n${serverStderr}` : ''}`
        );
      }
      try {
        const res = await fetch(`${this.baseUrl}/api/health`);
        if (res.ok) {
          const body: any = await res.json();
          lastCommit = body.commit;
          if (!requireCommitMatch || !opts?.commit || body.commit === opts.commit) {
            isHealthy = true;
            break;
          }
        }
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!isHealthy) {
      if (requireCommitMatch && opts?.commit && lastCommit && lastCommit !== opts.commit) {
        throw new DeliverableBuildError(
          `Lifecycle Error: Server started but returned commit '${lastCommit}' instead of expected candidate commit '${opts.commit}'`
        );
      }
      throw new DeliverableBuildError(
        `Lifecycle Error: Server at ${this.baseUrl} failed to become healthy within 15 seconds.${serverStderr ? `\nServer stderr:\n${serverStderr}` : ''}`
      );
    }

    console.log(`[Lifecycle] Ledgerly is healthy on ${this.baseUrl} (commit: ${lastCommit || 'none'}, pid: ${pid})`);
    return { pid, port: this.port, commit: lastCommit };
  }

  async stop(): Promise<void> {
    if (this.serverProcess && this.serverProcess.pid) {
      try {
        process.kill(-this.serverProcess.pid, 'SIGKILL');
      } catch {
        try {
          this.serverProcess.kill('SIGKILL');
        } catch {}
      }
      this.serverProcess = null;
    }

    // Free port if still occupied by an AutoCast / Ledgerly server process
    try {
      const pids = execSync(`lsof -ti :${this.port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
        .split('\n')
        .filter(Boolean);
      for (const p of pids) {
        const pidNum = parseInt(p, 10);
        if (pidNum && pidNum !== process.pid) {
          try {
            // Verify process ownership before sending termination signal
            const cmd = execSync(`ps -p ${pidNum} -o args=`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            if (cmd.includes('ledgerly') || cmd.includes('examples/ledgerly') || cmd.includes('server/index.js')) {
              process.kill(pidNum, 'SIGKILL');
            } else {
              console.warn(`[Lifecycle] Port ${this.port} occupied by unrelated PID ${pidNum} ('${cmd}'), skipping.`);
            }
          } catch {}
        }
      }
    } catch {
      // Port is free
    }

    // Wait until port is actually free (up to 3 seconds)
    for (let i = 0; i < 30; i++) {
      if (!this.isPortOccupied()) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async getHealthInfo(): Promise<{ ok: boolean; commit?: string; bug?: string | null } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) return null;
      const body: any = await res.json();
      return {
        ok: true,
        commit: body.commit,
        bug: body.bug || null,
      };
    } catch {
      return null;
    }
  }

  async healthCheck(expectedCommit?: string): Promise<boolean> {
    const info = await this.getHealthInfo();
    if (!info?.ok) return false;
    if (expectedCommit && (info.commit || '').toLowerCase() !== expectedCommit.toLowerCase()) {
      console.warn(`[Lifecycle] Health check commit mismatch: got '${info.commit}', expected '${expectedCommit}'`);
      return false;
    }
    return true;
  }

  async resetSeedData(seedId?: string): Promise<void> {
    if (seedId && !SUPPORTED_LEDGERLY_SEED_IDS.has(seedId)) {
      throw new Error(
        `Unsupported seed_id '${seedId}'. Supported Ledgerly seed IDs: ${Array.from(SUPPORTED_LEDGERLY_SEED_IDS).join(', ')}`
      );
    }

    const res = await fetch(`${this.baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed_id: seedId || 'ledgerly-default-v1' }),
    });
    if (!res.ok) {
      throw new Error(`Failed to reset seed data: HTTP ${res.status}`);
    }
  }

  async verifyUnderlyingState(expected?: Record<string, any> | OutcomeSpec[]): Promise<boolean> {
    if (Array.isArray(expected)) {
      const result = await verifyApiStateOutcomes(this.baseUrl, expected);
      if (!result.passed) {
        for (const failure of result.failures) {
          console.error(`[State Verify] ${failure}`);
        }
        return false;
      }
      if (result.checkedCount === 0) {
        console.error('[State Verify] No api_state outcome_specs provided; oracle mode requires backend truth assertions.');
        return false;
      }
      return true;
    }

    try {
      const targetInvoice = expected?.invoiceId || 'INV-1042';
      const expectedStatus = expected?.status || 'Approved';

      const res = await fetch(`${this.baseUrl}/api/invoices/${targetInvoice}`);
      if (!res.ok) return false;
      const invoice: any = await res.json();
      return invoice.status === expectedStatus;
    } catch {
      return false;
    }
  }
}
