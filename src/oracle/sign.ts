import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RunManifest } from '../types.js';
import { canonicalizeJson } from './canonicalJson.js';

export class OracleSigningConfigError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'OracleSigningConfigError';
  }
}

export type TrustedKeyMap = Record<string, string>;

export function computePublicKeyId(publicKey: crypto.KeyObject): string {
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(spkiDer).digest('hex');
}

function readPemOrFile(rawInput: string, kind: 'private' | 'public'): string {
  const trimmed = rawInput.trim();
  if (trimmed.includes('-----BEGIN ')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  const resolved = path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(resolved)) {
    throw new OracleSigningConfigError(
      `Oracle ${kind} key file does not exist at configured path.`
    );
  }
  return fs.readFileSync(resolved, 'utf-8');
}

export function loadOracleSigningKey(keyInput?: string): {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicKeyPem: string;
  keyId: string;
} {
  const raw = keyInput ?? process.env.ORACLE_SIGNING_KEY;
  if (!raw || !raw.trim()) {
    throw new OracleSigningConfigError(
      'ORACLE_SIGNING_KEY is required in oracle mode. Provide an Ed25519 PEM string or file path.'
    );
  }

  let privateKey: crypto.KeyObject;
  try {
    const pem = readPemOrFile(raw, 'private');
    privateKey = crypto.createPrivateKey(pem);
  } catch (err: any) {
    if (err instanceof OracleSigningConfigError) throw err;
    throw new OracleSigningConfigError('Failed to parse ORACLE_SIGNING_KEY as a valid Ed25519 private key.');
  }

  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new OracleSigningConfigError(
      `ORACLE_SIGNING_KEY must be an ed25519 key (got '${privateKey.asymmetricKeyType || 'unknown'}').`
    );
  }

  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const keyId = computePublicKeyId(publicKey);

  return { privateKey, publicKey, publicKeyPem, keyId };
}

export function stripManifestSignature(manifest: RunManifest): Omit<RunManifest, 'signature'> {
  const { signature: _ignored, ...unsigned } = manifest;
  return unsigned;
}

export function signOracleManifest(
  manifest: Omit<RunManifest, 'signature'> | RunManifest,
  signingKeyInput?: string
): RunManifest {
  const { privateKey, keyId } = loadOracleSigningKey(signingKeyInput);
  const unsigned = stripManifestSignature(manifest as RunManifest);
  const canonical = canonicalizeJson(unsigned);
  const sig = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');

  return {
    ...unsigned,
    signature: {
      alg: 'ed25519',
      key_id: keyId,
      sig,
    },
  };
}

function registerPublicKey(map: TrustedKeyMap, pem: string, expectedKeyId?: string): void {
  const normalizedPem = pem.replace(/\\n/g, '\n').trim();
  const keyObj = crypto.createPublicKey(normalizedPem);
  if (keyObj.asymmetricKeyType !== 'ed25519') {
    throw new OracleSigningConfigError(
      `Trusted key must be ed25519 (got '${keyObj.asymmetricKeyType || 'unknown'}').`
    );
  }
  const derivedKeyId = computePublicKeyId(keyObj);
  if (expectedKeyId && expectedKeyId.toLowerCase() !== derivedKeyId) {
    throw new OracleSigningConfigError(
      `Trusted key key_id mismatch: declared '${expectedKeyId}' does not match SHA-256 '${derivedKeyId}'.`
    );
  }
  map[derivedKeyId] = keyObj.export({ type: 'spki', format: 'pem' }).toString();
}

export function loadTrustedKeys(source?: string | TrustedKeyMap): TrustedKeyMap {
  if (source && typeof source === 'object') {
    const map: TrustedKeyMap = {};
    for (const [k, pem] of Object.entries(source)) {
      registerPublicKey(map, pem, k);
    }
    return map;
  }

  const rawSource = source ?? process.env.ORACLE_TRUSTED_KEYS;
  if (!rawSource || !rawSource.trim()) {
    throw new OracleSigningConfigError(
      'No trusted runner public keys configured. Set ORACLE_TRUSTED_KEYS or pass --trusted-keys.'
    );
  }

  const trimmed = rawSource.trim();
  let content = trimmed;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.includes('-----BEGIN ')) {
    const resolved = path.resolve(process.cwd(), trimmed);
    if (!fs.existsSync(resolved)) {
      throw new OracleSigningConfigError(`Trusted keys file not found: ${resolved}`);
    }
    content = fs.readFileSync(resolved, 'utf-8');
  }

  const map: TrustedKeyMap = {};

  if (content.trim().includes('-----BEGIN PUBLIC KEY-----')) {
    const blocks = content.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/g) || [];
    if (blocks.length === 0) {
      throw new OracleSigningConfigError('No valid PEM public key blocks found in trusted keys.');
    }
    for (const block of blocks) {
      registerPublicKey(map, block);
    }
    return map;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    throw new OracleSigningConfigError(`Trusted keys JSON parse error: ${err.message}`);
  }

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object' || typeof (entry as any).public_key !== 'string') {
        throw new OracleSigningConfigError('Trusted keys array entries must contain public_key PEM.');
      }
      registerPublicKey(map, (entry as any).public_key, (entry as any).key_id);
    }
    return map;
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const record =
      obj.keys && typeof obj.keys === 'object' && !Array.isArray(obj.keys)
        ? (obj.keys as Record<string, unknown>)
        : obj;
    for (const [keyId, pem] of Object.entries(record)) {
      if (typeof pem !== 'string') {
        throw new OracleSigningConfigError(`Trusted key '${keyId}' must map to a PEM public key string.`);
      }
      registerPublicKey(map, pem, keyId);
    }
    return map;
  }

  throw new OracleSigningConfigError('Unsupported ORACLE_TRUSTED_KEYS format.');
}

export function verifyManifestSignature(
  manifest: RunManifest,
  trustedKeys: TrustedKeyMap
): { valid: boolean; error?: string } {
  const sigObj = manifest.signature;
  if (!sigObj) {
    return { valid: false, error: 'Manifest missing required cryptographic signature' };
  }
  if (sigObj.alg !== 'ed25519') {
    return { valid: false, error: `Unsupported signature algorithm: '${sigObj.alg}'` };
  }
  if (!sigObj.key_id || !sigObj.sig) {
    return { valid: false, error: 'Manifest signature missing key_id or sig' };
  }

  const normalizedKeyId = sigObj.key_id.toLowerCase();
  const trustedPem = trustedKeys[normalizedKeyId];
  if (!trustedPem) {
    return { valid: false, error: `Untrusted or unknown signature key_id: '${sigObj.key_id}'` };
  }

  try {
    const publicKey = crypto.createPublicKey(trustedPem);
    const unsigned = stripManifestSignature(manifest);
    const canonical = canonicalizeJson(unsigned);
    const sigBuf = Buffer.from(sigObj.sig, 'base64');
    const ok = crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, sigBuf);
    if (!ok) {
      return { valid: false, error: 'Manifest Ed25519 signature verification failed (tampered payload or wrong key)' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Signature verification error: ${err.message}` };
  }
}
