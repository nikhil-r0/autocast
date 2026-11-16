import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import { AppLifecycleAdapter } from '../types.js';

export class LedgerlyLifecycleAdapter implements AppLifecycleAdapter {
  name = 'ledgerly';
  appDir: string;
  port: number;
  baseUrl: string;
  serverProcess: ChildProcess | null = null;

  constructor(options?: { appDir?: string; port?: number }) {
    this.appDir = options?.appDir || path.resolve(process.cwd(), 'examples/ledgerly');
    this.port = options?.port || 8080;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  async start(opts?: { env?: Record<string, string>; commit?: string }): Promise<{ pid: number; port: number; commit?: string }> {
    // Stop any existing instance on the port
    await this.stop();

    const env = {
      ...process.env,
      PORT: String(this.port),
      APP_COMMIT: opts?.commit || process.env.APP_COMMIT || '',
      ...(opts?.env || {}),
    };

    console.log(`[Lifecycle] Starting Ledgerly from ${this.appDir} on port ${this.port}...`);
    const serverPath = path.join(this.appDir, 'server/index.js');

    this.serverProcess = spawn(process.execPath, [serverPath], {
      cwd: this.appDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    const pid = this.serverProcess.pid!;
    this.serverProcess.unref();

    // Poll healthcheck until ready (max 15s)
    const startTime = Date.now();
    let isHealthy = false;
    let lastCommit: string | undefined;

    while (Date.now() - startTime < 15000) {
      try {
        const res = await fetch(`${this.baseUrl}/api/health`);
        if (res.ok) {
          const body: any = await res.json();
          lastCommit = body.commit;
          if (!opts?.commit || body.commit === opts.commit) {
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
      if (opts?.commit && lastCommit && lastCommit !== opts.commit) {
        throw new Error(
          `Lifecycle Error: Server started but returned commit '${lastCommit}' instead of expected candidate commit '${opts.commit}'`
        );
      }
      throw new Error(`Lifecycle Error: Server at ${this.baseUrl} failed to become healthy within 15 seconds`);
    }

    console.log(`[Lifecycle] Ledgerly is healthy on ${this.baseUrl} (commit: ${lastCommit || 'none'}, pid: ${pid})`);
    return { pid, port: this.port, commit: lastCommit };
  }

  async stop(): Promise<void> {
    if (this.serverProcess && this.serverProcess.pid) {
      try {
        process.kill(-this.serverProcess.pid, 'SIGTERM');
      } catch {
        try {
          this.serverProcess.kill('SIGTERM');
        } catch {}
      }
      this.serverProcess = null;
    }

    // Free port if still occupied
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
            process.kill(pidNum, 'SIGTERM');
          } catch {}
        }
      }
    } catch {
      // Port is free
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  async healthCheck(expectedCommit?: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) return false;
      const body: any = await res.json();
      if (expectedCommit && body.commit !== expectedCommit) {
        console.warn(`[Lifecycle] Health check commit mismatch: got '${body.commit}', expected '${expectedCommit}'`);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async resetSeedData(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to reset seed data: HTTP ${res.status}`);
    }
  }

  async verifyUnderlyingState(expected?: Record<string, any>): Promise<boolean> {
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
