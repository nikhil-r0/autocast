/**
 * Environment scrubbing utilities for untrusted deliverable code and subprocesses.
 * Ensures oracle signing keys, webhook secrets, and API credentials never leak into
 * contractor build scripts, deliverable servers, or browser test subprocesses.
 */

const SAFE_CHILD_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'TMPDIR',
  'TMP',
  'TEMP',
  'NODE_ENV',
  'PORT',
  'APP_COMMIT',
  'APP_BUG',
  'TARGET_APP_URL',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'DBUS_SESSION_BUS_ADDRESS',
  'XDG_RUNTIME_DIR',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'PLAYWRIGHT_BROWSERS_PATH',
  'CI',
  'NO_COLOR',
  'FORCE_COLOR',
  'PWD',
]);

const SENSITIVE_KEY_PATTERN =
  /(?:^ORACLE_|_SIGNING_KEY$|_SECRET$|_PRIVATE_KEY$|_API_KEY$|_TOKEN$|_PASSWORD$|_CREDENTIAL)/i;

/**
 * Produces a strictly allowlisted child environment for untrusted deliverable builds
 * and app server execution.
 */
export function scrubChildEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  const clean: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (SAFE_CHILD_ENV_KEYS.has(key) || key.startsWith('npm_config_')) {
      clean[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && !SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Strips Oracle signing, webhook, and trust secrets from environments passed to
 * browser runners like kane-cli while preserving Kane's own CLI auth context.
 */
export function stripOracleSecrets(
  sourceEnv: NodeJS.ProcessEnv = process.env
): Record<string, string | undefined> {
  const clean: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (
      key === 'ORACLE_SIGNING_KEY' ||
      key === 'ORACLE_WEBHOOK_SECRET' ||
      key === 'ORACLE_TRUSTED_KEYS' ||
      /^(?:GEMINI|ANTHROPIC|OPENAI|ELEVENLABS)_API_KEY$/i.test(key)
    ) {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}
