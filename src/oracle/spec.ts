import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { AcceptanceSpec } from '../types.js';
import { canonicalizeJson } from './canonicalJson.js';

export class OracleSpecError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'OracleSpecError';
  }
}

const DomTextVerificationSchema = z
  .object({
    type: z.literal('dom_text'),
    selector: z.string().min(1),
    expected: z.string(),
  })
  .strict();

const VisibleVerificationSchema = z
  .object({
    type: z.literal('visible'),
    selector: z.string().min(1),
  })
  .strict();

const UrlVerificationSchema = z
  .object({
    type: z.literal('url'),
    expected: z.string().min(1),
  })
  .strict();

const ApiStateVerificationSchema = z
  .object({
    type: z.literal('api_state'),
    endpoint: z.string().min(1),
    jsonPath: z.string().min(1),
    expected: z.unknown().refine((val) => val !== undefined, {
      message: 'api_state expected value must be defined',
    }),
  })
  .strict();

export const OutcomeSpecSchema = z
  .object({
    id: z.string().min(1),
    verification: z.discriminatedUnion('type', [
      DomTextVerificationSchema,
      VisibleVerificationSchema,
      UrlVerificationSchema,
      ApiStateVerificationSchema,
    ]),
  })
  .strict();

export const AcceptanceSpecSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    outcome_specs: z.array(OutcomeSpecSchema).min(1),
    target: z
      .object({
        url: z
          .string()
          .trim()
          .refine((raw) => {
            try {
              const parsed = new URL(raw);
              return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            } catch {
              return false;
            }
          }, 'target.url must be a valid http or https URL'),
        seed_id: z.string().trim().min(1),
      })
      .strict(),
    parties: z
      .object({
        client: z.string().trim().min(1),
        contractor: z.string().trim().min(1),
      })
      .strict()
      .optional(),
    contract_id: z.string().trim().min(1),
    escrow_address: z.string().trim().min(1).optional(),
    milestone_id: z.string().trim().min(1),
  })
  .strict();

export interface LoadedAcceptanceSpec {
  spec: AcceptanceSpec;
  canonicalJson: string;
  specSha256: string;
}

export function computeSpecSha256(spec: AcceptanceSpec): { canonicalJson: string; specSha256: string } {
  const canonical = canonicalizeJson(spec);
  const specSha256 = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return { canonicalJson: canonical, specSha256 };
}

export function parseAcceptanceSpec(rawContent: string, sourceLabel = '<spec>'): LoadedAcceptanceSpec {
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawContent);
  } catch (err: any) {
    throw new OracleSpecError(`Invalid JSON in acceptance spec ${sourceLabel}: ${err.message}`);
  }

  const parsed = AcceptanceSpecSchema.safeParse(rawJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`)
      .join('; ');
    throw new OracleSpecError(`Acceptance spec validation failed (${sourceLabel}): ${details}`);
  }

  const spec = parsed.data as AcceptanceSpec;
  const { canonicalJson, specSha256 } = computeSpecSha256(spec);
  return { spec, canonicalJson, specSha256 };
}

export function loadAcceptanceSpec(specPath: string): LoadedAcceptanceSpec {
  if (!specPath || !fs.existsSync(specPath)) {
    throw new OracleSpecError(`Acceptance spec file not found: ${specPath}`);
  }
  const content = fs.readFileSync(specPath, 'utf-8');
  return parseAcceptanceSpec(content, specPath);
}

export function normalizeSha256Hex(value: string, label = 'sha256'): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new OracleSpecError(`Invalid ${label}: expected 64-character hex SHA-256 digest`);
  }
  return normalized;
}

export function validateCommitSha40(value: string | undefined, label = '--commit'): string {
  const normalized = (value || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(normalized)) {
    throw new OracleSpecError(
      `Invalid ${label}: expected a full 40-character hexadecimal git commit SHA`
    );
  }
  return normalized;
}
