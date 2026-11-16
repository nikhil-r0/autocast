import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { KaneRunResult, KaneStep } from '../types.js';

export interface KaneRunOptions {
  objective: string;
  url?: string;
  name?: string;
  timeoutSec?: number;
}

export async function executeKaneRun(options: KaneRunOptions): Promise<KaneRunResult> {
  const sessionName = options.name || `autocast-${Date.now()}`;
  const targetUrl = options.url || process.env.TARGET_APP_URL || 'http://localhost:8080/?logged_in=true';

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
    'stop',
    '--final-validation',
    'on',
    '--assertion-failure-mode',
    'stop',
    '--name',
    sessionName,
    '--code-export',
    '--code-language',
    'javascript',
  ];

  if (options.timeoutSec) {
    args.push('--timeout', String(options.timeoutSec));
  }

  console.log(`[Shoot Loop] Invoking Kane CLI: kane-cli ${args.join(' ')}`);

  return new Promise((resolve) => {
    const child = spawn('kane-cli', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let runEndData: any = null;
    const capturedSteps: KaneStep[] = [];
    let stdoutBuffer = '';
    let stderrText = '';

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line.trim());
          if (event.type === 'run_end') {
            runEndData = event;
          } else if (event.step && event.status === 'done') {
            capturedSteps.push({
              stepNumber: event.step,
              kind: event.remark?.split(':')[0]?.trim() || 'action',
              summary: event.remark || `Step ${event.step}`,
              durationMs: 1500,
              timestamp: event.ts,
            });
          }
        } catch (e) {
          // ignore non-json lines
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrText += chunk.toString();
    });

    child.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim());
          if (event.type === 'run_end') runEndData = event;
        } catch (e) {}
      }

      const passed = runEndData?.status === 'passed';
      const isProductDefect = runEndData?.status === 'failed' || code !== 0;

      // Extract rich step details from session actions ndjson if available
      let enrichedSteps = capturedSteps;
      if (runEndData?.session_dir) {
        enrichedSteps = enrichStepsFromSession(runEndData.session_dir, capturedSteps);
      }

      resolve({
        passed,
        isProductDefect: !passed,
        resultCode: runEndData?.result_code ?? (code === 0 ? 100 : 500),
        reasonCode: runEndData?.reason_code || (passed ? 'success.complete' : 'failure'),
        summary: runEndData?.summary || (passed ? 'Objective passed' : 'Objective failed'),
        sessionDir: runEndData?.session_dir,
        runDir: runEndData?.run_dir,
        steps: enrichedSteps,
        creditsConsumed: runEndData?.credits_consumed,
        testUrl: runEndData?.test_url,
        errorMessage: stderrText || (!passed ? runEndData?.summary : undefined),
      });
    });

    child.on('error', (err) => {
      resolve({
        passed: false,
        isProductDefect: false,
        resultCode: 500,
        reasonCode: 'execution.error',
        summary: `Failed to spawn kane-cli: ${err.message}`,
        steps: [],
        errorMessage: err.message,
      });
    });
  });
}

function enrichStepsFromSession(sessionDir: string, fallbackSteps: KaneStep[]): KaneStep[] {
  try {
    const codeExportDir = path.join(sessionDir, 'code-export');
    const actionsLog = findActionsLog(sessionDir);

    if (!actionsLog || !fs.existsSync(actionsLog)) {
      return fallbackSteps;
    }

    const lines = fs.readFileSync(actionsLog, 'utf-8').split('\n');
    const steps: KaneStep[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line.trim());
        if (item.action_type === 'navigate' || item.action_type === 'click') {
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
      } catch (e) {}
    }

    return steps.length > 0 ? steps : fallbackSteps;
  } catch (e) {
    return fallbackSteps;
  }
}

function findActionsLog(dir: string): string | null {
  // Look for 0-actions.ndjson in subdirectories
  const findRecursive = (current: string): string | null => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isFile() && entry.name === '0-actions.ndjson') {
        return full;
      }
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        const found = findRecursive(full);
        if (found) return found;
      }
    }
    return null;
  };

  try {
    return findRecursive(dir);
  } catch (e) {
    return null;
  }
}

