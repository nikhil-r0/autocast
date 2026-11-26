import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync, spawn } from 'child_process';
import {
  AcceptanceSpec,
  AppLifecycleAdapter,
  ApplicationEnvironment,
  ApplicationIsolation,
  KaneRunResult,
  OracleHoldReason,
  OracleVerdict,
  OutcomeSpec,
  RunManifest,
} from '../types.js';
import {
  DeliverableBuildError,
  LedgerlyLifecycleAdapter,
  RunnerInfraError,
} from '../app/lifecycle.js';
import {
  executeKaneRun,
  probeKaneCliVersion,
  SUPPORTED_ORACLE_KANE_VERSION_PATTERN,
} from '../shoot/kane.js';
import { classifyKaneRun } from '../shoot/classify.js';
import { generateRunManifest } from '../manifest.js';
import { runOraclePreflight } from '../preflight.js';
import { loadAcceptanceSpec, normalizeSha256Hex, OracleSpecError, validateCommitSha40 } from './spec.js';
import { loadOracleSigningKey, OracleSigningConfigError } from './sign.js';
import { buildVerdictPayload, PublishAdapterName, publishVerdict } from './publish.js';
import {
  findActionsLog,
  parseActionsLogToActionIR,
  replayActionIRAndVerifyOutcomes,
} from '../capture/actionIR.js';
import { replayAndRecord } from '../capture/replay.js';
import { generateNarration } from '../edit/narration.js';
import { buildStoryboard } from '../edit/storyboard.js';
import { lintStoryboard } from '../edit/lint.js';
import { writeShareCopy } from '../edit/shareCopy.js';
import { extractPosterFrame, bakePosterToFrame0, findHeroTimestamp } from '../edit/poster.js';
import { scanVideoPixelsForSecrets } from '../edit/ocrScan.js';

export interface OracleRunOptions {
  specPath: string;
  commit: string;
  expectSpecSha256?: string;
  requireExpectSpecSha256?: boolean;
  requireDeterministicUiVerification?: boolean;
  withVideo?: boolean;
  publishAdapter?: PublishAdapterName;
  agentRepairRequested?: boolean;
  runId?: string;
  outDir?: string;
  manifestOutPath?: string;
  signingKey?: string;
  runnerId?: string;
  runnerOrigin?: string;
  allowedHosts?: string;
  requireCleanTree?: boolean;
  deps?: OracleRunnerDeps;
}

export interface OracleCheckoutHandle {
  appDir: string;
  cleanup?: () => void;
  usesExternalApp?: boolean;
}

export interface OracleRunnerDeps {
  preflightFn?: typeof runOraclePreflight;
  prepareCheckoutFn?: (expectedCommit: string, runDir: string, cwd: string) => OracleCheckoutHandle;
  createAdapterFn?: (opts: { appDir?: string; port?: number; baseUrl?: string }) => AppLifecycleAdapter;
  getKaneVersionFn?: () => string;
  executeKaneRunFn?: typeof executeKaneRun;
  verifyUiOutcomesFn?: (params: {
    specs: OutcomeSpec[];
    kaneResult: KaneRunResult;
    targetUrl: string;
    apiBase: string;
    resetSeedFn: () => Promise<void>;
  }) => Promise<{ passed: boolean; failures: string[] }>;
  publishVerdictFn?: typeof publishVerdict;
  captureVideoEvidenceFn?: (params: {
    spec: AcceptanceSpec;
    kaneResult: KaneRunResult;
    outDir: string;
  }) => Promise<{ videoPath?: string; posterPath?: string }>;
}

export interface OracleRunOutcome {
  exitCode: 0 | 1 | 2 | 4;
  verdict?: OracleVerdict;
  holdReason?: OracleHoldReason;
  manifest?: RunManifest;
  manifestPath?: string;
  specSha256?: string;
  error?: string;
}

export class OracleConfigError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'OracleConfigError';
  }
}

export function validateOracleTargetUrl(
  targetUrlRaw: string,
  runnerOrigin: string = process.env.ORACLE_RUNNER_URL || 'http://localhost:8080',
  allowedHostsEnv: string | undefined = process.env.ORACLE_ALLOWED_HOSTS
): { parsedTarget: URL; parsedRunnerOrigin: URL; isRunnerManaged: boolean } {
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrlRaw);
  } catch {
    throw new OracleConfigError(`Invalid target.url: '${targetUrlRaw}'`);
  }

  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    throw new OracleConfigError(`Unsupported target.url protocol: '${parsedTarget.protocol}'`);
  }

  let parsedRunnerOrigin: URL;
  try {
    parsedRunnerOrigin = new URL(runnerOrigin);
  } catch {
    throw new OracleConfigError(`Invalid runner origin: '${runnerOrigin}'`);
  }

  const isRunnerOriginMatch = parsedTarget.origin === parsedRunnerOrigin.origin;
  const rawAllowed = (allowedHostsEnv || '').trim();

  if (!rawAllowed) {
    if (!isRunnerOriginMatch) {
      throw new OracleConfigError(
        `Target URL '${parsedTarget.origin}' is not on the runner allowlist (default: only runner-started '${parsedRunnerOrigin.origin}'). Set ORACLE_ALLOWED_HOSTS to allow external targets.`
      );
    }
    return { parsedTarget, parsedRunnerOrigin, isRunnerManaged: true };
  }

  const allowEntries = rawAllowed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const matched = allowEntries.some((entry) => {
    if (entry.includes('://')) {
      try {
        return new URL(entry).origin === parsedTarget.origin;
      } catch {
        return false;
      }
    }
    if (entry.includes(':')) {
      return entry.toLowerCase() === parsedTarget.host.toLowerCase();
    }
    return entry.toLowerCase() === parsedTarget.hostname.toLowerCase();
  });

  if (!matched && !isRunnerOriginMatch) {
    throw new OracleConfigError(
      `Target URL '${parsedTarget.origin}' rejected: not in ORACLE_ALLOWED_HOSTS (${rawAllowed}).`
    );
  }

  return { parsedTarget, parsedRunnerOrigin, isRunnerManaged: isRunnerOriginMatch };
}

export function preparePinnedAppCheckout(
  expectedCommit: string,
  runDir: string,
  cwd: string = process.cwd()
): OracleCheckoutHandle {
  // Verify the pinned commit resolves in the git object database
  try {
    execSync(`git cat-file -e ${expectedCommit}^{commit}`, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new OracleConfigError(
      `Pinned target.expected_commit '${expectedCommit}' does not exist in local git history.`
    );
  }

  const resolvedExpectedSha = execSync(`git rev-parse ${expectedCommit}^{commit}`, {
    cwd,
    encoding: 'utf-8',
  }).trim();
  const currentHeadSha = execSync('git rev-parse HEAD', {
    cwd,
    encoding: 'utf-8',
  }).trim();

  if (currentHeadSha === resolvedExpectedSha) {
    return {
      appDir: path.join(cwd, 'examples/ledgerly'),
      usesExternalApp: false,
    };
  }

  // Extract the exact historical commit into an isolated checkout directory without touching repo HEAD
  const checkoutRoot = path.join(runDir, 'checkout');
  fs.rmSync(checkoutRoot, { recursive: true, force: true });
  fs.mkdirSync(checkoutRoot, { recursive: true });

  execSync(`git archive ${resolvedExpectedSha} | tar -x -C "${checkoutRoot}"`, {
    cwd,
    shell: '/bin/bash',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const appDir = path.join(checkoutRoot, 'examples/ledgerly');
  if (!fs.existsSync(appDir)) {
    fs.rmSync(checkoutRoot, { recursive: true, force: true });
    throw new OracleConfigError(
      `Checked-out commit ${resolvedExpectedSha} does not contain examples/ledgerly.`
    );
  }

  return {
    appDir,
    usesExternalApp: false,
    cleanup: () => {
      fs.rmSync(checkoutRoot, { recursive: true, force: true });
    },
  };
}

async function defaultCaptureOptionalVideo(params: {
  spec: AcceptanceSpec;
  kaneResult: KaneRunResult;
  outDir: string;
}): Promise<{ videoPath?: string; posterPath?: string }> {
  const replayResult = await replayAndRecord(params.kaneResult.steps, params.spec.target.url, {
    sessionDir: params.kaneResult.sessionDir,
  });

  const narrations = await generateNarration(
    params.kaneResult.steps,
    params.spec.title,
    replayResult.segments.length
  );
  const storyboard = buildStoryboard(
    params.spec.title,
    replayResult,
    params.kaneResult.steps,
    narrations
  );
  const lint = lintStoryboard(storyboard);
  if (!lint.valid) {
    console.warn('[Oracle Video] Optional storyboard lint failed; omitting optional video artifact.');
    return {};
  }

  fs.mkdirSync(params.outDir, { recursive: true });
  const outputMp4 = path.join(params.outDir, 'demo.mp4');
  writeShareCopy(params.outDir, storyboard.meta.title);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['remotion', 'render', 'Demo', outputMp4, '--codec=h264', '--concurrency=2'],
      { stdio: 'inherit', env: { ...process.env } }
    );
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remotion render exited with code ${code}`));
    });
    proc.on('error', reject);
  });

  const posterPath = path.join(params.outDir, 'poster.jpg');
  try {
    const heroSec = findHeroTimestamp(storyboard);
    await extractPosterFrame(outputMp4, posterPath, heroSec);
    await bakePosterToFrame0(outputMp4, posterPath);
  } catch (err: any) {
    console.warn(`[Oracle Video] Optional poster extraction warning: ${err.message}`);
  }

  const ocr = await scanVideoPixelsForSecrets(outputMp4);
  if (!ocr.passed) {
    console.warn('[Oracle Video] OCR safety scan flagged optional video; quarantining video without affecting oracle verdict.');
    const quarantineDir = path.join(process.cwd(), '.quarantine');
    fs.mkdirSync(quarantineDir, { recursive: true });
    if (fs.existsSync(outputMp4)) {
      fs.renameSync(outputMp4, path.join(quarantineDir, `quarantined-oracle-${Date.now()}.mp4`));
    }
    if (fs.existsSync(posterPath)) {
      fs.unlinkSync(posterPath);
    }
    return {};
  }

  return {
    videoPath: fs.existsSync(outputMp4) ? outputMp4 : undefined,
    posterPath: fs.existsSync(posterPath) ? posterPath : undefined,
  };
}

export async function runOraclePipeline(options: OracleRunOptions): Promise<OracleRunOutcome> {
  const quietStdout = options.publishAdapter === 'stdout-json';
  const origConsoleLog = console.log;
  if (quietStdout) {
    console.log = (...args: unknown[]) => console.error(...args);
  }
  try {
    return await runOraclePipelineImpl(options);
  } finally {
    if (quietStdout) {
      console.log = origConsoleLog;
    }
  }
}

async function runOraclePipelineImpl(options: OracleRunOptions): Promise<OracleRunOutcome> {
  const quietStdout = options.publishAdapter === 'stdout-json';
  const log = (...args: unknown[]) => {
    if (quietStdout) {
      console.error(...args);
    } else {
      console.log(...args);
    }
  };
  const warn = (...args: unknown[]) => console.warn(...args);
  const logErr = (...args: unknown[]) => console.error(...args);

  if (options.agentRepairRequested) {
    warn('[Oracle] Warning: --agent-repair is ignored in oracle mode; repair is permanently disabled.');
  }

  if (
    options.publishAdapter &&
    options.publishAdapter !== 'stdout-json' &&
    options.publishAdapter !== 'webhook' &&
    options.publishAdapter !== 'evm'
  ) {
    const message = `Invalid --publish adapter '${options.publishAdapter}'. Expected 'stdout-json', 'webhook', or 'evm'.`;
    logErr(`❌ [Oracle] ${message}`);
    return { exitCode: 2, error: message };
  }

  // Validate signing key before doing anything else (fail closed on missing/bad key)
  try {
    loadOracleSigningKey(options.signingKey);
  } catch (err: any) {
    logErr(`❌ [Oracle] ${err.message}`);
    return { exitCode: 2, error: err.message };
  }

  // Validate delivery commit SHA before loading or executing
  let expectedCommit: string;
  try {
    expectedCommit = validateCommitSha40(options.commit, '--commit');
  } catch (err: any) {
    logErr(`❌ [Oracle] ${err.message}`);
    return { exitCode: 2, error: err.message };
  }

  // Enforce --expect-spec-sha256 before executing if strict contract hash binding is enabled
  if (options.requireExpectSpecSha256 && !options.expectSpecSha256) {
    const msg = '--expect-spec-sha256 <64-hex> is required in strict oracle payment mode.';
    logErr(`❌ [Oracle] ${msg}`);
    return { exitCode: 2, error: msg };
  }

  // Load and strictly validate frozen AcceptanceSpec
  let loadedSpec: ReturnType<typeof loadAcceptanceSpec>;
  try {
    loadedSpec = loadAcceptanceSpec(options.specPath);
  } catch (err: any) {
    logErr(`❌ [Oracle] ${err.message}`);
    return { exitCode: 2, error: err.message };
  }

  const { spec, specSha256 } = loadedSpec;
  const runId = options.runId || process.env.RUN_ID || `autocast-oracle-${Date.now()}`;
  const outDir = options.outDir || path.join(process.cwd(), 'out');
  const runDir = path.join(outDir, 'runs', runId);
  const manifestOutPath = options.manifestOutPath || path.join(outDir, 'run-manifest.json');
  const runManifestPath = path.join(runDir, 'run-manifest.json');
  const runnerId = options.runnerId || process.env.ORACLE_RUNNER_ID || os.hostname() || 'autocast-oracle-runner';

  fs.mkdirSync(runDir, { recursive: true });
  let applicationEnvironment: ApplicationEnvironment = 'external_unverified';
  const applicationIsolation: ApplicationIsolation = 'none';

  // Fail closed on untested Kane CLI versions (Oracle is pinned to tested 0.10.x format & flags)
  let kaneCliVersion: string;
  try {
    if (options.deps?.getKaneVersionFn) {
      kaneCliVersion = options.deps.getKaneVersionFn();
    } else if (!options.deps?.executeKaneRunFn) {
      kaneCliVersion = probeKaneCliVersion();
    } else {
      kaneCliVersion = '0.10.4';
    }
  } catch (err: any) {
    const msg = `Failed to probe kane-cli --version: ${err?.message || err}`;
    logErr(`❌ [Oracle] ${msg}`);
    return { exitCode: 2, specSha256, error: msg };
  }

  if (!SUPPORTED_ORACLE_KANE_VERSION_PATTERN.test(kaneCliVersion)) {
    const msg = `Unsupported kane-cli version '${kaneCliVersion}': Oracle Mode is pinned to tested 0.10.x releases.`;
    logErr(`❌ [Oracle] ${msg}`);
    return { exitCode: 2, specSha256, error: msg };
  }

  const sealAndOptionallyPublish = async (params: {
    status: RunManifest['status'];
    verdict: OracleVerdict;
    holdReason?: OracleHoldReason;
    testedCommit: string;
    stateVerified: boolean;
    kaneResult?: KaneRunResult;
    videoPath?: string;
    posterPath?: string;
  }): Promise<RunManifest> => {
    const resolvedSigningKey = options.signingKey ?? process.env.ORACLE_SIGNING_KEY;
    const signedManifest = generateRunManifest({
      outputPath: manifestOutPath,
      additionalOutputPaths: [runManifestPath],
      mode: 'oracle',
      status: params.status,
      runId,
      applicationUrl: spec.target.url,
      applicationEnvironment,
      applicationIsolation,
      baselineCommit: expectedCommit,
      testedCommit: params.testedCommit,
      stateVerified: params.stateVerified,
      kaneVerification: params.kaneResult
        ? {
            run_id: params.kaneResult.sessionDir || runId,
            kane_cli_version: kaneCliVersion,
            session_id: params.kaneResult.sessionDir,
            evidence_pack: params.kaneResult.evidencePack,
            result_code: params.kaneResult.resultCode,
            share_url: params.kaneResult.testUrl,
            test_url: params.kaneResult.testUrl,
            credits_consumed: params.kaneResult.creditsConsumed,
          }
        : undefined,
      closedLoopRepair: { occurred: false },
      oracle: {
        spec_sha256: specSha256,
        seed_id: spec.target.seed_id,
        expected_commit: expectedCommit,
        runner_id: runnerId,
        verdict: params.verdict,
        ...(params.holdReason ? { hold_reason: params.holdReason } : {}),
      },
      signingKey: resolvedSigningKey,
      videoPath: params.videoPath,
      posterPath: params.posterPath,
    });

    if (!signedManifest.signature) {
      throw new OracleSigningConfigError('Failed to sign oracle manifest before writing to disk.');
    }

    if (options.publishAdapter) {
      try {
        const publishFn = options.deps?.publishVerdictFn || publishVerdict;
        const payload = buildVerdictPayload(signedManifest, manifestOutPath, spec.milestone_id);
        await publishFn(payload, { adapter: options.publishAdapter });
      } catch (pubErr: any) {
        warn(`[Oracle Publish] Warning: verdict publishing failed (${pubErr.message}); sealed verdict unchanged.`);
      }
    }

    return signedManifest;
  };

  log('================================================================');
  log('⚖️  AUTOCAST ORACLE MODE: ACCEPTANCE PROOF RUNNER');
  log(`   Spec: "${spec.title}" (${specSha256.slice(0, 12)}...)`);
  log(`   Pinned Commit: ${expectedCommit} | Seed: ${spec.target.seed_id}`);
  log(`   Kane Pin: v${kaneCliVersion} | Isolation: ${applicationIsolation}`);
  log('   ⚠️  BETA WARNING: isolation=\'none\' (shared OS user, no container/separate signer).');
  log('       Trusted code only — DO NOT use for untrusted code or real funds.');
  log('================================================================\n');

  // Step 2: Check --expect-spec-sha256 BEFORE starting app
  if (options.expectSpecSha256) {
    let expectedHash: string;
    try {
      expectedHash = normalizeSha256Hex(options.expectSpecSha256, '--expect-spec-sha256');
    } catch (err: any) {
      logErr(`❌ [Oracle] ${err.message}`);
      return { exitCode: 2, specSha256, error: err.message };
    }

    if (expectedHash !== specSha256) {
      const msg = `Spec hash mismatch: expected '${expectedHash}', computed '${specSha256}'`;
      logErr(`❌ [Oracle] ${msg}`);
      const manifest = await sealAndOptionallyPublish({
        status: 'failed',
        verdict: 'hold',
        holdReason: 'spec_mismatch',
        testedCommit: 'not_started',
        stateVerified: false,
      });
      return {
        exitCode: 2,
        verdict: 'hold',
        holdReason: 'spec_mismatch',
        manifest,
        manifestPath: manifestOutPath,
        specSha256,
        error: msg,
      };
    }
  }

  // Step 3: Validate target URL allowlist BEFORE starting app
  const runnerOrigin = options.runnerOrigin || process.env.ORACLE_RUNNER_URL || 'http://localhost:8080';
  let urlInfo: ReturnType<typeof validateOracleTargetUrl>;
  try {
    urlInfo = validateOracleTargetUrl(spec.target.url, runnerOrigin, options.allowedHosts);
    applicationEnvironment = urlInfo.isRunnerManaged ? 'runner_pinned' : 'external_unverified';
  } catch (err: any) {
    logErr(`❌ [Oracle] ${err.message}`);
    return { exitCode: 2, specSha256, error: err.message };
  }

  const preflightFn = options.deps?.preflightFn || runOraclePreflight;
  const prepareCheckoutFn = options.deps?.prepareCheckoutFn || preparePinnedAppCheckout;
  const createAdapterFn =
    options.deps?.createAdapterFn || ((opts) => new LedgerlyLifecycleAdapter(opts));
  const executeKaneRunFn = options.deps?.executeKaneRunFn || executeKaneRun;

  let checkoutHandle: OracleCheckoutHandle | undefined;
  let adapter: AppLifecycleAdapter | undefined;
  let startedLocalServer = false;

  try {
    const port = urlInfo.parsedTarget.port
      ? parseInt(urlInfo.parsedTarget.port, 10)
      : urlInfo.parsedTarget.protocol === 'https:'
      ? 443
      : 80;

    if (urlInfo.isRunnerManaged) {
      preflightFn({ requireCleanTree: options.requireCleanTree ?? true });
      checkoutHandle = prepareCheckoutFn(expectedCommit, runDir, process.cwd());
      adapter = createAdapterFn({
        appDir: checkoutHandle.appDir,
        port,
        baseUrl: urlInfo.parsedTarget.origin,
      });

      const resolvedCommitEnv =
        process.env.APP_COMMIT ||
        (() => {
          try {
            return execSync(`git rev-parse ${expectedCommit}^{commit}`, {
              encoding: 'utf-8',
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
          } catch {
            return expectedCommit;
          }
        })();

      if (adapter instanceof LedgerlyLifecycleAdapter) {
        await adapter.start({
          commit: resolvedCommitEnv,
          strictPort: true,
          requireHealthyCommitMatch: false,
          buildDistIfMissing: true,
          scrubEnv: true,
          allowNodeModulesSymlink: false,
        });
      } else {
        await adapter.start({ commit: resolvedCommitEnv });
      }
      startedLocalServer = true;
    } else {
      adapter = createAdapterFn({
        port,
        baseUrl: urlInfo.parsedTarget.origin,
      });
    }

    // Verify health & served commit
    const healthInfo = adapter.getHealthInfo ? await adapter.getHealthInfo() : null;
    const healthy = await adapter.healthCheck(expectedCommit);
    const testedCommit = healthInfo?.commit || (healthy ? expectedCommit : 'unknown');

    if (!healthy || testedCommit.toLowerCase() !== expectedCommit.toLowerCase()) {
      const msg = `Commit mismatch or unhealthy target: expected '${expectedCommit}', served '${testedCommit}'`;
      logErr(`❌ [Oracle HOLD] ${msg}`);
      const manifest = await sealAndOptionallyPublish({
        status: 'failed',
        verdict: 'hold',
        holdReason: 'commit_mismatch',
        testedCommit,
        stateVerified: false,
      });
      return {
        exitCode: 1,
        verdict: 'hold',
        holdReason: 'commit_mismatch',
        manifest,
        manifestPath: manifestOutPath,
        specSha256,
        error: msg,
      };
    }

    // Reset deterministic seed data
    await adapter.resetSeedData(spec.target.seed_id);

    // Single-shot Kane execution with verbatim spec.objective (NO Gemini, NO retries, NO agy)
    log('\n--- ORACLE VERIFICATION: KANE EXECUTION (FAIL-CLOSED) ---');
    log(`Verbatim Objective: "${spec.objective}"`);

    const kaneResult = await executeKaneRunFn({
      objective: spec.objective,
      url: spec.target.url,
      name: runId,
      bugDetection: 'off',
      scrubOracleSecrets: true,
    });

    const classification = classifyKaneRun(kaneResult);

    if (classification.type === 'cli_configuration_error') {
      logErr(`❌ [Oracle] Kane CLI configuration error: ${classification.message}`);
      return {
        exitCode: 2,
        specSha256,
        error: classification.message,
      };
    }

    if (classification.type === 'timeout' || classification.type === 'cancelled') {
      logErr(`⏱️ [Oracle INCONCLUSIVE] Kane execution ${classification.type}: ${classification.message}`);
      const manifest = await sealAndOptionallyPublish({
        status: 'failed',
        verdict: 'inconclusive',
        holdReason: 'timeout',
        testedCommit,
        stateVerified: false,
        kaneResult,
      });
      return {
        exitCode: 4,
        verdict: 'inconclusive',
        holdReason: 'timeout',
        manifest,
        manifestPath: manifestOutPath,
        specSha256,
        error: classification.message,
      };
    }

    if (classification.type !== 'pass') {
      logErr(`🚨 [Oracle HOLD] Kane failed (${classification.type}, code=${kaneResult.resultCode ?? 'none'}): ${classification.message}`);
      const manifest = await sealAndOptionallyPublish({
        status: 'failed',
        verdict: 'hold',
        holdReason: 'kane_failed',
        testedCommit,
        stateVerified: false,
        kaneResult,
      });
      return {
        exitCode: 1,
        verdict: 'hold',
        holdReason: 'kane_failed',
        manifest,
        manifestPath: manifestOutPath,
        specSha256,
        error: classification.message,
      };
    }

    // Backend truth verification against api_state outcome_specs
    const apiStateVerified = await adapter.verifyUnderlyingState(spec.outcome_specs);
    if (!apiStateVerified) {
      const msg = 'Backend state verification failed against api_state outcome_specs';
      logErr(`🚨 [Oracle HOLD] ${msg}`);
      const manifest = await sealAndOptionallyPublish({
        status: 'failed',
        verdict: 'hold',
        holdReason: 'state_mismatch',
        testedCommit,
        stateVerified: false,
        kaneResult,
      });
      return {
        exitCode: 1,
        verdict: 'hold',
        holdReason: 'state_mismatch',
        manifest,
        manifestPath: manifestOutPath,
        specSha256,
        error: msg,
      };
    }

    // Deterministic browser verification for dom_text / visible / url outcome_specs
    const uiSpecs = spec.outcome_specs.filter((s) => s.verification.type !== 'api_state');
    if (uiSpecs.length > 0) {
      let uiOutcomeResult: { passed: boolean; failures: string[] } | null = null;
      const resetFn = () => adapter!.resetSeedData(spec.target.seed_id);

      if (options.deps?.verifyUiOutcomesFn) {
        uiOutcomeResult = await options.deps.verifyUiOutcomesFn({
          specs: spec.outcome_specs,
          kaneResult,
          targetUrl: spec.target.url,
          apiBase: urlInfo.parsedTarget.origin,
          resetSeedFn: resetFn,
        });
      } else {
        const actionsLogPath = kaneResult.sessionDir
          ? findActionsLog(kaneResult.sessionDir, kaneResult.evidencePack)
          : null;
        if (actionsLogPath && fs.existsSync(actionsLogPath)) {
          const actionIR = parseActionsLogToActionIR(fs.readFileSync(actionsLogPath, 'utf-8'), {
            fallbackUrl: spec.target.url,
          });
          uiOutcomeResult = await replayActionIRAndVerifyOutcomes(
            actionIR,
            spec.target.url,
            spec.outcome_specs,
            urlInfo.parsedTarget.origin,
            resetFn
          );
        } else if (options.requireDeterministicUiVerification !== false) {
          const msg =
            'Deterministic UI verification inconclusive: Kane session produced no actions.ndjson trace to replay declared DOM/visibility/URL outcome_specs.';
          logErr(`⏱️ [Oracle INCONCLUSIVE] ${msg}`);
          const manifest = await sealAndOptionallyPublish({
            status: 'failed',
            verdict: 'inconclusive',
            holdReason: 'missing_trace',
            testedCommit,
            stateVerified: false,
            kaneResult,
          });
          return {
            exitCode: 4,
            verdict: 'inconclusive',
            holdReason: 'missing_trace',
            manifest,
            manifestPath: manifestOutPath,
            specSha256,
            error: msg,
          };
        }
      }

      if (uiOutcomeResult && !uiOutcomeResult.passed) {
        const msg = `Deterministic UI outcome verification failed: ${uiOutcomeResult.failures.join('; ')}`;
        logErr(`🚨 [Oracle HOLD] ${msg}`);
        const manifest = await sealAndOptionallyPublish({
          status: 'failed',
          verdict: 'hold',
          holdReason: 'state_mismatch',
          testedCommit,
          stateVerified: false,
          kaneResult,
        });
        return {
          exitCode: 1,
          verdict: 'hold',
          holdReason: 'state_mismatch',
          manifest,
          manifestPath: manifestOutPath,
          specSha256,
          error: msg,
        };
      }
    }

    // Optional cinematic capture/render if --with-video was requested (never gates payment)
    let videoPath: string | undefined;
    let posterPath: string | undefined;
    if (options.withVideo) {
      try {
        const videoFn = options.deps?.captureVideoEvidenceFn || defaultCaptureOptionalVideo;
        const artifacts = await videoFn({ spec, kaneResult, outDir });
        videoPath = artifacts.videoPath;
        posterPath = artifacts.posterPath;
      } catch (videoErr: any) {
        warn(`[Oracle Video] Optional video capture/render failed (${videoErr.message}); proceeding with release manifest.`);
      }
    }

    const manifest = await sealAndOptionallyPublish({
      status: 'verified',
      verdict: 'release',
      testedCommit,
      stateVerified: true,
      kaneResult,
      videoPath,
      posterPath,
    });

    log('\n================================================================');
    log('🎉 ORACLE VERDICT: RELEASE');
    log(`   Spec SHA-256:  ${specSha256}`);
    log(`   Tested Commit: ${testedCommit}`);
    log(`   Manifest:      ${manifestOutPath}`);
    log('================================================================');

    return {
      exitCode: 0,
      verdict: 'release',
      manifest,
      manifestPath: manifestOutPath,
      specSha256,
    };
  } catch (err: any) {
    if (err instanceof OracleConfigError || err instanceof OracleSpecError || err instanceof OracleSigningConfigError) {
      logErr(`❌ [Oracle] ${err.message}`);
      return { exitCode: 2, specSha256, error: err.message };
    }
    if (err instanceof DeliverableBuildError) {
      logErr(`🚨 [Oracle HOLD] ${err.message}`);
      try {
        const manifest = await sealAndOptionallyPublish({
          status: 'failed',
          verdict: 'hold',
          holdReason: 'build_failed',
          testedCommit: expectedCommit,
          stateVerified: false,
        });
        return {
          exitCode: 1,
          verdict: 'hold',
          holdReason: 'build_failed',
          manifest,
          manifestPath: manifestOutPath,
          specSha256,
          error: err.message,
        };
      } catch {
        return { exitCode: 2, specSha256, error: err.message };
      }
    }
    if (err instanceof RunnerInfraError) {
      logErr(`⏱️ [Oracle INCONCLUSIVE] ${err.message}`);
      try {
        const manifest = await sealAndOptionallyPublish({
          status: 'failed',
          verdict: 'inconclusive',
          holdReason: 'runner_error',
          testedCommit: expectedCommit,
          stateVerified: false,
        });
        return {
          exitCode: 4,
          verdict: 'inconclusive',
          holdReason: 'runner_error',
          manifest,
          manifestPath: manifestOutPath,
          specSha256,
          error: err.message,
        };
      } catch {
        return { exitCode: 2, specSha256, error: err.message };
      }
    }
    logErr(`❌ [Oracle] Environment/execution error: ${err.message}`);
    return { exitCode: 2, specSha256, error: err.message };
  } finally {
    if (startedLocalServer && adapter) {
      try {
        await adapter.stop();
      } catch {}
    }
    if (checkoutHandle?.cleanup) {
      try {
        checkoutHandle.cleanup();
      } catch {}
    }
  }
}

export interface OraclePolicyRunResult {
  outcome: OracleRunOutcome;
  attempts: number;
  escalatedToArbitration: boolean;
  history: Array<{ attempt: number; exitCode: number; verdict?: OracleVerdict; holdReason?: OracleHoldReason }>;
}

/**
 * Enforces the inconclusive retry & arbitration escalation policy:
 * runs single-shot verification and retries only on `verdict === 'inconclusive'`
 * up to `maxInconclusiveRetries` (default 2 -> max 3 total runs) before escalating
 * to arbitration.
 */
export async function runOracleWithInconclusivePolicy(
  options: OracleRunOptions & { maxInconclusiveRetries?: number },
  runFn: (opts: OracleRunOptions) => Promise<OracleRunOutcome> = runOraclePipeline
): Promise<OraclePolicyRunResult> {
  const maxRetries = Math.max(0, Math.min(2, options.maxInconclusiveRetries ?? 2));
  const history: OraclePolicyRunResult['history'] = [];
  const baseRunId = options.runId || process.env.RUN_ID || `autocast-oracle-${Date.now()}`;

  let lastOutcome: OracleRunOutcome = { exitCode: 2, error: 'Oracle did not execute' };
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const attemptRunId = attempt === 1 ? baseRunId : `${baseRunId}-retry-${attempt - 1}`;
    lastOutcome = await runFn({
      ...options,
      runId: attemptRunId,
    });
    history.push({
      attempt,
      exitCode: lastOutcome.exitCode,
      verdict: lastOutcome.verdict,
      holdReason: lastOutcome.holdReason,
    });

    if (lastOutcome.verdict !== 'inconclusive') {
      return {
        outcome: lastOutcome,
        attempts: attempt,
        escalatedToArbitration: false,
        history,
      };
    }
  }

  return {
    outcome: lastOutcome,
    attempts: history.length,
    escalatedToArbitration: true,
    history,
  };
}
