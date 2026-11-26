import { Storyboard, Scene } from '../types.js';

export interface RedactionResult {
  text: string;
  redactedCount: number;
  detectedTypes: string[];
}

export interface RedactionRule {
  name: string;
  regex: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
}

export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // 1. OpenAI / Generic API Keys (sk-..., sk_live_..., sk_test_...)
  {
    name: 'api_key_sk',
    regex: /\b(sk_(?:live|test)_[a-zA-Z0-9]{16,}|sk-[a-zA-Z0-9]{20,})\b/g,
    replacement: '[REDACTED_API_KEY]',
  },
  // 2. Google Gemini / Cloud API Key (AIzaSy...)
  {
    name: 'google_api_key',
    regex: /\bAIzaSy[a-zA-Z0-9_-]{33}\b/g,
    replacement: '[REDACTED_GEMINI_KEY]',
  },
  // 3. GitHub Tokens (ghp_..., gho_..., github_pat_...)
  {
    name: 'github_token',
    regex: /\b(?:ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/g,
    replacement: '[REDACTED_GH_TOKEN]',
  },
  // 4. AWS Access Key ID
  {
    name: 'aws_access_key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  // 5. Authorization Bearer header tokens
  {
    name: 'bearer_token',
    regex: /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}\b/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  // 6. JSON Web Tokens (JWT)
  {
    name: 'jwt_token',
    regex: /\beyJ[a-zA-Z0-9_\-]{8,}\.eyJ[a-zA-Z0-9_\-]{8,}\.[a-zA-Z0-9_\-]{8,}\b/g,
    replacement: '[REDACTED_JWT]',
  },
  // 7. Private Keys (RSA/EC/OpenSSH) & Oracle env secret assignments
  {
    name: 'private_key',
    regex: /-----BEGIN (?:[A-Z ]+)PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+)PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    name: 'oracle_secret_assignment',
    regex: /\b(?:ORACLE_SIGNING_KEY|ORACLE_WEBHOOK_SECRET)\s*=\s*[^\s"']+/gi,
    replacement: '[REDACTED_ORACLE_SECRET]',
  },
  // 8. Private RFC1918 IP addresses (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  {
    name: 'private_ip',
    regex: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
    replacement: '[INTERNAL_IP]',
  },
  // 9. Internal hostnames (*.internal, *.corp, *.local, *.lan)
  {
    name: 'internal_host',
    regex: /\b[a-zA-Z0-9\-_]+(?:\.[a-zA-Z0-9\-_]+)*\.(?:internal|corp|local|lan|intra)\b/gi,
    replacement: '[internal-host]',
  },
  // 10. Live user emails (preserve demo placeholder domains)
  {
    name: 'customer_email',
    regex: /\b[a-zA-Z0-9._%+-]+@(?!example\.com|test\.com|acme\.inc|demo\.corp)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
    replacement: 'demo.user@example.com',
  },
];

/**
 * Redact sensitive secrets from any arbitrary text string.
 */
export function redactSecrets(
  text: string,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES
): RedactionResult {
  if (!text) {
    return { text: '', redactedCount: 0, detectedTypes: [] };
  }

  let sanitized = text;
  let redactedCount = 0;
  const detectedTypes: string[] = [];

  for (const rule of rules) {
    const matches = sanitized.match(rule.regex);
    if (matches && matches.length > 0) {
      redactedCount += matches.length;
      if (!detectedTypes.includes(rule.name)) {
        detectedTypes.push(rule.name);
      }
      sanitized = sanitized.replace(rule.regex, rule.replacement as any);
    }
  }

  return {
    text: sanitized,
    redactedCount,
    detectedTypes,
  };
}

/**
 * Recursively deep sanitize a storyboard object before rendering or saving.
 */
export function redactStoryboard(storyboard: Storyboard): {
  storyboard: Storyboard;
  redactedCount: number;
  detectedTypes: string[];
} {
  let totalRedacted = 0;
  const allDetected = new Set<string>();

  // Sanitize title
  const titleRes = redactSecrets(storyboard.meta.title);
  if (titleRes.redactedCount > 0) {
    totalRedacted += titleRes.redactedCount;
    titleRes.detectedTypes.forEach((t) => allDetected.add(t));
  }

  const sanitizedScenes: Scene[] = storyboard.scenes.map((scene) => {
    const capRes = redactSecrets(scene.caption);
    const narRes = redactSecrets(scene.narration);

    if (capRes.redactedCount > 0) {
      totalRedacted += capRes.redactedCount;
      capRes.detectedTypes.forEach((t) => allDetected.add(t));
    }
    if (narRes.redactedCount > 0) {
      totalRedacted += narRes.redactedCount;
      narRes.detectedTypes.forEach((t) => allDetected.add(t));
    }

    return {
      ...scene,
      caption: capRes.text,
      narration: narRes.text,
    };
  });

  const sanitizedStoryboard: Storyboard = {
    ...storyboard,
    meta: {
      ...storyboard.meta,
      title: titleRes.text,
    },
    scenes: sanitizedScenes,
  };

  if (totalRedacted > 0) {
    console.log(
      `[Redaction Pass] 🛡️ Scrubbed ${totalRedacted} sensitive secret(s) (${Array.from(allDetected).join(', ')}) from storyboard.`
    );
  }

  return {
    storyboard: sanitizedStoryboard,
    redactedCount: totalRedacted,
    detectedTypes: Array.from(allDetected),
  };
}

