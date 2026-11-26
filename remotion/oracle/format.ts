export function shortHash(value: string, head = 8, tail = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 1) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

export const ORACLE_BEAT_FRAMES = [420, 540, 540, 135, 420, 180] as const;

export const ORACLE_GATE_LABELS = [
  'Oracle mode',
  'Verdict is release',
  'Kane passed',
  'Backend state changed',
  'No repair ran',
  'Commit matches',
  'Spec hash matches',
  'Signature valid',
  'Runner pinned',
  'Container isolated (Tier B)',
] as const;
