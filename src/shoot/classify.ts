import { KaneRunResult } from '../types.js';

export interface Classification {
  type: 'pass' | 'product_defect' | 'bad_objective';
  message: string;
  report?: string;
}

export function classifyKaneRun(result: KaneRunResult): Classification {
  if (result.passed) {
    return {
      type: 'pass',
      message: 'Objective passed successfully and verified by Kane CLI.',
    };
  }

  // Check for product defect:
  // - Result code indicates assertion failed, or Kane observed unexpected UI error
  // - Or errorMessage indicates assertion or verification failure
  const isAssertionFailure =
    result.isProductDefect ||
    (result.errorMessage && result.errorMessage.toLowerCase().includes('assert')) ||
    (result.reasonCode && result.reasonCode.toLowerCase().includes('assert')) ||
    (result.summary && result.summary.toLowerCase().includes('failed'));

  if (isAssertionFailure) {
    const report = `
================================================================================
🚨 AUTOCAST AI STOP-ON-BUG: DEMOS CAN'T LIE
================================================================================
Kane CLI detected a defect in the application under test.
As per Autocast AI safety policy, NO VIDEO HAS BEEN RENDERED.

• Result Code: ${result.resultCode} (${result.reasonCode})
• Summary: ${result.summary || 'Assertion condition was not met'}
• Test URL: ${result.testUrl || 'Check local evidence pack'}
• Session Directory: ${result.sessionDir || 'N/A'}
• Failing Step: ${result.steps.length > 0 ? result.steps[result.steps.length - 1].summary : 'Unknown step'}

Please resolve the application bug before generating this product demo.
================================================================================
`;
    return {
      type: 'product_defect',
      message: 'Product defect detected. Halting pipeline without rendering.',
      report,
    };
  }

  return {
    type: 'bad_objective',
    message: result.errorMessage || 'Kane could not find an element or navigate according to objective.',
  };
}

