import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { verifyOracleHoldManifest, verifyOracleManifest } from '../src/manifest.js';
import { loadAcceptanceSpec } from '../src/oracle/spec.js';
import type { TrustedKeyMap } from '../src/oracle/sign.js';
import type { RunManifest } from '../src/types.js';
import { ORACLE_BEAT_FRAMES, ORACLE_GATE_LABELS, ORACLE_TRANSITION_FRAMES } from '../remotion/oracle/format.js';

const SECRET_LINE = /oracle-keys|BEGIN |PRIVATE KEY|ORACLE_SIGNING_KEY|ORACLE_WEBHOOK_SECRET|ORACLE_TRUSTED_KEYS/i;
const DIVIDER_LINE = /^[=\-_*]{4,}$/;
const SIGNAL_LINE = /^(Spec:|Pinned Commit:|Kane Pin:|Manifest:|Expected |✓|⚠|❌|🚨|🎉|\[Shoot Loop\]|\[Path B Replay\] .*verified|\[Pixel Safety OCR\] ✓|\[Provenance\]|ORACLE VERDICT:|RELEASE MANIFEST|ORACLE PAYMENT|Gate \d+:|Trusted code)/i;

export interface FinalizeOracleDropArgs {
  specPath: string;
  holdManifest: string;
  releaseManifest: string;
  holdLog?: string;
  releaseLog?: string;
  verifyLog?: string;
  sourceVideo?: string;
  sourceTrimBefore?: number;
  sourcePlaybackRate?: number;
  trustedKeys?: string;
  trustedKeyMap?: TrustedKeyMap;
  outPath: string;
  audioDir: string;
}

function parseOptionalNumber(raw: string | undefined, fallback: number, name: string, allowZero = false): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new Error(`Invalid --${name} value: "${raw}"`);
  }
  return parsed;
}

function parseArgs(argv: string[]): FinalizeOracleDropArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      values.set(arg.slice(2), argv[++i]);
    }
  }
  const required = (key: string) => {
    const value = values.get(key);
    if (!value) throw new Error(`Missing --${key}`);
    return value;
  };
  return {
    specPath: required('spec'),
    holdManifest: required('hold-manifest'),
    releaseManifest: required('release-manifest'),
    holdLog: values.get('hold-log'),
    releaseLog: values.get('release-log'),
    verifyLog: values.get('verify-log'),
    sourceVideo: values.get('source-video'),
    sourceTrimBefore: Math.round(parseOptionalNumber(values.get('source-trim-before'), 0, 'source-trim-before', true)),
    sourcePlaybackRate: parseOptionalNumber(values.get('source-playback-rate'), 1, 'source-playback-rate', false),
    trustedKeys: values.get('trusted-keys'),
    outPath: values.get('out') || path.join('out', 'oracle-drop', 'oracle-drop-props.json'),
    audioDir: values.get('audio-dir') || path.join('public', 'audio'),
  };
}

function readManifest(filePath: string): RunManifest {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RunManifest;
}

function faceFromManifest(manifest: RunManifest, taskTitle: string, summaryText: string) {
  return {
    resultCode: manifest.kane_verification?.result_code ?? null,
    taskTitle,
    summaryText,
    verdict: manifest.oracle?.verdict ?? 'hold',
    ...(manifest.oracle?.hold_reason ? { holdReason: manifest.oracle.hold_reason } : {}),
    repairOccurred: manifest.closed_loop_repair?.occurred ?? true,
    stateVerified: manifest.application?.state_verified === true,
    specSha256: manifest.oracle?.spec_sha256 ?? '',
    testedCommit: manifest.application?.tested_commit ?? '',
    signatureKeyId: manifest.signature?.key_id ?? '',
  };
}

function classify(line: string): 'command' | 'error' | 'success' | 'warn' | 'info' | 'dim' {
  if (/^\$ /.test(line) || line.startsWith('[Shoot Loop]')) return 'command';
  if (/error|fail|hold|mismatch|NOT CLEARED|❌|🚨/i.test(line)) return 'error';
  if (/warn|⚠/i.test(line)) return 'warn';
  if (/pass|release|verified|100|^✓ /i.test(line)) return 'success';
  return 'info';
}

function curateLogLines(
  filePath: string | undefined,
  label: string,
  fallback: string,
  prependCommand?: string
) {
  if (!filePath) {
    return [{ text: fallback, type: 'dim' as const }];
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required ${label} log file does not exist: ${filePath}`);
  }
  const rawLines = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .filter((line) => line.length > 0 && !DIVIDER_LINE.test(line) && !SECRET_LINE.test(line));

  if (rawLines.length === 0) {
    throw new Error(`${label} log file contains no displayable lines: ${filePath}`);
  }

  const prioritized = rawLines.filter((line) => SIGNAL_LINE.test(line));
  const pool = prioritized.length >= 4 ? prioritized : rawLines;
  const maxLines = prependCommand ? 10 : 11;
  const selected =
    pool.length <= maxLines
      ? pool
      : [...pool.slice(0, 6), ...pool.slice(-(maxLines - 6))];

  const formatted = selected.map((text) => ({
    text: text.length > 150 ? `${text.slice(0, 147)}...` : text,
    type: classify(text),
  }));

  if (prependCommand) {
    return [{ text: prependCommand.replace(/^\$\s*/, ''), type: 'command' as const }, ...formatted];
  }
  return formatted;
}

function extractHoldSummary(holdLogPath: string | undefined, hold: RunManifest): string {
  if (holdLogPath && fs.existsSync(holdLogPath)) {
    const match = fs
      .readFileSync(holdLogPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.includes('[Oracle HOLD]'));
    if (match) {
      return match.replace(/^🚨\s*/, '');
    }
  }
  return hold.oracle?.hold_reason
    ? `First evaluation (${hold.oracle.hold_reason}). Repair disabled.`
    : 'First evaluation failed. Repair disabled.';
}

function audioSeconds(filePath: string): number | null {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf8' }
    ).trim();
    const seconds = Number(out);
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

function beatFramesFor(audioDir: string): { frames: number[]; audio: Record<string, string> } {
  const stems = ['beat0a', 'beat0b', 'beat1', 'beat2', 'beat3a', 'beat3b', 'beat4a', 'beat4b'] as const;
  const files = [
    'oracle-beat-0a',
    'oracle-beat-0b',
    'oracle-beat-1',
    'oracle-beat-2',
    'oracle-beat-3a',
    'oracle-beat-3b',
    'oracle-beat-4a',
    'oracle-beat-4b',
  ];
  const frames = [...ORACLE_BEAT_FRAMES];
  const audio: Record<string, string> = {};
  stems.forEach((stem, index) => {
    const match = ['mp3', 'wav', 'm4a']
      .map((ext) => path.join(audioDir, `${files[index]}.${ext}`))
      .find((candidate) => fs.existsSync(candidate));
    if (!match) return;
    const seconds = audioSeconds(match);
    if (seconds) {
      // Reserve 6f pre-roll + 15f trailing breath + transition overlap so no stem clips or overlaps
      frames[index] = Math.max(frames[index], Math.ceil(seconds * 30) + 21 + ORACLE_TRANSITION_FRAMES);
    }
    const relative = path.relative(path.join(process.cwd(), 'public'), match);
    audio[stem] = relative.split(path.sep).join('/');
  });
  return { frames, audio };
}

function publicRelative(sourceVideo: string | undefined): string {
  if (!sourceVideo) return '';
  const absolute = path.resolve(sourceVideo);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source video does not exist: ${sourceVideo}`);
  }
  const publicDir = path.join(process.cwd(), 'public');
  const relative = path.relative(publicDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Source video must live under public/ so Remotion can load it. Got ${sourceVideo}`);
  }
  return relative.split(path.sep).join('/');
}

function deriveVerifiedApiStateLine(loadedSpec: ReturnType<typeof loadAcceptanceSpec>, release: RunManifest): string {
  if (release.application?.state_verified !== true) return '';
  if (release.oracle?.spec_sha256 !== loadedSpec.specSha256) return '';
  const apiRule = loadedSpec.spec.outcome_specs.find((item) => item.verification.type === 'api_state');
  if (!apiRule || apiRule.verification.type !== 'api_state') return '';
  return `GET ${apiRule.verification.endpoint} -> ${apiRule.verification.jsonPath}: ${JSON.stringify(apiRule.verification.expected)} (verified)`;
}

export function finalizeOracleDrop(args: FinalizeOracleDropArgs) {
  const loaded = loadAcceptanceSpec(args.specPath);
  const hold = readManifest(args.holdManifest);
  const release = readManifest(args.releaseManifest);
  const releaseCommit = (release.application?.tested_commit || '').toLowerCase();
  const holdCommit = (hold.application?.tested_commit || '').toLowerCase();

  if (!releaseCommit || !holdCommit) {
    throw new Error('Both manifests need application.tested_commit.');
  }
  if (holdCommit === releaseCommit) {
    throw new Error(
      `HOLD and RELEASE share tested_commit (${holdCommit}). Oracle Demo 2.0 requires two distinct commits (C_bug !== C_fix) under the same frozen spec.`
    );
  }
  if (hold.oracle?.spec_sha256 !== release.oracle?.spec_sha256) {
    throw new Error('Hold and release manifests were sealed against different spec hashes.');
  }
  if (hold.oracle?.spec_sha256 !== loaded.specSha256) {
    throw new Error('Manifest spec_sha256 does not match the acceptance spec file.');
  }

  const verifiedHold = verifyOracleHoldManifest(args.holdManifest, {
    expectedSpecSha256: loaded.specSha256,
    expectedCommit: holdCommit,
    trustedKeysPath: args.trustedKeys,
    trustedKeys: args.trustedKeyMap,
  });
  if (!verifiedHold.valid) {
    throw new Error(`Hold manifest failed cryptographic or invariant verification:\n${verifiedHold.errors.join('\n')}`);
  }

  const verifiedRelease = verifyOracleManifest(args.releaseManifest, {
    expectedSpecSha256: loaded.specSha256,
    expectedCommit: releaseCommit,
    trustedKeysPath: args.trustedKeys,
    trustedKeys: args.trustedKeyMap,
    allowUnisolatedBeta: true,
  });
  if (!verifiedRelease.valid) {
    throw new Error(`Release manifest failed payment gates:\n${verifiedRelease.errors.join('\n')}`);
  }

  const { frames, audio } = beatFramesFor(args.audioDir);
  const derivedApiStateLine = deriveVerifiedApiStateLine(loaded, release);
  const verifyCommand = args.verifyLog
    ? `npm run verify:oracle -- ${args.releaseManifest} --spec ${args.specPath} --commit ${releaseCommit.slice(0, 12)}... --allow-unisolated-beta`
    : undefined;

  const props = {
    beatFrames: frames,
    specSha256: loaded.specSha256,
    contractId: loaded.spec.contract_id || loaded.spec.milestone_id || '',
    hold: faceFromManifest(hold, loaded.spec.title, extractHoldSummary(args.holdLog, hold)),
    release: faceFromManifest(release, loaded.spec.title, 'Kane 100. Declared UI & API assertions verified. Repair did not run.'),
    holdTerminalLines: curateLogLines(args.holdLog, '--hold-log', 'Hold log not provided.'),
    releaseTerminalLines: curateLogLines(args.releaseLog, '--release-log', 'Release log not provided.'),
    verifyTerminalLines: curateLogLines(args.verifyLog, '--verify-log', 'Verify log not provided.', verifyCommand),
    sourceVideo: publicRelative(args.sourceVideo),
    sourcePlaybackRate: args.sourcePlaybackRate ?? 1,
    sourceTrimBefore: args.sourceTrimBefore ?? 0,
    apiStateLine: derivedApiStateLine,
    gates: ORACLE_GATE_LABELS.map((label, index) => ({
      label,
      passed: index === ORACLE_GATE_LABELS.length - 1 ? release.application?.isolation === 'container' : true,
    })),
    closingTitle: 'Autocast Oracle',
    closingSubtitle: 'Milestone decisions, backed by signed and verifiable proof.',
    repoUrl: 'github.com/nikhil-r0/autocast',
    swapAt: 0.56,
    ...(Object.keys(audio).length > 0 ? { audio } : {}),
  };

  fs.mkdirSync(path.dirname(path.resolve(args.outPath)), { recursive: true });
  fs.writeFileSync(args.outPath, `${JSON.stringify(props, null, 2)}\n`);
  return { props, holdCommit, releaseCommit, frames };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]).endsWith('finalize-oracle-drop.ts');
if (isEntrypoint) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const res = finalizeOracleDrop(args);
    console.log(`Wrote ${args.outPath}`);
    console.log(`Hold commit ${res.holdCommit}`);
    console.log(`Release commit ${res.releaseCommit}`);
    const overlap = (res.frames.length - 1) * ORACLE_TRANSITION_FRAMES;
    console.log(
      `Frames ${res.frames.join('+')} - ${overlap} (transitions) = ${res.frames.reduce((sum, value) => sum + value, 0) - overlap}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
}
