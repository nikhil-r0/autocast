# Part 2 Feature Drop Plan: Autocast Oracle Mode (~74.5s)

> **Video Title:** *Autocast v0.2 — Oracle Mode: Milestone Payouts, Gated by Signed Proof*  
> **Target Runtime:** **~74.5 seconds** (baseline `2,235` frames @ `30 FPS`, `1920x1080`, dynamically padded via `ffprobe` to match voiceover stems)  
> **Core Rule:** Zero mocked outputs, zero hardcoded manifest values. Every terminal output, Kane result, 1080p browser replay, `spec_sha256`, `tested_commit`, and Ed25519 `signature` comes directly from live `autocast --oracle` runs across two genuinely distinct commits (`C_bug` vs. `C_fix`) and cryptographically verified `run-manifest.json` artifacts.

---

## 1. Beat Sheet & Visual Direction (~74.5s Baseline · 2,235+ Frames @ 30 FPS)

### Color Grammar (Locked Across All Beats, <= 2 Visual Effects per Beat)
- **Red (`#ef4444`):** Acceptance failure (`kane_failed` / `state_mismatch`), `HOLD`, `state_verified: false`
- **Emerald (`#22c55e`):** `100` pass, `RELEASE`, `state_verified: true`, verified gates
- **Amber (`#f59e0b`):** Frozen policy constraints (`closed_loop_repair: false`, Day-1 lock)
- **Cyan (`#38bdf8`):** Cryptographic identifiers (`spec_sha256`, `tested_commit`, `key_id`, `manifest_sha256`)

| Beat | Time / Frames | Layout & Visual Source | Voiceover, Captions & Audio Cues |
|---|---|---|---|
| **Beat 1: Problem & Policy Flip** | `0:00 – 0:14` (`14s` / `420f` min) | **Remotion Split Policy Card** (`AuroraBackground` + Policy Panels: Demo `740 → auto-fix`, Oracle `Fail → HOLD`) + compact **Frozen Spec Pill** (`contract_id`, `spec_sha256`) | **Voiceover (~38 words):** *"Client says it's broken. Contractor says it works. Who's right? On Day 1, both lock one acceptance contract. In Autocast Demo Mode, failures trigger auto-repair. In Oracle Mode, failures seal a signed hold without touching code."*<br>**LowerThird Caption:** `Frozen contract · Demo repairs · Oracle seals HOLD`<br>**SFX:** `sfx-click.wav` on policy fork reveal. |
| **Beat 2: Fail-Closed `hold` on `C_bug`** | `0:14 – 0:32` (`18s` / `540f` min) | **2-Column Staggered Layout**:<br>• **Left (`width: 860`):** Filtered `TerminalCard` (6–8 key lines from `hold-terminal.log`)<br>• **Right (`width: 860`):** `OracleVerdictSlab` (live Kane/gate failure card swapping at `f280` to `ManifestBadge`: `HOLD · repair: locked off`) | **Voiceover (~40 words):** *"Against a deliberate buggy test commit, the UI claims success while storage stays Pending. The oracle catches it, refuses to touch the deliverable—zero worktrees, zero `agy` calls—and seals a signed `hold` manifest exiting code 1."*<br>**LowerThird Caption:** `Deliberate test fixture (C_bug) → zero repair → signed HOLD`<br>**SFX:** `sfx-stamp.wav` on `HOLD` seal (`f280`). |
| **Beat 3a: Signed `release` on `C_fix`** | `0:32 – 0:50` (`18s` / `540f` min) | **3D-Tilted `BrowserFrame`** playing `public/oracle-source.mp4` + **Backend State Pill** (`GET /api/invoices/INV-1042 → status: "Approved"`) + **`LowerThird`** | **Voiceover (~34 words):** *"On the fixed commit, `--oracle --commit --with-video` passes Kane 100, verifies every declared UI and `/api/invoices/INV-1042` backend assertion, and captures 1080p browser proof as optional evidence."*<br>**LowerThird Caption:** `Commit C_fix · Kane + backend state verified → signed RELEASE` |
| **Beat 3b: Oracle Verified End Card** | `0:50 – 0:54.5` (`4.5s` / `135f` min) | **`OracleEndCard`** bound to `release-manifest.json` (`verdict: RELEASE`, `spec_sha256`, `tested_commit`, `state_verified: true`, `repair: false`, `key_id`) | **Voiceover:** *"Ed25519-signed for verification."* *(snappy 4.5s stamp beat)*<br>**SFX:** `sfx-stamp.wav` on `RELEASE` seal. |
| **Beat 4a: 10-Gate Offline Verification & Publisher** | `0:54.5 – 1:08.5` (`14s` / `420f` min) | **2-Column Layout**:<br>• **Left (`width: 860`):** `TerminalCard` (`verify:oracle --allow-unisolated-beta` + `--publish stdout-json`)<br>• **Right (`width: 860`):** **10-Gate Checklist** animating gates 1–9 green and Gate 10 (`Container isolated`) honestly marked Tier B until container ships | **Voiceover (~36 words):** *"Any client verifies payment gates and the runner's Ed25519 signature completely offline—no browser or video required—while Gate ten refuses unisolated beta runs until container isolation ships."*<br>**LowerThird Caption:** `10 gates verified offline · Gate 10 blocks unisolated beta for real funds` |
| **Beat 4b: Closing Title Card** | `1:08.5 – 1:14.5` (`6s` / `180f` min) | **`TitleCard` Closing Card** (`3.5s+` clean hold): *"Autocast v0.2 — Milestone payouts, gated by signed and verifiable proof."* + `autocast --oracle` + `github.com/nikhil-r0/autocast` | **Voiceover (~11 words):** *"Autocast v0.2: milestone payouts, gated by signed and verifiable proof."* |

*Frame Budget Check:* Baseline `420 + 540 + 540 + 135 + 420 + 180 = 2,235` frames = **74.5s** @ 30 FPS. Each beat's final `durationInFrames` is computed dynamically via `Math.max(defaultFrames, Math.ceil(audioDurationSec * 30) + 15)` so no voiceover word is clipped at transition boundaries.

---

## 2. Exact Execution Runbook (Zero Faked Artifacts)

> **Prerequisite:** Commit all Remotion / script updates cleanly on `main` and verify `npm run preflight` passes before capturing the final runs (`runOraclePreflight` enforces a clean git tree).

### Step 0 — Environment & Key Setup (Run Once Before Filming)

1. Generate a runner Ed25519 keypair outside the repository (or under `.oracle-keys/`, which is gitignored via `.gitignore`):
   ```bash
   mkdir -p .oracle-keys
   openssl genpkey -algorithm ed25519 -out .oracle-keys/runner-private.pem
   openssl pkey -in .oracle-keys/runner-private.pem -pubout -out .oracle-keys/runner-public.pem
   ```
2. Build `ORACLE_TRUSTED_KEYS` JSON keyed by the SHA-256 of the SPKI DER public key (matching `computePublicKeyId` in `src/oracle/sign.ts`):
   ```bash
   node -e "
     const fs = require('fs');
     const crypto = require('crypto');
     const pubPem = fs.readFileSync('.oracle-keys/runner-public.pem', 'utf8');
     const pubKey = crypto.createPublicKey(pubPem);
     const keyId = crypto.createHash('sha256').update(pubKey.export({ type: 'spki', format: 'der' })).digest('hex');
     fs.writeFileSync('.oracle-keys/trusted-keys.json', JSON.stringify({ [keyId]: pubPem }, null, 2));
     console.log('Trusted key_id:', keyId);
   "
   ```
3. Build TypeScript, verify Kane CLI auth, and confirm a clean working tree (`runOraclePipeline` isolates commit dependencies via `npm ci --ignore-scripts --no-audit --no-fund`):
   ```bash
   npm run build
   kane-cli --version
   git status --porcelain   # Must be empty before oracle runs
   ```
4. Export oracle environment variables for the session (never print `.oracle-keys/runner-private.pem` in recorded terminal views):
   ```bash
   export ORACLE_SIGNING_KEY=".oracle-keys/runner-private.pem"
   export ORACLE_TRUSTED_KEYS=".oracle-keys/trusted-keys.json"
   export ORACLE_RUNNER_ID="autocast-demo-runner-01"
   export GEMINI_API_KEY=""   # Guarantees deterministic DEFAULT_NARRATIONS during --with-video
   ```
5. Compute the Day-1 frozen `spec_sha256` and identify two genuinely distinct 40-char git commits (`BUG_COMMIT` = `C_bug` containing a code defect on disk, `FIX_COMMIT` = `C_fix` resolving it):
   ```bash
   SPEC_PATH="examples/oracle/ledgerly-approval.json"
   SPEC_SHA256=$(node -e "import('./dist/oracle/spec.js').then(m => console.log(m.loadAcceptanceSpec('${SPEC_PATH}').specSha256))")
   BUG_COMMIT="<40-char-sha-C_bug>"
   FIX_COMMIT="$(git rev-parse HEAD)"   # or distinct 40-char C_fix SHA
   echo "SPEC_SHA256=${SPEC_SHA256}"
   echo "BUG_COMMIT=${BUG_COMMIT}"
   echo "FIX_COMMIT=${FIX_COMMIT}"
   ```

### Step 1 — Run 1: Real Fail-Closed `hold` on Buggy Commit `C_bug` (Exit `1`)

Run with `--commit "${BUG_COMMIT}"` and `--expect-spec-sha256 "${SPEC_SHA256}"`, capturing verbatim terminal output for Beat 2 (`Oracle Mode` runs `--bug-detection off` + deterministic `outcome_specs`, so `hold_reason` is `kane_failed` or `state_mismatch` and `kane_verification.result_code` comes directly from the actual run—do not hardcode `740`):
```bash
mkdir -p out/oracle-drop
RUN_ID=oracle-hold \
  node bin/autocast.js --oracle "${SPEC_PATH}" \
  --commit "${BUG_COMMIT}" \
  --expect-spec-sha256 "${SPEC_SHA256}" \
  2>&1 | tee out/oracle-drop/hold-terminal.log
HOLD_EXIT=${PIPESTATUS[0]}
echo "Hold exit code: ${HOLD_EXIT}"   # Must be 1
cp out/runs/oracle-hold/run-manifest.json out/oracle-drop/hold-manifest.json
```
*Expected sealed evidence:* `out/oracle-drop/hold-manifest.json` with `status: "failed"`, `oracle.verdict: "hold"`, `oracle.hold_reason` (`"kane_failed"` or `"state_mismatch"`), `application.environment: "runner_pinned"`, `application.tested_commit === BUG_COMMIT`, `closed_loop_repair.occurred: false`, and valid Ed25519 `signature`.

### Step 2 — Run 2: Real Signed `release` on Fixed Commit `C_fix` + 1080p Playwright Proof (Exit `0`)

Run `--commit "${FIX_COMMIT}"` with `--with-video` and `--publish stdout-json` under `RUN_ID=oracle-release`:
```bash
RUN_ID=oracle-release \
  node bin/autocast.js --oracle "${SPEC_PATH}" \
  --commit "${FIX_COMMIT}" \
  --expect-spec-sha256 "${SPEC_SHA256}" \
  --with-video \
  --publish stdout-json \
  > out/oracle-drop/release-verdict.json \
  2> out/oracle-drop/release-terminal.log
RELEASE_EXIT=$?
echo "Release exit code: ${RELEASE_EXIT}"   # Must be 0
cp out/runs/oracle-release/run-manifest.json out/oracle-drop/release-manifest.json
cp public/source.mp4 public/oracle-source.mp4   # Preserve isolated copy so demo runs never clobber Beat 3a
```
*Expected sealed evidence:*
- `out/oracle-drop/release-manifest.json`: `status: "verified"`, `oracle.verdict: "release"`, `application.environment: "runner_pinned"`, `application.tested_commit === FIX_COMMIT`, `kane_verification.result_code: 100`, `application.state_verified: true`, `closed_loop_repair.occurred: false`, `artifacts.video` + `artifacts.poster` hashed, and valid Ed25519 `signature`.
- `public/oracle-source.mp4`: genuine 1080p Playwright replay generated during Run 2.
- `out/oracle-drop/release-verdict.json`: pure `VerdictPayload` JSON (`spec_sha256`, `tested_commit`, `manifest_sha256`, `verdict: "release"`, `signature`). *(When `--publish stdout-json` is passed, `runOraclePipeline` routes human progress logs to `stderr`, keeping `stdout` clean JSON.)*

### Step 3 — Run 3: Offline 10-Gate Verification (Strict vs. Beta Inspect)

Verify the sealed release manifest completely offline (strict default exits `1` on Gate 10 for beta `isolation: "none"`; `--allow-unisolated-beta` verifies gates 1–9 cleanly for demo capture):
```bash
npm run verify:oracle -- out/oracle-drop/release-manifest.json \
  --spec "${SPEC_PATH}" \
  --commit "${FIX_COMMIT}" \
  --trusted-keys .oracle-keys/trusted-keys.json \
  --allow-unisolated-beta \
  | tee out/oracle-drop/verify-oracle.log
```
*(Optional confidence check: running `npm run verify:oracle -- out/oracle-drop/hold-manifest.json --spec "${SPEC_PATH}" --commit "${BUG_COMMIT}" ...` exits `1`, proving payment gates reject the `hold` artifact while `verifyOracleHoldManifest` accepts it.)*

### Step 4 — Bind Artifacts, Render `OracleDrop`, & Run OCR + FFprobe Audit

1. Generate voiceover audio stems (under `public/audio/oracle-beat-*.mp3`/`.wav`), then assemble props from the real sealed manifests, captured logs, and `public/oracle-source.mp4` via `scripts/finalize-oracle-drop.ts` (which refuses `holdCommit === releaseCommit`, validates `hold-manifest.json` via `verifyOracleHoldManifest`, validates `release-manifest.json` via `verifyOracleManifest`, and probes audio stems with `ffprobe` to pad `beatFrames`):
   ```bash
   npx tsx scripts/finalize-oracle-drop.ts \
     --spec "${SPEC_PATH}" \
     --hold-manifest out/oracle-drop/hold-manifest.json \
     --release-manifest out/oracle-drop/release-manifest.json \
     --hold-log out/oracle-drop/hold-terminal.log \
     --verify-log out/oracle-drop/verify-oracle.log \
     --source-video public/oracle-source.mp4 \
     --trusted-keys .oracle-keys/trusted-keys.json \
     --out out/oracle-drop/oracle-drop-props.json
   ```
2. Render the ~74.5-second Part 2 feature drop video:
   ```bash
   npx remotion render OracleDrop out/oracle-feature-drop.mp4 \
     --codec=h264 \
     --concurrency=2 \
     --props=out/oracle-drop/oracle-drop-props.json
   ```
3. Inspect video stream properties (`1920x1080`, `30 fps`, `~74.5s`), run Tesseract OCR pixel safety audit (`scanVideoPixelsForSecrets`) to prove zero `.oracle-keys/` leakage in any frame, and bake the frame-0 poster:
   ```bash
   ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,codec_name -of json out/oracle-feature-drop.mp4
   npx tsx -e "import { scanVideoPixelsForSecrets } from './src/edit/ocrScan.js'; scanVideoPixelsForSecrets('out/oracle-feature-drop.mp4').then(r => { console.log(r); if (!r.passed) process.exit(1); });"
   ```

---

## 3. Minimal Remotion / Composition Implementation Plan

To keep Part 1 (`Demo` and `AutoCastShowcase`) 100% unchanged and risk-free, apply additive extensions only:

### A. Additive Oracle Props on Existing Components (Non-Breaking)
- **`remotion/Demo.tsx` (`DemoProps`)**: Add optional `oracle?: OracleManifestOverlay` and `appUrl?: string` (displays `oracle.url` in `<BrowserFrame>` instead of hardcoding `/invoices`).
- **`remotion/components/FloatingHud.tsx` & `remotion/components/Sidebar.tsx`**: Accept optional `oracle?: { verdict: 'release' | 'hold'; resultCode: number; stateVerified: boolean; repairOccurred: boolean }`. When absent, keep exact `✓ Kane Verified` Part 1 badge; when present, render compact chips (`ORACLE: RELEASE`/`HOLD`, `KANE: 100`, `STATE_VERIFIED: true`, `REPAIR: false`).
- **`remotion/components/Outro.tsx`**: Accept optional `oracle?: OracleManifestOverlay`. When provided, render the **Oracle Verified End Card** bound to real props (`oracle.verdict`, `oracle.hold_reason`, `oracle.spec_sha256`, `tested_commit`, `result_code`, `state_verified`, `closed_loop_repair.occurred`, `signature.key_id`).
- **`remotion/components/ManifestBadge.tsx`**: Add optional `mode?: 'demo' | 'oracle'`, `verdict`, `holdReason`, `specSha256`, `repairOccurred`, and `signatureKeyId` props. When `mode === 'oracle'`, render those fields alongside `tested_commit` and `state_verified`, labeling the video SHA row `optional_video_sha256` (or `not attached (payment-decoupled)`).

### B. Dedicated `remotion/OracleDrop.tsx` Composition (~74.5s Baseline · Dynamic Voiceover Padding)
- Register `<Composition id="OracleDrop" component={OracleDrop} calculateMetadata={calculateOracleDropMetadata} width={1920} height={1080} fps={30} durationInFrames={2235} ... />` in `remotion/Root.tsx` so `calculateOracleDropMetadata` sums `props.beatFrames` dynamically.
- **Voiceover overflow guard:** `scripts/finalize-oracle-drop.ts` runs `ffprobe` on each existing `public/audio/oracle-beat-*.mp3`/`.wav` stem and computes `beatFrames[k] = Math.max(defaultFrames[k], Math.ceil(audioDurationSec * 30) + 15)` (preserving `15` frames / `0.5s` breathing room before each `KineticTransition` cut so no words clip).
- Implement Beat 3a timing cleanly: inspect `public/oracle-source.mp4` duration in `finalize-oracle-drop.ts` so `<OffthreadVideo>` speed-ramps idle typing (`1.4x–1.6x`) or trims dead lead-in frames to settle cleanly on the `APPROVED` badge within Beat 3a before cutting to Beat 3b (`135f` / `4.5s` Oracle `Outro`).
- Mount `KineticTransition` flares on scene boundaries, `sfx-click.wav` / `sfx-stamp.wav` via `<Audio>`, voiceover stems inside each `<Series.Sequence>` (when audio paths exist in props), and concise `LowerThird` captions across Beats 1, 2, 3a, and 4a.
- Props interface (`OracleDropProps`), populated exclusively by `scripts/finalize-oracle-drop.ts` from disk artifacts (`hold-manifest.json`, `release-manifest.json`, captured `.log` files, `release-verdict.json`, `public/oracle-source.mp4`, and `beatFrames` / `audioStems`).

### C. Keep `src/oracle/runner.ts` Sealing Order Untouched
- In `src/oracle/runner.ts:207-275`, `defaultCaptureOptionalVideo` renders `Demo` before `sealAndOptionallyPublish` seals `out/run-manifest.json`.
- Because `OracleDrop` consumes `public/oracle-source.mp4` directly in Beat 3a and reads `release-manifest.json` in Beat 3b, **zero changes to `src/oracle/runner.ts` are required**, preserving the tested sealing pipeline intact.

---

## 4. Pre-Flight Risks & Checks

1. **Two Distinct Commits Required (`--commit C_bug` vs. `C_fix`)**
   - Since `expected_commit` is passed via `--commit <40-char-sha>` (not hashed inside `AcceptanceSpec`), **one frozen `spec.json` (`spec_sha256` + `contract_id`)** verifies both `--commit C_bug` and `--commit C_fix` (`preparePinnedAppCheckout()` extracts historical commits via `git archive` and installs dependencies via `npm ci --ignore-scripts --no-audit --no-fund`).
   - `scripts/finalize-oracle-drop.ts` throws if `holdManifest.application.tested_commit === releaseManifest.application.tested_commit`. Single-commit `APP_BUG` toggles are rejected for Demo 2.0.
2. **Do Not Use `scripts/finalize-showcase.ts` for Oracle Drops**
   - `scripts/finalize-showcase.ts:30` and `scripts/verify-provenance.ts:28-33` require `mode: 'demo'` + `visual_qa`. Use `npm run verify:oracle` and `scripts/finalize-oracle-drop.ts` backed by `verifyOracleManifest()`.
3. **`out/run-manifest.json` Overwrite Between Run 1 and Run 2**
   - Every `autocast --oracle` run overwrites `out/run-manifest.json` while also saving `out/runs/<runId>/run-manifest.json`. Always pass distinct `RUN_ID=oracle-hold` / `RUN_ID=oracle-release` and copy each run's manifest into `out/oracle-drop/` immediately.
4. **Port `8080` Conflicts & Deterministic Seed Reset**
   - Ensure no manual `npm run app` or stray server holds port `8080` (`strictPort: true` exits `2`). `replayAndRecord` posts `/api/reset` without a body, defaulting to `'ledgerly-default-v1'` (`examples/ledgerly/server/index.js:73`).
5. **Keep Private Signing Keys Off-Screen**
   - Store keys under gitignored `.oracle-keys/` and pass a file path (`ORACLE_SIGNING_KEY=.oracle-keys/runner-private.pem`) rather than pasting PEM text in terminal commands. Confirm clean pixels with `scanVideoPixelsForSecrets('out/oracle-feature-drop.mp4')`.
