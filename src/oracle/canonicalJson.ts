/**
 * Produces deterministic canonical JSON with lexicographically sorted object keys
 * and zero whitespace. Used for both AcceptanceSpec SHA-256 hashing and Ed25519
 * manifest signing/verification so in-memory objects match disk-parsed JSON.
 */
function normalizeForCanonicalJson(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (typeof value === 'object') {
    const maybeToJson = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof maybeToJson === 'function') {
      return normalizeForCanonicalJson(maybeToJson.call(value));
    }

    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = normalizeForCanonicalJson(item);
        return normalized === undefined ? null : normalized;
      });
    }

    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const key of keys) {
      const normalized = normalizeForCanonicalJson(record[key]);
      if (normalized !== undefined) {
        sorted[key] = normalized;
      }
    }
    return sorted;
  }

  return undefined;
}

export function canonicalizeJson(value: unknown): string {
  const normalized = normalizeForCanonicalJson(value);
  if (normalized === undefined) {
    return 'null';
  }
  return JSON.stringify(normalized);
}
