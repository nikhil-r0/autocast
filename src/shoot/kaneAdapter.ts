import { KaneRunResult, KaneStep, FailureCategory, KaneVerdict } from '../types.js';

export interface RawKaneExecution {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationSec?: number;
  timeoutSec?: number;
}

/**
 * Normalizes raw Kane CLI output (stdout NDJSON stream, stderr, exit code)
 * into a typed KaneRunResult conforming to the verified contract.
 */
export function normalizeKaneExecution(raw: RawKaneExecution): KaneRunResult {
  const { exitCode, stdout, stderr, durationSec = 0, timeoutSec = 300 } = raw;

  let runEndData: any = null;
  const capturedSteps: KaneStep[] = [];
  const rawEvents: any[] = [];

  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line.trim());
      rawEvents.push(event);

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
    } catch {
      // ignore non-json lines
    }
  }

  const passed = exitCode === 0 && runEndData?.status === 'passed';
  const resultCode = runEndData?.result_code ? Number(runEndData.result_code) : (exitCode === 0 ? 100 : undefined);
  const reasonCode = runEndData?.reason_code || (passed ? 'success.complete' : 'failure');

  // Parse verdict if Kane confirmed a product bug under --bug-detection stop
  let verdict: KaneVerdict | undefined = undefined;
  if (runEndData?.verdict) {
    verdict = {
      confirmed: Boolean(runEndData.verdict.confirmed),
      family: String(runEndData.verdict.family || 'product_defect'),
      category: String(runEndData.verdict.category || 'assertion_failure'),
      severity: String(runEndData.verdict.severity || 'high'),
      oneLiner: String(runEndData.verdict.one_liner || runEndData.summary || 'Product defect detected'),
      confidence: Number(runEndData.verdict.confidence ?? 1.0),
    };
  } else if (resultCode === 740) {
    verdict = {
      confirmed: true,
      family: 'product_defect',
      category: 'bug_detected',
      severity: 'high',
      oneLiner: runEndData?.summary || 'Confirmed product bug detected by Kane CLI',
      confidence: 1.0,
    };
  }

  // Determine category based on Kane exit code and run_end payload
  let category: FailureCategory = 'unconfirmed_failure';
  let isProductDefect = false;

  if (passed) {
    category = 'pass';
  } else if (exitCode === 1) {
    if (resultCode === 740 && verdict?.confirmed) {
      category = 'confirmed_product_bug';
      isProductDefect = true;
    } else {
      category = 'unconfirmed_failure';
      isProductDefect = false;
    }
  } else if (exitCode === 2) {
    category = 'cli_configuration_error';
  } else if (exitCode === 3) {
    if (durationSec >= timeoutSec - 5 || (runEndData?.reason && runEndData.reason.toLowerCase().includes('timeout'))) {
      category = 'timeout';
    } else {
      category = 'cancelled';
    }
  } else {
    category = 'unconfirmed_failure';
  }

  const evidencePack =
    runEndData?.evidence_pack ||
    runEndData?.evidence_pack_path ||
    runEndData?.evidence_zip ||
    undefined;

  return {
    passed,
    category,
    isProductDefect,
    exitCode,
    resultCode,
    reasonCode,
    summary: runEndData?.summary || (passed ? 'Objective passed' : `Kane run halted with exit code ${exitCode}`),
    verdict,
    sessionDir: runEndData?.session_dir,
    runDir: runEndData?.run_dir,
    evidencePack,
    creditsConsumed: runEndData?.credits_consumed,
    testUrl: runEndData?.test_url,
    steps: capturedSteps,
    errorMessage: stderr || (!passed ? runEndData?.summary : undefined),
    rawEvents,
  };
}

