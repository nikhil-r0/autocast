import { spawn, execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { KaneRunResult, KaneStep } from '../types.js';
import { normalizeKaneExecution } from './kaneAdapter.js';
import { stripOracleSecrets } from '../oracle/env.js';
import { findActionsLog } from '../capture/actionIR.js';

/**
 * Oracle Mode is pinned to the exact tested Kane CLI version allowlist whose
 * --bug-detection off, NDJSON run_end, and .evidence bundle layout are verified.
 */
export const SUPPORTED_ORACLE_KANE_VERSIONS = new Set<string>(['0.10.4']);

export function probeKaneCliVersion(): string {
  const out = execFileSync('kane-cli', ['--version'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const match = out.match(/\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/);
  return match ? match[1] : out;
}

export interface KaneRunOptions {
  objective: string;
  url?: string;
  name?: string;
  timeoutSec?: number;
  bugDetection?: 'stop' | 'off';
  scrubOracleSecrets?: boolean;
}

export async function executeKaneRun(options: KaneRunOptions): Promise<KaneRunResult> {
  const sessionName = options.name || `autocast-${Date.now()}`;
  const targetUrl = options.url || process.env.TARGET_APP_URL || 'http://localhost:8080/?logged_in=true';
  const timeoutSec = options.timeoutSec || 300;
  const bugDetection = options.bugDetection ?? 'stop';

  const args = [
    'run',
    options.objective,
    '--url',
    targetUrl,
    '--headless',
    '--agent',
    '--mode',
    'action',
    '--bug-detection',
    bugDetection,
    '--final-validation',
    'on',
    '--assertion-failure-mode',
    'stop',
    '--name',
    sessionName,
    '--timeout',
    String(timeoutSec),
  ];

  console.log(`[Shoot Loop] Invoking Kane CLI: kane-cli ${args.join(' ')}`);

  const startTime = Date.now();
  const childEnv = options.scrubOracleSecrets ? stripOracleSecrets(process.env) : { ...process.env };

  return new Promise((resolve) => {
    const child = spawn('kane-cli', args, {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderrText = '';

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrText += chunk.toString();
    });

    child.on('close', (code) => {
      const durationSec = (Date.now() - startTime) / 1000;
      const exitCode = code ?? 1;

      // Normalize output through KaneRunAdapter
      const normalized = normalizeKaneExecution({
        exitCode,
        stdout: stdoutBuffer,
        stderr: stderrText,
        durationSec,
        timeoutSec,
      });

      // Persist raw stream & stderr to disk for provenance & debugging
      const runLogDir = path.join(process.cwd(), 'out', 'runs', sessionName);
      try {
        fs.mkdirSync(runLogDir, { recursive: true });
        fs.writeFileSync(path.join(runLogDir, 'kane-stream.ndjson'), stdoutBuffer, 'utf-8');
        fs.writeFileSync(path.join(runLogDir, 'kane-stderr.log'), stderrText, 'utf-8');
        fs.writeFileSync(
          path.join(runLogDir, 'run-metadata.json'),
          JSON.stringify(
            {
              sessionName,
              objective: options.objective,
              targetUrl,
              exitCode,
              durationSec,
              category: normalized.category,
              resultCode: normalized.resultCode,
              verdict: normalized.verdict,
            },
            null,
            2
          ),
          'utf-8'
        );
      } catch (err) {
        console.warn(`[Kane Run] Warning: Failed to persist run logs: ${err}`);
      }

      // Extract rich step details and evidence pack from session dir if available
      let enrichedSteps = normalized.steps;
      let evidencePack = normalized.evidencePack;
      if (normalized.sessionDir) {
        enrichedSteps = enrichStepsFromSession(normalized.sessionDir, normalized.steps, evidencePack);
        if (!evidencePack) {
          evidencePack = findEvidencePack(normalized.sessionDir) || undefined;
        }
      }

      resolve({
        ...normalized,
        evidencePack,
        steps: enrichedSteps,
      });
    });

    child.on('error', (err) => {
      resolve({
        passed: false,
        category: 'cli_configuration_error',
        isProductDefect: false,
        exitCode: 2,
        resultCode: 500,
        reasonCode: 'execution.error',
        summary: `Failed to spawn kane-cli: ${err.message}`,
        steps: [],
        errorMessage: err.message,
      });
    });
  });
}

function enrichStepsFromSession(sessionDir: string, fallbackSteps: KaneStep[], evidencePack?: string): KaneStep[] {
  try {
    const actionsLog = findActionsLog(sessionDir, evidencePack);
    if (!actionsLog || !fs.existsSync(actionsLog)) {
      return fallbackSteps;
    }

    const lines = fs.readFileSync(actionsLog, 'utf-8').split('\n');
    const steps: KaneStep[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line.trim());
        if (item.action_type === 'navigate' || item.action_type === 'click' || item.action_type === 'type') {
          const visual = item.visual_data;
          steps.push({
            stepNumber: item.step,
            kind: item.action_type,
            summary: item.action_instruction || item.intent,
            durationMs: item.duration_ms || 2000,
            url: item.action_params?.url,
            elementRect: visual?.bbox ? {
              x: visual.bbox.x,
              y: visual.bbox.y,
              width: visual.bbox.width,
              height: visual.bbox.height,
            } : undefined,
            clickCoordinates: visual ? {
              x: visual.x,
              y: visual.y,
            } : undefined,
            selector: item.selectors?.[0]?.selector,
            timestamp: item.timestamp,
          });
        }
      } catch {}
    }

    return steps.length > 0 ? steps : fallbackSteps;
  } catch {
    return fallbackSteps;
  }
}

function findEvidencePack(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.endsWith('.evidence') || entry.name === '.evidence') {
        return full;
      }
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.git')) {
        const subEntries = fs.readdirSync(full, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.name.endsWith('.evidence') || sub.name === '.evidence') {
            return path.join(full, sub.name);
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
