import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

interface RunManifest {
  autocast_version: string;
  run_id?: string;
  generated_at: string;
  status: string;
  application: {
    url: string;
    baseline_commit: string;
    tested_commit: string;
    integration_commit?: string;
    state_verified: boolean;
  };
  kane_verification?: {
    run_id: string;
    result_code: number;
    credits_consumed?: number;
    claims?: Array<{ id: string; claim: string; passed: boolean }>;
  };
  visual_qa?: {
    status: string;
    attempts?: number;
  };
  security_scan?: {
    status: string;
    ocr_frames_scanned?: number;
  };
  artifacts?: {
    video?: {
      path: string;
      sha256: string;
      size_bytes?: number;
    };
    poster?: {
      path: string;
      sha256: string;
    };
  };
}

async function generatePublicEvidence() {
  console.log('================================================================');
  console.log('📦 AUTOCAST PUBLIC EVIDENCE GENERATOR');
  console.log('   "Sanitizing and populating docs/catches/catch-ledgerly-approval"');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const outDir = path.join(rootDir, 'out');
  const catchDir = path.join(rootDir, 'docs', 'catches', 'catch-ledgerly-approval');

  if (!fs.existsSync(catchDir)) {
    fs.mkdirSync(catchDir, { recursive: true });
  }

  // 1. Mandatory Manifest for the Current Run (No fallback to sample output)
  const manifestPath = path.join(outDir, 'run-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Current run manifest missing at ${manifestPath}. Run 'npm run demo' first.`);
  }

  console.log(`[Evidence] Reading run manifest from: ${manifestPath}`);
  const manifest: RunManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  if (!manifest.run_id) {
    throw new Error('Run manifest is missing mandatory run_id. Every genuine run must be stamped with a unique run_id.');
  }

  if (!manifest.application?.tested_commit) {
    throw new Error('Manifest missing application.tested_commit. Cannot identify candidate repair commit.');
  }

  const runId = manifest.run_id;
  const testedCommit = manifest.application.tested_commit;
  const baselineCommit = manifest.application.baseline_commit || 'HEAD~1';

  // 2. Extract Genuine Git Diff for the Repair (No fallback to older catchDir/patch.diff)
  let diffContent = '';
  try {
    diffContent = execSync(
      `git diff ${baselineCommit}..${testedCommit} -- examples/ledgerly/server/index.js 2>/dev/null || true`,
      { encoding: 'utf-8' }
    ).trim();

    if (!diffContent) {
      diffContent = execSync(
        `git show ${testedCommit} -- examples/ledgerly/server/index.js 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).trim();
    }
  } catch {}

  if (!diffContent) {
    throw new Error(
      `No genuine git diff found on examples/ledgerly/server/index.js for candidate commit ${testedCommit}. Halting: AutoCast does not fabricate code diffs.`
    );
  }

  // Write patch.diff
  const patchPath = path.join(catchDir, 'patch.diff');
  fs.writeFileSync(patchPath, diffContent + '\n', 'utf-8');
  console.log(`[Evidence] ✓ Wrote genuine repair patch -> ${patchPath}`);

  // 3. Genuine failure-summary.json - Strictly from the current run
  const runSpecificFailurePath = path.join(outDir, 'runs', runId, 'initial-failure-summary.json');
  const initialFailurePath = path.join(outDir, 'initial-failure-summary.json');

  let failureSummary: any = null;
  if (fs.existsSync(runSpecificFailurePath)) {
    failureSummary = JSON.parse(fs.readFileSync(runSpecificFailurePath, 'utf-8'));
  } else if (fs.existsSync(initialFailurePath)) {
    failureSummary = JSON.parse(fs.readFileSync(initialFailurePath, 'utf-8'));
  } else {
    throw new Error(`Current run failure evidence missing at ${runSpecificFailurePath}. Halting: cannot fabricate defect evidence.`);
  }

  // Enforce exact run_id matching - never permit an old summary without matching run_id
  if (!failureSummary.run_id || failureSummary.run_id !== runId) {
    throw new Error(
      `Failure evidence run_id mismatch! Failure artifact has run_id '${failureSummary.run_id}', but manifest has '${runId}'. Contaminated execution rejected.`
    );
  }

  const failureResultCode = failureSummary.result_code || failureSummary.verdict?.result_code;
  if (!failureSummary.verdict || failureResultCode !== 740) {
    throw new Error(`Failure evidence is not a confirmed Kane product bug (result_code: ${failureResultCode}). Expected 740.`);
  }
  failureSummary.result_code = failureResultCode;

  const failurePath = path.join(catchDir, 'failure-summary.json');
  fs.writeFileSync(failurePath, JSON.stringify(failureSummary, null, 2) + '\n', 'utf-8');
  console.log(`[Evidence] ✓ Wrote genuine failure summary -> ${failurePath}`);

  // 4. Genuine success-summary.json
  if (manifest.application?.state_verified !== true) {
    throw new Error('Underlying application state verification failed (state_verified !== true). Halting: cannot claim success.');
  }

  if (!manifest.kane_verification || manifest.kane_verification.result_code !== 100) {
    throw new Error(`Kane verification failed or missing in run manifest (result_code: ${manifest.kane_verification?.result_code}). Expected 100.`);
  }

  if (!manifest.kane_verification.claims || manifest.kane_verification.claims.length === 0) {
    throw new Error('No verified Kane claims found in manifest. Halting: cannot claim success without verified claims.');
  }

  const successSummary = {
    run_id: runId,
    result_code: manifest.kane_verification.result_code,
    status: 'passed',
    steps_verified: manifest.kane_verification.claims.length,
    claims: manifest.kane_verification.claims,
    underlying_state_verified: true,
  };

  const successPath = path.join(catchDir, 'success-summary.json');
  fs.writeFileSync(successPath, JSON.stringify(successSummary, null, 2) + '\n', 'utf-8');
  console.log(`[Evidence] ✓ Wrote genuine success summary -> ${successPath}`);

  // 5. Copy run-manifest.json
  const manifestOutPath = path.join(catchDir, 'run-manifest.json');
  fs.writeFileSync(manifestOutPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`[Evidence] ✓ Wrote run-manifest -> ${manifestOutPath}`);

  // 6. Execute Unit Regression Tests & Capture Actual Evidence
  console.log('[Evidence] Executing unit regression suite to record verified test count...');
  let testOut = '';
  try {
    testOut = execSync('npm test 2>&1', { encoding: 'utf-8' });
  } catch (err: any) {
    throw new Error(`Unit tests failed during evidence generation: ${err.message}\n${err.stdout || ''}`);
  }

  const passMatch = testOut.match(/ℹ pass (\d+)/);
  const totalMatch = testOut.match(/ℹ tests (\d+)/);
  const failMatch = testOut.match(/ℹ fail (\d+)/);

  if (!passMatch || !totalMatch) {
    throw new Error('Failed to parse test execution metrics from test runner output.');
  }

  const passedTests = parseInt(passMatch[1], 10);
  const totalTests = parseInt(totalMatch[1], 10);
  const failedTests = failMatch ? parseInt(failMatch[1], 10) : 0;

  if (failedTests > 0 || passedTests !== totalTests || passedTests === 0) {
    throw new Error(
      `Test suite has failing or incomplete tests (${passedTests}/${totalTests} passed, ${failedTests} failed). Release aborted.`
    );
  }

  console.log(`[Evidence] ✓ Verified unit regression results: ${passedTests}/${totalTests} passed (0 failures)`);

  // Archive execution test report
  const testReportPath = path.join(catchDir, 'test-report.txt');
  fs.writeFileSync(testReportPath, testOut, 'utf-8');

  // Also archive in run directory
  const runReportPath = path.join(outDir, 'runs', runId, 'test-report.txt');
  fs.mkdirSync(path.dirname(runReportPath), { recursive: true });
  fs.writeFileSync(runReportPath, testOut, 'utf-8');

  // 7. Generate README.md
  const readmeContent = `# Kane CLI Assurance Evidence: Ledgerly Invoice Approval Defect & Autonomous Repair

This directory contains the machine-verifiable evidence artifacts for AutoCast's closed-loop repair of Ledgerly.

## 1. Failure Evidence (Kane Run 1)
- **Result Code**: \`${failureSummary.result_code} · Confirmed product bug\`
- **Defect Trigger**: \`APP_BUG=approve-noop\` on \`examples/ledgerly/server/index.js\`
- **Failing Step**: ${failureSummary.step}
- **Failure Summary**: [\`failure-summary.json\`](./failure-summary.json)
- **Visual Evidence**: ![Failure Screenshot](./failing-screenshot.jpg)

## 2. Autonomous Repair by Antigravity AI
- **Isolated Worktree**: \`.worktrees/repair-*\`
- **Target File**: \`examples/ledgerly/server/index.js\`
- **Guardrails**: \`tests/**\` enforced read-only. ${passedTests}/${totalTests} unit regression tests passed (\`npm test\`).
- **Test Report**: [\`test-report.txt\`](./test-report.txt)
- **Git Patch**: [\`patch.diff\`](./patch.diff)

## 3. Independent Verification (Kane Run 2)
- **Result Code**: \`${manifest.kane_verification.result_code} · Passed\` (${successSummary.steps_verified}/${successSummary.steps_verified} steps verified)
- **Underlying Database State**: \`invoice.status === 'Approved'\` verified independently via backend API.
- **Success Summary**: [\`success-summary.json\`](./success-summary.json)
- **Visual Evidence**: ![Passing Screenshot](./passing-screenshot.jpg)

## 4. Hash-Verified Provenance Manifest
- **Manifest File**: [\`run-manifest.json\`](./run-manifest.json)
- **Run ID**: \`${runId}\`
- **Verified Commit**: \`${testedCommit}\`
- **Verification ID**: \`${manifest.kane_verification.run_id}\`
`;

  const readmePath = path.join(catchDir, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf-8');
  console.log(`[Evidence] ✓ Wrote evidence README -> ${readmePath}`);

  console.log('\n================================================================');
  console.log('✓ PUBLIC EVIDENCE SUITE REGENERATED AND READY FOR COMMIT');
  console.log('================================================================');
}

generatePublicEvidence().catch((err) => {
  console.error('[Evidence] Error:', err.message || err);
  process.exit(1);
});
