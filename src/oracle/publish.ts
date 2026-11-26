import crypto from 'crypto';
import { OracleVerdict, RunManifest } from '../types.js';
import { computeFileSha256 } from '../manifest.js';

export type PublishAdapterName = 'stdout-json' | 'webhook' | 'evm';

export interface VerdictPayload {
  spec_sha256: string;
  tested_commit: string;
  manifest_sha256: string;
  verdict: OracleVerdict;
  hold_reason?: string;
  signature: NonNullable<RunManifest['signature']>;
  run_id?: string;
  milestone_id?: string;
}

export interface PublishResult {
  adapter: PublishAdapterName;
  published: boolean;
  details?: string;
}

export interface VerdictPublisher {
  readonly name: PublishAdapterName;
  publish(payload: VerdictPayload): Promise<PublishResult>;
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export function buildVerdictPayload(
  manifest: RunManifest,
  manifestPath: string,
  milestoneId?: string
): VerdictPayload {
  if (!manifest.oracle) {
    throw new Error('Cannot publish verdict: manifest missing oracle metadata');
  }
  if (!manifest.signature) {
    throw new Error('Cannot publish verdict: manifest missing cryptographic signature');
  }

  return {
    spec_sha256: manifest.oracle.spec_sha256,
    tested_commit: manifest.application.tested_commit || 'unknown',
    manifest_sha256: computeFileSha256(manifestPath),
    verdict: manifest.oracle.verdict,
    ...(manifest.oracle.hold_reason ? { hold_reason: manifest.oracle.hold_reason } : {}),
    signature: manifest.signature,
    ...(manifest.run_id ? { run_id: manifest.run_id } : {}),
    ...(milestoneId ? { milestone_id: milestoneId } : {}),
  };
}

export class StdoutJsonVerdictPublisher implements VerdictPublisher {
  readonly name = 'stdout-json' as const;
  private writeFn: (chunk: string) => void;

  constructor(writeFn: (chunk: string) => void = (chunk) => process.stdout.write(chunk)) {
    this.writeFn = writeFn;
  }

  async publish(payload: VerdictPayload): Promise<PublishResult> {
    this.writeFn(`${JSON.stringify(payload)}\n`);
    return {
      adapter: this.name,
      published: true,
      details: 'Wrote canonical verdict JSON to stdout',
    };
  }
}

export class WebhookVerdictPublisher implements VerdictPublisher {
  readonly name = 'webhook' as const;
  private url: string;
  private secret: string;
  private fetchFn: typeof fetch;

  constructor(options?: { url?: string; secret?: string; fetchFn?: typeof fetch }) {
    this.url = (options?.url ?? process.env.ORACLE_WEBHOOK_URL ?? '').trim();
    this.secret = options?.secret ?? process.env.ORACLE_WEBHOOK_SECRET ?? '';
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  async publish(payload: VerdictPayload): Promise<PublishResult> {
    if (!this.url) {
      throw new Error('ORACLE_WEBHOOK_URL is required for webhook verdict publishing');
    }
    let parsed: URL;
    try {
      parsed = new URL(this.url);
    } catch {
      throw new Error(`Invalid ORACLE_WEBHOOK_URL: '${this.url}'`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported webhook URL protocol: '${parsed.protocol}'`);
    }
    if (!this.secret) {
      throw new Error('ORACLE_WEBHOOK_SECRET is required to sign webhook verdict deliveries');
    }

    const body = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    const hmac = crypto
      .createHmac('sha256', this.secret)
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('hex');

    const res = await this.fetchFn(parsed.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Autocast-Signature': `sha256=${hmac}`,
        'X-Autocast-Timestamp': timestamp,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Webhook endpoint returned HTTP ${res.status}`);
    }

    return {
      adapter: this.name,
      published: true,
      details: `POST ${parsed.origin}${parsed.pathname} -> HTTP ${res.status}`,
    };
  }
}

export interface WebhookVerifyOptions {
  payloadBody: string;
  signatureHeader: string;
  timestampHeader: string;
  secret: string;
  seenManifestSha256s?: Set<string>;
  maxSkewSeconds?: number;
  nowMs?: number;
}

export interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
  payload?: VerdictPayload;
}

/**
 * Verifies an incoming Autocast Oracle webhook delivery:
 * 1. Rejects missing or expired X-Autocast-Timestamp headers outside maxSkewSeconds (default 300s).
 * 2. Validates X-Autocast-Signature (`sha256=<hex>`) over `${timestamp}.${body}` in constant time.
 * 3. Deduplicates deliveries by `payload.manifest_sha256` against caller-supplied seenManifestSha256s.
 */
export function verifyWebhookSignature(options: WebhookVerifyOptions): WebhookVerifyResult {
  const maxSkewSec = options.maxSkewSeconds ?? 300;
  const nowMs = options.nowMs ?? Date.now();

  if (!options.secret) {
    return { valid: false, error: 'Missing webhook secret' };
  }
  if (!options.timestampHeader || !options.signatureHeader) {
    return { valid: false, error: 'Missing X-Autocast-Timestamp or X-Autocast-Signature header' };
  }

  const parsedMs = Date.parse(options.timestampHeader);
  if (!Number.isFinite(parsedMs)) {
    return { valid: false, error: 'Invalid X-Autocast-Timestamp format' };
  }
  const skewSec = Math.abs(nowMs - parsedMs) / 1000;
  if (skewSec > maxSkewSec) {
    return {
      valid: false,
      error: `Webhook timestamp outside allowed ${maxSkewSec}s replay window (${Math.round(skewSec)}s skew)`,
    };
  }

  const sigMatch = /^sha256=([a-fA-F0-9]{64})$/.exec(options.signatureHeader.trim());
  if (!sigMatch) {
    return { valid: false, error: 'Malformed X-Autocast-Signature header (expected sha256=<64-hex>)' };
  }

  const expectedHex = crypto
    .createHmac('sha256', options.secret)
    .update(`${options.timestampHeader}.${options.payloadBody}`, 'utf8')
    .digest('hex');

  const receivedBuf = Buffer.from(sigMatch[1].toLowerCase(), 'utf8');
  const expectedBuf = Buffer.from(expectedHex.toLowerCase(), 'utf8');
  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return { valid: false, error: 'Webhook HMAC signature mismatch' };
  }

  let payload: VerdictPayload;
  try {
    payload = JSON.parse(options.payloadBody) as VerdictPayload;
  } catch {
    return { valid: false, error: 'Webhook body is not valid JSON' };
  }

  if (!payload.manifest_sha256) {
    return { valid: false, error: 'Webhook payload missing manifest_sha256' };
  }

  const dedupeKey = payload.manifest_sha256.toLowerCase();
  if (options.seenManifestSha256s) {
    if (options.seenManifestSha256s.has(dedupeKey)) {
      return { valid: false, error: `Duplicate manifest_sha256 replay detected (${dedupeKey})` };
    }
    options.seenManifestSha256s.add(dedupeKey);
  }

  return { valid: true, payload };
}

export class EvmVerdictPublisher implements VerdictPublisher {
  readonly name = 'evm' as const;

  async publish(_payload: VerdictPayload): Promise<PublishResult> {
    throw new NotImplementedError(
      'EVM verdict publisher is an interface stub; no chain dependencies are bundled in this release.'
    );
  }
}

export function createVerdictPublisher(
  adapter: PublishAdapterName = 'stdout-json',
  options?: {
    webhookUrl?: string;
    webhookSecret?: string;
    stdoutWriter?: (chunk: string) => void;
    fetchFn?: typeof fetch;
  }
): VerdictPublisher {
  if (adapter === 'stdout-json') {
    return new StdoutJsonVerdictPublisher(options?.stdoutWriter);
  }
  if (adapter === 'webhook') {
    return new WebhookVerdictPublisher({
      url: options?.webhookUrl,
      secret: options?.webhookSecret,
      fetchFn: options?.fetchFn,
    });
  }
  if (adapter === 'evm') {
    return new EvmVerdictPublisher();
  }
  throw new Error(`Unsupported verdict publish adapter: '${adapter}'`);
}

export async function publishVerdict(
  payload: VerdictPayload,
  options?: {
    adapter?: PublishAdapterName;
    webhookUrl?: string;
    webhookSecret?: string;
    stdoutWriter?: (chunk: string) => void;
    fetchFn?: typeof fetch;
  }
): Promise<PublishResult> {
  const publisher = createVerdictPublisher(options?.adapter || 'stdout-json', options);
  return publisher.publish(payload);
}
