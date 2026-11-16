import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';
import { OutcomeSpec } from '../types.js';

export interface ReplayAction {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'scroll' | 'hover';
  selector?: string;
  value?: string;
  targetRect?: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; deviceScaleFactor: number };
  waitAfterMs: number;
  sourceStep: number;
}

export interface ActionIR {
  startUrl: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  actions: ReplayAction[];
  outcomeSpecs: OutcomeSpec[];
}

const SUPPORTED_ACTION_TYPES = new Set(['navigate', 'click', 'fill', 'scroll', 'hover']);
const IGNORED_ACTION_TYPES = new Set(['assert', 'analyze']);

export function parseActionsLogToActionIR(actionsNdjsonContent: string, options?: { fallbackUrl?: string }): ActionIR {
  const lines = actionsNdjsonContent.split('\n').filter((l) => l.trim().length > 0);
  const actions: ReplayAction[] = [];
  const outcomeSpecs: OutcomeSpec[] = [];
  let startUrl = options?.fallbackUrl || 'http://localhost:8080/?logged_in=true';
  let defaultViewport = { width: 1920, height: 1080, deviceScaleFactor: 1 };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }

    const actionType: string = (event.action_type || '').toLowerCase();

    // Verification specs
    if (actionType === 'assert' || actionType === 'analyze') {
      const condition = event.action_params?.condition || event.intent || event.action_instruction || '';
      if (condition.includes('Approved seal') || condition.includes('seal')) {
        outcomeSpecs.push({
          id: `outcome-${idx}`,
          verification: {
            type: 'visible',
            selector: '[data-testid="approved-seal"]',
          },
        });
      } else if (event.selectors?.[0]?.selector) {
        outcomeSpecs.push({
          id: `outcome-${idx}`,
          verification: {
            type: 'visible',
            selector: event.selectors[0].selector,
          },
        });
      }
      continue;
    }

    // Explicit rejection of unsupported action types (TEST-10)
    if (!SUPPORTED_ACTION_TYPES.has(actionType)) {
      throw new Error(`Unsupported action type in Action IR: '${actionType}' (action_id: ${event.action_id || idx})`);
    }

    if (actionType === 'navigate') {
      const url = event.action_params?.url || event.target_url;
      if (url) {
        startUrl = url;
      }
    }

    const bbox = event.visual_data?.bbox;
    const targetRect = bbox
      ? {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        }
      : undefined;

    const viewport = {
      width: event.visual_data?.viewport_width || 1920,
      height: event.visual_data?.viewport_height || 1080,
      deviceScaleFactor: 1,
    };
    defaultViewport = viewport;

    actions.push({
      id: event.action_id || `action-${idx}`,
      type: actionType as ReplayAction['type'],
      selector: event.selectors?.[0]?.selector,
      value: event.action_params?.value || event.action_params?.text,
      targetRect,
      viewport,
      waitAfterMs: actionType === 'navigate' ? 2500 : 1200,
      sourceStep: event.step || idx + 1,
    });
  }

  // Default outcome spec for Ledgerly if none extracted
  if (outcomeSpecs.length === 0) {
    outcomeSpecs.push({
      id: 'default-outcome-seal',
      verification: {
        type: 'visible',
        selector: '[data-testid="approved-seal"]',
      },
    });
    outcomeSpecs.push({
      id: 'default-outcome-api',
      verification: {
        type: 'api_state',
        endpoint: '/api/invoices/INV-1042',
        jsonPath: 'status',
        expected: 'Approved',
      },
    });
  }

  return {
    startUrl,
    viewport: defaultViewport,
    actions,
    outcomeSpecs,
  };
}

export function findActionsLog(dir: string): string | null {
  const findRecursive = (current: string): string | null => {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isFile() && (entry.name === '0-actions.ndjson' || entry.name.endsWith('-actions.ndjson') || entry.name === 'actions.ndjson')) {
          return full;
        }
        if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.git')) {
          const found = findRecursive(full);
          if (found) return found;
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  return findRecursive(dir);
}

export async function verifyOutcomeSpecs(
  page: Page,
  specs: OutcomeSpec[],
  apiBase: string = 'http://localhost:8080'
): Promise<{ passed: boolean; failures: string[] }> {
  const failures: string[] = [];

  for (const spec of specs) {
    try {
      if (spec.verification.type === 'visible') {
        const loc = page.locator(spec.verification.selector);
        const visible = await loc.isVisible({ timeout: 5000 }).catch(() => false);
        if (!visible) {
          failures.push(`OutcomeSpec '${spec.id}' failed: selector '${spec.verification.selector}' not visible`);
        }
      } else if (spec.verification.type === 'dom_text') {
        const loc = page.locator(spec.verification.selector);
        const text = await loc.innerText({ timeout: 5000 }).catch(() => null);
        if (text === null || !text.includes(spec.verification.expected)) {
          failures.push(
            `OutcomeSpec '${spec.id}' failed: selector '${spec.verification.selector}' expected text '${spec.verification.expected}', got '${text}'`
          );
        }
      } else if (spec.verification.type === 'url') {
        const currentUrl = page.url();
        if (!currentUrl.includes(spec.verification.expected)) {
          failures.push(`OutcomeSpec '${spec.id}' failed: expected url '${spec.verification.expected}', got '${currentUrl}'`);
        }
      } else if (spec.verification.type === 'api_state') {
        const url = `${apiBase.replace(/\/+$/, '')}${spec.verification.endpoint}`;
        const res = await fetch(url);
        if (!res.ok) {
          failures.push(`OutcomeSpec '${spec.id}' failed: API ${url} returned HTTP ${res.status}`);
          continue;
        }
        const data: any = await res.json();
        const actualValue = data[spec.verification.jsonPath];
        if (actualValue !== spec.verification.expected) {
          failures.push(
            `OutcomeSpec '${spec.id}' failed: API ${url} field '${spec.verification.jsonPath}' expected '${spec.verification.expected}', got '${actualValue}'`
          );
        }
      }
    } catch (err: any) {
      failures.push(`OutcomeSpec '${spec.id}' encountered error: ${err.message}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

