import { KaneRunResult, FailureCategory } from '../types.js';

export interface Classification {
  type: FailureCategory;
  message: string;
  report?: string;
  verdictOneLiner?: string;
}

export function classifyKaneRun(result: KaneRunResult): Classification {
  if (result.category === 'pass' || result.passed) {
    return {
      type: 'pass',
      message: 'Objective passed successfully and verified by Kane CLI.',
    };
  }

  if (result.category === 'confirmed_product_bug') {
    const report = `
================================================================================
🚨 AUTOCAST AI STOP-ON-BUG: DEMOS CAN'T LIE
================================================================================
Kane CLI detected a CONFIRMED PRODUCT BUG in the application under test.
• Result Code: ${result.resultCode} (${result.reasonCode})
• Verdict: ${result.verdict?.oneLiner || result.summary}
• Severity: ${result.verdict?.severity || 'high'} (Confidence: ${result.verdict?.confidence ?? 1.0})
• Failing Step: ${result.steps.length > 0 ? result.steps[result.steps.length - 1].summary : 'Unknown step'}
• Test URL: ${result.testUrl || 'Check local evidence pack'}
• Session Directory: ${result.sessionDir || 'N/A'}

As per Autocast AI safety policy, NO VIDEO HAS BEEN RENDERED.
================================================================================
`;
    return {
      type: 'confirmed_product_bug',
      message: result.verdict?.oneLiner || result.summary || 'Confirmed product bug detected.',
      report,
      verdictOneLiner: result.verdict?.oneLiner,
    };
  }

  if (result.category === 'cli_configuration_error') {
    return {
      type: 'cli_configuration_error',
      message: `Kane CLI configuration error: ${result.errorMessage || result.summary}`,
    };
  }

  if (result.category === 'timeout') {
    return {
      type: 'timeout',
      message: `Kane run timed out: ${result.summary}`,
    };
  }

  if (result.category === 'cancelled') {
    return {
      type: 'cancelled',
      message: 'Kane run cancelled by user or signal.',
    };
  }

  return {
    type: 'unconfirmed_failure',
    message: result.summary || result.errorMessage || 'Kane could not complete objective (unconfirmed failure).',
  };
}
